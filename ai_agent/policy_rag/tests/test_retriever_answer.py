import asyncio
import json
from types import SimpleNamespace

import pytest

from ai_agent.policy_rag import answer
from ai_agent.policy_rag.retriever import PolicyRetriever, RetrievalOptions
from ai_agent.policy_rag.tools import SEARCH_POLICIES_DESCRIPTION, search_policies


CHUNKS = [
    {
        "id": "payment-refund",
        "text": "Payment, Cancellation and Refunds Policy > 8. Refund Methods and Timelines. Credit or debit card refunds take 7 to 14 business days.",
        "metadata": {
            "collection": "payment_refunds",
            "docId": "GT-POL-PR-01",
            "docTitle": "Payment, Cancellation and Refunds Policy",
            "docVersion": "1.0",
            "sectionNumber": "8",
            "sectionTitle": "Refund Methods and Timelines",
            "headingPath": "8. Refund Methods and Timelines",
            "chunkType": "table_row",
            "pageNumber": 6,
            "chunkId": "payment-refund",
            "contentHash": "hash-a",
        },
    },
    {
        "id": "delivery-damage",
        "text": "Delivery and Shipping Policy > 7. Damaged, Missing or Wrong Parcels. Report a damaged parcel within 48 hours.",
        "metadata": {
            "collection": "delivery_shipping",
            "docId": "GT-POL-DS-01",
            "docTitle": "Delivery and Shipping Policy",
            "docVersion": "1.0",
            "sectionNumber": "7.1",
            "sectionTitle": "Damaged parcel",
            "headingPath": "7. Damaged, Missing or Wrong Parcels > 7.1 Damaged parcel",
            "chunkType": "section",
            "pageNumber": 5,
            "chunkId": "delivery-damage",
            "contentHash": "hash-b",
        },
    },
    {
        "id": "warranty-damage",
        "text": "Warranty and Service Policy > 8. Damaged or Defective Product Policy. Gentech arranges free pickup for damaged-on-delivery claims.",
        "metadata": {
            "collection": "warranty_service",
            "docId": "GT-POL-WS-01",
            "docTitle": "Warranty and Service Policy",
            "docVersion": "1.0",
            "sectionNumber": "8.1",
            "sectionTitle": "Product damaged or wrong on delivery",
            "headingPath": "8. Damaged or Defective Product Policy",
            "chunkType": "faq",
            "pageNumber": 8,
            "chunkId": "warranty-damage",
            "contentHash": "hash-c",
        },
    },
]


class FakeEmbeddings:
    def embed_query(self, query):
        return [float(len(query))]


class FakeStore:
    def get_all(self):
        return {
            "ids": [item["id"] for item in CHUNKS],
            "documents": [item["text"] for item in CHUNKS],
            "metadatas": [item["metadata"] for item in CHUNKS],
        }

    def search(self, embedding, count, collection=None):
        _ = embedding, count
        rows = [
            item
            for item in CHUNKS
            if not collection or item["metadata"]["collection"] == collection
        ]
        return {"ids": [[item["id"] for item in rows]]}


@pytest.fixture
def retriever():
    return PolicyRetriever(FakeStore(), embeddings=FakeEmbeddings())


def test_hybrid_retrieval_finds_table_row(retriever):
    results = retriever.retrieve("credit card refund business days")

    assert results[0]["docId"] == "GT-POL-PR-01"
    assert results[0]["sectionNumber"] == "8"
    assert results[0]["chunkType"] == "table_row"


def test_collection_filter_applies_only_when_explicit(retriever):
    all_results = retriever.retrieve("damaged parcel refund")
    delivery_only = retriever.retrieve(
        "damaged parcel refund",
        RetrievalOptions(collection="delivery_shipping"),
    )

    assert {result["docId"] for result in all_results} == {
        "GT-POL-DS-01",
        "GT-POL-PR-01",
        "GT-POL-WS-01",
    }
    assert {result["docId"] for result in delivery_only} == {"GT-POL-DS-01"}


def test_low_rrf_score_returns_no_chunks(retriever, monkeypatch):
    monkeypatch.setattr(
        "ai_agent.policy_rag.retriever.settings.policy_retrieval_min_score",
        1,
    )

    assert retriever.retrieve("a question") == []


def test_near_duplicate_keeps_faq_when_question_matches_it_better():
    section = {
        "text": "Defective graphics cards may be returned within 7 days for replacement.",
        "metadata": {"chunkType": "section"},
    }
    faq = {
        "text": "Q: Can I return a defective graphics card? A: Defective graphics cards may be returned within 7 days for replacement.",
        "metadata": {"chunkType": "faq"},
    }

    results = PolicyRetriever._remove_near_duplicates(
        "Can I return a defective graphics card?",
        [section, faq],
    )
    assert len(results) == 1
    assert results[0]["metadata"]["chunkType"] == "faq"


