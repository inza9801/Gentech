import json
import math
from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pymongo.errors import DuplicateKeyError

from app.core.database import get_db
from app.core.security import get_optional_current_user, require_customer
from app.schemas.commerce import ProductReviewInput
from app.schemas.product import ProductCard, ProductDetail
from app.services import product_service
from app.repositories import category_repo, product_repo
from app.services.product_service import to_card
from app.services.product_filters import FILTER_CONFIG

router = APIRouter(
    prefix="/api/products",
    tags=["Products"]
)


@router.get("/latest", response_model=list[ProductCard])
async def latest_products(
    limit: int = Query(default=10, ge=1, le=40),
    db=Depends(get_db)
):
    return await product_service.get_latest_products(db, limit)


@router.get("/best-sellers", response_model=list[ProductCard])
async def best_seller_products(
    limit: int = Query(default=10, ge=1, le=40),
    db=Depends(get_db)
):
    return await product_service.get_best_seller_products(db, limit)


@router.get("/offers", response_model=list[ProductCard])
async def offered_products(
    limit: int = Query(default=100, ge=1, le=200),
    category: str | None = None,
    db=Depends(get_db),
):
    categories = await category_repo.get_all_categories(db)
    matched = next(
        (item for item in categories if item["slug"] == category),
        None,
    ) if category else None
    if category and matched is None:
        raise HTTPException(status_code=404, detail="Category not found")

    results = await product_repo.get_offered_products(
        db,
        limit,
        category_slug=matched["slug"] if matched else None,
    )
    return [to_card(document, product_category) for document, product_category in results]


@router.get("/category/{slug}/filter", response_model=list[ProductCard])
async def filter_products(
    request: Request,
    slug: str,
    brand: str | None = None,
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    in_stock: bool | None = None,
    filters: str | None = None,
    sort: Literal["newest", "best"] = "newest",
    limit: int = Query(default=20, ge=1, le=100),
    db=Depends(get_db),
):
    categories = await category_repo.get_all_categories(db)

    category = next(
        (item for item in categories if item["slug"] == slug),
        None,
    )

    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    supplied = {}
    if filters:
        try:
            parsed_filters = json.loads(filters)
        except json.JSONDecodeError as error:
            raise HTTPException(status_code=422, detail="Filters must be valid JSON") from error
        if not isinstance(parsed_filters, dict):
            raise HTTPException(status_code=422, detail="Filters must be a JSON object")
        supported = FILTER_CONFIG.get(category["collection"], {})
        unknown = set(parsed_filters) - set(supported)
        if unknown:
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported filters: {', '.join(sorted(unknown))}",
            )
        supplied = parsed_filters
        filter_config = FILTER_CONFIG.get(category["collection"], {})
        for key, value in supplied.items():
            definition = filter_config[key]
            if definition["type"] == "text":
                values = value if isinstance(value, list) else [value]
                if not values or any(not isinstance(item, str) or not item.strip() for item in values):
                    raise HTTPException(
                        status_code=422,
                        detail=f"Filter {key} must contain non-empty text values",
                    )
                supplied[key] = [item.strip() for item in values]
                continue

            bounds = value if isinstance(value, dict) else {"min": value, "max": value}
            if not bounds or set(bounds) - {"min", "max"}:
                raise HTTPException(
                    status_code=422,
                    detail=f"Filter {key} must contain numeric min/max bounds",
                )
            for bound, bound_value in bounds.items():
                if (
                    isinstance(bound_value, bool)
                    or not isinstance(bound_value, (int, float))
                    or not math.isfinite(bound_value)
                ):
                    raise HTTPException(
                        status_code=422,
                        detail=f"Filter {key} {bound} must be a finite number",
                    )
            if (
                "min" in bounds
                and "max" in bounds
                and bounds["min"] > bounds["max"]
            ):
                raise HTTPException(
                    status_code=422,
                    detail=f"Filter {key} minimum cannot exceed its maximum",
                )

    # Keep the original scalar query parameters working for existing clients.
    for key in FILTER_CONFIG.get(category["collection"], {}):
        value = request.query_params.get(key)
        if value is not None and key not in supplied:
            definition = FILTER_CONFIG[category["collection"]][key]
            if definition["type"] == "number":
                try:
                    supplied[key] = float(value)
                except ValueError as error:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Filter {key} must be a number",
                    ) from error
            else:
                supplied[key] = value

    documents = await product_repo.filter_category_products(
        db,
        category["collection"],
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        filters=supplied,
        sort_by=sort,
        limit=limit,
    )

    return [to_card(doc, category) for doc in documents]


@router.get("/category/{slug}/filter-options")
async def category_filter_options(
    slug: str,
    db=Depends(get_db),
):
    categories = await category_repo.get_all_categories(db)
    category = next((item for item in categories if item["slug"] == slug), None)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    return await product_repo.get_category_filter_options(
        db,
        category["collection"],
    )

