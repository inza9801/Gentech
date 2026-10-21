import asyncio
from datetime import datetime
from fastapi import HTTPException
from app.repositories import category_repo, product_repo
from app.schemas.product import CategoryRef, ProductCard

def _created_at(doc: dict) -> datetime:
    """
    Get createdAt from the document.
    Fall back to the MongoDB ObjectId timestamp.
    """
    created_at = doc.get("createdAt")

    if created_at is not None:
        return created_at

    return doc["_id"].generation_time.replace(tzinfo=None)


def _latest_key(doc: dict) -> tuple[datetime, str]:
    """
    Sorting key for newest products.
    """
    return _created_at(doc), str(doc["_id"])


def _best_key(doc: dict) -> tuple[int, int, float]:
    """
    Sorting key for best-selling products.
    """
    return (
        doc.get("soldCount", 0) or 0,
        doc.get("reviewCount", 0) or 0,
        doc.get("rating", 0) or 0,
    )


def to_card(
    doc: dict,
    category: dict,
) -> ProductCard:
    """
    Convert a MongoDB product document into a ProductCard.
    """

    price = int(doc.get("price", 0))
    discount = int(doc.get("discount", 0) or 0)
    stock = int(doc.get("availability", 0) or 0)

    images = doc.get("images") or []
    features = doc.get("features") or []

    return ProductCard(
        id=str(doc["_id"]),
        sku=doc.get("sku"),
        name=doc["name"],
        brand=doc.get("brand"),

        category=CategoryRef(
            name=category["name"],
            slug=category["slug"],
        ),

        color=doc.get("color"),

        price=price,
        discount=discount,

        finalPrice=round(
            price * (1 - discount / 100)
        ),

        hasDiscount=discount > 0,

        rating=float(
            doc.get("rating", 0) or 0
        ),

        reviewCount=int(
            doc.get("reviewCount", 0) or 0
        ),
        soldCount=int(
            doc.get("soldCount", 0) or 0
        ),

        availability=stock,
        inStock=stock > 0,
        lowStock=0 < stock <= 5,

        image=images[0] if images else None,
        highlights=features[:3],
        images=images,
        features=features,

        createdAt=doc.get("createdAt"),
    )


async def _merged_top(
    db,
    categories: list[dict],
    sort: list[tuple[str, int]],
    key,
    limit: int,
) -> list[ProductCard]:
    """
    Fetch products from every category,
    merge them, sort globally, and return the top results.
    """

    batches = await asyncio.gather(
        *(
            product_repo.find_in_stock(
                db,
                category["collection"],
                sort,
                limit,
            )
            for category in categories
        )
    )

    pairs = [
        (doc, category)
        for category, docs in zip(categories, batches)
        for doc in docs
    ]

    pairs.sort(
        key=lambda pair: key(pair[0]),
        reverse=True,
    )

    return [
        to_card(doc, category)
        for doc, category in pairs[:limit]
    ]


async def get_latest_products(
    db,
    limit: int,
) -> list[ProductCard]:
    """
    Return the newest in-stock products across all categories.
    """

    categories = await category_repo.get_all_categories(db)

    return await _merged_top(
        db,
        categories,
        product_repo.LATEST_SORT,
        _latest_key,
        limit,
    )


async def get_best_seller_products(
    db,
    limit: int,
) -> list[ProductCard]:
    """
    Return the best-ranked in-stock products across all categories.
    """

    categories = await category_repo.get_all_categories(db)

    return await _merged_top(
        db,
        categories,
        product_repo.BEST_SORT,
        _best_key,
        limit,
    )
    
async def get_product_details(db, product_id: str):
    result = await product_repo.get_product_by_id(db, product_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    document, category = result

    # Keep the original product fields.
    details = {
        key: value
        for key, value in document.items()
        if key != "_id"
    }

    # Add the API fields calculated by your existing converter.
    details.update(to_card(document, category).model_dump())

    return details