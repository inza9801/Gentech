from fastapi import APIRouter, Depends, Query

from app.core.database import get_db
from app.schemas.category import Category, CategoryWithBrands
from app.services import category_service

router = APIRouter(
    prefix="/api",
    tags=["Categories"],
)


@router.get("/categories", response_model=list[Category])
async def list_categories(db=Depends(get_db)):
    return await category_service.get_categories(db)


@router.get(
    "/categories/sidebar",
    response_model=list[CategoryWithBrands],
)
async def sidebar_categories(db=Depends(get_db)):
    return await category_service.get_sidebar_categories(db)

@router.get("/categories/{slug}/brands")
async def category_brands(
    slug: str,
    db=Depends(get_db),
):
    return await category_service.get_category_brands(db, slug)


@router.get("/categories/{slug}/brands/{brand}/products")
async def category_brand_products(
    slug: str,
    brand: str,
    limit: int = Query(default=20, ge=1, le=100),
    db=Depends(get_db),
):
    return await category_service.get_category_brand_products(
        db,
        slug,
        brand,
        limit,
    )