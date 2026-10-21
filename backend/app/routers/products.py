import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.database import get_db
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

    # Keep the original scalar query parameters working for existing clients.
    for key in FILTER_CONFIG.get(category["collection"], {}):
        value = request.query_params.get(key)
        if value is not None and key not in supplied:
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

@router.get("/{product_id}", response_model=ProductDetail)
async def product_details(
    product_id: str,
    db=Depends(get_db),
):
    return await product_service.get_product_details(db, product_id)