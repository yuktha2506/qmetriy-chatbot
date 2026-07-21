from __future__ import annotations

from typing import Any


def build_chat_prompt_context(
    *,
    user_query: str,
    routing: dict[str, Any],
    rag_context: dict[str, Any] | None = None,
    analytics_context: dict[str, Any] | None = None,
    app_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    rag_context = rag_context or {"chunks": []}
    analytics_context = analytics_context or {}
    app_context = app_context or {}

    prompt_sections = [
        "You are QMetrix AI, an enterprise engineering analytics assistant.",
        "Answer with concise, actionable guidance grounded in the supplied context.",
        f"User query: {user_query}",
        f"Detected intent: {routing.get('intent', 'fallback')}",
    ]

    if app_context:
        prompt_sections.append(f"Application context: {app_context}")

    chunks = rag_context.get("chunks", [])
    if chunks:
        prompt_sections.append("Knowledge base context:")
        for index, chunk in enumerate(chunks, start=1):
            metadata = chunk.get("metadata", {})
            source = metadata.get("source", "unknown")
            heading = metadata.get("heading", "unknown")
            prompt_sections.append(
                f"[{index}] Source: {source} / {heading}\n{chunk.get('text', '')}"
            )

    if analytics_context:
        prompt_sections.append(f"Analytics context: {analytics_context}")

    return {
        "user_query": user_query,
        "routing": routing,
        "rag_context": rag_context,
        "analytics_context": analytics_context,
        "app_context": app_context,
        "prompt": "\n\n".join(prompt_sections),
    }