def test_near_duplicate_removal_preserves_cross_policy_evidence():
    section = {"text": "The item can be returned within 7 days.", "metadata": {"collection": "warranty_service", "chunkType": "section"}}
    faq = {"text": "The item can be returned within 7 days.", "metadata": {"collection": "payment_refunds", "chunkType": "faq"}}

    results = PolicyRetriever._remove_near_duplicates(
        "Can I return the item?",
        [section, faq],
    )

    assert len(results) == 2


def test_cross_policy_question_surfaces_each_relevant_collection():
    candidates = [
        {"metadata": {"collection": "payment_refunds", "chunkId": "payment"}, "score": 0.05},
        {"metadata": {"collection": "delivery_shipping", "chunkId": "delivery"}, "score": 0.04},
        {"metadata": {"collection": "warranty_service", "chunkId": "warranty"}, "score": 0.03},
    ]

    results = PolicyRetriever._ensure_collection_coverage(
        "Can I return the item and where is my parcel?",
        candidates,
        2,
    )

    assert {item["metadata"]["collection"] for item in results} == {
        "delivery_shipping",
        "warranty_service",
    }


def test_evidence_synonyms_expand_for_keyword_search():
    from ai_agent.policy_rag.retriever import _expanded_tokens

    expanded = _expanded_tokens("What evidence is needed?")

    assert {"proof", "documents", "information", "provide", "required"} <= set(expanded)


def test_out_of_scope_questions_do_not_call_ollama_or_retrieval(monkeypatch):
    def fail(*_args, **_kwargs):
        raise AssertionError("Out-of-scope query must not invoke retrieval or Ollama.")

    monkeypatch.setattr(answer, "retrieve", fail)
    result = asyncio.run(
        answer.answer_policy_question("What is the current price of an RTX 5070?")
    )

    assert "I don't know" in result["answer"]
    assert "support@gentech.example" in result["answer"]
    assert result["sources"] == []


def test_policy_question_uses_grounded_rag_without_database_tool_routing(monkeypatch):
    async def fake_policy_answer(question, history, **_kwargs):
        assert question == "How much is delivery?"
        assert history == []
        return {
            "answer": "The fee is BDT 120.",
            "sources": [{"docTitle": "Delivery Policy", "chunkId": "delivery-fee"}],
        }

    def fail_database_route(*_args, **_kwargs):
        raise AssertionError("Policy-only questions must not enter the database tool loop.")

    monkeypatch.setattr(answer, "answer_policy_question", fake_policy_answer)
    monkeypatch.setattr(answer, "answer_database_chat", fail_database_route)
    result = asyncio.run(
        answer.answer_chat_message("How much is delivery?", db=object())
    )

    assert result["answer"] == "The fee is BDT 120."
    assert result["sources"][0]["chunkId"] == "delivery-fee"


def test_chat_answers_general_questions_without_policy_retrieval(monkeypatch):
    from langchain_core.messages import AIMessage

    class FakeChat:
        def bind_tools(self, tools):
            assert "search_policies" not in {tool.name for tool in tools}
            return self

        async def ainvoke(self, messages):
            assert len(messages) == 4
            assert messages[0].type == "system"
            assert any(
                isinstance(message, AIMessage) and message.content == "Hi"
                for message in messages
            )
            assert any(
                message.type == "human" and message.content == "Hello"
                for message in messages
            )
            return SimpleNamespace(content="Hi! What would you like to know?")

    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeChat())

    result = asyncio.run(
        answer.answer_chat_message(
            "How are you?",
            [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}],
            db=object(),
        )
    )

    assert result == {"answer": "Hi! What would you like to know?", "sources": []}


def test_chat_streams_model_deltas(monkeypatch):
    from langchain_core.messages import AIMessageChunk

    class FakeChat:
        def bind_tools(self, tools):
            return self

        async def astream(self, _messages):
            yield AIMessageChunk(content="Hello")
            yield AIMessageChunk(content=" there")

    deltas = []

    async def on_delta(text):
        deltas.append(text)

    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeChat())
    result = asyncio.run(
        answer.answer_chat_message(
            "How are you?",
            db=object(),
            on_delta=on_delta,
        )
    )

    assert result["answer"] == "Hello there"
    assert deltas == ["Hello", " there"]


@pytest.mark.parametrize(
    ("question", "history", "expected"),
    [
        ("What is your return policy?", [], "POLICY"),
        ("How are you?", [], "GENERAL"),
        ("Where is my order?", [], "ORDER"),
        ("Build me a PC under BDT 100,000", [], "BUILD"),
        ("Suggest a monitor around BDT 25,000", [], "PRODUCT_RECOMMENDATION"),
        ("Compare an RTX 4070 vs RTX 5070", [], "COMPARE"),
        (
            "What about outside Dhaka?",
            [{"role": "user", "content": "How much is delivery to Chattogram?"}],
            "POLICY",
        ),
        (
            "What about movies?",
            [{"role": "user", "content": "Tell me about science fiction."}],
            "GENERAL",
        ),
    ],
)
def test_chat_intent_routes_locally_without_model_call(
    question,
    history,
    expected,
):
    assert answer._classify_chat_intent(question, history) == expected


