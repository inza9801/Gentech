"""Thin FastAPI adapter for the policy RAG service in ai_agent."""

from __future__ import annotations

import asyncio
import logging
import sys
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai_agent.policy_rag.answer import (
    PolicyConfigurationError,
    answer_chat_message,
    answer_policy_question,
)
from ai_agent.policy_rag.settings import settings
from app.schemas.policy_qa import PolicyQARequest, PolicyQAResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Policy QA"])
ChatAnswer = Callable[
    [str, list[dict[str, str]]],
    Awaitable[dict[str, Any]],
]


async def _run_chat(
    body: PolicyQARequest,
    answer_function: ChatAnswer,
) -> PolicyQAResponse:
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question must not be empty.")
    history = [message.model_dump() for message in body.history]
    try:
        result = await asyncio.wait_for(
            answer_function(question, history),
            timeout=settings.policy_timeout_seconds,
        )
    except PolicyConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except TimeoutError as error:
        raise HTTPException(
            status_code=504,
            detail="Policy question timed out. Please try again.",
        ) from error
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
            detail="Policy index is unavailable. Please notify support.",
        ) from error
    except Exception as error:
        logger.exception("Chat request failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=502,
            detail="Chat service is temporarily unavailable.",
        ) from error
    return PolicyQAResponse.model_validate(result)


@router.post("/chat", response_model=PolicyQAResponse)
async def chat(body: PolicyQARequest) -> PolicyQAResponse:
    """Handle normal chat and route Gentech policy questions to PDF retrieval."""
    return await _run_chat(body, answer_chat_message)


@router.post("/policy-qa", response_model=PolicyQAResponse)
async def ask_policy_question(body: PolicyQARequest) -> PolicyQAResponse:
    """Answer using only the published Gentech policy PDFs."""
    return await _run_chat(body, answer_policy_question)
