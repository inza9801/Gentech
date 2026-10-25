"""Idempotently parse policy PDFs and persist Ollama vectors in Chroma."""

from __future__ import annotations

import argparse
import logging
from collections import Counter

from ai_agent.policy_rag.documents import PolicyChunk, load_policy_documents
from ai_agent.policy_rag.embeddings import create_embeddings
from ai_agent.policy_rag.store import ChromaPolicyStore

logger = logging.getLogger(__name__)
_EMBEDDING_BATCH_SIZE = 100


def _batches(items: list[PolicyChunk], size: int) -> list[list[PolicyChunk]]:
    return [items[start : start + size] for start in range(0, len(items), size)]


def ingest_policy_pdfs(*, rebuild: bool = False) -> dict[str, object]:
    chunks, source_paths = load_policy_documents()
    store = ChromaPolicyStore()
    if rebuild:
        store.reset()
    existing = store.get_all()
    stored_ids = list(existing["ids"])
    existing_metadata = dict(zip(existing["ids"], existing["metadatas"]))
    existing_text = dict(zip(existing["ids"], existing["documents"]))

    new_by_id = {chunk.chunk_id: chunk for chunk in chunks}
    removed_ids = [chunk_id for chunk_id in stored_ids if chunk_id not in new_by_id]

    unchanged: list[PolicyChunk] = []
    metadata_only: list[PolicyChunk] = []
    changed: list[PolicyChunk] = []
    for chunk in chunks:
        current_metadata = existing_metadata.get(chunk.chunk_id)
        if (
            current_metadata
            and current_metadata.get("contentHash") == chunk.content_hash
            and existing_text.get(chunk.chunk_id) == chunk.text
        ):
            if current_metadata != chunk.metadata:
                metadata_only.append(chunk)
            else:
                unchanged.append(chunk)
        else:
            changed.append(chunk)

    if changed:
        embeddings = create_embeddings()
        for batch in _batches(changed, _EMBEDDING_BATCH_SIZE):
            vectors = embeddings.embed_documents([chunk.text for chunk in batch])
            if len(vectors) != len(batch):
                raise RuntimeError("Ollama returned an unexpected number of embeddings.")
            store.upsert(batch, vectors)
    store.update_metadata(
        [chunk.chunk_id for chunk in metadata_only],
        [chunk.metadata for chunk in metadata_only],
    )
    store.delete(removed_ids)

    counts: Counter[tuple[str, str]] = Counter(
        (str(chunk.metadata["collection"]), str(chunk.metadata["chunkType"]))
        for chunk in chunks
    )
    summary = {
        "documents": len(source_paths),
        "chunks": len(chunks),
        "embedded_or_updated": len(changed),
        "metadata_only": len(metadata_only),
        "unchanged": len(unchanged),
        "deleted": len(removed_ids),
        "chunks_by_collection_and_type": {
            f"{collection}/{chunk_type}": count
            for (collection, chunk_type), count in sorted(counts.items())
        },
    }
    logger.info("Policy ingestion summary: %s", summary)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Re-embed and replace the current policy vector index.",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    try:
        report = ingest_policy_pdfs(rebuild=args.rebuild)
    except Exception as error:
        logger.error("Policy ingestion failed (%s).", type(error).__name__)
        raise SystemExit(1) from error
    print(report)


if __name__ == "__main__":
    main()
