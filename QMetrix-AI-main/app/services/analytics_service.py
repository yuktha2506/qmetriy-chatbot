from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Mapping
from typing import Any

import httpx


logger = logging.getLogger(__name__)


CONTEXT_KEYS = (
    "companyId",
    "projectId",
    "boardId",
    "sprintId",
    "releaseId",
    "repo",
    "session_id",
)

REQUIRED_BOARD_CONTEXT = ("companyId", "projectId", "boardId")
DEFAULT_QMETRIX_API_BASE_URL = "http://localhost:3000"


def _configured_base_url() -> str:
    return (
        os.getenv("QMETRIX_API_BASE_URL", "").strip().rstrip("/")
        or DEFAULT_QMETRIX_API_BASE_URL
    )


def _configured_token() -> str:
    return os.getenv("QMETRIX_API_TOKEN", "").strip()


def normalize_app_context(app_context: Mapping[str, Any] | None) -> dict[str, str]:
    context = app_context or {}
    normalized = {
        key: str(context[key])
        for key in CONTEXT_KEYS
        if context.get(key) not in (None, "", [], {})
    }
    logger.info("Propagating analytics context keys=%s", sorted(normalized))
    return normalized


def _walk_values(value: Any):
    if isinstance(value, dict):
        for child_value in value.values():
            yield from _walk_values(child_value)
    elif isinstance(value, list):
        for child_value in value:
            yield from _walk_values(child_value)
    else:
        yield value


def _has_context_payload(dashboard_context: dict[str, Any] | None) -> bool:
    if not dashboard_context:
        return False
    return any(value not in (None, "", [], {}) for value in _walk_values(dashboard_context))


def _normalize_key(key: str) -> str:
    return key.replace("_", "").replace("-", "").replace(" ", "").lower()


def _find_first_number(value: Any, keys: set[str]) -> float | None:
    normalized_keys = {_normalize_key(key) for key in keys}
    if isinstance(value, dict):
        for key, child_value in value.items():
            if _normalize_key(str(key)) in normalized_keys:
                try:
                    return float(child_value)
                except (TypeError, ValueError):
                    pass
            nested_value = _find_first_number(child_value, normalized_keys)
            if nested_value is not None:
                return nested_value
    elif isinstance(value, list):
        for child_value in value:
            nested_value = _find_first_number(child_value, normalized_keys)
            if nested_value is not None:
                return nested_value
    return None


def _find_first_string(value: Any, keys: set[str]) -> str | None:
    normalized_keys = {_normalize_key(key) for key in keys}
    if isinstance(value, dict):
        for key, child_value in value.items():
            if _normalize_key(str(key)) in normalized_keys and child_value:
                return str(child_value)
            nested_value = _find_first_string(child_value, normalized_keys)
            if nested_value:
                return nested_value
    elif isinstance(value, list):
        for child_value in value:
            nested_value = _find_first_string(child_value, normalized_keys)
            if nested_value:
                return nested_value
    return None


def _number_metric(raw: Any, *keys: str) -> float | None:
    return _find_first_number(raw, set(keys))


def _string_metric(raw: Any, *keys: str) -> str | None:
    return _find_first_string(raw, set(keys))


def _present_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in metrics.items() if value not in (None, "")}


def _build_url(base_url: str, path: str) -> str:
    if base_url.endswith("/api") and path.startswith("/api/"):
        path = path[4:]
    return f"{base_url}{path}"


def _compact_raw(raw: Any) -> Any:
    if isinstance(raw, dict):
        return {key: _compact_raw(value) for key, value in list(raw.items())[:20]}
    if isinstance(raw, list):
        return [_compact_raw(value) for value in raw[:8]]
    return raw


