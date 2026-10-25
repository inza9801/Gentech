from pathlib import Path

from ai_agent.policy_rag import embeddings
from ai_agent.policy_rag.settings import BACKEND_ROOT, PolicySettings


def test_relative_pdf_and_vector_paths_resolve_from_backend_root():
    settings = PolicySettings(
        _env_file=None,
        policy_pdf_dir=Path("../ai_agent/rag_knowledge"),
        policy_chroma_dir=Path("./data/policy_chroma"),
    )

    assert settings.policy_pdf_dir == (BACKEND_ROOT / "../ai_agent/rag_knowledge").resolve()
    assert settings.policy_chroma_dir == (BACKEND_ROOT / "./data/policy_chroma").resolve()


def test_create_embeddings_uses_configured_ollama_model(monkeypatch):
    from ai_agent.policy_rag import settings as settings_module

    monkeypatch.setattr(settings_module.settings, "ollama_embedding_model", "nomic-embed-text")
    monkeypatch.setattr(settings_module.settings, "ollama_base_url", "http://ollama.local:11434")
    monkeypatch.setattr(settings_module.settings, "policy_timeout_seconds", 12)
    captured = {}

    def fake_embeddings(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(embeddings, "OllamaEmbeddings", fake_embeddings)

    embeddings.create_embeddings()

    assert captured == {
        "model": "nomic-embed-text",
        "base_url": "http://ollama.local:11434",
        "client_kwargs": {"timeout": 12},
    }
