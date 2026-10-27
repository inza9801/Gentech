import asyncio
import json

import httpx2
import pytest
from fastapi import FastAPI, HTTPException
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

from app.services import chat_mcp


class FakeOrders:
    def __init__(self):
        self.query = None

    async def find_one(self, query, projection):
        self.query = query
        assert projection == {
            "orderNumber": 1,
            "status": 1,
            "createdAt": 1,
            "_id": 1,
        }
        return None


class FakeDatabase:
    def __init__(self):
        self.orders = FakeOrders()
        self.monitors = FakeCatalog()

    def __getitem__(self, name):
        if name == "orders":
            return self.orders
        if name == "monitors":
            return self.monitors
        raise AssertionError(f"Unexpected collection: {name}")


class FakeCatalogCursor:
    async def to_list(self, length=None):
        return [
            {
                "_id": "monitor-123",
                "name": "Monitor near budget",
                "price": 25000,
                "availability": 4,
                "images": ["monitors/monitor.jpg"],
                "features": ["144Hz refresh rate"],
            }
        ]


class FakeCatalog:
    def find(self, query, projection):
        assert query == {}
        return FakeCatalogCursor()


def test_streamable_mcp_discovery_and_order_lookup_are_customer_scoped(monkeypatch):
    database = FakeDatabase()

    async def authenticate(token, db):
        assert token == "valid-customer-token"
        assert db is database
        return {"_id": "customer-123", "role": "customer"}

    async def get_database():
        return database

    monkeypatch.setattr(chat_mcp, "get_user_from_access_token", authenticate)
    monkeypatch.setattr(chat_mcp, "get_db", get_database)

    app = FastAPI()
    app.mount("/mcp", chat_mcp.chat_mcp_app)

    async def use_mcp():
        async with chat_mcp.mcp_server.session_manager.run():
            async with httpx2.AsyncClient(
                transport=httpx2.ASGITransport(app=app),
                base_url="http://test",
                headers={"Authorization": "Bearer valid-customer-token"},
            ) as http_client:
                async with Client(
                    streamable_http_client(
                        "http://test/mcp/",
                        http_client=http_client,
                    )
                ) as client:
                    tools = await client.list_tools()
                    assert {tool.name for tool in tools.tools} == {
                        "lookup_order_status",
                        "get_pc_build_inventory",
                        "find_products_near_price",
                    }
                    result = await client.call_tool(
                        "lookup_order_status",
                        {"order_id": "GT-2026-000001"},
                    )
                    assert not result.is_error
                    assert "No order matched" in result.content[0].text
                    catalog_result = await client.call_tool(
                        "find_products_near_price",
                        {
                            "category": "monitors",
                            "target_price_bdt": 25000,
                        },
                    )
                    assert not catalog_result.is_error
                    assert catalog_result.structured_content["result"]
                    catalog_payload = json.loads(
                        catalog_result.structured_content["result"]
                    )
                    assert catalog_payload["products"][0]["name"] == "Monitor near budget"

    asyncio.run(use_mcp())
    assert database.orders.query["$and"][1]["customerId"]["$in"] == [
        "customer-123"
    ]


def test_streamable_mcp_rejects_missing_bearer_token():
    app = FastAPI()
    app.mount("/mcp", chat_mcp.chat_mcp_app)

    async def request_mcp():
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://test",
        ) as http_client:
            response = await http_client.post("/mcp/")
            return response

    response = asyncio.run(request_mcp())
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


@pytest.mark.parametrize(
    ("token", "auth_error", "expected_status", "expected_detail"),
    [
        (
            "expired-token",
            HTTPException(status_code=401, detail="Invalid or expired token"),
            401,
            "Invalid or expired token",
        ),
        (
            "admin-token",
            None,
            403,
            "Customer access required",
        ),
    ],
)
def test_streamable_mcp_rejects_invalid_tokens_and_non_customer_users(
    monkeypatch,
    token,
    auth_error,
    expected_status,
    expected_detail,
):
    async def authenticate(access_token, _db):
        assert access_token == token
        if auth_error is not None:
            raise auth_error
        return {"_id": "admin-123", "role": "admin"}

    async def get_database():
        return object()

    monkeypatch.setattr(chat_mcp, "get_user_from_access_token", authenticate)
    monkeypatch.setattr(chat_mcp, "get_db", get_database)

    app = FastAPI()
    app.mount("/mcp", chat_mcp.chat_mcp_app)

    async def request_mcp():
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {token}"},
        ) as http_client:
            return await http_client.post("/mcp/")

    response = asyncio.run(request_mcp())
    assert response.status_code == expected_status
    assert response.json()["detail"] == expected_detail