class AnalyticsService:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        token: str | None = None,
        timeout_seconds: float = 8.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = (base_url if base_url is not None else _configured_base_url()).rstrip("/")
        self.token = token if token is not None else _configured_token()
        self.timeout_seconds = timeout_seconds
        self._client = client

    @property
    def is_configured(self) -> bool:
        return bool(self.base_url)

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["qmetrix-token"] = self.token
        return headers

    def _has_required_context(self, context: dict[str, str]) -> bool:
        missing = [key for key in REQUIRED_BOARD_CONTEXT if not context.get(key)]
        if missing:
            logger.info("Analytics retrieval missing required context keys=%s", missing)
            return False
        return True

    async def _get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        if not self.is_configured:
            raise RuntimeError("QMETRIX_API_BASE_URL is not configured.")

        url = _build_url(self.base_url, path)
        request_started = time.perf_counter()
        safe_params = {key: value for key, value in (params or {}).items() if value not in (None, "")}
        logger.info("Calling QMetrix analytics API url=%s params=%s", url, safe_params)

        try:
            if self._client is not None:
                response = await self._client.get(url, params=safe_params, headers=self._headers())
                response.raise_for_status()
                return response.json()

            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(url, params=safe_params, headers=self._headers())
                response.raise_for_status()
                return response.json()
        finally:
            elapsed_ms = (time.perf_counter() - request_started) * 1000
            logger.info("QMetrix analytics API completed url=%s elapsed_ms=%.2f", url, elapsed_ms)

    async def _fetch_source(
        self,
        *,
        domain: str,
        context: dict[str, str],
        path: str,
        params: dict[str, Any] | None,
        normalizer,
    ) -> dict[str, Any]:
        if not self._has_required_context(context):
            return self._unavailable_source(domain, context, "Missing companyId, projectId, or boardId.")

        try:
            raw = await self._get(path, params=params)
            normalized = normalizer(raw, context)
            normalized["raw_preview"] = _compact_raw(raw)
            return normalized
        except Exception as exc:
            logger.exception("Failed analytics retrieval domain=%s context=%s", domain, context)
            return self._unavailable_source(domain, context, str(exc))

    def _unavailable_source(
        self,
        domain: str,
        context: dict[str, str],
        reason: str,
    ) -> dict[str, Any]:
        logger.info("Fallback analytics routing domain=%s reason=%s", domain, reason)
        return {
            "success": False,
            "domain": domain,
            "context": context,
            "metrics": {},
            "signals": [f"{domain} analytics unavailable: {reason}"],
            "summary_text": f"{domain} analytics could not be retrieved from the live backend.",
            "error": reason,
        }

    def _dashboard_source(
        self,
        context: dict[str, str],
        dashboard_context: dict[str, Any],
    ) -> dict[str, Any]:
        metrics = _present_metrics(
            {
                "average_velocity": _number_metric(
                    dashboard_context,
                    "averageVelocity",
                    "avgVelocity",
                    "average",
                    "velocityAverage",
                ),
                "current_velocity": _number_metric(
                    dashboard_context,
                    "currentVelocity",
                    "velocity",
                    "completedStoryPoints",
                    "completedHours",
                ),
                "target_velocity": _number_metric(
                    dashboard_context,
                    "targetVelocity",
                    "planned",
                    "committedStoryPoints",
                    "committedHours",
                ),
                "sprint_completion": _number_metric(
                    dashboard_context,
                    "sprintCompletion",
                    "completion",
                    "completionPercentage",
                    "completedPercentage",
                ),
                "blocked_items": _number_metric(
                    dashboard_context,
                    "blockedItems",
                    "blockers",
                    "blockedCount",
                ),
                "stale_prs": _number_metric(
                    dashboard_context,
                    "stalePRs",
                    "stalePR",
                    "staleMRs",
                    "staleMR",
                ),
                "release_readiness": _string_metric(
                    dashboard_context,
                    "releaseReadiness",
                    "releaseStatus",
                    "deliveryHealth",
                    "health",
                ),
                "selected_sprint": dashboard_context.get("selectedSprintName"),
                "selected_release": dashboard_context.get("selectedReleaseName"),
                "selected_project": dashboard_context.get("selectedProjectName"),
                "estimation_type": dashboard_context.get("estimationType"),
            }
        )
        return {
            "success": True,
            "domain": "live_dashboard",
            "context": context,
            "metrics": metrics,
            "signals": ["Live dashboard context was provided by the frontend."],
            "summary_text": "Live dashboard metrics were propagated with the chat request.",
            "raw_preview": _compact_raw(dashboard_context),
        }

    async def fetch_sprint_metrics(self, context: dict[str, str]) -> dict[str, Any]:
        sections = ",".join(
            [
                "velocity",
                "burndownData",
                "burndownVelocity",
                "actualStoryPoints",
                "sprintCompleteDate",
                "spCommittedVsCompleted",
                "taskCount",
                "statusCount",
            ]
        )
        return await self._fetch_source(
            domain="sprint_metrics",
            context=context,
            path=f"/api/analytics/getProjectManagementData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}",
            params={
                "sprintId": context.get("sprintId"),
                "releaseId": context.get("releaseId"),
                "sections": sections,
                "estimationType": "storyPoints",
            },
            normalizer=normalize_sprint_metrics,
        )

    async def fetch_qa_metrics(self, context: dict[str, str]) -> dict[str, Any]:
        sections = ",".join(
            [
                "bugClassification",
                "defectDensity",
                "defectRejection",
                "defectRemovalEfficiency",
                "timeToFix",
                "defectLeakage",
                "qaInsightsBugs",
                "qaInsightsTests",
                "qaReference",
            ]
        )
        return await self._fetch_source(
            domain="qa_metrics",
            context=context,
            path=f"/api/analytics/getProjectManagementData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}",
            params={
                "sprintId": context.get("sprintId"),
                "releaseId": context.get("releaseId"),
                "sections": sections,
            },
            normalizer=normalize_qa_metrics,
        )

    async def fetch_pr_metrics(self, context: dict[str, str]) -> dict[str, Any]:
        sections = ",".join(
            [
                "openPRs",
                "closedPRs",
                "totalPRs",
                "mergedWithoutReview",
                "prSize",
                "gitCycleTime",
                "approvalRate",
                "iterationTime",
                "leadTime",
            ]
        )
        return await self._fetch_source(
            domain="pr_metrics",
            context=context,
            path=f"/api/analytics/getGitData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}",
            params={
                "sprintId": context.get("sprintId"),
                "releaseId": context.get("releaseId"),
                "repo": context.get("repo"),
                "sections": sections,
            },
            normalizer=normalize_pr_metrics,
        )

    async def fetch_dora_metrics(self, context: dict[str, str]) -> dict[str, Any]:
        return await self._fetch_source(
            domain="dora_metrics",
            context=context,
            path=f"/api/analytics/getGitData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}",
            params={
                "sprintId": context.get("sprintId"),
                "releaseId": context.get("releaseId"),
                "repo": context.get("repo"),
                "sections": "doraMetrics,leadTime",
            },
            normalizer=normalize_dora_metrics,
        )

    async def fetch_standup_metrics(self, context: dict[str, str]) -> dict[str, Any]:
        sections = ",".join(
            [
                "jiraData",
                "jiraStatusByDev",
                "standupBurndown",
                "openPRs",
                "mergedWithoutReview",
                "storyChurn",
                "storyChurnExcludingBugs",
                "dailyBurnup",
            ]
        )
        return await self._fetch_source(
            domain="standup_metrics",
            context=context,
            path=f"/api/analytics/getStandupData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}",
            params={
                "sprintId": context.get("sprintId"),
                "releaseId": context.get("releaseId"),
                "repo": context.get("repo"),
                "sections": sections,
            },
            normalizer=normalize_standup_metrics,
        )

    async def fetch_release_health(self, context: dict[str, str]) -> dict[str, Any]:
        path = f"/api/releaseDashboard/releaseData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}"
        if not context.get("releaseId"):
            path = f"/api/analytics/getCXOData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}"

        return await self._fetch_source(
            domain="release_health",
            context=context,
            path=path,
            params={
                "releaseId": context.get("releaseId"),
                "sprintId": context.get("sprintId"),
                "sections": "cxoData,cxoTrends",
            },
            normalizer=normalize_release_health,
        )

    async def fetch_capacity_metrics(self, context: dict[str, str]) -> dict[str, Any]:
        return await self._fetch_source(
            domain="capacity_metrics",
            context=context,
            path=f"/api/analytics/getProjectManagementData/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}",
            params={
                "sprintId": context.get("sprintId"),
                "releaseId": context.get("releaseId"),
                "sections": "availableHours,userList,storyPointData",
            },
            normalizer=normalize_capacity_metrics,
        )

    async def fetch_engineering_health(self, context: dict[str, str]) -> dict[str, Any]:
        return await self._fetch_source(
            domain="engineering_health",
            context=context,
            path=f"/api/techQuality/getTechQualityMetrics/{context.get('companyId')}/{context.get('projectId')}/{context.get('boardId')}",
            params=None,
            normalizer=normalize_engineering_health,
        )

    async def retrieve_analytics_context(
        self,
        app_context: Mapping[str, Any] | None,
        dashboard_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        context = normalize_app_context(app_context)

        if _has_context_payload(dashboard_context):
            logger.info("Using propagated live dashboard context for analytics.")
            source = self._dashboard_source(context, dashboard_context or {})
            return normalize_analytics_context([source], context)

        sources = await asyncio.gather(
            self.fetch_sprint_metrics(context),
            self.fetch_qa_metrics(context),
            self.fetch_standup_metrics(context),
            self.fetch_pr_metrics(context),
            self.fetch_dora_metrics(context),
            self.fetch_release_health(context),
            self.fetch_capacity_metrics(context),
            self.fetch_engineering_health(context),
        )
        return normalize_analytics_context(list(sources), context)


def _summary_source(
    *,
    success: bool,
    domain: str,
    context: dict[str, str],
    metrics: dict[str, Any],
    signals: list[str],
    summary_text: str,
) -> dict[str, Any]:
    return {
        "success": success,
        "domain": domain,
        "context": context,
        "metrics": _present_metrics(metrics),
        "signals": [signal for signal in signals if signal],
        "summary_text": summary_text,
    }


def normalize_sprint_metrics(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "average_velocity": _number_metric(raw, "averageVelocity", "avgVelocity", "velocityAverage"),
            "current_velocity": _number_metric(raw, "currentVelocity", "velocity", "completedStoryPoints"),
            "target_velocity": _number_metric(raw, "targetVelocity", "committedStoryPoints", "planned"),
            "sprint_completion": _number_metric(raw, "sprintCompletion", "completionPercentage", "completedPercentage"),
            "remaining_work": _number_metric(raw, "remainingWork", "remainingStoryPoints", "remainingHours"),
            "story_churn": _number_metric(raw, "storyChurn", "scopeChurn", "churnPercentage"),
        }
    )
    return _summary_source(
        success=True,
        domain="sprint_metrics",
        context=context,
        metrics=metrics,
        signals=["Realtime sprint delivery, velocity, and burndown metrics retrieved."],
        summary_text="Sprint delivery metrics were retrieved from the QMetrix backend.",
    )


