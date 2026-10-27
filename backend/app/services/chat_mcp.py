"""MCP transport and customer-authenticated chat database tools."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from mcp.server import MCPServer
from mcp.server.mcpserver import Context
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.database import get_db
from app.core.security import get_user_from_access_token
from app.services.chat_tools import create_chat_tools


mcp_server = MCPServer(
    name="gentech-chat-tools",
    version="1.0.0",
    instructions=(
        "Read-only catalog and order-status tools for Gentech customer chat. "
        "Order lookups are always scoped to the authenticated customer."
    ),
)


async def _run_tool(ctx: Context, tool_name: str, arguments: dict[str, Any]) -> str:
    request = ctx.request_context.request
    customer = request.scope.get("state", {}).get("mcp_customer")
    if customer is None:
        raise RuntimeError("Authenticated customer context is missing.")

    tools = {
        tool.name: tool
        for tool in create_chat_tools(
            await get_db(),
            customer_id=customer["_id"],
        )
    }
    tool = tools.get(tool_name)
    if tool is None:
        raise RuntimeError(f"Unknown Gentech chat tool: {tool_name}")
    return await tool.ainvoke(arguments)


@mcp_server.tool(
    description=(
        "Look up one Gentech order using its exact order number or MongoDB order "
        "ID. Only returns status and an estimated delivery window for the "
        "authenticated customer."
    )
)
async def lookup_order_status(order_id: str, ctx: Context) -> str:
    return await _run_tool(ctx, "lookup_order_status", {"order_id": order_id})


@mcp_server.tool(
    description=(
        "Get current in-stock Gentech catalog items and discounted prices across "
        "all categories for a complete desktop PC build using the customer's "
        "stated BDT budget."
    )
)
async def get_pc_build_inventory(budget_bdt: int, ctx: Context) -> str:
    return await _run_tool(ctx, "get_pc_build_inventory", {"budget_bdt": budget_bdt})


@mcp_server.tool(
    description=(
        "Find the closest in-stock products to a customer's target BDT price in "
        "one supported Gentech product category."
    )
)
async def find_products_near_price(
    category: str,
    target_price_bdt: int,
    ctx: Context,
) -> str:
    return await _run_tool(
        ctx,
        "find_products_near_price",
        {"category": category, "target_price_bdt": target_price_bdt},
    )


class CustomerMCPAuthMiddleware:
    """Validate existing customer JWTs before accepting MCP requests."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        authorization = request.headers.get("authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.casefold() != "bearer" or not token.strip():
            response = JSONResponse(
                {"detail": "Authentication required"},
                status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
            await response(scope, receive, send)
            return

        try:
            customer = await get_user_from_access_token(token.strip(), await get_db())
        except HTTPException as error:
            response = JSONResponse(
                {"detail": error.detail},
                status_code=error.status_code,
                headers=error.headers,
            )
            await response(scope, receive, send)
            return

        if customer.get("role", "customer") != "customer":
            response = JSONResponse(
                {"detail": "Customer access required"},
                status_code=403,
            )
            await response(scope, receive, send)
            return

        scope.setdefault("state", {})["mcp_customer"] = customer
        await self.app(scope, receive, send)


chat_mcp_app = CustomerMCPAuthMiddleware(
    mcp_server.streamable_http_app(
        streamable_http_path="/",
        host="0.0.0.0",
    )
)
