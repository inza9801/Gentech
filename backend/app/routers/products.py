from fastapi import APIRouter, Depends, Query,HTTPException

from app.core.database import get_db
from app.schemas.product import ProductCard, ProductDetail
from app.services import product_service
from app.repositories import category_repo, product_repo
from app.services.product_service import to_card

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

@router.get("/category/{slug}/filter", response_model=list[ProductCard])
async def filter_products(
    slug: str,
    brand: str | None = None,
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    in_stock: bool | None = None,
    cores: int | None = Query(default=None, ge=1),
    threads: int | None = Query(default=None, ge=1),
    capacityGB: int | None = Query(default=None, ge=1),
    speedMHz: int | None = Query(default=None, ge=1),
    vramGB: int | None = Query(default=None, ge=1),
    refreshRate: int | None = Query(default=None, ge=1),
    resolution: str | None = None,
    socket: str | None = None,
    series: str | None = None,
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

    # Only supplied filters are applied.
    supplied = {
        key: value
        for key, value in {
            "cores": cores,
            "threads": threads,
            "capacityGB": capacityGB,
            "speedMHz": speedMHz,
            "vramGB": vramGB,
            "refreshRate": refreshRate,
            "resolution": resolution,
            "socket": socket,
            "series": series,
        }.items()
        if value is not None
    }

    documents = await product_repo.filter_category_products(
        db,
        category["collection"],
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        filters=supplied,
        limit=limit,
    )

    return [to_card(doc, category) for doc in documents]

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