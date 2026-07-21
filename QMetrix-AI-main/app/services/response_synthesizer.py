from __future__ import annotations

import re
from typing import Any


FALLBACK_RESPONSE = (
    "The requested data is not present in the available QMetrix knowledge base. "
    "Please refine the question or provide additional project context."
)

MAX_CLEAN_CHUNK_LENGTH = 650

RESPONSE_TEMPLATES = {
    "story churn": (
        "Story churn measures stories, defects, or scope items added or removed "
        "during a sprint. High churn usually signals changing priorities, weaker "
        "backlog refinement, and more context switching. Low churn reflects a more "
        "stable sprint plan."
    ),
    "velocity": (
        "Velocity shows how much work a team completes over a sprint or set of "
        "sprints. In QMetrix, velocity trends help identify whether delivery is "
        "stable, improving, or at risk against planned scope."
    ),
    "burndown": (
        "Burndown tracks remaining sprint or release work over time. A healthy "
        "burndown trends steadily downward; a flat or rising burndown can indicate "
        "blockers, scope changes, or execution risk."
    ),
    "qa": (
        "QA risk reflects product quality signals such as open defects, critical "
        "issues, reopen rates, test execution, and pass rates. Higher QA risk means "
        "the team should prioritize validation and defect resolution before release."
    ),
    "defect": (
        "Defect risk is driven by open issues, critical defects, reopen patterns, "
        "and the pace of fixes. QMetrix uses these signals to highlight quality "
        "pressure before it affects delivery or release confidence."
    ),
    "release": (
        "Release risk combines delivery progress, scope stability, unresolved "
        "defects, and readiness signals. QMetrix helps identify whether a release "
        "is on track, needs attention, or requires immediate action."
    ),
    "dora": (
        "DORA metrics assess engineering delivery performance through deployment "
        "frequency, lead time for changes, change failure rate, and mean time to "
        "restore. They help teams balance speed, stability, and operational quality."
    ),
    "git": (
        "Git and PR analytics summarize contribution flow, open pull requests, "
        "stale reviews, merge activity, and contributor participation. These signals "
        "help identify review bottlenecks and release readiness concerns."
    ),
    "pr": (
        "PR analytics show review and merge flow across repositories. Stale or "
        "unmerged PRs can indicate bottlenecks that slow delivery and increase "
        "release risk."
    ),
    "sprint metrics": (
        "Sprint metrics summarize delivery progress, completed work, remaining "
        "scope, capacity use, quality signals, and execution risks for the current "
        "iteration."
    ),
}


def _normalize_for_duplicate_check(text: str) -> str:
    return re.sub(r"\W+", " ", text.lower()).strip()


def _strip_markdown(text: str) -> str:
    text = re.sub(r"!\[[^\]]*]\([^)]*\)", " ", text)
    text = re.sub(r"\[[^\]]*]\([^)]*\)", " ", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", " ", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*_]{3,}\s*$", " ", text, flags=re.MULTILINE)
    text = re.sub(r"[*_~>|#]", " ", text)
    return text


def _looks_noisy(text: str) -> bool:
    if len(text) < 35:
        return True

    compact = text.replace(" ", "")
    if not compact:
        return True

    non_alnum_ratio = len(re.findall(r"[^a-zA-Z0-9\s.,;:!?()/%-]", text)) / max(
        len(text), 1
    )
    if non_alnum_ratio > 0.2:
        return True

    artifact_patterns = [
        r"\bbase64\b",
        r"\bpng\b|\bjpg\b|\bjpeg\b|\bsvg\b",
        r"\bimage\d*\b",
        r"\bocr\b.*\bconfidence\b",
        r"\bhttp[s]?://",
        r"\b[a-f0-9]{24,}\b",
        r"_{3,}",
    ]
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in artifact_patterns)


def _clean_text(text: str) -> str:
    text = _strip_markdown(text or "")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\b(.{3,80}?)\s+\1\b", r"\1", text, flags=re.IGNORECASE)
    text = text.strip(" -:;,.")
    if len(text) > MAX_CLEAN_CHUNK_LENGTH:
        text = text[:MAX_CLEAN_CHUNK_LENGTH].rsplit(" ", 1)[0].strip()
    return text


