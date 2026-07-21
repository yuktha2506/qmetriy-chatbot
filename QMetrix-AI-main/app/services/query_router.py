from __future__ import annotations

import re
from typing import Any


ANALYTICS_KEYWORDS = {
    "velocity",
    "sprint",
    "burndown",
    "release",
    "qa",
    "defect",
    "metrics",
    "risk",
    "story churn",
    "capacity",
    "dora",
    "git",
    "pr",
    "cxo",
}

RAG_KEYWORDS = {
    "what is",
    "explain",
    "workflow",
    "guide",
    "documentation",
    "help",
    "troubleshooting",
}

UPLOAD_KEYWORDS = {
    "upload",
    "screenshot",
    "image",
    "ocr",
    "attachment",
    "analyze file",
    "uploaded",
}

DEFINITION_PREFIXES = (
    "what is",
    "what are",
    "define",
    "meaning of",
)

LIVE_CONTEXT_KEYWORDS = {
    "current",
    "latest",
    "actual",
    "average",
    "today",
    "now",
    "selected",
    "dashboard",
    "this sprint",
    "this release",
}


def _contains_keyword(query: str, keyword: str) -> bool:
    if " " in keyword:
        return keyword in query
    return re.search(rf"\b{re.escape(keyword)}\b", query) is not None


def detect_intent(query: str | None) -> dict[str, Any]:
    normalized_query = (query or "").strip().lower()

    has_analytics = any(
        _contains_keyword(normalized_query, keyword.lower())
        for keyword in ANALYTICS_KEYWORDS
    )
    has_rag = any(
        _contains_keyword(normalized_query, keyword.lower()) for keyword in RAG_KEYWORDS
    )
    has_upload = any(
        _contains_keyword(normalized_query, keyword.lower())
        for keyword in UPLOAD_KEYWORDS
    )

    if not normalized_query:
        return {"intent": "fallback", "route": "fallback", "requires_context": False}

    if has_upload and (has_analytics or has_rag):
        return {
            "intent": "hybrid",
            "route": "hybrid_orchestration",
            "requires_context": True,
        }

    if has_upload:
        return {
            "intent": "upload",
            "route": "upload_analysis",
            "requires_context": True,
        }

    has_live_context_request = any(
        _contains_keyword(normalized_query, keyword)
        for keyword in LIVE_CONTEXT_KEYWORDS
    )

    if has_analytics and has_live_context_request:
        return {
            "intent": "analytics",
            "route": "analytics_context",
            "requires_context": True,
        }

    if has_rag and has_analytics and normalized_query.startswith(DEFINITION_PREFIXES):
        return {
            "intent": "rag",
            "route": "knowledge_base",
            "requires_context": False,
        }

    if has_analytics and has_rag:
        return {
            "intent": "hybrid",
            "route": "hybrid_orchestration",
            "requires_context": True,
        }

    if has_analytics:
        return {
            "intent": "analytics",
            "route": "analytics_context",
            "requires_context": True,
        }

    if has_rag:
        return {
            "intent": "rag",
            "route": "knowledge_base",
            "requires_context": False,
        }

    return {"intent": "fallback", "route": "fallback", "requires_context": False}


def route_query(query: str | None) -> dict[str, Any]:
    return detect_intent(query)
