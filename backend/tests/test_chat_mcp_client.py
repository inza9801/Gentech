import asyncio

from app.services import chat_mcp_client


def test_chat_mcp_client_uses_policy_timeout_and_backend_server_url(monkeypatch):
    observed = {}

    class FakeHTTPClient:
        def __init__(self, **kwargs):
            observed["http_kwargs"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    class FakeMCPClient:
        def __init__(self, transport):
            observed["transport"] = transport

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

    monkeypatch.setattr(chat_mcp_client.httpx2, "AsyncClient", FakeHTTPClient)
    monkeypatch.setattr(chat_mcp_client, "Client", FakeMCPClient)
    monkeypatch.setattr(
        chat_mcp_client,
        "streamable_http_client",
        lambda url, *, http_client: (url, http_client),
    )
    monkeypatch.setattr(chat_mcp_client.policy_settings, "policy_timeout_seconds", 37)
    monkeypatch.setattr(
        chat_mcp_client.backend_settings,
        "chat_mcp_server_url",
        "http://localhost:9000/mcp/",
    )

    async def open_client():
        async with chat_mcp_client.open_chat_mcp_client("customer-token") as client:
            assert isinstance(client, FakeMCPClient)

    asyncio.run(open_client())

    assert observed["http_kwargs"] == {
        "headers": {"Authorization": "Bearer customer-token"},
        "timeout": 37,
    }
    assert observed["transport"][0] == "http://localhost:9000/mcp/"
