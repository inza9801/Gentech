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


def test_chat_routes_policy_questions_to_pdf_answer(monkeypatch):
    async def fake_policy_answer(question, history):
        assert question == "How much is delivery?"
        assert history == []
        return {"answer": "The policy says BDT 120.", "sources": []}

    def fail_model():
        raise AssertionError("Keyword-routed policy questions need no classifier call.")

    monkeypatch.setattr(answer, "_create_chat_model", fail_model)
    monkeypatch.setattr(answer, "answer_policy_question", fake_policy_answer)

    result = asyncio.run(answer.answer_chat_message("How much is delivery?"))

    assert result["answer"] == "The policy says BDT 120."
    assert result["sources"] == []


def test_chat_answers_general_questions_without_policy_retrieval(monkeypatch):
    from langchain_core.messages import AIMessage

    class FakeChat:
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

    def fail_retrieval(*_args, **_kwargs):
        raise AssertionError("General chat must not search policy documents.")

    monkeypatch.setattr(answer, "_create_chat_model", lambda: FakeChat())
    monkeypatch.setattr(answer, "retrieve", fail_retrieval)

    result = asyncio.run(
        answer.answer_chat_message(
            "How are you?",
            [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi"}],
        )
    )

    assert result == {"answer": "Hi! What would you like to know?", "sources": []}


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


def test_order_tool_call_uses_database_result(monkeypatch):
    from langchain_core.messages import AIMessage, ToolMessage

    class FakeOrders:
        async def find_one(self, query, projection):
            assert query["$or"][0] == {"orderNumber": "GT-2026-000001"}
            assert "shippingAddress" not in projection
            return {
                "orderNumber": "GT-2026-000001",
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
        )
    )

    assert result == {"answer": "Your order has been accepted.", "sources": []}


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


def test_unanswerable_policy_query_uses_support_fallback(monkeypatch):
    monkeypatch.setattr(answer, "retrieve", lambda *_args, **_kwargs: [])
    result = asyncio.run(answer.answer_policy_question("What is Gentech's return window for drones?"))

    assert "couldn't find that answer" in result["answer"]
    assert "support@gentech.example" in result["answer"]
    assert result["sources"] == []


def test_policy_answer_uses_retrieved_chunks_and_appends_real_citations(monkeypatch):
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

    assert "Source: Payment, Cancellation and Refunds Policy, section 8.2 (Expected timelines), page 6" in result["answer"]
    assert result["sources"][0]["chunkId"] == "real-chunk-id"


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
    assert "section 12 (Payment problems)" in answer._append_citations(
        "Answer", sources, "Question"
    )


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

    assert "\n\nউৎস: " in result["answer"]


def test_tool_description_matches_policy_scope():
    assert search_policies.name == "search_policies"
    assert search_policies.description == SEARCH_POLICIES_DESCRIPTION
    assert "Do not use for prices, stock, product specs" in search_policies.description


def test_module_tool_result_is_json_chunks(monkeypatch):
    monkeypatch.setattr(
        "ai_agent.policy_rag.tools.retrieve",
        lambda *_args, **_kwargs: [{
            "text": "A policy excerpt",
            "headingPath": "3. Fees",
            "docId": "GT-POL-DS-01",
            "sectionNumber": "3.1",
            "score": 0.02,
        }],
    )

    raw = search_policies.func("delivery fee")
    assert json.loads(raw)[0]["sectionNumber"] == "3.1"
