"""MCP client connection for authenticated chat database tools."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx2
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

from ai_agent.policy_rag.settings import settings as policy_settings
from app.core.config import settings as backend_settings


@asynccontextmanager
async def open_chat_mcp_client(
    access_token: str,
) -> AsyncGenerator[Client, None, None]:
    async with httpx2.AsyncClient(
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=policy_settings.policy_timeout_seconds,
    ) as http_client:
        async with Client(
            streamable_http_client(
                backend_settings.chat_mcp_server_url,
                http_client=http_client,
            )
        ) as client:
            yield client
