import bcrypt

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    get_current_user as authenticated_user,
    require_customer as current_customer,
)
from app.schemas.commerce import (
    CustomerRegister,
    CustomerLogin,
    CustomerProfileUpdate,
    CartItemInput,
    CheckoutInput,
)

router = APIRouter(prefix="/api", tags=["Commerce"])

SECRET = settings.jwt_secret
ALGORITHM = settings.jwt_algorithm
TOKEN_MINUTES = settings.jwt_expire_minutes


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def create_token(customer_id: str) -> str:
    if not SECRET:
        raise RuntimeError("JWT_SECRET is not configured")

    now = datetime.now(timezone.utc)

    return jwt.encode(
        {
            "sub": customer_id,
            "iat": now,
            "exp": now + timedelta(minutes=TOKEN_MINUTES),
        },
        SECRET,
        algorithm=ALGORITHM,
    )


async def find_product(db, category_slug: str, product_id: str):
    category = await db.products.find_one({"slug": category_slug})

    if not category or not ObjectId.is_valid(product_id):
        return None, None

    document = await db[category["collection"]].find_one({
        "_id": ObjectId(product_id)
    })

    return document, category


@router.post("/customers/register", status_code=201)
async def register_customer(
    body: CustomerRegister,
    db=Depends(get_db),
):
    customer = {
        "name": body.name.strip(),
        "phone": body.phone.strip(),
        "email": str(body.email).lower(),
        "passwordHash": hash_password(body.password),
        "role": "customer",
        "active": True,
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc),
    }

    try:
        result = await db.customers.insert_one(customer)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Email or phone number already registered",
        )

    return {
        "id": str(result.inserted_id),
        "name": customer["name"],
        "email": customer["email"],
    }


@router.post("/customers/login")
async def login_customer(
    body: CustomerLogin,
    db=Depends(get_db),
):
    customer = await db.customers.find_one({
        "email": str(body.email).lower()
    })

    if (
        customer is None
        or not customer.get("active", False)
        or not verify_password(
            body.password,
            customer["passwordHash"],
        )
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "access_token": create_token(str(customer["_id"])),
        "token_type": "bearer",
        "customer": {
            "id": str(customer["_id"]),
            "name": customer["name"],
            "phone": customer["phone"],
            "email": customer["email"],
            "role": customer.get("role", "customer"),
        },
    }


@router.get("/customers/me")
async def get_my_profile(
    customer=Depends(authenticated_user),
):
    return {
        "id": str(customer["_id"]),
        "name": customer["name"],
        "phone": customer["phone"],
        "email": customer["email"],
        "role": customer.get("role", "customer"),
    }


@router.patch("/customers/me")
async def update_my_profile(
    body: CustomerProfileUpdate,
    customer=Depends(authenticated_user),
    db=Depends(get_db),
):
    changes = body.model_dump(exclude_unset=True)
    changes = {
        key: value.strip()
        for key, value in changes.items()
        if value is not None
    }
    if not changes:
        raise HTTPException(status_code=400, detail="No profile changes supplied")

    changes["updatedAt"] = datetime.now(timezone.utc)
    await db.customers.update_one(
        {"_id": customer["_id"]},
        {"$set": changes},
    )
    return {
        "id": str(customer["_id"]),
        "name": changes.get("name", customer["name"]),
        "phone": changes.get("phone", customer["phone"]),
        "email": customer["email"],
        "role": customer.get("role", "customer"),
    }


@router.get("/cart")
async def get_cart(
    customer=Depends(current_customer),
    db=Depends(get_db),
):
    cart = await db.carts.find_one({
        "customerId": customer["_id"]
    })

    if cart is None:
        return {"items": []}

    cart["_id"] = str(cart["_id"])
    cart["customerId"] = str(cart["customerId"])
    return cart


@router.post("/cart/items")
async def add_cart_item(
    body: CartItemInput,
    customer=Depends(current_customer),
    db=Depends(get_db),
):
    product, category = await find_product(
        db,
        body.categorySlug,
        body.productId,
    )

    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.get("availability", 0) < body.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    cart = await db.carts.find_one({
        "customerId": customer["_id"]
    })

    items = cart.get("items", []) if cart else []

    found = False

    for item in items:
        if (
            item["productId"] == body.productId
            and item["categorySlug"] == body.categorySlug
        ):
            new_quantity = item["quantity"] + body.quantity

            if new_quantity > product.get("availability", 0):
                raise HTTPException(
                    status_code=400,
                    detail="Requested quantity exceeds stock",
                )

            item["quantity"] = new_quantity
            found = True
            break

    if not found:
        items.append({
            "categorySlug": body.categorySlug,
            "productId": body.productId,
            "quantity": body.quantity,
        })

    await db.carts.update_one(
        {"customerId": customer["_id"]},
        {
            "$set": {
                "items": items,
                "updatedAt": datetime.now(timezone.utc),
            },
            "$setOnInsert": {
                "customerId": customer["_id"],
                "createdAt": datetime.now(timezone.utc),
            },
        },
        upsert=True,
    )

    return {"message": "Cart updated", "items": items}


