"""Small persistent vector-store adapter; Chroma can be swapped independently."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol

from chromadb import PersistentClient
from chromadb.api.models.Collection import Collection

from ai_agent.policy_rag.documents import PolicyChunk
from ai_agent.policy_rag.settings import settings


class PolicyVectorStore(Protocol):
    def get_all(self) -> dict[str, list[Any]]: ...

    def upsert(self, chunks: list[PolicyChunk], embeddings: list[list[float]]) -> None: ...

    def update_metadata(self, chunk_ids: list[str], metadatas: list[dict[str, Any]]) -> None: ...

    def delete(self, chunk_ids: list[str]) -> None: ...

    def search(
        self,
        embedding: list[float],
        count: int,
        collection: str | None = None,
    ) -> dict[str, list[list[Any]]]: ...


class ChromaPolicyStore:
    """Chroma persistence adapter using precomputed Ollama embeddings."""

    def __init__(
        self,
        directory: Path | None = None,
        collection_name: str | None = None,
        *,
        create: bool = True,
    ) -> None:
        path = directory or settings.policy_chroma_dir
        name = collection_name or settings.policy_chroma_collection
        if not create and not path.is_dir():
            raise FileNotFoundError(
                f"Policy vector index is missing at {path}. "
                "Run `python -m ai_agent.policy_rag.ingest` first."
            )
        self.client = PersistentClient(path=str(path))
        collection_names = {
            item.name for item in self.client.list_collections()
        }
        if not create and name not in collection_names:
            raise FileNotFoundError(
                f"Policy vector collection {name!r} is missing. "
                "Run `python -m ai_agent.policy_rag.ingest` first."
            )
        self.collection: Collection
        if create:
            self.collection = self.client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"},
            )
        else:
            self.collection = self.client.get_collection(name=name)

    def get_all(self) -> dict[str, list[Any]]:
        return self.collection.get(include=["documents", "metadatas"])

    def reset(self) -> None:
        """Replace this collection so a rebuild can change embedding dimensions."""
        name = self.collection.name
        self.client.delete_collection(name=name)
        self.collection = self.client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert(
        self,
        chunks: list[PolicyChunk],
        embeddings: list[list[float]],
    ) -> None:
        if not chunks:
            return
        self.collection.upsert(
            ids=[chunk.chunk_id for chunk in chunks],
            documents=[chunk.text for chunk in chunks],
            metadatas=[chunk.metadata for chunk in chunks],
            embeddings=embeddings,
        )

    def update_metadata(
        self,
        chunk_ids: list[str],
        metadatas: list[dict[str, Any]],
    ) -> None:
        if chunk_ids:
            self.collection.update(ids=chunk_ids, metadatas=metadatas)

    def delete(self, chunk_ids: list[str]) -> None:
        if chunk_ids:
            self.collection.delete(ids=chunk_ids)

    def search(
        self,
        embedding: list[float],
        count: int,
        collection: str | None = None,
    ) -> dict[str, list[list[Any]]]:
        options: dict[str, Any] = {}
        if collection:
            options["where"] = {"collection": collection}
        return self.collection.query(
            query_embeddings=[embedding],
            n_results=count,
            include=["documents", "metadatas", "distances"],
            **options,
        )


def count_by_metadata(rows: list[dict[str, Any]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        value = str(row.get(key, "unknown"))
        counts[value] = counts.get(value, 0) + 1
    return counts
