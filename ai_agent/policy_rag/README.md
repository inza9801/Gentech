# Gentech policy RAG

This module answers policy questions only from the three PDFs in
`ai_agent/rag_knowledge`. The PDFs are not modified. Page 1 is skipped; pages
2+ are parsed into section, FAQ, and table-row chunks with source page and
section metadata. Each table row retains its column-header mapping and is
rendered as a self-contained sentence before embedding.

## Configuration

Copy `backend/.env.example` to `backend/.env` if needed. Configure Ollama there.
The defaults use `qwen2.5:3b` for chat and
`nomic-embed-text` for embeddings; Ollama must be running at
`OLLAMA_BASE_URL` (default `http://localhost:11434`). Pull both models if needed:

```powershell
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

`POLICY_PDF_DIR` and `POLICY_CHROMA_DIR` can point to alternate directories.

Chroma is the default persistent vector store; a small adapter in `store.py`
keeps the retrieval layer independent of Chroma APIs. The same chunks are
indexed by BM25 at first query per process. Retrieval uses reciprocal-rank
fusion, boosts likely policy collections without filtering the other policies,
and returns at most six deduplicated chunks by default. The `score` is an
uncalibrated RRF ranking value, not a confidence percentage.
Likely collections and table rows for fee, amount, deadline, and evidence
questions receive configurable ranking boosts; cross-policy results retain
coverage from each relevant collection when matching chunks exist.

`POLICY_RETRIEVAL_RERANKER=none` uses RRF order. Set it to `ollama` to use the
configured Ollama chat model for reranking; if the optional reranker fails, the
retriever logs a warning and retains RRF order. Retrieval also enforces the
configured minimum RRF score.

## Ingest and run

From the repository root:

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python.exe -m ai_agent.policy_rag.ingest
```

Rebuild the index after switching from Gemini embeddings or changing the
embedding model:

```powershell
backend\.venv\Scripts\python.exe -m ai_agent.policy_rag.ingest --rebuild
```

Re-run ingestion after any policy PDF is replaced. Unchanged chunks are not
re-embedded; changed chunks are upserted and stale chunks are deleted.

The app uses `POST /api/chat`, with JSON:

```json
{
  "question": "What is the delivery fee to Chattogram?",
  "history": []
}
```

The endpoint handles ordinary conversation with the configured Ollama chat
model and routes questions about Gentech's written policies through PDF
retrieval. Policy answers include citations from retrieved source metadata.
`POST /api/policy-qa` remains available for policy-only requests. Policy text is
always treated as untrusted data, never as model instructions.

For order-status requests, the assistant asks for an order number or database ID
if one is missing. It looks up the recorded status and estimates a 3–5 business
day delivery window from the order date (an estimate, not a delivery promise);
it does not disclose customer or shipping details. PC-build recommendations
require a stated BDT budget and use in-stock products and current discounted
prices across all 12 catalog categories. Product comparisons use the local
model's general knowledge and are not verified against live inventory. Other
live price, stock, cart, and product-specific warranty questions remain out of
scope. For a single-product recommendation, the assistant can search one stated
category near a target BDT price, ask about feature priorities, then recommend
from the matching in-stock products. Catalog access is read-only and restricted
to that validated category; the model has no unrestricted database access.

## Tests and evaluation

From the repository root:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q backend\tests ai_agent\policy_rag\tests
backend\.venv\Scripts\python.exe -m ai_agent.policy_rag.evaluate
```

The evaluation dataset contains 57 English, Bangla, and mixed-language
questions with expected source sections, multi-policy questions, table lookups,
and deterministic out-of-scope cases. It reports hit-rate@5 and a pass/fail
summary. Run ingestion before evaluation; the evaluator batches its query
embeddings and uses the persistent index.

## Store and embedding changes

Implement the `PolicyVectorStore` interface in `store.py` to replace Chroma.
The current embedding adapter in `embeddings.py` uses Ollama through
`langchain-ollama`; embedding and chat models are configured separately.
Re-ingest after changing embedding models because a vector index cannot safely
mix embedding dimensions or model spaces.
