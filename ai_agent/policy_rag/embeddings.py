"""Configurable Ollama embeddings for policy chunk indexing and retrieval."""

from langchain_ollama import OllamaEmbeddings
from ai_agent.policy_rag.settings import PolicyConfigurationError, settings

def create_embeddings() -> OllamaEmbeddings:
    if not settings.ollama_embedding_model:
        raise PolicyConfigurationError(
            "OLLAMA_EMBEDDING_MODEL is not configured in backend/.env."
        )
    return OllamaEmbeddings(
        model=settings.ollama_embedding_model,
        base_url=settings.ollama_base_url,
        client_kwargs={"timeout": settings.policy_timeout_seconds},
    )