def test_chat_model_uses_configured_ollama_settings(monkeypatch):
    from ai_agent.policy_rag import settings as settings_module

    monkeypatch.setattr(settings_module.settings, "ollama_chat_model", "qwen2.5:3b")
    monkeypatch.setattr(settings_module.settings, "ollama_base_url", "http://ollama.local:11434")
    monkeypatch.setattr(settings_module.settings, "policy_timeout_seconds", 17)
    captured = {}

    def fake_model(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(answer, "ChatOllama", fake_model)

    answer._create_chat_model()

    assert captured == {
        "model": "qwen2.5:3b",
        "base_url": "http://ollama.local:11434",
        "client_kwargs": {"timeout": 17},
        "async_client_kwargs": {"timeout": 17},
    }


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("Where is my order now?", False),
        ("What are the specs of an RTX 5070?", True),
        ("RTX 5070-এর দাম কত?", True),
        ("What does it cost to live in Dhaka?", False),
        ("চট্টগ্রামে ডেলিভারি চার্জ কত?", False),
    ],
)
def test_scope_detection_distinguishes_lookup_from_policy_question(question, expected):
    assert answer.is_out_of_scope(question) is expected


def test_order_and_build_followups_are_routed_from_history():
    assert answer._classify_chat_intent(
        "GT-2026-000001",
        [
            {
                "role": "assistant",
                "content": "Please share your order number or order ID.",
            }
        ],
    ) == "ORDER"
    assert answer._classify_chat_intent(
        "BDT 100,000",
        [{"role": "user", "content": "Suggest a desktop PC build."}],
    ) == "BUILD"
    assert answer._classify_chat_intent(
        "I care most about refresh rate",
        [{"role": "user", "content": "Suggest a monitor around BDT 25,000"}],
    ) == "PRODUCT_RECOMMENDATION"


def test_new_policy_or_general_turn_is_not_overridden_by_old_tool_topics():
    history = [
        {"role": "user", "content": "Suggest a monitor around BDT 25,000"},
        {"role": "assistant", "content": "I recommend Monitor A for your budget."},
        {"role": "user", "content": "Build a desktop PC under BDT 100,000"},
        {"role": "assistant", "content": "Here is a balanced build."},
        {"role": "user", "content": "Where is my order GT-2026-000001?"},
        {"role": "assistant", "content": "Your order is accepted."},
    ]

    assert answer._classify_chat_intent(
        "What is the warranty policy?",
        history,
    ) == "POLICY"
    assert answer._classify_chat_intent("How are you?", history) == "GENERAL"


def test_build_budget_followup_requires_an_active_budget_question():
    assert answer._classify_chat_intent(
        "BDT 100,000",
        [
            {"role": "user", "content": "Suggest a desktop PC build."},
            {"role": "assistant", "content": "What is your total budget in BDT?"},
        ],
    ) == "BUILD"
    assert answer._classify_chat_intent(
        "BDT 100,000",
        [
            {"role": "user", "content": "Suggest a desktop PC build."},
            {"role": "assistant", "content": "Here is a balanced build."},
        ],
    ) == "GENERAL"


def test_product_category_extraction_and_near_price_parsing():
    assert answer._extract_product_category("looking for a graphics card") == "graphics_cards"
    assert answer._extract_product_category("monitor") == "monitors"
    assert answer._extract_product_category("graphics_cards") == "graphics_cards"
    assert answer._extract_product_category("which is best?") is None
    assert answer._extract_budget_bdt("Suggest a monitor near ৳25,000") == 25000
    assert answer._extract_bare_price_bdt("25,000") == 25000
    assert answer._extract_bare_price_bdt("25k") == 25000
    assert answer._extract_bare_price_bdt("Refresh rate matters more") is None


def test_product_recommendation_context_resolves_latest_category_and_price_from_history():
    category, price = answer._resolve_product_recommendation_context(
        "25,000",
        [
            {"role": "user", "content": "Suggest a monitor"},
            {"role": "assistant", "content": "I found a few options around your budget."},
        ],
    )
    assert category == "monitors"
    assert price == 25000

    category, price = answer._resolve_product_recommendation_context(
        "monitor",
        [
            {"role": "user", "content": "Suggest a product around BDT 25,000"},
            {
                "role": "assistant",
                "content": "Which category should I search: casings, graphics cards, keyboards, laptops, mice, monitors, motherboards, power supplies, processors, RAM, SSDs, or UPS?",
            },
        ],
    )
    assert category == "monitors"
    assert price == 25000


def test_budget_parser_normalizes_common_bdt_formats():
    assert answer._extract_budget_bdt("Build a PC under BDT 100k") == 100000
    assert answer._extract_budget_bdt("My 1 lakh budget is fixed") == 100000
    assert answer._extract_budget_bdt("Suggest a PC for ৳75,000") == 75000