@router.delete("/cart/items/{product_id}")
async def remove_cart_item(
    product_id: str,
    categorySlug: str,
    customer=Depends(current_customer),
    db=Depends(get_db),
):
    result = await db.carts.update_one(
        {"customerId": customer["_id"]},
        {
            "$pull": {
                "items": {
                    "productId": product_id,
                    "categorySlug": categorySlug,
                }
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cart not found")

    return {"message": "Item removed"}


@router.get("/locations/districts")
async def get_districts(db=Depends(get_db)):
    return await db.locations.distinct(
        "district",
        {"active": True},
    )


@router.get("/locations/areas")
async def get_areas(
    district: str,
    db=Depends(get_db),
):
    return await db.locations.distinct(
        "area",
        {"district": district, "active": True},
    )


@router.post("/coupons/validate")
async def validate_coupon(
    code: str,
    subtotal: int = 0,
    customer=Depends(current_customer),
    db=Depends(get_db),
):
    coupon = await db.coupons.find_one({
        "code": code.strip().upper(),
        "active": True,
    })

    if coupon is None:
        raise HTTPException(status_code=404, detail="Invalid coupon")

    now = datetime.now(timezone.utc)
    starts = coupon.get("startsAt")
    expires = coupon.get("expiresAt")

    # Normalize BSON datetimes before comparing with UTC.
    if starts and starts.tzinfo is None:
        starts = starts.replace(tzinfo=timezone.utc)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if starts and now < starts:
        raise HTTPException(status_code=400, detail="Coupon not active yet")

    if expires and now > expires:
        raise HTTPException(status_code=400, detail="Coupon expired")

    if coupon.get("usedCount", 0) >= coupon.get("usageLimit", 0):
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")

    minimum = coupon.get("minOrderAmount", 0)
    if subtotal and subtotal < minimum:
        raise HTTPException(
            status_code=400,
            detail=f"Coupon requires a minimum order of {minimum}",
        )

    discount = 0
    if subtotal:
        if coupon["discountType"] == "percentage":
            discount = round(subtotal * coupon["discountValue"] / 100)
        else:
            discount = int(coupon["discountValue"])
        if coupon.get("maxDiscount") is not None:
            discount = min(discount, coupon["maxDiscount"])
        discount = min(discount, subtotal)

    return {
        "code": coupon["code"],
        "discountType": coupon["discountType"],
        "discountValue": coupon["discountValue"],
        "minOrderAmount": minimum,
        "maxDiscount": coupon.get("maxDiscount"),
        "couponDiscount": discount,
    }


@router.post("/orders", status_code=201)
async def place_order(
    body: CheckoutInput,
    customer=Depends(current_customer),
    db=Depends(get_db),
):
    # Validate delivery area.
    location = await db.locations.find_one({
        "district": body.district,
        "area": body.area,
        "active": True,
    })

    if location is None:
        raise HTTPException(status_code=400, detail="Invalid delivery area")

    cart = None
    items = [
        item.model_dump() if hasattr(item, "model_dump") else item
        for item in body.items
    ]
    if not items and customer:
        cart = await db.carts.find_one({
            "customerId": customer["_id"]
        })
        items = cart.get("items", []) if cart else []

    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    consolidated = {}
    for item in items:
        key = (item["categorySlug"], item["productId"])
        consolidated[key] = consolidated.get(key, 0) + item["quantity"]
    items = [
        {"categorySlug": category_slug, "productId": product_id, "quantity": quantity}
        for (category_slug, product_id), quantity in consolidated.items()
    ]

    order_items = []
    subtotal = 0

    for item in items:
        product, category = await find_product(
            db,
            item["categorySlug"],
            item["productId"],
        )

        if product is None:
            raise HTTPException(status_code=400, detail="A cart product no longer exists")

        quantity = item["quantity"]
        stock = product.get("availability", 0)

        if stock < quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product['name']}",
            )

        price = int(product.get("price", 0))
        discount = int(product.get("discount", 0) or 0)
        final_price = round(price * (1 - discount / 100))
        line_total = final_price * quantity
        subtotal += line_total

        order_items.append({
            "productId": item["productId"],
            "categorySlug": item["categorySlug"],
            "name": product["name"],
            "brand": product.get("brand"),
            "quantity": quantity,
            "unitPrice": price,
            "discount": discount,
            "finalPrice": final_price,
            "lineTotal": line_total,
        })

    coupon_discount = 0
    coupon = None

    if body.couponCode:
        coupon = await db.coupons.find_one({
            "code": body.couponCode.strip().upper(),
            "active": True,
        })

        if coupon is None:
            raise HTTPException(status_code=400, detail="Invalid coupon")

        starts = coupon.get("startsAt")
        expires = coupon.get("expiresAt")
        now = datetime.now(timezone.utc)

        if starts and starts.tzinfo is None:
            starts = starts.replace(tzinfo=timezone.utc)
        if expires and expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)

        if starts and now < starts:
            raise HTTPException(status_code=400, detail="Coupon not active yet")
        if expires and now > expires:
            raise HTTPException(status_code=400, detail="Coupon expired")

        if coupon.get("usedCount", 0) >= coupon.get("usageLimit", 0):
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")

        if subtotal < coupon.get("minOrderAmount", 0):
            raise HTTPException(status_code=400, detail="Order does not meet coupon minimum")

        if coupon["discountType"] == "percentage":
            coupon_discount = round(subtotal * coupon["discountValue"] / 100)
        else:
            coupon_discount = int(coupon["discountValue"])

        max_discount = coupon.get("maxDiscount")
        if max_discount is not None:
            coupon_discount = min(coupon_discount, max_discount)

        coupon_discount = min(coupon_discount, subtotal)

    total = subtotal - coupon_discount

    now = datetime.now(timezone.utc)
    order_number = "GT-" + str(ObjectId())
    mobile_payment = None
    if body.paymentType == "mobile":
        mobile_payment = {
            "provider": "bKash demo",
            "simulated": True,
            "transactionId": f"SIM-{order_number.removeprefix('GT-')}",
            "payer": f"******{body.paymentPhone[-4:]}",
            "status": "successful",
            "message": "Demo payment simulated successfully; no real payment was made.",
        }

    order = {
        "orderNumber": order_number,
        "customer": {
            "name": body.name,
            "phone": body.phone,
        },
        "delivery": {
            "district": body.district,
            "area": body.area,
            "notes": body.notes,
        },
        "paymentType": body.paymentType,
        "paymentStatus": "paid" if mobile_payment else "pending",
        "mobilePayment": mobile_payment,
        "status": "placed",
        "items": order_items,
        "subtotal": subtotal,
        "couponCode": coupon["code"] if coupon else None,
        "couponDiscount": coupon_discount,
        "total": total,
        "createdAt": now,
        "updatedAt": now,
    }
    if customer:
        order["customerId"] = customer["_id"]

    # Stock reservation and coupon usage need a MongoDB transaction
    # for robust concurrent checkout in production.
    await db.orders.insert_one(order)

    if coupon:
        await db.coupons.update_one(
            {"_id": coupon["_id"]},
            {"$inc": {"usedCount": 1}},
        )

    if customer and cart:
        await db.carts.update_one(
            {"customerId": customer["_id"]},
            {"$set": {"items": [], "updatedAt": now}},
        )

    response = {
        "orderNumber": order_number,
        "status": "placed",
        "paymentType": body.paymentType,
        "subtotal": subtotal,
        "couponDiscount": coupon_discount,
        "total": total,
    }
    if body.paymentType == "mobile":
        response["mobilePayment"] = mobile_payment
    return response


@router.get("/orders/my")
async def my_orders(
    customer=Depends(current_customer),
    db=Depends(get_db),
):
    cursor = (
        db.orders.find({"customerId": customer["_id"]})
        .sort("createdAt", -1)
        .limit(50)
    )

    orders = await cursor.to_list(length=50)

    for order in orders:
        order["_id"] = str(order["_id"])
        order["customerId"] = str(order["customerId"])

    return orders
@router.get("/orders/{order_id}")
async def get_my_order_details(
    order_id: str,
    customer=Depends(current_customer),
    db=Depends(get_db),
):
    if not ObjectId.is_valid(order_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid order ID",
        )

    customer_id = customer["_id"]

    # Support orders that store customerId as either a string
    # or an ObjectId.
    order = await db["orders"].find_one({
        "_id": ObjectId(order_id),
        "customerId": {
            "$in": [str(customer_id), customer_id]
        },
    })

    if not order:
        # Do not reveal whether another customer's order exists.
        raise HTTPException(
            status_code=404,
            detail="Order not found",
        )

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

    return serialize(order)