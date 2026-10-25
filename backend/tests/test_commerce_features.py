import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from bson import ObjectId

from app.routers import commerce
from app.services import admin_service
from app.schemas.commerce import CartItemInput, CheckoutInput


class CouponCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, length=None):
        return self.rows[:length]


class CouponCollection:
    def __init__(self, rows):
        self.rows = rows

    def find(self, query):
        assert query == {"active": True}
        return CouponCursor(self.rows)


class CouponDatabase:
    def __init__(self, rows):
        self.coupons = CouponCollection(rows)


def test_available_coupons_excludes_expired_future_and_exhausted():
    now = datetime.now(timezone.utc)
    db = CouponDatabase([
        {
            "code": "SAVE10",
            "active": True,
            "discountType": "percentage",
            "discountValue": 10,
            "minOrderAmount": 1000,
            "usageLimit": 10,
            "usedCount": 2,
            "expiresAt": now + timedelta(days=2),
        },
        {
            "code": "EXPIRED",
            "active": True,
            "discountType": "fixed",
            "discountValue": 100,
            "expiresAt": now - timedelta(days=1),
        },
        {
            "code": "FUTURE",
            "active": True,
            "discountType": "fixed",
            "discountValue": 100,
            "startsAt": now + timedelta(days=1),
        },
        {
            "code": "USED",
            "active": True,
            "discountType": "fixed",
            "discountValue": 100,
            "usageLimit": 1,
            "usedCount": 1,
        },
    ])

    coupons = asyncio.run(commerce.list_available_coupons(db))

    assert [coupon["code"] for coupon in coupons] == ["SAVE10"]
    assert coupons[0]["minOrderAmount"] == 1000
    assert coupons[0]["expiresAt"].endswith("+00:00")


def test_placing_order_reserves_each_product_quantity(monkeypatch):
    product_id = ObjectId()

    class StockCollection:
        def __init__(self):
            self.update = None

        async def update_one(self, query, update):
            self.update = (query, update)
            return SimpleNamespace(matched_count=1)

    class OrdersCollection:
        def __init__(self):
            self.order = None

        async def insert_one(self, order):
            self.order = order

    class LocationsCollection:
        async def find_one(self, _query):
            return {"deliveryZone": "dhaka"}

    class FakeDatabase:
        def __init__(self):
            self.locations = LocationsCollection()
            self.orders = OrdersCollection()
            self.coupons = CouponCollection([])
            self.stock = StockCollection()

        def __getitem__(self, name):
            assert name == "monitors"
            return self.stock

    async def find_product(_db, _category_slug, _product_id):
        return (
            {
                "_id": product_id,
                "name": "Monitor",
                "price": 20000,
                "discount": 0,
                "availability": 4,
            },
            {"collection": "monitors", "slug": "monitors"},
        )

    monkeypatch.setattr(commerce, "find_product", find_product)
    monkeypatch.setattr(
        commerce,
        "quote_delivery",
        lambda *_args, **_kwargs: SimpleNamespace(
            zone="dhaka",
            fee=100,
        ),
    )
    db = FakeDatabase()
    body = CheckoutInput(
        name="Customer",
        phone="0123456789",
        district="Dhaka",
        area="Dhanmondi",
        paymentType="cod",
        items=[
            CartItemInput(
                categorySlug="monitors",
                productId=str(product_id),
                quantity=1,
            )
        ],
    )

    result = asyncio.run(
        commerce.place_order(
            body,
            {"_id": ObjectId()},
            db,
        )
    )

    query, update = db.stock.update
    assert query["availability"] == {"$gte": 1}
    assert update["$inc"] == {"availability": -1, "soldCount": 1}
    assert update["$addToSet"]["deliveryAdjustmentKeys"].startswith(
        f"{db.orders.order['_id']}:{product_id}"
    )
    assert db.orders.order["stockReservationStatus"] == "reserved"
    assert result["status"] == "placed"


def test_rollback_reservation_restores_stock_and_removes_order_marker():
    product_id = ObjectId()

    class StockCollection:
        def __init__(self):
            self.update = None

        async def update_one(self, query, update):
            self.update = (query, update)

    class FakeDatabase:
        def __init__(self):
            self.stock = StockCollection()

        def __getitem__(self, _name):
            return self.stock

    db = FakeDatabase()
    order_id = ObjectId()
    asyncio.run(
        commerce._rollback_order_stock(
            db,
            [("monitors", product_id, 2, "Monitor")],
            order_id,
        )
    )

    query, update = db.stock.update
    marker = f"{order_id}:{product_id}"
    assert query["deliveryAdjustmentKeys"] == marker
    assert update["$inc"] == {"availability": 2, "soldCount": -2}
    assert update["$pull"] == {"deliveryAdjustmentKeys": marker}


def test_cancelling_reserved_order_returns_stock(monkeypatch):
    product_id = ObjectId()

    class StockCollection:
        def __init__(self):
            self.update = None

        async def update_one(self, query, update):
            self.update = (query, update)

    class FakeDatabase:
        def __init__(self):
            self.stock = StockCollection()

        def __getitem__(self, _name):
            return self.stock

    async def get_product_by_id(_db, _product_id):
        return (
            {"_id": product_id},
            {"slug": "monitors", "collection": "monitors"},
        )

    monkeypatch.setattr(admin_service.product_repo, "get_product_by_id", get_product_by_id)
    db = FakeDatabase()
    order_id = ObjectId()
    order = {
        "items": [{
            "productId": str(product_id),
            "categorySlug": "monitors",
            "quantity": 1,
        }],
    }

    asyncio.run(admin_service._release_reserved_inventory(db, order_id, order))

    query, update = db.stock.update
    marker = f"{order_id}:{product_id}"
    assert query["deliveryAdjustmentKeys"] == marker
    assert update["$inc"] == {"availability": 1, "soldCount": -1}
    assert update["$pull"] == {"deliveryAdjustmentKeys": marker}