def test_order_status_asks_for_id_without_calling_model(monkeypatch):
    async def fail_model(*_args, **_kwargs):
        raise AssertionError("An order lookup without an ID must ask for it first.")

    monkeypatch.setattr(answer, "_create_chat_model", fail_model)
    result = asyncio.run(answer.answer_chat_message("Where is my order?"))

    assert "order number" in result["answer"]
    assert result["sources"] == []


def test_pc_build_asks_for_budget_without_calling_model(monkeypatch):
    async def fail_model(*_args, **_kwargs):
        raise AssertionError("A PC build without a budget must ask for one first.")

    monkeypatch.setattr(answer, "_create_chat_model", fail_model)
    result = asyncio.run(answer.answer_chat_message("Suggest a full PC build."))

    assert "budget in BDT" in result["answer"]
    assert result["sources"] == []


def test_product_recommendation_asks_for_category_before_model_call(monkeypatch):
    async def fail_model(*_args, **_kwargs):
        raise AssertionError("A product recommendation without a category must clarify first.")

    monkeypatch.setattr(answer, "_create_chat_model", fail_model)
    result = asyncio.run(
        answer.answer_chat_message("Suggest a product around BDT 25,000")
    )

    assert "Which category" in result["answer"]
    assert result["sources"] == []


def test_mixed_product_and_policy_question_answers_policy_and_clarifies(monkeypatch):
    async def fake_policy_answer(question, history, **_kwargs):
        assert "delivery policy" in question
        return {
            "answer": "Delivery fees depend on the destination. Source: Delivery Policy.",
            "sources": [{"docTitle": "Delivery Policy", "chunkId": "delivery"}],
        }

    monkeypatch.setattr(answer, "answer_policy_question", fake_policy_answer)
    result = asyncio.run(
        answer.answer_chat_message(
            "Suggest a product around BDT 25,000 and what is the delivery policy?",
            db=object(),
        )
    )

    assert "Delivery fees depend on the destination." in result["answer"]
    assert "Which category should I search" in result["answer"]
    assert result["sources"][0]["chunkId"] == "delivery"


def test_mixed_order_and_policy_question_combines_rag_and_order_answer(monkeypatch):
    async def fake_policy_answer(question, history, **_kwargs):
        assert "return policy" in question
        return {
            "answer": "The published policy allows returns under its stated conditions.",
            "sources": [{"docTitle": "Returns Policy", "chunkId": "return-policy"}],
        }

    async def fake_database_answer(question, history, db, intent, *_args, **kwargs):
        assert intent == "ORDER"
        assert db is not None
        assert kwargs["on_progress"] is None
        return {"answer": "Your order has shipped.", "sources": []}

    monkeypatch.setattr(answer, "answer_policy_question", fake_policy_answer)
    monkeypatch.setattr(answer, "answer_database_chat", fake_database_answer)

    result = asyncio.run(
        answer.answer_chat_message(
            "What is the order status and return policy for GT-2026-000001?",
            db=object(),
            customer_id="customer-1",
        )
    )

    assert "policy allows returns" in result["answer"]
    assert "Your order has shipped." in result["answer"]
    assert result["sources"][0]["chunkId"] == "return-policy"


def test_order_tool_call_uses_database_result(monkeypatch):
    from langchain_core.messages import AIMessage, ToolMessage

    class FakeOrders:
        async def find_one(self, query, projection):
            assert query["$and"][0]["$or"][0] == {
                "orderNumber": "GT-2026-000001"
            }
            assert query["$and"][1]["customerId"]["$in"] == ["customer-1"]
            assert "shippingAddress" not in projection
            return {
                "orderNumber": "GT-2026-000001",
                "customerId": "customer-1",
                "status": "accepted",
                "createdAt": "2026-10-18T12:30:00Z",
                "statusHistory": [],
            }

    class FakeDatabase:
        def __getitem__(self, name):
            assert name == "orders"
            return FakeOrders()

    class FakeModel:
        def bind_tools(self, tools):
            assert {tool.name for tool in tools} == {
                "lookup_order_status",
                "get_pc_build_inventory",
                "find_products_near_price",
            }
            return self

        async def ainvoke(self, messages):
            if not any(isinstance(message, ToolMessage) for message in messages):
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "lookup_order_status",
                            "args": {"order_id": "GT-2026-000001"},
                            "id": "order-lookup",
                            "type": "tool_call",
                        }
                    ],
                )
            tool_result = next(
                message.content
                for message in messages
                if isinstance(message, ToolMessage)
            )
            assert '"status": "accepted"' in tool_result
            return AIMessage(content="Your order has been accepted.")

    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeModel())
    result = asyncio.run(
        answer.answer_chat_message(
            "Where is my order GT-2026-000001?",
            db=FakeDatabase(),
            customer_id="customer-1",
        )
    )

    assert result == {"answer": "Your order has been accepted.", "sources": []}


