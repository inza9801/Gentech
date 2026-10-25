"""Environment-backed settings for the policy RAG module."""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"


class PolicyConfigurationError(RuntimeError):
    """Raised when required policy RAG provider configuration is missing."""


class PolicySettings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "qwen2.5:3b"
    ollama_embedding_model: str = "nomic-embed-text"
    policy_pdf_dir: Path = PROJECT_ROOT / "ai_agent" / "rag_knowledge"
    policy_chroma_dir: Path = BACKEND_ROOT / "data" / "policy_chroma"
    policy_chroma_collection: str = "gentech_policy_chunks"
    policy_retrieval_candidate_count: int = 20
    policy_retrieval_top_k: int = 6
    policy_retrieval_rrf_constant: int = 60
    policy_retrieval_min_score: float = 0.012
    policy_retrieval_dedup_threshold: int = 90
    policy_retrieval_collection_boost: float = 1.3
    policy_retrieval_table_boost: float = 1.2
    policy_retrieval_reranker: str = "none"
    policy_timeout_seconds: int = 45
    policy_chunk_max_tokens: int = 500
    policy_chunk_overlap_tokens: int = 50

    @field_validator("policy_pdf_dir", "policy_chroma_dir", mode="after")
    @classmethod
    def resolve_relative_paths(cls, value: Path) -> Path:
        if value.is_absolute():
            return value
        return (BACKEND_ROOT / value).resolve()

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        extra="ignore",
    )


settings = PolicySettings()
