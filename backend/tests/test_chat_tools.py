import asyncio
import json
from datetime import datetime, timezone

from app.services.chat_tools import (
    _add_business_days,
    _estimated_delivery,
    create_chat_tools,
)


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    async def to_list(self, length=None):
        return self.documents if length is None else self.documents[:length]


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents

    async def find_one(self, query, projection):
        self.query = query
        self.projection = projection
        return self.documents[0] if self.documents else None

    def find(self, query, projection):
        self.query = query
        self.projection = projection
        return FakeCursor(self.documents)


class FakeDatabase:
    def __init__(self):
        self.collections = {
            "orders": FakeCollection(
                [
                    {
                        "orderNumber": "GT-2026-000001",
                        "status": "accepted",
                        "createdAt": datetime(2026, 10, 18, tzinfo=timezone.utc),
                        "statusHistory": [],
                        "customer": {"name": "Private Customer"},
                        "shippingAddress": {"address": "Private Address"},
                    }
                ]
            )
        }
        for collection in (
            "casings",
            "graphics_cards",
            "keyboards",
            "laptops",
            "mice",
            "monitors",
            "motherboards",
            "power_supplies",
            "processors",
            "rams",
            "ssds",
            "ups",
        ):
            self.collections[collection] = FakeCollection(
                [
                    {
                        "name": f"Sample {collection}",
                        "sku": "SAMPLE-001",
                        "price": 10000,
                        "discount": 10,
                        "availability": 2,
                    }
                ]
            )

    def __getitem__(self, collection):
        return self.collections[collection]


def test_order_tool_returns_status_and_eta_without_personal_details():
    async def run():
        tool = create_chat_tools(FakeDatabase())[0]
        result = json.loads(await tool.ainvoke({"order_id": "GT-2026-000001"}))

        assert result["found"] is True
        assert result["status"] == "accepted"
        assert result["estimatedDelivery"]["from"] == "2026-10-21"
        assert "customer" not in result
        assert "shippingAddress" not in result

    asyncio.run(run())


def test_pc_inventory_tool_returns_live_discounted_inventory_for_all_categories():
    async def run():
        tool = create_chat_tools(FakeDatabase())[1]
        result = json.loads(await tool.ainvoke({"budget_bdt": 100000}))

        assert result["budgetBDT"] == 100000
        assert len(result["categories"]) == 12
        assert result["categories"]["processors"]["products"][0]["finalPriceBDT"] == 9000

    asyncio.run(run())


def test_delivery_estimate_skips_friday():
    assert _add_business_days(datetime(2026, 10, 22).date(), 1).isoformat() == "2026-10-24"


def test_delivery_estimate_uses_bangladesh_local_order_date():
    placed_at = datetime(2026, 10, 17, 20, tzinfo=timezone.utc)

    assert _estimated_delivery(placed_at, None)["from"] == "2026-10-21"