def test_database_chat_discovers_and_calls_tools_over_mcp(monkeypatch):
    from contextlib import asynccontextmanager
    from langchain_core.messages import AIMessage, ToolMessage

    order_tool = SimpleNamespace(
        name="lookup_order_status",
        description="Look up the signed-in customer's order.",
        input_schema={
            "type": "object",
            "properties": {"order_id": {"type": "string"}},
            "required": ["order_id"],
        },
    )
    other_tools = [
        SimpleNamespace(
            name="get_pc_build_inventory",
            description="Find current build inventory.",
            input_schema={"type": "object", "properties": {}},
        ),
        SimpleNamespace(
            name="find_products_near_price",
            description="Find products near a price.",
            input_schema={"type": "object", "properties": {}},
        ),
    ]

    class FakeMCPClient:
        called_tool = None

        async def list_tools(self):
            return SimpleNamespace(tools=[order_tool, *other_tools])

        async def call_tool(self, name, arguments):
            self.called_tool = (name, arguments)
            return SimpleNamespace(
                is_error=False,
                structured_content=None,
                content=[SimpleNamespace(text='{"status":"accepted"}')],
            )

    mcp_client = FakeMCPClient()

    @asynccontextmanager
    async def fake_open_chat_mcp_client(token):
        assert token == "customer-jwt"
        yield mcp_client

    from backend.app.services import chat_mcp_client

    monkeypatch.setattr(
        chat_mcp_client,
        "open_chat_mcp_client",
        fake_open_chat_mcp_client,
    )

    class FakeModel:
        def bind_tools(self, tools):
            assert {tool["function"]["name"] for tool in tools} == {
                "lookup_order_status",
                "get_pc_build_inventory",
                "find_products_near_price",
            }
            assert next(
                tool["function"]["parameters"]
                for tool in tools
                if tool["function"]["name"] == "lookup_order_status"
            ) == order_tool.input_schema
            return self

        async def ainvoke(self, messages):
            if not any(isinstance(message, ToolMessage) for message in messages):
                return AIMessage(
                    content="",
                    tool_calls=[
                        {
                            "name": "lookup_order_status",
                            "args": {"order_id": "GT-2026-000001"},
                            "id": "mcp-order-lookup",
                            "type": "tool_call",
                        }
                    ],
                )
            tool_result = next(
                message.content
                for message in messages
                if isinstance(message, ToolMessage)
            )
            assert '"status":"accepted"' in tool_result
            return AIMessage(content="Your order has been accepted.")

    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeModel())
    result = asyncio.run(
        answer.answer_chat_message(
            "Where is my order GT-2026-000001?",
            mcp_access_token="customer-jwt",
        )
    )

    assert mcp_client.called_tool == (
        "lookup_order_status",
        {"order_id": "GT-2026-000001"},
    )
    assert result == {"answer": "Your order has been accepted.", "sources": []}


def test_mcp_product_lookup_decodes_wrapped_result_and_returns_product_card(monkeypatch):
    from contextlib import asynccontextmanager

    product = {
        "id": "monitor-123",
        "name": "Monitor near budget",
        "priceBDT": 25000,
        "discountPercent": 0,
        "finalPriceBDT": 25000,
        "stock": 4,
        "image": "monitors/monitor.jpg",
        "images": ["monitors/monitor.jpg"],
        "features": [],
    }
    catalog_json = json.dumps(
        {
            "category": "monitors",
            "targetPriceBDT": 25000,
            "catalogCount": 1,
            "availableCount": 1,
            "products": [product],
        }
    )
    tool_definitions = [
        SimpleNamespace(
            name=name,
            description="",
            input_schema={"type": "object", "properties": {}},
        )
        for name in (
            "lookup_order_status",
            "get_pc_build_inventory",
            "find_products_near_price",
        )
    ]

    class FakeMCPClient:
        async def list_tools(self):
            return SimpleNamespace(tools=tool_definitions)

        async def call_tool(self, name, arguments):
            assert name == "find_products_near_price"
            assert arguments == {
                "category": "monitors",
                "target_price_bdt": 25000,
            }
            return SimpleNamespace(
                is_error=False,
                structured_content={"result": catalog_json},
                content=[],
            )

    @asynccontextmanager
    async def fake_open_chat_mcp_client(_token):
        yield FakeMCPClient()

    from backend.app.services import chat_mcp_client

    monkeypatch.setattr(
        chat_mcp_client,
        "open_chat_mcp_client",
        fake_open_chat_mcp_client,
    )

    result = asyncio.run(
        answer.answer_chat_message(
            "Suggest a monitor around BDT 25,000",
            db=object(),
            mcp_access_token="customer-jwt",
        )
    )

    assert "Monitor near budget" in result["answer"]
    assert len(result["suggested_products"]) == 1
    assert result["suggested_products"][0]["id"] == "monitor-123"
    assert result["suggested_products"][0]["finalPrice"] == 25000