def clean_retrieved_chunks(rag_context: dict[str, Any] | None) -> list[str]:
    chunks = (rag_context or {}).get("chunks", [])
    cleaned_chunks: list[str] = []
    seen: set[str] = set()

    for chunk in chunks:
        text = _clean_text(str(chunk.get("text", "")))
        if _looks_noisy(text):
            continue

        duplicate_key = _normalize_for_duplicate_check(text[:300])
        if duplicate_key in seen:
            continue

        seen.add(duplicate_key)
        cleaned_chunks.append(text)

    return cleaned_chunks


def _query_terms(query: str) -> set[str]:
    stopwords = {
        "a",
        "an",
        "and",
        "are",
        "for",
        "how",
        "is",
        "of",
        "or",
        "the",
        "to",
        "what",
        "show",
        "explain",
    }
    return {
        term
        for term in re.findall(r"[a-zA-Z0-9]+", query.lower())
        if len(term) > 2 and term not in stopwords
    }


def _matching_template(query: str) -> str | None:
    normalized = query.lower()
    if "sprint" in normalized and "metric" in normalized:
        return RESPONSE_TEMPLATES["sprint metrics"]

    for keyword, template in RESPONSE_TEMPLATES.items():
        if keyword in normalized:
            return template
    return None


def summarize_rag_context(query: str, rag_context: dict[str, Any] | None) -> str:
    template = _matching_template(query)
    if template:
        return template

    cleaned_chunks = clean_retrieved_chunks(rag_context)
    if not cleaned_chunks:
        return ""

    terms = _query_terms(query)
    sentences: list[str] = []
    seen: set[str] = set()

    for chunk in cleaned_chunks:
        for sentence in re.split(r"(?<=[.!?])\s+", chunk):
            sentence = sentence.strip()
            if len(sentence) < 35:
                continue
            normalized = _normalize_for_duplicate_check(sentence)
            if normalized in seen:
                continue
            if not terms or terms & _query_terms(sentence):
                seen.add(normalized)
                sentences.append(sentence)
            if len(sentences) >= 2:
                break
        if len(sentences) >= 2:
            break

    if not sentences:
        sentences = cleaned_chunks[:1]

    summary = " ".join(sentences)
    return summary[:850].rsplit(" ", 1)[0].strip()


