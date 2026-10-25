"""Request and response schemas for customer chat and policy questions."""

from typing import Literal

from pydantic import BaseModel, Field


class PolicyChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class PolicyQARequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[PolicyChatMessage] = Field(default_factory=list, max_length=8)
    conversation_id: str | None = Field(default=None, min_length=1, max_length=128)


class PolicySource(BaseModel):
    docId: str
    docTitle: str
    sectionNumber: str
    sectionTitle: str
    headingPath: str
    pageNumber: int | None = None
    chunkId: str
    score: float = Field(ge=0)


class PolicyQAResponse(BaseModel):
    answer: str
    sources: list[PolicySource]
    conversation_id: str | None = None
    hitl_pending: bool = False