def test_recommendations_for_new_categories_work_back_to_back(monkeypatch):
    from contextlib import asynccontextmanager

    features_by_category = {
        "monitors": ["165Hz refresh rate"],
        "processors": ["8 CPU cores"],
        "rams": ["DDR5 memory"],
    }
    calls = []
    tool_definitions = [
        SimpleNamespace(
            name=name,
            description="",
            input_schema={"type": "object", "properties": {}},
        )
        for name in (
            "lookup_order_status",
            "get_pc_build_inventory",
            "find_products_near_price",
        )
    ]

    class FakeMCPClient:
        async def list_tools(self):
            return SimpleNamespace(tools=tool_definitions)

        async def call_tool(self, name, arguments):
            assert name == "find_products_near_price"
            category = arguments["category"]
            calls.append(category)
            product = {
                "id": f"{category}-product",
                "name": f"{category} product",
                "priceBDT": 25_000,
                "discountPercent": 0,
                "finalPriceBDT": 25_000,
                "stock": 2,
                "features": features_by_category[category],
            }
            return SimpleNamespace(
                is_error=False,
                structured_content={
                    "result": json.dumps(
                        {
                            "category": category,
                            "targetPriceBDT": arguments["target_price_bdt"],
                            "products": [product],
                        }
                    )
                },
                content=[],
            )

    @asynccontextmanager
    async def fake_open_chat_mcp_client(_token):
        yield FakeMCPClient()

    from backend.app.services import chat_mcp_client

    monkeypatch.setattr(
        chat_mcp_client,
        "open_chat_mcp_client",
        fake_open_chat_mcp_client,
    )

    async def ask_sequential_recommendations():
        history = []
        results = []
        for question in (
            "Suggest a monitor around BDT 25,000",
            "Suggest a CPU now",
            "Suggest RAM now",
        ):
            result = await answer.answer_chat_message(
                question,
                history=history,
                db=object(),
                conversation_id="sequential-categories",
                mcp_access_token="customer-jwt",
            )
            results.append(result)
            history.extend(
                [
                    {"role": "user", "content": question},
                    {"role": "assistant", "content": result["answer"]},
                ]
            )
        return results

    results = asyncio.run(ask_sequential_recommendations())

    assert calls == ["monitors", "processors", "rams"]
    assert "165Hz refresh rate" in results[0]["answer"]
    assert "8 CPU cores" in results[1]["answer"]
    assert "DDR5 memory" in results[2]["answer"]
    assert all(result.get("hitl_pending") for result in results)


def test_new_recommendation_is_not_consumed_as_previous_feature_choice():
    history = [
        {"role": "user", "content": "Suggest a monitor around BDT 25,000"},
        {
            "role": "assistant",
            "content": (
                "Which feature should I prioritize? Choose one:\n"
                "1. High refresh rate\n2. Resolution"
            ),
        },
    ]

    assert not answer._is_feature_selection_response("Suggest a CPU now", history)
    assert answer._is_feature_selection_response("2", history)
    assert answer._is_feature_selection_response("Resolution", history)
    assert not answer._feature_menu_options(
        history
        + [{"role": "assistant", "content": "I recommend Monitor A."}]
    )


