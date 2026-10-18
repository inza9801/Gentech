from datetime import datetime
import re

from bson import ObjectId
from app.services.product_filters import FILTER_CONFIG
LATEST_SORT = [("createdAt", -1)]
BEST_SORT = [
    ("soldCount", -1),
    ("reviewCount", -1),
    ("rating", -1),
]


async def find_in_stock(db, collection_name, sort, limit):
    cursor = (
        db[collection_name]
        .find({"availability": {"$gt": 0}})
        .sort(sort)
        .limit(limit)
    )

    return await cursor.to_list(length=limit)


async def get_product_collections(db):
    cursor = db["products"].find(
        {},
        {
            "name": 1,
            "slug": 1,
            "collection": 1
        }
    )

    categories = await cursor.to_list(length=None)

    return [
        category
        for category in categories
        if category.get("collection")
        and category.get("collection") != "products"
    ]


def prepare_product(product, category):
    product["id"] = str(product.pop("_id"))

    product["category"] = {
        "name": category["name"],
        "slug": category["slug"]
    }

    return product


def created_at_key(product):
    created_at = product.get("createdAt")

    if isinstance(created_at, datetime):
        return created_at.timestamp()

    return 0


async def get_latest_products(db, limit=10):
    categories = await get_product_collections(db)

    all_products = []

    for category in categories:
        collection_name = category["collection"]

        cursor = (
            db[collection_name]
            .find()
            .sort("createdAt", -1)
            .limit(limit)
        )

        products = await cursor.to_list(length=limit)

        for product in products:
            all_products.append(
                prepare_product(product, category)
            )

    all_products.sort(
        key=created_at_key,
        reverse=True
    )

    return all_products[:limit]


async def get_best_seller_products(db, limit=10):
    categories = await get_product_collections(db)

    all_products = []

    for category in categories:
        collection_name = category["collection"]

        cursor = (
            db[collection_name]
            .find()
            .sort([
                ("soldCount", -1),
                ("reviewCount", -1),
                ("rating", -1)
            ])
            .limit(limit)
        )

        products = await cursor.to_list(length=limit)

        for product in products:
            all_products.append(
                prepare_product(product, category)
            )

    all_products.sort(
        key=lambda product: (
            product.get("soldCount", 0) or 0,
            product.get("reviewCount", 0) or 0,
            product.get("rating", 0) or 0,
            created_at_key(product)
        ),
        reverse=True
    )

    return all_products[:limit]

async def get_unique_brands(db, collection_name: str) -> list[str]:
    brands = await db[collection_name].distinct(
        "brand",
        {
            "brand": {
                "$type": "string",
                "$ne": "",
            }
        },
    )

    # Remove empty values and duplicate names.
    unique_brands = {}

    for brand in brands:
        if isinstance(brand, str) and brand.strip():
            clean_brand = brand.strip()
            unique_brands.setdefault(clean_brand.casefold(), clean_brand)

    return sorted(unique_brands.values(), key=str.casefold)

async def get_products_by_brand(
    db,
    collection_name: str,
    brand: str,
    limit: int = 20,
):
    # Match the selected brand without case sensitivity.
    pattern = f"^{re.escape(brand)}$"

    cursor = (
        db[collection_name]
        .find({"brand": {"$regex": pattern, "$options": "i"}})
        .sort("createdAt", -1)
        .limit(limit)
    )

    return await cursor.to_list(length=limit)


async def get_product_by_id(db, product_id: str):
    if not ObjectId.is_valid(product_id):
        return None

    object_id = ObjectId(product_id)

    categories = await get_product_collections(db)

    for category in categories:
        product = await db[category["collection"]].find_one(
            {"_id": object_id}
        )

        if product is not None:
            return product, category

    return None

async def filter_category_products(
    db,
    collection_name: str,
    brand: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    in_stock: bool | None = None,
    filters: dict | None = None,
    limit: int = 20,
):
    query = {}

    if brand:
        query["brand"] = {
            "$regex": f"^{re.escape(brand)}$",
            "$options": "i",
        }

    if min_price is not None or max_price is not None:
        query["price"] = {}

        if min_price is not None:
            query["price"]["$gte"] = min_price

        if max_price is not None:
            query["price"]["$lte"] = max_price

    if in_stock is True:
        query["availability"] = {"$gt": 0}
    elif in_stock is False:
        query["availability"] = {"$lte": 0}

    config = FILTER_CONFIG.get(collection_name, {})

    for name, value in (filters or {}).items():
        definition = config.get(name)

        # Ignore unsupported filter names.
        if definition is None:
            continue

        field = definition["field"]

        if definition["type"] == "number":
            if isinstance(value, dict):
                condition = {}

                if "min" in value:
                    condition["$gte"] = float(value["min"])

                if "max" in value:
                    condition["$lte"] = float(value["max"])

                if condition:
                    query[field] = condition
            else:
                query[field] = float(value)

        elif definition["type"] == "text":
            if isinstance(value, list):
                query[field] = {"$in": value}
            else:
                query[field] = {
                    "$regex": f"^{re.escape(str(value))}$",
                    "$options": "i",
                }

    cursor = (
        db[collection_name]
        .find(query)
        .sort("createdAt", -1)
        .limit(limit)
    )

    return await cursor.to_list(length=limit)

async def search_products(db, search_text: str, limit: int = 10):
    categories = await get_product_collections(db)
    pattern = re.escape(search_text.strip())

    results = []

    for category in categories:
        cursor = (
            db[category["collection"]]
            .find({
                "$or": [
                    {"name": {"$regex": pattern, "$options": "i"}},
                    {"brand": {"$regex": pattern, "$options": "i"}},
                    {"sku": {"$regex": pattern, "$options": "i"}},
                ]
            })
            .sort("createdAt", -1)
            .limit(limit)
        )

        documents = await cursor.to_list(length=limit)

        for document in documents:
            results.append((document, category))

    results.sort(
        key=lambda pair: (
            pair[0].get("name", "").casefold().find(search_text.casefold()) != 0,
            pair[0].get("name", "").casefold(),
        )
    )

    return [
        (document, category)
        for document, category in results[:limit]
    ]