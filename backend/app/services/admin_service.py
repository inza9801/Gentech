from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.repositories import admin_repo
from app.schemas.admin import (
    CategoryCreate,
    CategoryUpdate,
    CouponCreate,
    CouponUpdate,
    OrderStatusUpdate,
    ProductCreate,
    ProductUpdate,
)

ALLOWED_COLLECTIONS = {
    "processors",
    "motherboards",
    "rams",
    "ssds",
    "graphics_cards",
    "power_supplies",
    "casings",
    "monitors",
    "ups",
    "keyboards",
    "mice",
    "laptops",
}


def now_utc():
    return datetime.now(timezone.utc)


def serialize(value):
    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, list):
        return [serialize(item) for item in value]

    if isinstance(value, dict):
        return {
            key: serialize(item)
            for key, item in value.items()
            if key != "passwordHash"
        }

    return value


async def _get_category(db, slug: str):
    category = await admin_repo.get_category(db, slug)
    if category is None:
        raise HTTPException(404, "Category not found")

    if category.get("collection") not in ALLOWED_COLLECTIONS:
        raise HTTPException(400, "Category has an invalid product collection")

    return category


def _clean_product_fields(data: dict, creating: bool = False):
    forbidden = {"_id", "createdAt", "updatedAt", "passwordHash"}
    if forbidden.intersection(data):
        raise HTTPException(400, "Protected fields cannot be supplied")

    if creating and not {"name", "price"}.issubset(data):
        raise HTTPException(422, "Product name and price are required")

    if "price" in data and data["price"] < 0:
        raise HTTPException(422, "Price cannot be negative")

    if "discount" in data and not 0 <= data["discount"] <= 100:
        raise HTTPException(422, "Discount must be between 0 and 100")

    if "availability" in data and data["availability"] < 0:
        raise HTTPException(422, "Stock cannot be negative")

    return data


async def list_categories(db):
    return serialize(await admin_repo.list_categories(db))


async def create_category(db, payload: CategoryCreate):
    if payload.collection not in ALLOWED_COLLECTIONS:
        raise HTTPException(400, "Unsupported product collection")

    slug = payload.slug.strip().lower()
    name = payload.name.strip()
    if await admin_repo.find_category_conflict(db, slug, name):
        raise HTTPException(
            409,
            "A category with this name or slug already exists",
        )

    timestamp = now_utc()
    category = await admin_repo.insert_category(
        db,
        {
            "name": name,
            "slug": slug,
            "collection": payload.collection,
            "createdAt": timestamp,
            "updatedAt": timestamp,
        },
    )
    return serialize(category)


