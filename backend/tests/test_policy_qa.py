import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.security import require_customer
from app.routers import policy_qa
from app.schemas.policy_qa import PolicyQARequest


def _client(authenticated: bool = True) -> TestClient:
    app = FastAPI()
    app.include_router(policy_qa.router)
    app.dependency_overrides[get_db] = lambda: object()
    if authenticated:
        app.dependency_overrides[require_customer] = lambda: {"_id": "customer-1"}
    return TestClient(app)


def test_policy_endpoint_returns_validated_answer_and_sources(monkeypatch):
    async def fake_answer(question, history):
        assert question == "How much is delivery?"
        assert history == [{"role": "user", "content": "Question"}]
        return {
            "answer": "The fee is BDT 120.",
            "sources": [{
                "docId": "GT-POL-DS-01",
                "docTitle": "Delivery and Shipping Policy",
                "sectionNumber": "3.1",
                "sectionTitle": "Standard delivery fees",
                "headingPath": "3. Delivery Fees > 3.1 Standard delivery fees",
                "pageNumber": 3,
                "chunkId": "real-chunk-id",
                "score": 0.02,
            }],
        }

    monkeypatch.setattr(policy_qa, "answer_policy_question", fake_answer)
    response = _client().post(
        "/api/policy-qa",
        json={
            "question": " How much is delivery? ",
            "history": [{"role": "user", "content": "Question"}],
        },
    )

    assert response.status_code == 200
    assert response.json()["sources"][0]["sectionNumber"] == "3.1"
    assert response.json()["suggested_products"] == []


def test_policy_pdf_is_publicly_served_inline_with_pdf_content():
    response = _client(authenticated=False).get("/api/policies/GT-POL-DS-01")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline;")
    assert response.content.startswith(b"%PDF")


def test_unknown_policy_pdf_is_not_served():
    response = _client(authenticated=False).get("/api/policies/unknown")

    assert response.status_code == 404


def test_chat_endpoint_uses_unified_chat_answer(monkeypatch):
    suggested_product = {
        "id": "product-1",
        "name": "Recommended Monitor",
        "category": {"name": "Monitors", "slug": "monitors"},
        "price": 25000,
        "discount": 0,
        "finalPrice": 25000,
        "hasDiscount": False,
        "inStock": True,
        "lowStock": False,
    }

    async def fake_answer(
        question,
        history,
        db,
        conversation_id=None,
        customer_id=None,
        mcp_access_token=None,
    ):
        assert question == "Hello"
        assert history == []
        assert db is not None
        assert conversation_id == "test-conversation"
        assert customer_id == "customer-1"
        assert mcp_access_token == "test-customer-token"
        return {
            "answer": "This monitor matches your needs.",
            "sources": [],
            "suggested_products": [suggested_product],
        }

    monkeypatch.setattr(policy_qa, "answer_chat_message", fake_answer)
    response = _client().post(
        "/api/chat",
        json={"question": "Hello", "conversation_id": "test-conversation"},
        headers={"Authorization": "Bearer test-customer-token"},
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "This monitor matches your needs."
    assert response.json()["conversation_id"] == "test-conversation"
    assert response.json()["hitl_pending"] is False
    assert response.json()["suggested_products"][0]["id"] == "product-1"


def test_chat_stream_emits_progress_deltas_and_final_response(monkeypatch):
    async def fake_answer(
        question,
        history,
        db,
        conversation_id=None,
        customer_id=None,
        mcp_access_token=None,
        on_delta=None,
        on_progress=None,
    ):
        assert question == "Hello"
        assert db is not None
        assert customer_id == "customer-1"
        assert mcp_access_token == "test-customer-token"
        await on_progress("Writing a reply")
        await on_delta("Hello")
        await on_delta(" there")
        return {"answer": "Hello there", "sources": []}

    monkeypatch.setattr(policy_qa, "answer_chat_message", fake_answer)
    response = _client().post(
        "/api/chat/stream",
        json={"question": "Hello", "conversation_id": "stream-conversation"},
        headers={"Authorization": "Bearer test-customer-token"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: progress\ndata: {\"message\": \"Writing a reply\"}" in response.text
    assert "event: delta\ndata: {\"text\": \"Hello\"}" in response.text
    assert "event: delta\ndata: {\"text\": \" there\"}" in response.text
    assert "event: done" in response.text
    assert '"conversation_id": "stream-conversation"' in response.text


def test_policy_endpoint_rejects_blank_and_oversized_questions():
    client = _client()
    assert client.post("/api/policy-qa", json={"question": "   "}).status_code == 422
    assert client.post("/api/policy-qa", json={"question": "x" * 2001}).status_code == 422


def test_chat_request_accepts_twenty_context_messages():
    request = PolicyQARequest(
        question="What did I ask earlier?",
        history=[
            {"role": "user", "content": f"Message {index}"}
            for index in range(20)
        ],
    )
    assert len(request.history) == 20


def test_chat_endpoints_require_customer_authentication():
    client = _client(authenticated=False)
    assert client.post("/api/chat", json={"question": "Hello"}).status_code == 401
    assert client.post("/api/chat/stream", json={"question": "Hello"}).status_code == 401
    assert client.post("/api/policy-qa", json={"question": "Hello"}).status_code == 401


def test_policy_endpoint_maps_configuration_errors_to_service_unavailable(monkeypatch):
    async def fail_configuration(*_args, **_kwargs):
        raise policy_qa.PolicyConfigurationError("OLLAMA_CHAT_MODEL is not configured.")

    monkeypatch.setattr(policy_qa, "answer_policy_question", fail_configuration)
    response = _client().post("/api/policy-qa", json={"question": "What is the return policy?"})

    assert response.status_code == 503
    assert "OLLAMA_CHAT_MODEL" in response.json()["detail"]


def test_policy_endpoint_enforces_timeout(monkeypatch):
    async def slow_answer(*_args, **_kwargs):
        await asyncio.sleep(0.05)
        return {"answer": "late", "sources": []}

    monkeypatch.setattr(policy_qa, "answer_policy_question", slow_answer)
    monkeypatch.setattr(policy_qa.settings, "policy_timeout_seconds", 0.001)
    response = _client().post("/api/policy-qa", json={"question": "What is the return policy?"})

    assert response.status_code == 504


def test_chat_endpoint_reports_ollama_failures_as_bad_gateway(monkeypatch):
    async def unavailable(*_args, **_kwargs):
        raise ConnectionError("Ollama is unavailable")

    monkeypatch.setattr(policy_qa, "answer_chat_message", unavailable)
    response = _client().post("/api/chat", json={"question": "Hello"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Chat service is temporarily unavailable."