def normalize_qa_metrics(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "open_defects": _number_metric(raw, "openDefects", "openBugs", "defectCount"),
            "critical_defects": _number_metric(raw, "criticalDefects", "criticalBugs", "p1Defects"),
            "defect_density": _number_metric(raw, "defectDensity"),
            "defect_leakage": _number_metric(raw, "defectLeakage"),
            "dre": _number_metric(raw, "defectRemovalEfficiency", "dre"),
            "test_pass_rate": _number_metric(raw, "testPassRate", "passRate"),
            "tests_executed": _number_metric(raw, "testsExecuted", "executedTests"),
        }
    )
    return _summary_source(
        success=True,
        domain="qa_metrics",
        context=context,
        metrics=metrics,
        signals=["Realtime QA and defect metrics retrieved."],
        summary_text="QA, defect, and test execution metrics were retrieved from the QMetrix backend.",
    )


def normalize_pr_metrics(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "open_prs": _number_metric(raw, "openPRs", "openPrs", "openMergeRequests"),
            "closed_prs": _number_metric(raw, "closedPRs", "closedPrs", "closedMergeRequests"),
            "total_prs": _number_metric(raw, "totalPRs", "totalPrs", "totalMergeRequests"),
            "stale_prs": _number_metric(raw, "stalePRs", "stalePrs", "staleMergeRequests"),
            "merged_without_review": _number_metric(raw, "mergedWithoutReview"),
            "approval_rate": _number_metric(raw, "approvalRate"),
            "git_cycle_time": _number_metric(raw, "gitCycleTime", "cycleTime"),
            "lead_time": _number_metric(raw, "leadTime", "leadTimeForChanges"),
        }
    )
    return _summary_source(
        success=True,
        domain="pr_metrics",
        context=context,
        metrics=metrics,
        signals=["Realtime PR flow and review metrics retrieved."],
        summary_text="Pull request throughput, review, and merge metrics were retrieved from the QMetrix backend.",
    )


