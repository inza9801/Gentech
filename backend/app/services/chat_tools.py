"""Read-only database tools used by the customer chat assistant."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from langchain_core.tools import tool


_CATALOG_CATEGORIES = {
    "casings": "Casings",
    "graphics_cards": "Graphics Cards",
    "keyboards": "Keyboards",
    "laptops": "Laptops",
    "mice": "Mice",
    "monitors": "Monitors",
    "motherboards": "Motherboards",
    "power_supplies": "Power Supplies",
    "processors": "Processors",
    "rams": "RAM",
    "ssds": "SSDs",
    "ups": "UPS",
}
_BANGLADESH_TIMEZONE = timezone(timedelta(hours=6))
_PRODUCT_FIELDS = (
    "brand",
    "socket",
    "processorType",
    "processorBrand",
    "processorModel",
    "numberOfCores",
    "numberOfThreads",
    "ramType",
    "ramSize",
    "ramSpeed",
    "ramSlots",
    "maximumMemory",
    "formFactor",
    "type",
    "watts",
    "graphicsChipset",
    "gpuSeries",
    "memorySize",
    "memoryType",
    "ssdSize",
    "interface",
    "readSpeed",
    "writeSpeed",
    "capacity",
    "loadCapacity",
    "outputCapacity",
    "voltAmpere",
    "displaySize",
    "displayType",
    "resolution",
    "refreshRate",
    "powerSupply",
    "features",
)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _add_business_days(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() != 4:
            added += 1
    return current


def _estimated_delivery(created_at: Any, order_id: Any) -> dict[str, str] | None:
    placed_at = _parse_datetime(created_at)
    if placed_at is None and isinstance(order_id, ObjectId):
        placed_at = order_id.generation_time
    if placed_at is None:
        return None
    if placed_at.tzinfo is None:
        placed_at = placed_at.replace(tzinfo=timezone.utc)
    placed_at = placed_at.astimezone(_BANGLADESH_TIMEZONE)
    order_date = placed_at.date()
    return {
        "from": _add_business_days(order_date, 3).isoformat(),
        "to": _add_business_days(order_date, 5).isoformat(),
        "basis": "Estimated 3-5 business days from the order date; Friday excluded.",
    }


def _order_lookup_query(order_id: str) -> dict[str, Any]:
    conditions: list[dict[str, Any]] = [{"orderNumber": order_id}]
    if ObjectId.is_valid(order_id):
        conditions.append({"_id": ObjectId(order_id)})
    return {"$or": conditions}


def _serializable_time(value: Any) -> str | None:
    parsed = _parse_datetime(value)
    return parsed.isoformat() if parsed else None


def _compact_product(
    product: dict[str, Any],
    *,
    include_all_features: bool = False,
) -> dict[str, Any]:
    price = product.get("price")
    discount = product.get("discount", 0) or 0
    if not isinstance(price, (int, float)) or isinstance(price, bool) or price <= 0:
        return {}
    if not isinstance(discount, (int, float)) or isinstance(discount, bool):
        discount = 0
    compact = {
        "name": product.get("name"),
        "sku": product.get("sku"),
        "priceBDT": round(price),
        "discountPercent": discount,
        "finalPriceBDT": round(price * (1 - discount / 100)),
        "stock": product.get("availability", 0),
    }
    for field in _PRODUCT_FIELDS:
        value = product.get(field)
        if value is not None:
            if field == "features" and isinstance(value, list) and not include_all_features:
                compact[field] = value[:3]
            else:
                compact[field] = value
    if include_all_features and not isinstance(compact.get("features"), list):
        compact["features"] = []
    return compact


def create_chat_tools(db: Any) -> list[Any]:
    """Create per-request tools bound to the active MongoDB database."""

    @tool(
        description=(
            "Look up one Gentech order by its exact order number (for example "
            "GT-2026-000001) or MongoDB order ID. Returns only status, order date, "
            "and an estimated delivery window. Never guess or fabricate an ID."
        )
    )
    async def lookup_order_status(order_id: str) -> str:
        identifier = order_id.strip()
        if not identifier:
            raise ValueError("An order number or order ID is required.")
        order = await db["orders"].find_one(
            _order_lookup_query(identifier),
            {
                "orderNumber": 1,
                "status": 1,
                "createdAt": 1,
                "_id": 1,
            },
        )
        if order is None:
            return json.dumps({"found": False, "message": "No order matched that ID."})

        status = str(order.get("status", "unknown"))
        response = {
            "found": True,
            "orderNumber": order.get("orderNumber"),
            "status": status,
            "orderDate": _serializable_time(order.get("createdAt")),
        }
        if status.casefold() not in {"delivered", "cancelled", "canceled", "rejected"}:
            response["estimatedDelivery"] = _estimated_delivery(
                order.get("createdAt"),
                order.get("_id"),
            )
        return json.dumps(response, ensure_ascii=False)

    @tool(
        description=(
            "Get current in-stock products and discounted prices across all 12 "
            "Gentech categories for a complete desktop PC recommendation. Use only "
            "when the customer gives a numeric total budget in BDT. Inventory "
            "includes laptops and peripherals for context; a desktop build must "
            "not use a laptop as a component. Choose compatible CPU, motherboard, "
            "RAM, case, storage, and a correctly sized PSU; consider a GPU and "
            "optional monitor, keyboard, mouse, and UPS. Do not exceed the budget."
        )
    )
    async def get_pc_build_inventory(budget_bdt: int) -> str:
        if budget_bdt <= 0:
            raise ValueError("The PC build budget must be greater than zero.")

        inventory: dict[str, Any] = {}
        for collection, category_name in _CATALOG_CATEGORIES.items():
            cursor = db[collection].find(
                {"availability": {"$gt": 0}},
                {
                    "name": 1,
                    "sku": 1,
                    "brand": 1,
                    "price": 1,
                    "discount": 1,
                    "availability": 1,
                    **{field: 1 for field in _PRODUCT_FIELDS},
                },
            )
            products = await cursor.to_list(length=None)
            available = []
            candidates = []
            for product in products:
                compact = _compact_product(product)
                if not compact:
                    continue
                available.append(compact)
                if compact["finalPriceBDT"] <= budget_bdt:
                    candidates.append(compact)
            candidates.sort(key=lambda item: (item["finalPriceBDT"], item["name"] or ""))
            inventory[collection] = {
                "category": category_name,
                "availableCount": len(available),
                "withinBudgetCount": len(candidates),
                "products": candidates,
            }

        return json.dumps(
            {
                "budgetBDT": budget_bdt,
                "categories": inventory,
                "guidance": (
                    "Product prices are current discounted prices from the database. "
                    "Select only stocked products. State clearly if a complete, "
                    "compatible build cannot fit this budget. Do not invent products, "
                    "specifications, stock, or prices."
                ),
            },
            ensure_ascii=False,
        )

    @tool(
        description=(
            "Find in-stock products closest to a customer's target BDT price in "
            "exactly one category: casings, graphics_cards, keyboards, laptops, "
            "mice, monitors, motherboards, power_supplies, processors, rams, ssds, "
            "or ups. Read that category's catalog, calculate discounted prices, "
            "and return the nearest 10 matches sorted by price distance with their "
            "features. Use for a single-product recommendation, not a PC build."
        )
    )
    async def find_products_near_price(category: str, target_price_bdt: int) -> str:
        category_key = category.strip().casefold().replace("-", "_").replace(" ", "_")
        category_key = {
            "case": "casings",
            "casing": "casings",
            "graphics_card": "graphics_cards",
            "gpu": "graphics_cards",
            "keyboard": "keyboards",
            "laptop": "laptops",
            "mouse": "mice",
            "monitor": "monitors",
            "motherboard": "motherboards",
            "power_supply": "power_supplies",
            "psu": "power_supplies",
            "processor": "processors",
            "cpu": "processors",
            "ram": "rams",
            "memory": "rams",
            "ssd": "ssds",
        }.get(category_key, category_key)
        if category_key not in _CATALOG_CATEGORIES:
            raise ValueError("Choose one of the supported Gentech product categories.")
        if target_price_bdt <= 0:
            raise ValueError("The target price must be greater than zero.")

        cursor = db[category_key].find(
            {},
            {
                "name": 1,
                "sku": 1,
                "brand": 1,
                "price": 1,
                "discount": 1,
                "availability": 1,
                **{field: 1 for field in _PRODUCT_FIELDS},
            },
        )
        documents = await cursor.to_list(length=None)
        available = [
            document
            for document in documents
            if isinstance(document.get("availability"), (int, float))
            and not isinstance(document.get("availability"), bool)
            and document["availability"] > 0
        ]
        products = [
            compact
            for document in available
            if (compact := _compact_product(document, include_all_features=True))
        ]
        products.sort(
            key=lambda product: (
                abs(product["finalPriceBDT"] - target_price_bdt),
                product["finalPriceBDT"],
                product["name"] or "",
            )
        )
        matches = products[:10]
        for product in matches:
            product["priceDistanceBDT"] = abs(
                product["finalPriceBDT"] - target_price_bdt
            )

        return json.dumps(
            {
                "category": category_key,
                "targetPriceBDT": target_price_bdt,
                "catalogCount": len(documents),
                "availableCount": len(available),
                "products": matches,
            },
            ensure_ascii=False,
        )

    return [lookup_order_status, get_pc_build_inventory, find_products_near_price]
