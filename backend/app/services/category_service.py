import asyncio
from fastapi import HTTPException
from app.repositories import category_repo, product_repo
from app.schemas.category import CategoryWithBrands
from app.schemas.product import ProductCard
from app.services.product_service import to_card

async def get_categories(db):
    return await category_repo.get_all_categories(db)

async def get_sidebar_categories(db) -> list[CategoryWithBrands]:
    categories = await category_repo.get_all_categories(db)

    brand_lists = await asyncio.gather(
        *(
            product_repo.get_unique_brands(
                db,
                category["collection"],
            )
            for category in categories
        )
    )

    return [
        CategoryWithBrands(
            **category,
            brands=brands,
        )
        for category, brands in zip(categories, brand_lists)
    ]
    
async def get_category_brands(db, slug: str):
    categories = await category_repo.get_all_categories(db)

    category = next(
        (item for item in categories if item["slug"] == slug),
        None,
    )

    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    brands = await product_repo.get_unique_brands(
        db,
        category["collection"],
    )

    return {
        "category": category["name"],
        "slug": category["slug"],
        "brands": brands,
    }


async def get_category_brand_products(
    db,
    slug: str,
    brand: str,
    limit: int = 20,
) -> list[ProductCard]:
    categories = await category_repo.get_all_categories(db)

    category = next(
        (item for item in categories if item["slug"] == slug),
        None,
    )

    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")

    brands = await product_repo.get_unique_brands(
        db,
        category["collection"],
    )

    matched_brand = next(
        (item for item in brands if item.casefold() == brand.casefold()),
        None,
    )

    if matched_brand is None:
        raise HTTPException(status_code=404, detail="Brand not found in this category")

    documents = await product_repo.get_products_by_brand(
        db,
        category["collection"],
        matched_brand,
        limit,
    )

    return [
        to_card(document, category)
        for document in documents
    ]