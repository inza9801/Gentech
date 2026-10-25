from ai_agent.policy_rag import ingest
from ai_agent.policy_rag.documents import PolicyChunk


def _chunk(*, text="Policy body", section="1", content_hash="hash-1"):
    metadata = {
        "collection": "delivery_shipping",
        "docId": "GT-POL-DS-01",
        "docTitle": "Delivery and Shipping Policy",
        "docVersion": "1.0",
        "sectionNumber": section,
        "sectionTitle": "Delivery",
        "headingPath": "1. Delivery",
        "chunkType": "section",
        "pageNumber": 2,
        "chunkId": f"chunk-{section}",
        "contentHash": content_hash,
    }
    return PolicyChunk(
        chunk_id=f"chunk-{section}",
        content_hash=content_hash,
        text=text,
        metadata=metadata,
    )


class FakeStore:
    def __init__(self, existing=None):
        self.existing = existing or {
            "ids": [],
            "metadatas": [],
            "documents": [],
        }
        self.upserted = []
        self.updated = []
        self.deleted = []
        self.reset_called = False

    def get_all(self):
        return self.existing

    def reset(self):
        self.reset_called = True
        self.existing = {"ids": [], "metadatas": [], "documents": []}

    def upsert(self, chunks, embeddings):
        self.upserted.extend(zip(chunks, embeddings))

    def update_metadata(self, chunk_ids, metadatas):
        self.updated.extend(zip(chunk_ids, metadatas))

    def delete(self, chunk_ids):
        self.deleted.extend(chunk_ids)


def test_unchanged_index_skips_embedding_provider(monkeypatch):
    chunk = _chunk()
    store = FakeStore({
        "ids": [chunk.chunk_id],
        "metadatas": [chunk.metadata],
        "documents": [chunk.text],
    })
    monkeypatch.setattr(ingest, "load_policy_documents", lambda: ([chunk], [object()]))
    monkeypatch.setattr(ingest, "ChromaPolicyStore", lambda: store)
    monkeypatch.setattr(
        ingest,
        "create_embeddings",
        lambda: (_ for _ in ()).throw(AssertionError("No changed chunks to embed.")),
    )

    report = ingest.ingest_policy_pdfs()

    assert report["unchanged"] == 1
    assert report["embedded_or_updated"] == 0
    assert store.upserted == []
    assert store.deleted == []


def test_changed_and_removed_chunks_are_upserted_and_deleted(monkeypatch):
    changed = _chunk(text="Updated delivery body", content_hash="hash-2")
    old_metadata = {**changed.metadata, "contentHash": "hash-1"}
    stale_metadata = {**changed.metadata, "chunkId": "removed-chunk"}
    store = FakeStore({
        "ids": [changed.chunk_id, "removed-chunk"],
        "metadatas": [old_metadata, stale_metadata],
        "documents": ["Old body", "Removed body"],
    })
    monkeypatch.setattr(ingest, "load_policy_documents", lambda: ([changed], [object()]))
    monkeypatch.setattr(ingest, "ChromaPolicyStore", lambda: store)
    monkeypatch.setattr(
        ingest,
        "create_embeddings",
        lambda: type("FakeEmbeddings", (), {
            "embed_documents": lambda _self, texts: [[float(len(texts[0]))]]
        })(),
    )

    report = ingest.ingest_policy_pdfs()

    assert report["embedded_or_updated"] == 1
    assert report["deleted"] == 1
    assert store.upserted[0][0] == changed
    assert store.deleted == ["removed-chunk"]


def test_rebuild_resets_existing_collection_before_embedding(monkeypatch):
    chunk = _chunk()
    store = FakeStore({
        "ids": [chunk.chunk_id],
        "metadatas": [chunk.metadata],
        "documents": [chunk.text],
    })
    monkeypatch.setattr(ingest, "load_policy_documents", lambda: ([chunk], [object()]))
    monkeypatch.setattr(ingest, "ChromaPolicyStore", lambda: store)
    monkeypatch.setattr(
        ingest,
        "create_embeddings",
        lambda: type("FakeEmbeddings", (), {
            "embed_documents": lambda _self, texts: [[float(len(texts[0]))]]
        })(),
    )

    report = ingest.ingest_policy_pdfs(rebuild=True)

    assert store.reset_called
    assert report["embedded_or_updated"] == 1
    assert report["unchanged"] == 0
    assert store.upserted[0][0] == chunk