def test_product_recommendation_asks_priorities_then_selects_from_live_products(monkeypatch):
    class FakeCursor:
        async def to_list(self, length=None):
            return [
                {
                    "_id": "monitor-a",
                    "name": "Monitor A",
                    "price": 26000,
                    "availability": 3,
                    "images": ["monitors/monitor-a.jpg"],
                    "features": [
                        "180Hz refresh rate",
                        "Adaptive-Sync",
                        "Low blue light",
                        "Curved display",
                    ],
                },
                {
                    "_id": "monitor-b",
                    "name": "Monitor B",
                    "price": 24000,
                    "availability": 1,
                    "features": [
                        "HDR10",
                        "Low blue light",
                        "Wide color gamut",
                    ],
                },
            ]

    class FakeMonitors:
        def find(self, query, projection):
            assert query == {}
            return FakeCursor()

    class FakeDatabase:
        def __getitem__(self, name):
            assert name == "monitors"
            return FakeMonitors()

    initial = asyncio.run(
        answer.answer_chat_message(
            "Suggest a product around BDT 25,000",
            conversation_id="feature-choice-test",
        )
    )
    first = asyncio.run(
        answer.answer_chat_message(
            "monitor",
            history=[
                {"role": "user", "content": "Suggest a product around BDT 25,000"},
                {"role": "assistant", "content": initial["answer"]},
            ],
            db=FakeDatabase(),
            conversation_id="feature-choice-test",
        )
    )
    second = asyncio.run(
        answer.answer_chat_message(
            "4",
            history=[
                {"role": "user", "content": "Suggest a product around BDT 25,000"},
                {"role": "assistant", "content": initial["answer"]},
                {"role": "user", "content": "monitor"},
                {"role": "assistant", "content": first["answer"]},
            ],
            db=FakeDatabase(),
            conversation_id="feature-choice-test",
        )
    )

    assert "Which category" in initial["answer"]
    assert "Which feature should I prioritize?" in first["answer"]
    assert "brand" not in first["answer"].casefold()
    assert "resolution" not in first["answer"].casefold()
    assert "4. 180Hz refresh rate" in first["answer"]
    assert "Curved display" in first["answer"]
    assert first["answer"].count("Low blue light") == 1
    assert "Monitor A" in second["answer"]
    assert "selected feature: 180Hz refresh rate" in second["answer"]
    assert len(second["suggested_products"]) == 1
    assert second["suggested_products"][0]["id"] == "monitor-a"
    assert second["suggested_products"][0]["category"]["slug"] == "monitors"
    assert second["suggested_products"][0]["finalPrice"] == 26000
    assert second["suggested_products"][0]["image"] == "monitors/monitor-a.jpg"
    assert answer._resolve_product_recommendation_context(
        "4",
        [
            {"role": "user", "content": "Suggest a product around BDT 25,000"},
            {"role": "assistant", "content": initial["answer"]},
            {"role": "user", "content": "monitor"},
            {"role": "assistant", "content": first["answer"]},
        ],
    ) == ("monitors", 25000)

    price_prompt = asyncio.run(
        answer.answer_chat_message("Suggest a monitor")
    )
    price_reply = asyncio.run(
        answer.answer_chat_message(
            "25,000",
            history=[
                {"role": "user", "content": "Suggest a monitor"},
                {"role": "assistant", "content": price_prompt["answer"]},
            ],
            db=FakeDatabase(),
        )
    )

    assert "target price" in price_prompt["answer"]
    assert "Which feature should I prioritize?" in price_reply["answer"]


def test_feature_choice_state_is_isolated_for_repeated_recommendations():
    conversation_id = "monitor-then-cpu"
    first_prompt = (
        "I found monitor products. Which feature should I prioritize? "
        "Choose one:\n1. High refresh rate"
    )
    next_prompt = (
        "I found CPU products. Which feature should I prioritize? "
        "Choose one:\n1. More cores"
    )
    history = [{"role": "assistant", "content": first_prompt}]

    async def exercise_repeated_requests():
        first = await answer._run_feature_choice_human_review(
            "Suggest a monitor",
            [],
            conversation_id,
            first_prompt,
        )
        second = await answer._run_feature_choice_human_review(
            "Suggest a CPU now",
            history,
            conversation_id,
            next_prompt,
        )
        third = await answer._run_feature_choice_human_review(
            "Suggest another CPU now",
            history,
            conversation_id,
            next_prompt,
        )
        return first, second, third

    assert asyncio.run(exercise_repeated_requests()) == (True, True, True)


def test_product_recommendation_returns_card_when_catalog_has_no_features():
    class FakeCursor:
        async def to_list(self, length=None):
            return [
                {
                    "_id": "monitor-a",
                    "name": "Monitor A",
                    "price": 25000,
                    "availability": 3,
                    "images": ["monitors/monitor-a.jpg"],
                }
            ]

    class FakeMonitors:
        def find(self, query, projection):
            return FakeCursor()

    class FakeDatabase:
        def __getitem__(self, name):
            assert name == "monitors"
            return FakeMonitors()

    result = asyncio.run(
        answer.answer_chat_message(
            "Suggest a monitor around BDT 25,000",
            db=FakeDatabase(),
        )
    )

    assert len(result["suggested_products"]) == 1
    assert result["suggested_products"][0]["id"] == "monitor-a"
    assert result["suggested_products"][0]["category"]["slug"] == "monitors"


def test_unanswerable_policy_query_uses_support_fallback(monkeypatch):
    monkeypatch.setattr(answer, "retrieve", lambda *_args, **_kwargs: [])
    result = asyncio.run(answer.answer_policy_question("What is Gentech's return window for drones?"))

    assert "couldn't find that answer" in result["answer"]
    assert "support@gentech.example" in result["answer"]
    assert result["sources"] == []


def test_policy_answer_uses_retrieved_chunks_without_appending_citations(monkeypatch):
    retrieved = [{
        "text": "7 to 14 business days",
        "headingPath": "8. Refund Methods and Timelines",
        "docId": "GT-POL-PR-01",
        "docTitle": "Payment, Cancellation and Refunds Policy",
        "sectionNumber": "8.2",
        "sectionTitle": "Expected timelines",
        "pageNumber": 6,
        "chunkType": "table_row",
        "chunkId": "real-chunk-id",
        "score": 0.02,
    }]

    class FakeChat:
        async def ainvoke(self, messages):
            assert "untrusted" in str(messages).casefold()
            return SimpleNamespace(content="Card refunds take 7 to 14 business days.")

    monkeypatch.setattr(answer, "retrieve", lambda *_args, **_kwargs: retrieved)
    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeChat())
    result = asyncio.run(answer.answer_policy_question("How long is a card refund?"))

    assert result["answer"] == "Card refunds take 7 to 14 business days."
    assert result["sources"][0]["chunkId"] == "real-chunk-id"