def normalize_standup_metrics(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "blocked_items": _number_metric(raw, "blockedItems", "blockers", "blockedCount"),
            "aging_blockers_days": _number_metric(raw, "agingBlockersDays", "agingBlockers"),
            "story_churn": _number_metric(raw, "storyChurn", "scopeChurn", "churnPercentage"),
            "daily_burnup": _number_metric(raw, "dailyBurnup", "burnup"),
            "standup_remaining_work": _number_metric(raw, "standupBurndown", "remainingWork"),
            "open_prs": _number_metric(raw, "openPRs", "openPrs"),
            "merged_without_review": _number_metric(raw, "mergedWithoutReview"),
        }
    )
    return _summary_source(
        success=True,
        domain="standup_metrics",
        context=context,
        metrics=metrics,
        signals=["Realtime standup, blocker, story churn, and burnup metrics retrieved."],
        summary_text="Standup execution, blocker, story churn, and burnup metrics were retrieved from the QMetrix backend.",
    )


def normalize_dora_metrics(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "deployment_frequency": _string_metric(raw, "deploymentFrequency"),
            "lead_time_for_changes": _number_metric(raw, "leadTimeForChanges", "leadTime"),
            "change_failure_rate": _number_metric(raw, "changeFailureRate"),
            "mttr": _number_metric(raw, "mttr", "meanTimeToRestore"),
        }
    )
    return _summary_source(
        success=True,
        domain="dora_metrics",
        context=context,
        metrics=metrics,
        signals=["Realtime DORA metrics retrieved."],
        summary_text="DORA delivery performance metrics were retrieved from the QMetrix backend.",
    )


