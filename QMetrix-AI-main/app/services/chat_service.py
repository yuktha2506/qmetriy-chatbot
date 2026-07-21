from __future__ import annotations

import logging
from typing import Any

from app.models.chat_models import ChatRequest, ChatResponse
from app.services.analytics_service import retrieve_analytics_context
from app.services.prompt_builder import build_chat_prompt_context
from app.services.query_router import route_query
from app.services.rag_service import retrieve_knowledge_context
from app.services.response_synthesizer import generate_final_response


logger = logging.getLogger(__name__)


def _extract_app_context(request: ChatRequest) -> dict[str, str]:
    return {
        key: value
        for key, value in {
            "companyId": request.companyId,
            "projectId": request.projectId,
            "boardId": request.boardId,
            "sprintId": request.sprintId,
            "releaseId": request.releaseId,
            "repo": request.repo,
            "session_id": request.session_id,
        }.items()
        if value
    }


async def build_chat_response(
    request: ChatRequest,
    *,
    qmetrix_token: str | None = None,
) -> ChatResponse:
    logger.info("Starting chat orchestration for session_id=%s", request.session_id)

    routing = route_query(request.message)
    logger.info(
        "Detected intent=%s route=%s requires_context=%s",
        routing["intent"],
        routing["route"],
        routing["requires_context"],
    )

    app_context = _extract_app_context(request)
    rag_context: dict[str, Any] = {"success": False, "chunks": [], "message": ""}
    analytics_context: dict[str, Any] = {}

    try:
        if routing["intent"] in {"rag", "hybrid"}:
            rag_context = retrieve_knowledge_context(request.message)
            logger.info(
                "RAG retrieval mode=%s count=%s success=%s",
                rag_context.get("retrieval_mode"),
                len(rag_context.get("chunks", [])),
                rag_context.get("success"),
            )
    except Exception as exc:
        logger.exception("RAG retrieval failed during chat orchestration.")
        rag_context = {
            "success": False,
            "chunks": [],
            "message": f"Knowledge retrieval failed: {exc}",
            "retrieval_mode": "failed",
        }

    if routing["intent"] in {"analytics", "hybrid", "upload"}:
        analytics_context = await retrieve_analytics_context(
            app_context,
            request.dashboard_context,
            qmetrix_token=qmetrix_token,
        )
        logger.info(
            "Analytics retrieval count=%s",
            len(analytics_context.get("sources", [])),
        )

    if routing["intent"] == "fallback":
        logger.info("Using fallback response path for query=%s", request.message)

    prompt_context = build_chat_prompt_context(
        user_query=request.message,
        routing=routing,
        rag_context=rag_context,
        analytics_context=analytics_context,
        app_context=app_context,
    )
    logger.info("Prompt context built for route=%s", routing["route"])

    answer = generate_final_response(prompt_context)
    logger.info("Synthesized final chat response for intent=%s", routing["intent"])

    return ChatResponse(
        success=True,
        message="Chat response generated successfully.",
        answer=answer,
        session_id=request.session_id,
    )
