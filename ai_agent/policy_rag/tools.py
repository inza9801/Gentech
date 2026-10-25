"""Native LangChain policy search function; no MCP server is involved."""

import json
from typing import Any

from langchain_core.tools import tool

from ai_agent.policy_rag.retriever import RetrievalOptions, retrieve

SEARCH_POLICIES_DESCRIPTION = (
    "Search Gentech's written policies on warranty, returns, replacements, service "
    "claims, payment methods, COD, cancellation, refunds, failed or duplicate "
    "payments, delivery fees, delivery times, failed delivery, damaged parcels and "
    "pickup. Do not use for prices, stock, product specs, product warranty periods, "
    "carts or order status."
)


@tool(description=SEARCH_POLICIES_DESCRIPTION)
def search_policies(query: str, collection: str | None = None) -> str:
    """Search Gentech policy documents and return matching cited chunks."""
    results: list[dict[str, Any]] = retrieve(
        query,
        RetrievalOptions(collection=collection),
    )
    return json.dumps(
        [
            {
                "text": chunk["text"],
                "headingPath": chunk["headingPath"],
                "docId": chunk["docId"],
                "sectionNumber": chunk["sectionNumber"],
                "score": chunk["score"],
            }
            for chunk in results
        ],
        ensure_ascii=False,
    )
