"""Thin FastAPI adapter for the policy RAG service in ai_agent."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ai_agent.policy_rag.answer import (
    PolicyConfigurationError,
    answer_chat_message,
    answer_policy_question,
)
from ai_agent.policy_rag.settings import settings
from app.core.database import get_db
from app.core.security import bearer_scheme, require_customer
from app.schemas.policy_qa import PolicyQARequest, PolicyQAResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Policy QA"])
ChatAnswer = Callable[..., Awaitable[dict[str, Any]]]
POLICY_PDFS = {
    "GT-POL-WS-01": "gentech_warranty_and_service_policy.pdf",
    "GT-POL-PR-01": "gentech_payment_cancellation_and_refunds_policy.pdf",
    "GT-POL-DS-01": "gentech_delivery_and_shipping_policy.pdf",
}


@router.get("/policies/{policy_id}")
async def get_policy_pdf(policy_id: str) -> FileResponse:
    """Serve a published policy manual for in-app citation links."""
    filename = POLICY_PDFS.get(policy_id)
    if filename is None:
        raise HTTPException(status_code=404, detail="Policy manual not found.")
    file_path = settings.policy_pdf_dir / filename
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Policy manual is unavailable.")
    return FileResponse(
        file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


async def _run_chat(
    body: PolicyQARequest,
    answer_function: ChatAnswer,
    db: Any = None,
    conversation_id: str | None = None,
    customer_id: Any = None,
    mcp_access_token: str | None = None,
) -> PolicyQAResponse:
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question must not be empty.")
    history = [message.model_dump() for message in body.history]
    try:
        answer_kwargs = {
            "conversation_id": conversation_id,
            "customer_id": customer_id,
        }
        if mcp_access_token is not None:
            answer_kwargs["mcp_access_token"] = mcp_access_token
        result = await asyncio.wait_for(
            answer_function(question, history, db, **answer_kwargs)
            if db is not None
            else answer_function(question, history),
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
    response = dict(result)
    if conversation_id is not None:
        response.setdefault("conversation_id", conversation_id)
    return PolicyQAResponse.model_validate(response)


@router.post("/chat", response_model=PolicyQAResponse)
async def chat(
    body: PolicyQARequest,
    customer: Any = Depends(require_customer),
    db: Any = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> PolicyQAResponse:
    """Handle normal chat and route Gentech policy questions to PDF retrieval."""
    conversation_id = body.conversation_id or uuid4().hex
    return await _run_chat(
        body,
        answer_chat_message,
        db,
        conversation_id,
        customer["_id"],
        credentials.credentials if credentials is not None else None,
    )


@router.post("/chat/stream")
async def stream_chat(
    body: PolicyQARequest,
    customer: Any = Depends(require_customer),
    db: Any = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> StreamingResponse:
    """Stream progress and answer tokens for an authenticated chat turn."""
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question must not be empty.")
    conversation_id = body.conversation_id or uuid4().hex
    history = [message.model_dump() for message in body.history]

    async def events():
        queue: asyncio.Queue[tuple[str, Any] | None] = asyncio.Queue()

        async def on_delta(text: str) -> None:
            await queue.put(("delta", {"text": text}))

        async def on_progress(message: str) -> None:
            await queue.put(("progress", {"message": message}))

        async def run_answer() -> None:
            try:
                answer_kwargs = {
                    "conversation_id": conversation_id,
                    "customer_id": customer["_id"],
                    "on_delta": on_delta,
                    "on_progress": on_progress,
                }
                if credentials is not None:
                    answer_kwargs["mcp_access_token"] = credentials.credentials
                result = await asyncio.wait_for(
                    answer_chat_message(question, history, db, **answer_kwargs),
                    timeout=settings.policy_timeout_seconds,
                )
                response = PolicyQAResponse.model_validate(
                    {
                        **result,
                        "conversation_id": conversation_id,
                    }
                )
                await queue.put(("done", response.model_dump(mode="json")))
            except PolicyConfigurationError as error:
                await queue.put(("error", {"message": str(error)}))
            except TimeoutError:
                await queue.put(
                    (
                        "error",
                        {"message": "Policy question timed out. Please try again."},
                    )
                )
            except FileNotFoundError:
                await queue.put(
                    (
                        "error",
                        {"message": "Policy index is unavailable. Please notify support."},
                    )
                )
            except Exception as error:
                logger.exception("Streaming chat request failed (%s).", type(error).__name__)
                await queue.put(
                    ("error", {"message": "Chat service is temporarily unavailable."})
                )
            finally:
                await queue.put(None)

        task = asyncio.create_task(run_answer())
        try:
            yield f"event: progress\ndata: {json.dumps({'message': 'Understanding your question'})}\n\n"
            while True:
                event = await queue.get()
                if event is None:
                    break
                name, payload = event
                yield f"event: {name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                if name in {"done", "error"}:
                    break
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/policy-qa", response_model=PolicyQAResponse)
async def ask_policy_question(
    body: PolicyQARequest,
    customer: Any = Depends(require_customer),
) -> PolicyQAResponse:
    """Answer using only the published Gentech policy PDFs."""
    return await _run_chat(
        body,
        answer_policy_question,
        customer_id=customer["_id"],
    )