def summarize_analytics_context(analytics_context: dict[str, Any] | None) -> str:
    if not analytics_context:
        return ""

    if analytics_context.get("success") is False:
        failed_domains = analytics_context.get("summary", {}).get("failed_domains", [])
        if failed_domains:
            return (
                "Live analytics are currently unavailable from the QMetrix backend. "
                "Please verify the backend configuration and project context."
            )

    sources = analytics_context.get("sources", [])
    summary = analytics_context.get("summary", {})
    risks = summary.get("primary_risks", [])
    metrics_by_domain = {
        source.get("domain"): source.get("metrics", {}) for source in sources
    }

    sprint_metrics = {
        **metrics_by_domain.get("project_management", {}),
        **metrics_by_domain.get("sprint_metrics", {}),
    }
    qa_metrics = metrics_by_domain.get("qa_metrics", {})
    standup_metrics = metrics_by_domain.get("standup_metrics", {})
    pr_metrics = {
        **metrics_by_domain.get("git", {}),
        **metrics_by_domain.get("pr_metrics", {}),
    }
    release_metrics = {
        **metrics_by_domain.get("cxo", {}),
        **metrics_by_domain.get("release_health", {}),
    }
    capacity_metrics = metrics_by_domain.get("capacity_metrics", {})
    engineering_metrics = metrics_by_domain.get("engineering_health", {})

    sprint_completion = sprint_metrics.get("sprint_completion")
    live_metrics = metrics_by_domain.get("live_dashboard", {})
    average_velocity = live_metrics.get("average_velocity")
    current_velocity = live_metrics.get("current_velocity")
    target_velocity = live_metrics.get("target_velocity")
    estimation_type = live_metrics.get("estimation_type")
    selected_sprint = live_metrics.get("selected_sprint")
    selected_release = live_metrics.get("selected_release")

    if average_velocity is not None:
        scope_label = selected_sprint or selected_release or "the selected dashboard context"
        unit_text = f" {estimation_type}" if estimation_type else ""
        comparison = ""
        if current_velocity is not None:
            comparison = f" Current completed velocity is {current_velocity:g}{unit_text}."
        if target_velocity is not None:
            comparison += f" Planned or target velocity is {target_velocity:g}{unit_text}."
        return (
            f"The current average velocity for {scope_label} is "
            f"{float(average_velocity):g}{unit_text}.{comparison}"
        ).strip()

    if current_velocity is not None:
        scope_label = selected_sprint or selected_release or "the selected dashboard context"
        unit_text = f" {estimation_type}" if estimation_type else ""
        return f"The current velocity for {scope_label} is {float(current_velocity):g}{unit_text}."

    average_velocity = sprint_metrics.get("average_velocity")
    current_velocity = sprint_metrics.get("current_velocity")
    target_velocity = sprint_metrics.get("target_velocity")
    if average_velocity is not None:
        comparison = ""
        if current_velocity is not None:
            comparison = f" Current completed velocity is {float(current_velocity):g}."
        if target_velocity is not None:
            comparison += f" Planned or target velocity is {float(target_velocity):g}."
        return (
            f"The current average sprint velocity is {float(average_velocity):g}."
            f"{comparison}"
        ).strip()

    if current_velocity is not None:
        return f"The current sprint velocity is {float(current_velocity):g}."

    if "sprint_completion" in live_metrics:
        sprint_completion = live_metrics.get("sprint_completion")

    blocked_items = {
        **metrics_by_domain.get("standup", {}),
        **standup_metrics,
    }.get("blocked_items")
    if "blocked_items" in live_metrics:
        blocked_items = live_metrics.get("blocked_items")
    stale_prs = pr_metrics.get("stale_prs")
    if "stale_prs" in live_metrics:
        stale_prs = live_metrics.get("stale_prs")
    release_readiness = release_metrics.get("release_readiness")
    if "release_readiness" in live_metrics:
        release_readiness = live_metrics.get("release_readiness")
    critical_defects = qa_metrics.get("critical_defects")
    open_defects = qa_metrics.get("open_defects")
    capacity_utilization = capacity_metrics.get("capacity_utilization")
    code_quality_score = engineering_metrics.get("code_quality_score")

    sentences = ["Live QMetrix analytics indicate current engineering health is being monitored."]
    if sprint_completion is not None and sprint_completion < 0.85:
        sentences.append("Sprint completion is below the expected trend.")
    elif sprint_completion is not None:
        sentences.append("Sprint completion is tracking within the expected range.")
    if blocked_items:
        sentences.append("Unresolved blockers may slow delivery.")
    if stale_prs:
        sentences.append("Stale pull requests may create review bottlenecks.")
    if critical_defects:
        sentences.append("Critical defects should be reviewed before release decisions.")
    elif open_defects:
        sentences.append("Open defects remain part of the quality watchlist.")
    if str(release_readiness).lower() in {"needs_attention", "needs attention", "at_risk", "at risk"}:
        sentences.append("Release readiness needs closer validation.")
    if capacity_utilization is not None and capacity_utilization > 0.95:
        sentences.append("Capacity utilization is high and may limit sprint flexibility.")
    if code_quality_score is not None and code_quality_score < 70:
        sentences.append("Engineering health indicators show code quality needs attention.")
    if risks and len(sentences) == 1:
        sentences.append(risks[0])

    return " ".join(sentences)


def synthesize_rag_only(prompt_context: dict[str, Any]) -> str:
    query = prompt_context.get("user_query", "")
    return summarize_rag_context(query, prompt_context.get("rag_context")) or FALLBACK_RESPONSE


def synthesize_analytics_only(prompt_context: dict[str, Any]) -> str:
    return summarize_analytics_context(prompt_context.get("analytics_context")) or FALLBACK_RESPONSE


def synthesize_hybrid_response(prompt_context: dict[str, Any]) -> str:
    query = prompt_context.get("user_query", "")
    rag_summary = summarize_rag_context(query, prompt_context.get("rag_context"))
    analytics_summary = summarize_analytics_context(
        prompt_context.get("analytics_context")
    )

    if rag_summary and analytics_summary:
        return f"{analytics_summary} {rag_summary}"
    return analytics_summary or rag_summary or FALLBACK_RESPONSE


def generate_final_response(prompt_context: dict[str, Any]) -> str:
    routing = prompt_context.get("routing", {})
    intent = routing.get("intent", "fallback")

    if intent == "fallback":
        return FALLBACK_RESPONSE

    if intent == "rag":
        return synthesize_rag_only(prompt_context)

    if intent == "analytics":
        return synthesize_analytics_only(prompt_context)

    if intent == "hybrid":
        return synthesize_hybrid_response(prompt_context)

    return FALLBACK_RESPONSE