async def update_category(db, slug: str, payload: CategoryUpdate):
    category = await admin_repo.get_category(db, slug)
    if category is None:
        raise HTTPException(404, "Category not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(400, "No changes supplied")

    if changes.get("name") is not None:
        changes["name"] = changes["name"].strip()
        duplicate = await admin_repo.find_category_name_conflict(
            db,
            changes["name"],
            category["_id"],
        )
        if duplicate:
            raise HTTPException(409, "Another category already has this name")

    changes["updatedAt"] = now_utc()
    return serialize(
        await admin_repo.update_category(db, category["_id"], changes)
    )


async def delete_category(db, slug: str):
    category = await _get_category(db, slug)
    collection = category["collection"]
    if await admin_repo.count_category_products(db, collection) > 0:
        raise HTTPException(
            409,
            "This category's product collection is not empty. "
            "Move or remove its products before deleting the category.",
        )

    await admin_repo.delete_category(db, category["_id"])
    return {"message": "Category deleted"}


async def list_products(db, slug: str, skip: int, limit: int):
    category = await _get_category(db, slug)
    products = await admin_repo.list_products(
        db,
        category["collection"],
        skip,
        limit,
    )
    return serialize(products)


async def create_product(db, slug: str, payload: ProductCreate):
    category = await _get_category(db, slug)
    data = _clean_product_fields(payload.model_dump(exclude_unset=True), True)

    sku = data.get("sku")
    if sku and await admin_repo.find_product_by_sku(
        db,
        category["collection"],
        sku,
    ):
        raise HTTPException(409, "SKU already exists in this category")

    timestamp = now_utc()
    data.update(
        category=slug,
        createdAt=timestamp,
        updatedAt=timestamp,
    )
    try:
        product = await admin_repo.insert_product(
            db,
            category["collection"],
            data,
        )
    except DuplicateKeyError:
        raise HTTPException(409, "SKU already exists in this category")
    return serialize(product)


async def get_product(db, slug: str, product_id: str):
    category = await _get_category(db, slug)
    if not ObjectId.is_valid(product_id):
        raise HTTPException(400, "Invalid product ID")

    product = await admin_repo.get_product(
        db,
        category["collection"],
        ObjectId(product_id),
    )
    if product is None:
        raise HTTPException(404, "Product not found")
    return serialize(product)


async def update_product(
    db,
    slug: str,
    product_id: str,
    payload: ProductUpdate,
):
    category = await _get_category(db, slug)
    if not ObjectId.is_valid(product_id):
        raise HTTPException(400, "Invalid product ID")

    object_id = ObjectId(product_id)
    product = await admin_repo.get_product(
        db,
        category["collection"],
        object_id,
    )
    if product is None:
        raise HTTPException(404, "Product not found")

    changes = _clean_product_fields(payload.model_dump(exclude_unset=True))
    if not changes:
        raise HTTPException(400, "No changes supplied")

    sku = changes.get("sku")
    if sku and await admin_repo.find_product_by_sku(
        db,
        category["collection"],
        sku,
        exclude_id=object_id,
    ):
        raise HTTPException(409, "SKU already exists")

    changes["updatedAt"] = now_utc()
    try:
        updated = await admin_repo.update_product(
            db,
            category["collection"],
            object_id,
            changes,
        )
    except DuplicateKeyError:
        raise HTTPException(409, "SKU already exists")
    return serialize(updated)


async def delete_product(db, slug: str, product_id: str):
    category = await _get_category(db, slug)
    if not ObjectId.is_valid(product_id):
        raise HTTPException(400, "Invalid product ID")

    deleted = await admin_repo.delete_product(
        db,
        category["collection"],
        ObjectId(product_id),
    )
    if not deleted:
        raise HTTPException(404, "Product not found")
    return {"message": "Product deleted"}


async def list_orders(db, status: str | None, skip: int, limit: int):
    query = {}
    if status:
        allowed_statuses = {
            "pending",
            "placed",
            "accepted",
            "cancelled",
            "delivered",
        }
        if status not in allowed_statuses:
            raise HTTPException(400, "Invalid order status")
        query["status"] = status
    return serialize(await admin_repo.list_orders(db, query, skip, limit))


async def get_order(db, order_id: str):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(400, "Invalid order ID")

    order = await admin_repo.get_order(db, ObjectId(order_id))
    if order is None:
        raise HTTPException(404, "Order not found")
    return serialize(order)


async def update_order_status(
    db,
    order_id: str,
    payload: OrderStatusUpdate,
    admin: dict,
):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(400, "Invalid order ID")

    object_id = ObjectId(order_id)
    order = await admin_repo.get_order(db, object_id)
    if order is None:
        raise HTTPException(404, "Order not found")

    current = order.get("status", "pending")
    target = payload.status
    allowed_transitions = {
        "pending": {"accepted", "cancelled"},
        "placed": {"accepted", "cancelled"},
        "accepted": {"delivered", "cancelled"},
        "delivered": set(),
        "cancelled": set(),
    }
    if target not in allowed_transitions.get(current, set()):
        raise HTTPException(
            409,
            f"Cannot change order status from '{current}' to '{target}'",
        )

    timestamp = now_utc()
    event = {
        "status": target,
        "changedAt": timestamp,
        "changedBy": str(admin["_id"]),
    }
    if payload.reason:
        event["reason"] = payload.reason

    fields = {"status": target, "updatedAt": timestamp}
    if target == "accepted":
        fields["acceptedAt"] = timestamp
    elif target == "cancelled":
        fields["cancelledAt"] = timestamp
        if payload.reason:
            fields["cancelReason"] = payload.reason
    elif target == "delivered":
        fields["deliveredAt"] = timestamp

    updated = await admin_repo.update_order_status(
        db,
        object_id,
        current,
        {"$set": fields, "$push": {"statusHistory": event}},
    )
    if updated is None:
        raise HTTPException(
            409,
            "Order status changed concurrently; reload and try again",
        )
    return serialize(updated)


async def list_coupons(db):
    return serialize(await admin_repo.list_coupons(db))


async def create_coupon(db, payload: CouponCreate):
    if payload.discountType == "percentage" and payload.discountValue > 100:
        raise HTTPException(422, "Percentage discount cannot exceed 100")

    coupon = payload.model_dump()
    coupon["code"] = payload.code.strip().upper()
    coupon["usedCount"] = 0
    timestamp = now_utc()
    coupon["createdAt"] = timestamp
    coupon["updatedAt"] = timestamp
    try:
        coupon = await admin_repo.insert_coupon(db, coupon)
    except DuplicateKeyError:
        raise HTTPException(409, "Coupon code already exists")
    return serialize(coupon)


async def update_coupon(db, coupon_id: str, payload: CouponUpdate):
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(400, "Invalid coupon ID")

    object_id = ObjectId(coupon_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(400, "No changes supplied")

    current = await admin_repo.get_coupon(db, object_id)
    if current is None:
        raise HTTPException(404, "Coupon not found")

    discount_type = changes.get("discountType", current.get("discountType"))
    discount_value = changes.get("discountValue", current.get("discountValue"))
    if discount_type == "percentage" and discount_value > 100:
        raise HTTPException(422, "Percentage discount cannot exceed 100")

    changes["updatedAt"] = now_utc()
    try:
        updated = await admin_repo.update_coupon(db, object_id, changes)
    except DuplicateKeyError:
        raise HTTPException(409, "Coupon code already exists")
    return serialize(updated)


async def delete_coupon(db, coupon_id: str):
    if not ObjectId.is_valid(coupon_id):
        raise HTTPException(400, "Invalid coupon ID")

    deleted = await admin_repo.delete_coupon(db, ObjectId(coupon_id))
    if not deleted:
        raise HTTPException(404, "Coupon not found")
    return {"message": "Coupon deleted"}
