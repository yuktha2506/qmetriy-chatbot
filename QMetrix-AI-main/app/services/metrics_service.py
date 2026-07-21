import re
from collections.abc import Iterable

from app.models.metrics_models import (
    MetricValidationIssue,
    MetricsExtractionRequest,
    MetricsExtractionResponse,
    StandardizedMetric,
)


FIELD_ALIASES: dict[str, set[str]] = {
    "committed_story_points": {
        "committed_story_points",
        "committed_sp",
        "commitment",
        "committed points",
        "story points committed",
    },
    "completed_story_points": {
        "completed_story_points",
        "completed_sp",
        "delivered_story_points",
        "completed points",
        "story points completed",
    },
    "current_velocity": {"current_velocity", "velocity", "sprint_velocity"},
    "previous_velocity": {"previous_velocity", "last_velocity", "previous sprint velocity"},
    "team_capacity_hours": {
        "team_capacity_hours",
        "capacity_hours",
        "team capacity",
        "available hours",
    },
    "used_capacity_hours": {
        "used_capacity_hours",
        "utilized_hours",
        "used hours",
        "logged hours",
    },
    "planned_tasks": {"planned_tasks", "planned issues", "planned work items"},
    "completed_tasks": {"completed_tasks", "done tasks", "completed issues"},
    "elapsed_days": {"elapsed_days", "days elapsed", "elapsed sprint days"},
    "total_days": {"total_days", "sprint days", "total sprint days"},
    "scope_added_story_points": {
        "scope_added_story_points",
        "scope added",
        "scope increase",
        "added story points",
    },
    "scope_removed_story_points": {
        "scope_removed_story_points",
        "scope removed",
        "removed story points",
    },
    "open_defects": {"open_defects", "open bugs", "open defects"},
    "closed_defects": {"closed_defects", "resolved defects", "closed bugs"},
    "critical_open_defects": {
        "critical_open_defects",
        "critical bugs",
        "critical open defects",
    },
}

NUMERIC_FIELDS = set(FIELD_ALIASES)
NON_NEGATIVE_FIELDS = NUMERIC_FIELDS