def test_standalone_policy_question_skips_slow_context_rewrite(monkeypatch):
    retrieved = [{
        "text": "Refunds are processed within 7 to 14 business days.",
        "headingPath": "8. Refund Methods and Timelines",
        "docId": "GT-POL-PR-01",
        "docTitle": "Payment, Cancellation and Refunds Policy",
        "sectionNumber": "8",
        "sectionTitle": "Refund timelines",
        "pageNumber": 6,
        "chunkType": "section",
        "chunkId": "refund-timelines",
        "score": 0.02,
    }]

    def fake_retrieve(question, _options):
        assert question == "How long do card refunds take?"
        return retrieved

    async def fail_rewrite(*_args, **_kwargs):
        raise AssertionError("A standalone policy question must not need a rewrite call.")

    class FakeChat:
        async def ainvoke(self, _messages):
            return SimpleNamespace(content="Refunds take 7 to 14 business days.")

    monkeypatch.setattr(answer, "retrieve", fake_retrieve)
    monkeypatch.setattr(answer, "_rewrite_follow_up", fail_rewrite)
    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeChat())

    result = asyncio.run(
        answer.answer_policy_question(
            "How long do card refunds take?",
            [{"role": "user", "content": "What payment methods are available?"}],
        )
    )

    assert result["answer"] == "Refunds take 7 to 14 business days."


def test_faq_group_sources_are_not_collapsed_to_one_section():
    chunks = [
        {
            "docId": "GT-POL-PR-01",
            "docTitle": "Payment, Cancellation and Refunds Policy",
            "sectionNumber": "12",
            "sectionTitle": "Payment problems",
            "headingPath": "12. Frequently Asked Questions > Payment problems",
            "pageNumber": 12,
            "chunkId": "faq-payment",
            "score": 0.02,
        },
        {
            "docId": "GT-POL-PR-01",
            "docTitle": "Payment, Cancellation and Refunds Policy",
            "sectionNumber": "12",
            "sectionTitle": "Cancellation and refunds",
            "headingPath": "12. Frequently Asked Questions > Cancellation and refunds",
            "pageNumber": 12,
            "chunkId": "faq-refund",
            "score": 0.019,
        },
    ]

    sources = answer._format_sources(chunks)

    assert len(sources) == 2
    assert sources[0]["sectionTitle"] == "Payment problems"


def test_bangla_answer_citation_label_is_localized(monkeypatch):
    retrieved = [{
        "text": "7 to 14 business days",
        "headingPath": "8.2 Expected timelines",
        "docId": "GT-POL-PR-01",
        "docTitle": "Payment, Cancellation and Refunds Policy",
        "sectionNumber": "8.2",
        "sectionTitle": "Expected timelines",
        "pageNumber": 6,
        "chunkType": "table_row",
        "chunkId": "real-chunk-id",
        "score": 0.02,
    }]

    class FakeChat:
        async def ainvoke(self, _messages):
            return SimpleNamespace(content="কার্ডে টাকা ফেরত পেতে ৭ থেকে ১৪ কর্মদিবস লাগে।")

    monkeypatch.setattr(answer, "retrieve", lambda *_args, **_kwargs: retrieved)
    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeChat())
    result = asyncio.run(answer.answer_policy_question("কার্ডে টাকা ফেরত পেতে কতদিন লাগে?"))

    assert result["answer"] == "কার্ডে টাকা ফেরত পেতে ৭ থেকে ১৪ কর্মদিবস লাগে।"


def test_tool_description_matches_policy_scope():
    assert search_policies.name == "search_policies"
    assert search_policies.description == SEARCH_POLICIES_DESCRIPTION
    assert "Do not use for prices, stock, product specs" in search_policies.description


def test_module_tool_result_is_json_chunks(monkeypatch):
    monkeypatch.setattr(
        "ai_agent.policy_rag.tools.retrieve",
        lambda *_args, **_kwargs: [{
            "text": "A policy excerpt",
            "docTitle": "Delivery and Shipping Policy",
            "headingPath": "3. Fees",
            "docId": "GT-POL-DS-01",
            "sectionNumber": "3.1",
            "sectionTitle": "Standard delivery fees",
            "pageNumber": 3,
            "chunkId": "delivery-fee",
            "score": 0.02,
        }],
    )

    raw = search_policies.func("delivery fee")
    chunk = json.loads(raw)[0]
    assert chunk["sectionNumber"] == "3.1"
    assert chunk["docTitle"] == "Delivery and Shipping Policy"
    assert chunk["chunkId"] == "delivery-fee"
