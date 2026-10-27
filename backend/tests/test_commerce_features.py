import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from bson import ObjectId
import pytest

from app.routers import commerce
from app.services import admin_service
from app.services.delivery_locations import (
    delivery_location_records,
    seed_delivery_locations,
)
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


@pytest.mark.parametrize(
    (
        "district",
        "area",
        "configured_zone",
        "product_price",
        "expected_fee",
    ),
    [
        ("Dhaka", "Dhanmondi", "zone_1", 19_000, 60),
        ("Dhaka", "Mirpur", "zone_1", 25_000, 60),
        ("Gazipur", "Tongi", "zone_2", 19_000, 100),
        ("Narayanganj", "Narayanganj City", "zone_2", 25_000, 100),
    ],
)
def test_checkout_quote_matches_created_order_delivery_fee(
    monkeypatch,
    district,
    area,
    configured_zone,
    product_price,
    expected_fee,
):
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
        async def find_one(self, query):
            assert query == {
                "district": district,
                "area": area,
                "active": True,
            }
            return {"deliveryZone": configured_zone}

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
                "price": product_price,
                "discount": 0,
                "availability": 4,
            },
            {"collection": "monitors", "slug": "monitors"},
        )

    monkeypatch.setattr(commerce, "find_product", find_product)
    db = FakeDatabase()
    quote = asyncio.run(
        commerce.get_delivery_quote(
            district,
            area,
            product_price,
            db,
        )
    )
    assert quote["deliveryFee"] == expected_fee
    assert quote["zone"] == configured_zone

    body = CheckoutInput(
        name="Customer",
        phone="0123456789",
        district=district,
        area=area,
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
    assert db.orders.order["delivery"]["zone"] == configured_zone
    assert db.orders.order["delivery"]["deliveryFee"] == expected_fee
    assert db.orders.order["orderTotalAfterDiscounts"] == product_price
    assert db.orders.order["deliveryFee"] == expected_fee
    assert db.orders.order["total"] == product_price + expected_fee
    assert result["deliveryFee"] == quote["deliveryFee"]
    assert result["total"] == product_price + quote["deliveryFee"]
    assert result["status"] == "placed"


def test_seeded_delivery_locations_cover_all_64_districts_and_four_zones():
    locations = delivery_location_records()
    by_address = {
        (location["district"], location["area"]): location["deliveryZone"]
        for location in locations
    }

    assert len({location["district"] for location in locations}) == 64
    assert {location["deliveryZone"] for location in locations} == {
        "zone_1",
        "zone_2",
        "zone_3",
        "zone_4",
    }
    assert by_address[("Dhaka", "Mirpur")] == "zone_1"
    assert by_address[("Dhaka", "Savar")] == "zone_2"
    assert by_address[("Chattogram", "Agrabad")] == "zone_3"
    assert by_address[("Cumilla", "District Town")] == "zone_4"


@pytest.mark.parametrize(
    ("district", "area", "configured_zone", "amount", "expected_zone", "expected_fee"),
    [
        ("Dhaka", "Dhanmondi", "Zone 1: Dhaka city", 19_999, "zone_1", 60),
        ("Dhaka", "Mirpur", "zone_1", 20_000, "zone_1", 60),
        ("Dhaka", "Savar", "Zone 2: Greater Dhaka", 19_999, "zone_2", 100),
        ("Gazipur", "Tongi", "zone_2", 20_000, "zone_2", 100),
    ],
)
def test_delivery_quote_endpoint_calculates_zone1_and_zone2(
    district: str,
    area: str,
    configured_zone: str,
    amount: int,
    expected_zone: str,
    expected_fee: int,
):
    class LocationsCollection:
        async def find_one(self, query):
            assert query == {
                "district": district,
                "area": area,
                "active": True,
            }
            return {"deliveryZone": configured_zone}

    class FakeDatabase:
        locations = LocationsCollection()

    quote = asyncio.run(
        commerce.get_delivery_quote(district, area, amount, FakeDatabase())
    )

    assert quote["zone"] == expected_zone
    assert quote["deliveryFee"] == expected_fee
    assert quote["orderTotalAfterDiscounts"] == amount


def test_seeded_location_fees_are_fixed_at_all_order_totals():
    expected_fees = {
        "zone_1": 60,
        "zone_2": 100,
        "zone_3": 120,
        "zone_4": 150,
    }

    for location in delivery_location_records():
        zone = location["deliveryZone"]
        for amount in (0, 20_000, 50_000, 100_000):
            quote = commerce.quote_delivery(
                amount,
                location["district"],
                location["area"],
                configured_zone=zone,
            )
            assert quote.fee == expected_fees[zone], (location, amount, quote)


def test_seed_delivery_locations_is_safe_to_run_more_than_once():
    class LocationsCollection:
        def __init__(self):
            self.records = {}

        async def update_one(self, query, update, upsert):
            assert upsert is True
            key = (query["district"], query["area"])
            existing = key in self.records
            self.records[key] = update["$set"]
            return SimpleNamespace(
                upserted_id=None if existing else key,
                matched_count=1 if existing else 0,
            )

    class FakeDatabase:
        def __init__(self):
            self.locations = LocationsCollection()

    db = FakeDatabase()
    first = asyncio.run(seed_delivery_locations(db))
    second = asyncio.run(seed_delivery_locations(db))

    assert first["inserted"] == 70
    assert first["updated"] == 0
    assert second["inserted"] == 0
    assert second["updated"] == 70
    assert len(db.locations.records) == 70


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