def _normalize_key(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    return cleaned.strip("_")


def _flatten_dashboard_data(payload: dict) -> dict[str, object]:
    flattened: dict[str, object] = {}
    for key, value in payload.items():
        if isinstance(value, dict):
            flattened.update(_flatten_dashboard_data(value))
            continue
        flattened[_normalize_key(str(key))] = value
    return flattened


def _try_parse_number(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"-?\d+(?:,\d{3})*(?:\.\d+)?", value.replace("%", ""))
        if not match:
            return None
        return float(match.group(0).replace(",", ""))
    return None


def _resolve_field_value(
    field_name: str,
    dashboard_values: dict[str, object],
    ocr_values: dict[str, object],
) -> tuple[float | None, list[str]]:
    aliases = {_normalize_key(alias) for alias in FIELD_ALIASES[field_name]}
    sources: list[str] = []

    for candidate_key, candidate_value in dashboard_values.items():
        if candidate_key in aliases:
            parsed = _try_parse_number(candidate_value)
            if parsed is not None:
                sources.append(f"dashboard:{candidate_key}")
                return parsed, sources

    for candidate_key, candidate_value in ocr_values.items():
        if candidate_key in aliases:
            parsed = _try_parse_number(candidate_value)
            if parsed is not None:
                sources.append(f"ocr:{candidate_key}")
                return parsed, sources

    return None, sources


def _collect_ocr_values(ocr_outputs: Iterable) -> dict[str, object]:
    collected: dict[str, object] = {}
    for item in ocr_outputs:
        normalized_label = _normalize_key(item.label)
        if item.value is not None:
            collected[normalized_label] = item.value
    return collected


def _health_from_percentage(value: float | None, healthy: float, watch: float) -> str:
    if value is None:
        return "unknown"
    if value >= healthy:
        return "healthy"
    if value >= watch:
        return "watch"
    if value > 0:
        return "at_risk"
    return "critical"


def _validate_field(
    field_name: str,
    value: float | None,
    issues: list[MetricValidationIssue],
) -> float | None:
    if value is None:
        return None
    if field_name in NON_NEGATIVE_FIELDS and value < 0:
        issues.append(
            MetricValidationIssue(
                field=field_name,
                severity="error",
                message="Negative values are not allowed for this metric input.",
                provided_value=value,
            )
        )
        return None
    return value


def _build_standardized_metrics(
    normalized: dict[str, float | str | None],
    source_map: dict[str, list[str]],
) -> list[StandardizedMetric]:
    defect_health = str(normalized.get("defect_status_health") or "unknown")
    return [
        StandardizedMetric(
            key="velocity",
            label="Velocity",
            value=normalized.get("velocity"),
            normalized_value=normalized.get("velocity"),
            unit="story_points",
            health=_health_from_percentage(normalized.get("velocity_trend_pct"), 100, 85),
            source_fields=source_map["velocity"],
        ),
        StandardizedMetric(
            key="utilization",
            label="Utilization",
            value=normalized.get("utilization"),
            normalized_value=normalized.get("utilization"),
            unit="percent",
            health=_health_from_percentage(normalized.get("utilization"), 85, 70),
            source_fields=source_map["utilization"],
        ),
        StandardizedMetric(
            key="sprint_progress",
            label="Sprint Progress",
            value=normalized.get("sprint_progress"),
            normalized_value=normalized.get("sprint_progress"),
            unit="percent",
            health=_health_from_percentage(normalized.get("sprint_progress"), 75, 50),
            source_fields=source_map["sprint_progress"],
        ),
        StandardizedMetric(
            key="defect_status",
            label="Defect Status",
            value=normalized.get("defect_status"),
            normalized_value=normalized.get("defect_status_score"),
            unit=None,
            health=defect_health,
            source_fields=source_map["defect_status"],
        ),
        StandardizedMetric(
            key="scope_churn",
            label="Scope Churn",
            value=normalized.get("scope_churn"),
            normalized_value=normalized.get("scope_churn"),
            unit="percent",
            health="healthy"
            if (normalized.get("scope_churn") or 0) <= 10
            else "watch"
            if (normalized.get("scope_churn") or 0) <= 20
            else "at_risk",
            source_fields=source_map["scope_churn"],
        ),
    ]


async def extract_metrics(
    request: MetricsExtractionRequest,
) -> MetricsExtractionResponse:
    issues: list[MetricValidationIssue] = []
    dashboard_values = _flatten_dashboard_data(request.dashboard_data)
    ocr_values = _collect_ocr_values(request.ocr_outputs)

    resolved: dict[str, float | None] = {}
    source_map: dict[str, list[str]] = {}

    for field_name in NUMERIC_FIELDS:
        value, sources = _resolve_field_value(field_name, dashboard_values, ocr_values)
        resolved[field_name] = _validate_field(field_name, value, issues)
        source_map[field_name] = sources

    committed_story_points = resolved["committed_story_points"]
    completed_story_points = resolved["completed_story_points"]
    current_velocity = resolved["current_velocity"]
    previous_velocity = resolved["previous_velocity"]
    team_capacity_hours = resolved["team_capacity_hours"]
    used_capacity_hours = resolved["used_capacity_hours"]
    planned_tasks = resolved["planned_tasks"]
    completed_tasks = resolved["completed_tasks"]
    elapsed_days = resolved["elapsed_days"]
    total_days = resolved["total_days"]
    scope_added = resolved["scope_added_story_points"] or 0
    scope_removed = resolved["scope_removed_story_points"] or 0
    open_defects = resolved["open_defects"] or 0
    closed_defects = resolved["closed_defects"] or 0
    critical_open_defects = resolved["critical_open_defects"] or 0

    velocity = current_velocity if current_velocity is not None else completed_story_points
    velocity_trend_pct = None
    if velocity is not None and previous_velocity and previous_velocity > 0:
        velocity_trend_pct = round((velocity / previous_velocity) * 100, 2)
    elif velocity is not None:
        velocity_trend_pct = 100.0

    utilization = None
    if team_capacity_hours and team_capacity_hours > 0 and used_capacity_hours is not None:
        utilization = round((used_capacity_hours / team_capacity_hours) * 100, 2)
    elif used_capacity_hours is not None and team_capacity_hours == 0:
        issues.append(
            MetricValidationIssue(
                field="team_capacity_hours",
                severity="error",
                message="Team capacity hours must be greater than zero to calculate utilization.",
                provided_value=team_capacity_hours,
            )
        )

    sprint_progress = None
    sprint_progress_sources = list(
        dict.fromkeys(source_map["planned_tasks"] + source_map["completed_tasks"])
    )
    if planned_tasks and planned_tasks > 0 and completed_tasks is not None:
        sprint_progress = round((completed_tasks / planned_tasks) * 100, 2)
    elif total_days and total_days > 0 and elapsed_days is not None:
        sprint_progress = round((elapsed_days / total_days) * 100, 2)
        sprint_progress_sources = list(
            dict.fromkeys(source_map["elapsed_days"] + source_map["total_days"])
        )
    else:
        issues.append(
            MetricValidationIssue(
                field="sprint_progress",
                severity="warning",
                message="Sprint progress could not be calculated because task or timeline inputs were incomplete.",
            )
        )

    scope_churn = None
    if committed_story_points and committed_story_points > 0:
        scope_churn = round(((scope_added + scope_removed) / committed_story_points) * 100, 2)
    elif scope_added or scope_removed:
        issues.append(
            MetricValidationIssue(
                field="committed_story_points",
                severity="error",
                message="Committed story points must be greater than zero to calculate scope churn.",
                provided_value=committed_story_points,
            )
        )

    total_defects = open_defects + closed_defects
    defect_status_score = None
    defect_status = "unknown"
    defect_status_health = "unknown"
    if total_defects > 0:
        weighted_open_defects = open_defects + (critical_open_defects * 1.5)
        defect_status_score = round(max(0, 100 - ((weighted_open_defects / total_defects) * 100)), 2)
        if critical_open_defects >= 3 or open_defects > closed_defects:
            defect_status = "critical"
            defect_status_health = "critical"
        elif open_defects > 0:
            defect_status = "watch"
            defect_status_health = "watch"
        else:
            defect_status = "healthy"
            defect_status_health = "healthy"
    else:
        issues.append(
            MetricValidationIssue(
                field="defect_status",
                severity="warning",
                message="Defect status could not be fully assessed because no defect counts were available.",
            )
        )

    normalized_context: dict[str, float | str | None] = {
        "velocity": round(velocity, 2) if velocity is not None else None,
        "velocity_trend_pct": velocity_trend_pct,
        "utilization": utilization,
        "sprint_progress": sprint_progress,
        "scope_churn": scope_churn,
        "defect_status": defect_status,
        "defect_status_score": defect_status_score,
        "defect_status_health": defect_status_health,
    }

    source_map["velocity"] = list(
        dict.fromkeys(source_map["current_velocity"] + source_map["completed_story_points"])
    )
    source_map["utilization"] = list(
        dict.fromkeys(source_map["team_capacity_hours"] + source_map["used_capacity_hours"])
    )
    source_map["sprint_progress"] = sprint_progress_sources
    source_map["defect_status"] = list(
        dict.fromkeys(
            source_map["open_defects"]
            + source_map["closed_defects"]
            + source_map["critical_open_defects"]
        )
    )
    source_map["scope_churn"] = list(
        dict.fromkeys(
            source_map["committed_story_points"]
            + source_map["scope_added_story_points"]
            + source_map["scope_removed_story_points"]
        )
    )

    return MetricsExtractionResponse(
        success=not any(issue.severity == "error" for issue in issues),
        message="Metrics extracted successfully."
        if not any(issue.severity == "error" for issue in issues)
        else "Metrics extracted with validation issues.",
        metrics=_build_standardized_metrics(normalized_context, source_map),
        normalized_context={
            key: value
            for key, value in normalized_context.items()
            if isinstance(value, (int, float))
        },
        validation_issues=issues,
    )