@router.get("/search", response_model=list[ProductCard])
async def search_products(
    q: str = Query(min_length=2, max_length=100),
    limit: int = Query(default=10, ge=1, le=30),
    db=Depends(get_db),
):
    results = await product_repo.search_products(db, q, limit)

    return [
        product_service.to_card(document, category)
        for document, category in results
    ]

@router.get("/{product_id}/reviews")
async def get_product_reviews(
    product_id: str,
    category_slug: str = Query(alias="categorySlug"),
    customer=Depends(get_optional_current_user),
    db=Depends(get_db),
):
    result = await product_repo.get_product_by_id(db, product_id)
    if result is None or result[1]["slug"] != category_slug:
        raise HTTPException(status_code=404, detail="Product not found")

    query = {"productId": product_id, "categorySlug": category_slug}
    reviews = await (
        db.reviews.find(query)
        .sort("updatedAt", -1)
        .limit(100)
        .to_list(length=100)
    )
    summary = await db.reviews.aggregate([
        {"$match": query},
        {
            "$group": {
                "_id": None,
                "reviewCount": {"$sum": 1},
                "ratingCount": {
                    "$sum": {"$cond": [{"$ne": ["$rating", None]}, 1, 0]}
                },
                "averageRating": {"$avg": "$rating"},
            }
        },
    ]).to_list(length=1)
    own_review = None
    if customer:
        own_review = await db.reviews.find_one(
            {**query, "customerId": customer["_id"]}
        )

    def serialize(review):
        return {
            "id": str(review["_id"]),
            "customerName": review["customerName"],
            "rating": review.get("rating"),
            "text": review.get("text"),
            "createdAt": review["createdAt"].isoformat(),
            "updatedAt": review["updatedAt"].isoformat(),
        }

    stats = summary[0] if summary else {}
    has_saved_reviews = stats.get("reviewCount", 0) > 0
    return {
        "reviews": [serialize(review) for review in reviews],
        "reviewCount": (
            stats.get("reviewCount", 0)
            if has_saved_reviews
            else result[0].get("reviewCount", 0)
        ),
        "ratingCount": (
            stats.get("ratingCount", 0)
            if has_saved_reviews
            else result[0].get("ratingCount", result[0].get("reviewCount", 0))
        ),
        "averageRating": round(
            (stats.get("averageRating") or 0)
            if has_saved_reviews
            else (result[0].get("rating", 0) or 0),
            1,
        ),
        "myReview": serialize(own_review) if own_review else None,
    }


@router.put("/{product_id}/reviews")
async def upsert_product_review(
    product_id: str,
    body: ProductReviewInput,
    category_slug: str = Query(alias="categorySlug"),
    customer=Depends(require_customer),
    db=Depends(get_db),
):
    result = await product_repo.get_product_by_id(db, product_id)
    if result is None or result[1]["slug"] != category_slug:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.now(timezone.utc)
    query = {
        "productId": product_id,
        "categorySlug": category_slug,
        "customerId": customer["_id"],
    }
    changes = {
        "rating": body.rating,
        "text": body.text,
        "customerName": customer["name"],
        "updatedAt": now,
    }
    try:
        await db.reviews.update_one(
            query,
            {
                "$set": changes,
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )
    except DuplicateKeyError:
        await db.reviews.update_one(query, {"$set": changes})

    stats = await db.reviews.aggregate([
        {"$match": {"productId": product_id, "categorySlug": category_slug}},
        {
            "$group": {
                "_id": None,
                "reviewCount": {"$sum": 1},
                "ratingCount": {
                    "$sum": {"$cond": [{"$ne": ["$rating", None]}, 1, 0]}
                },
                "averageRating": {"$avg": "$rating"},
            }
        },
    ]).to_list(length=1)
    summary = stats[0] if stats else {}
    await db[result[1]["collection"]].update_one(
        {"_id": ObjectId(product_id)},
        {
            "$set": {
                "rating": round(summary.get("averageRating") or 0, 1),
                "ratingCount": summary.get("ratingCount", 0),
                "reviewCount": summary.get("reviewCount", 0),
            }
        },
    )
    review = await db.reviews.find_one(query)
    return {
        "id": str(review["_id"]),
        "customerName": review["customerName"],
        "rating": review.get("rating"),
        "text": review.get("text"),
        "createdAt": review["createdAt"].isoformat(),
        "updatedAt": review["updatedAt"].isoformat(),
    }

@router.get("/{product_id}", response_model=ProductDetail)
async def product_details(
    product_id: str,
    db=Depends(get_db),
):
    return await product_service.get_product_details(db, product_id)