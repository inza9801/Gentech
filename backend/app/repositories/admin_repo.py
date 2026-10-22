from bson import ObjectId


async def list_categories(db):
    return await db["products"].find().sort("name", 1).to_list(length=500)


async def get_category(db, slug: str):
    return await db["products"].find_one({"slug": slug})


async def find_category_conflict(db, slug: str, name: str, exclude_id=None):
    query = {"$or": [{"slug": slug}, {"name": name}]}
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    return await db["products"].find_one(query)


async def find_category_name_conflict(db, name: str, exclude_id):
    return await db["products"].find_one(
        {
            "name": name,
            "_id": {"$ne": exclude_id},
        }
    )


async def insert_category(db, category: dict):
    result = await db["products"].insert_one(category)
    category["_id"] = result.inserted_id
    return category


async def update_category(db, category_id, changes: dict):
    await db["products"].update_one(
        {"_id": category_id},
        {"$set": changes},
    )
    return await db["products"].find_one({"_id": category_id})


async def delete_category(db, category_id):
    await db["products"].delete_one({"_id": category_id})


async def count_category_products(db, collection: str) -> int:
    return await db[collection].count_documents({})


async def list_products(db, collection: str, skip: int, limit: int):
    return await (
        db[collection]
        .find()
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )


async def get_product(db, collection: str, product_id):
    return await db[collection].find_one({"_id": product_id})


async def find_product_by_sku(
    db,
    collection: str,
    sku: str,
    exclude_id=None,
):
    query = {"sku": sku}
    if exclude_id is not None:
        query["_id"] = {"$ne": exclude_id}
    return await db[collection].find_one(query)


async def insert_product(db, collection: str, product: dict):
    result = await db[collection].insert_one(product)
    product["_id"] = result.inserted_id
    return product


async def update_product(db, collection: str, product_id, changes: dict):
    await db[collection].update_one(
        {"_id": product_id},
        {"$set": changes},
    )
    return await get_product(db, collection, product_id)


async def delete_product(db, collection: str, product_id) -> int:
    result = await db[collection].delete_one({"_id": product_id})
    return result.deleted_count


async def list_orders(db, query: dict, skip: int, limit: int):
    return await (
        db["orders"]
        .find(query)
        .sort("createdAt", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )


async def get_order(db, order_id: ObjectId):
    return await db["orders"].find_one({"_id": order_id})


async def update_order_status(
    db,
    order_id: ObjectId,
    current_status: str,
    update: dict,
    delivery_processing: bool = False,
):
    query = {"_id": order_id, "status": current_status}
    if delivery_processing:
        query["deliveryInventoryStatus"] = "processing"
    elif current_status == "accepted":
        query["deliveryInventoryStatus"] = {"$ne": "processing"}
    result = await db["orders"].update_one(
        query,
        update,
    )
    if result.modified_count != 1:
        return None
    return await get_order(db, order_id)


async def list_coupons(db):
    return await db["coupons"].find().sort("code", 1).to_list(length=500)


async def insert_coupon(db, coupon: dict):
    result = await db["coupons"].insert_one(coupon)
    coupon["_id"] = result.inserted_id
    return coupon


async def get_coupon(db, coupon_id: ObjectId):
    return await db["coupons"].find_one({"_id": coupon_id})


async def update_coupon(db, coupon_id: ObjectId, changes: dict):
    await db["coupons"].update_one(
        {"_id": coupon_id},
        {"$set": changes},
    )
    return await get_coupon(db, coupon_id)


async def delete_coupon(db, coupon_id: ObjectId) -> int:
    result = await db["coupons"].delete_one({"_id": coupon_id})
    return result.deleted_count