def normalize_release_health(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "release_readiness": _string_metric(raw, "releaseReadiness", "releaseStatus", "readiness", "health"),
            "release_risk": _string_metric(raw, "releaseRisk", "risk", "riskLevel"),
            "forecast_accuracy": _number_metric(raw, "forecastAccuracy", "accuracy"),
            "open_release_defects": _number_metric(raw, "openDefects", "releaseDefects"),
            "risk_alerts": _number_metric(raw, "riskAlerts", "alertsCount"),
        }
    )
    return _summary_source(
        success=True,
        domain="release_health",
        context=context,
        metrics=metrics,
        signals=["Realtime release readiness and health metrics retrieved."],
        summary_text="Release readiness and risk metrics were retrieved from the QMetrix backend.",
    )


def normalize_capacity_metrics(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "available_hours": _number_metric(raw, "availableHours", "totalAvailableHours"),
            "capacity_utilization": _number_metric(raw, "capacityUtilization", "utilization"),
            "team_members": _number_metric(raw, "teamMembers", "userCount", "assigneeCount"),
            "planned_story_points": _number_metric(raw, "plannedStoryPoints", "committedStoryPoints"),
        }
    )
    return _summary_source(
        success=True,
        domain="capacity_metrics",
        context=context,
        metrics=metrics,
        signals=["Realtime capacity metrics retrieved."],
        summary_text="Team capacity and availability metrics were retrieved from the QMetrix backend.",
    )


def normalize_engineering_health(raw: Any, context: dict[str, str]) -> dict[str, Any]:
    metrics = _present_metrics(
        {
            "code_quality_score": _number_metric(raw, "codeQualityScore", "qualityScore"),
            "security_risk": _string_metric(raw, "securityRisk", "securityHealth"),
            "maintainability": _string_metric(raw, "maintainability", "maintainabilityRating"),
            "technical_debt": _number_metric(raw, "technicalDebt", "debt"),
            "coverage": _number_metric(raw, "coverage", "testCoverage"),
        }
    )
    return _summary_source(
        success=True,
        domain="engineering_health",
        context=context,
        metrics=metrics,
        signals=["Realtime engineering health indicators retrieved."],
        summary_text="Engineering health and technical quality metrics were retrieved from the QMetrix backend.",
    )


def normalize_analytics_context(
    sources: list[dict[str, Any]],
    context: dict[str, str],
) -> dict[str, Any]:
    successful_sources = [source for source in sources if source.get("success")]
    risks: list[str] = []

    metrics_by_domain = {
        source.get("domain"): source.get("metrics", {}) for source in successful_sources
    }
    sprint_completion = metrics_by_domain.get("sprint_metrics", {}).get("sprint_completion")
    if sprint_completion is not None and sprint_completion < 0.85:
        risks.append("Sprint completion is below the expected trend.")
    if metrics_by_domain.get("qa_metrics", {}).get("critical_defects"):
        risks.append("Critical defects require release readiness validation.")
    if metrics_by_domain.get("standup_metrics", {}).get("blocked_items"):
        risks.append("Blocked standup items may slow delivery flow.")
    if metrics_by_domain.get("pr_metrics", {}).get("stale_prs"):
        risks.append("Stale pull requests may create review bottlenecks.")
    release_readiness = metrics_by_domain.get("release_health", {}).get("release_readiness")
    if str(release_readiness).lower() in {"needs_attention", "at_risk", "watch", "risk"}:
        risks.append("Release readiness needs closer validation.")

    return {
        "success": bool(successful_sources),
        "context": context,
        "sources": sources,
        "summary": {
            "overall_health": "live" if successful_sources else "unavailable",
            "primary_risks": risks,
            "successful_domains": [source.get("domain") for source in successful_sources],
            "failed_domains": [
                source.get("domain") for source in sources if not source.get("success")
            ],
        },
        "llm_ready": {
            "context": context,
            "summaries": [
                source.get("summary_text") for source in successful_sources if source.get("summary_text")
            ],
            "metrics_by_domain": metrics_by_domain,
            "risks": risks,
        },
    }


async def retrieve_analytics_context(
    app_context: Mapping[str, Any] | None,
    dashboard_context: dict[str, Any] | None = None,
    *,
    qmetrix_token: str | None = None,
) -> dict[str, Any]:
    return await AnalyticsService(token=qmetrix_token).retrieve_analytics_context(
        app_context,
        dashboard_context,
    )
