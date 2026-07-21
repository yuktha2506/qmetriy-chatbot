from app.models.insight_models import (
    HealthStatus,
    InsightCard,
    InsightFilters,
    InsightsRequest,
    InsightsResponse,
)
from app.models.metrics_models import MetricsExtractionRequest
from app.services.metrics_service import extract_metrics


def classify_health(request: InsightsRequest) -> HealthStatus:
    score = 0

    sprint = request.context.sprint if request.context else None
    capacity = request.context.capacity if request.context else None
    quality = request.context.quality if request.context else None

    if sprint:
        if sprint.previous_velocity and sprint.current_velocity:
            velocity_ratio = sprint.current_velocity / sprint.previous_velocity
            if velocity_ratio < 0.6:
                score += 3
            elif velocity_ratio < 0.8:
                score += 2
            elif velocity_ratio < 0.95:
                score += 1

        if sprint.total_days and sprint.elapsed_days:
            time_used = sprint.elapsed_days / sprint.total_days
            if sprint.committed_story_points:
                work_done = sprint.completed_story_points / sprint.committed_story_points
                if time_used > 0.7 and work_done < 0.5:
                    score += 3
                elif time_used > 0.5 and work_done < 0.4:
                    score += 2

        if sprint.scope_added_story_points and sprint.committed_story_points:
            churn = sprint.scope_added_story_points / sprint.committed_story_points
            if churn > 0.2:
                score += 2
            elif churn > 0.1:
                score += 1

    if capacity:
        if capacity.team_capacity_hours and capacity.used_capacity_hours:
            utilization = capacity.used_capacity_hours / capacity.team_capacity_hours
            if utilization > 0.95:
                score += 2
            elif utilization > 0.85:
                score += 1

    if quality:
        if quality.critical_open_defects and quality.critical_open_defects >= 5:
            score += 3
        elif quality.critical_open_defects and quality.critical_open_defects >= 2:
            score += 1

        if quality.executed_test_cases and quality.passed_test_cases:
            pass_rate = quality.passed_test_cases / quality.executed_test_cases
            if pass_rate < 0.7:
                score += 2
            elif pass_rate < 0.85:
                score += 1

    if score == 0:
        return "healthy"
    if score <= 2:
        return "watch"
    if score <= 4:
        return "at_risk"
    return "critical"


def build_insight_cards(request: InsightsRequest) -> list[InsightCard]:
    cards: list[InsightCard] = []

    sprint = request.context.sprint if request.context else None
    capacity = request.context.capacity if request.context else None
    quality = request.context.quality if request.context else None
    scm = request.context.scm if request.context else None

    if sprint:
        if sprint.previous_velocity and sprint.current_velocity:
            if sprint.current_velocity < sprint.previous_velocity:
                drop = sprint.previous_velocity - sprint.current_velocity
                severity = "high" if drop > 10 else "medium"
                cards.append(
                    InsightCard(
                        title="Velocity Drop",
                        severity=severity,
                        summary=(
                            f"Velocity dropped from {sprint.previous_velocity} "
                            f"to {sprint.current_velocity} story points."
                        ),
                    )
                )

        if sprint.committed_story_points and sprint.scope_added_story_points:
            churn = (
                sprint.scope_added_story_points / sprint.committed_story_points
            ) * 100
            if churn > 10:
                cards.append(
                    InsightCard(
                        title="Scope Creep Detected",
                        severity="high" if churn > 20 else "medium",
                        summary=(
                            f"{churn:.1f}% scope added mid-sprint "
                            f"({sprint.scope_added_story_points} points)."
                        ),
                    )
                )

        if sprint.total_days and sprint.elapsed_days and sprint.committed_story_points:
            time_used = sprint.elapsed_days / sprint.total_days
            work_done = sprint.completed_story_points / sprint.committed_story_points
            if time_used > 0.6 and work_done < 0.5:
                cards.append(
                    InsightCard(
                        title="Delivery Risk",
                        severity="critical",
                        summary=(
                            f"{int(time_used * 100)}% of time elapsed but only "
                            f"{int(work_done * 100)}% work completed."
                        ),
                    )
                )

    if capacity:
        if capacity.team_capacity_hours and capacity.used_capacity_hours:
            utilization = (
                capacity.used_capacity_hours / capacity.team_capacity_hours
            ) * 100
            if utilization > 85:
                cards.append(
                    InsightCard(
                        title="Team Overload",
                        severity="high" if utilization > 95 else "medium",
                        summary=f"Team capacity utilization is at {utilization:.1f}%.",
                    )
                )

    if quality:
        if quality.critical_open_defects and quality.critical_open_defects > 0:
            cards.append(
                InsightCard(
                    title="Critical Defects Open",
                    severity="critical"
                    if quality.critical_open_defects >= 5
                    else "high",
                    summary=(
                        f"{quality.critical_open_defects} critical defects are still "
                        "unresolved."
                    ),
                )
            )

        if quality.executed_test_cases and quality.passed_test_cases:
            pass_rate = (
                quality.passed_test_cases / quality.executed_test_cases
            ) * 100
            if pass_rate < 85:
                cards.append(
                    InsightCard(
                        title="Low Test Pass Rate",
                        severity="high" if pass_rate < 70 else "medium",
                        summary=(
                            f"Test pass rate is {pass_rate:.1f}% - below acceptable "
                            "threshold."
                        ),
                    )
                )

    if scm:
        if scm.pull_requests_opened and scm.pull_requests_merged:
            unmerged = scm.pull_requests_opened - scm.pull_requests_merged
            if unmerged > 5:
                cards.append(
                    InsightCard(
                        title="Unmerged Pull Requests",
                        severity="medium",
                        summary=(
                            f"{unmerged} pull requests are open and not yet merged."
                        ),
                    )
                )

    return cards


def build_risks(request: InsightsRequest) -> list[str]:
    risks: list[str] = []

    sprint = request.context.sprint if request.context else None
    capacity = request.context.capacity if request.context else None
    quality = request.context.quality if request.context else None

    if sprint:
        if sprint.total_days and sprint.elapsed_days:
            time_used = sprint.elapsed_days / sprint.total_days
            if sprint.committed_story_points:
                work_done = sprint.completed_story_points / sprint.committed_story_points
                if time_used > 0.6 and work_done < 0.5:
                    risks.append("Sprint is at risk of not completing on time.")

        if sprint.scope_added_story_points and sprint.committed_story_points:
            if sprint.scope_added_story_points / sprint.committed_story_points > 0.1:
                risks.append("Scope instability may impact sprint goals.")

    if capacity:
        if capacity.team_capacity_hours and capacity.used_capacity_hours:
            if capacity.used_capacity_hours / capacity.team_capacity_hours > 0.9:
                risks.append("Team is overloaded - risk of burnout or missed deadlines.")

    if quality:
        if quality.critical_open_defects and quality.critical_open_defects >= 3:
            risks.append("High number of critical defects may block release.")
        if quality.defect_reopen_count and quality.defect_reopen_count > 2:
            risks.append("Recurring defect reopens indicate quality process gaps.")

    return risks


def build_recommendations(request: InsightsRequest) -> list[str]:
    recommendations: list[str] = []

    sprint = request.context.sprint if request.context else None
    capacity = request.context.capacity if request.context else None
    quality = request.context.quality if request.context else None
    scm = request.context.scm if request.context else None

    if sprint:
        if sprint.current_velocity and sprint.previous_velocity:
            if sprint.current_velocity < sprint.previous_velocity * 0.8:
                recommendations.append(
                    "Review sprint planning - velocity has dropped significantly."
                )
        if sprint.scope_added_story_points and sprint.committed_story_points:
            if sprint.scope_added_story_points / sprint.committed_story_points > 0.1:
                recommendations.append(
                    "Freeze scope changes to protect sprint commitment."
                )

    if capacity:
        if capacity.team_capacity_hours and capacity.used_capacity_hours:
            if capacity.used_capacity_hours / capacity.team_capacity_hours > 0.9:
                recommendations.append(
                    "Reallocate tasks or add resources to reduce team overload."
                )

    if quality:
        if quality.critical_open_defects and quality.critical_open_defects >= 3:
            recommendations.append(
                "Prioritize resolving critical defects before new feature work."
            )
        if quality.executed_test_cases and quality.passed_test_cases:
            if quality.passed_test_cases / quality.executed_test_cases < 0.85:
                recommendations.append(
                    "Improve test coverage and review failing test cases."
                )

    if scm:
        if scm.pull_requests_opened and scm.pull_requests_merged:
            if scm.pull_requests_opened - scm.pull_requests_merged > 5:
                recommendations.append(
                    "Schedule a PR review session to clear the backlog."
                )

    return recommendations


def build_summary(
    health: HealthStatus, cards: list[InsightCard], risks: list[str]
) -> str:
    if health == "healthy":
        return "Sprint is on track. No major risks detected."
    if health == "watch":
        return f"Sprint needs monitoring. {len(cards)} insight(s) flagged for review."
    if health == "at_risk":
        return (
            f"Sprint is at risk. {len(risks)} risk(s) identified that require "
            "immediate attention."
        )
    return f"Sprint is in critical state. Immediate action required across {len(cards)} area(s)."


async def build_insights_response(request: InsightsRequest) -> InsightsResponse:
    metrics_request = _resolve_metrics_request(request)
    if request.metrics_request is not None and metrics_request is not None:
        metrics_summary = await extract_metrics(metrics_request)
        return InsightsResponse(
            success=True,
            message="Insights response generated from the standardized metrics context.",
            filters=InsightFilters(
                project_id=request.project_id,
                sprint_id=request.sprint_id,
                release_id=request.release_id,
                session_id=request.session_id,
            ),
            health_status=_resolve_health_status(metrics_summary),
            summary=_build_metrics_summary(metrics_summary),
            cards=_build_metrics_cards(metrics_summary),
            risks=_build_metrics_risks(metrics_summary),
            recommendations=_build_metrics_recommendations(metrics_summary),
        )

    if not request.context:
        return InsightsResponse(
            success=True,
            message="No context data provided. Pass sprint/capacity/quality/scm metrics for insights.",
            filters=InsightFilters(
                project_id=request.project_id,
                sprint_id=request.sprint_id,
                release_id=request.release_id,
                session_id=request.session_id,
            ),
            health_status="unknown",
            summary="No metrics available to evaluate.",
            cards=[],
            risks=[],
            recommendations=[],
        )

    health = classify_health(request)
    cards = build_insight_cards(request)
    risks = build_risks(request)
    recommendations = build_recommendations(request)
    summary = build_summary(health, cards, risks)

    return InsightsResponse(
        success=True,
        message="Insights generated successfully.",
        filters=InsightFilters(
            project_id=request.project_id,
            sprint_id=request.sprint_id,
            release_id=request.release_id,
            session_id=request.session_id,
        ),
        health_status=health,
        summary=summary,
        cards=cards,
        risks=risks,
        recommendations=recommendations,
    )


def _resolve_metrics_request(request: InsightsRequest) -> MetricsExtractionRequest | None:
    if request.metrics_request is not None:
        return request.metrics_request

    if request.context is None:
        return None

    dashboard_data = request.context.model_dump(exclude_none=True)
    return MetricsExtractionRequest(dashboard_data=dashboard_data)


def _resolve_health_status(metrics_summary) -> HealthStatus:
    health_map = {metric.health for metric in metrics_summary.metrics}
    if "critical" in health_map:
        return "critical"
    if "at_risk" in health_map:
        return "at_risk"
    if "watch" in health_map:
        return "watch"
    if "healthy" in health_map:
        return "healthy"
    return "unknown"


def _build_metrics_summary(metrics_summary) -> str:
    available_metrics = [
        metric.label for metric in metrics_summary.metrics if metric.value is not None
    ]
    if not available_metrics:
        return (
            "Metrics extraction completed, but the payload did not contain enough "
            "usable values for insight generation."
        )

    return (
        "Metrics are normalized and ready for insight generation across "
        + ", ".join(available_metrics)
        + "."
    )


def _build_metrics_cards(metrics_summary) -> list[InsightCard]:
    cards: list[InsightCard] = []
    for metric in metrics_summary.metrics:
        if metric.value is None:
            continue
        severity = (
            "high"
            if metric.health in {"critical", "at_risk"}
            else "medium"
            if metric.health == "watch"
            else "low"
        )
        cards.append(
            InsightCard(
                title=metric.label,
                severity=severity,
                summary=f"{metric.label} is {metric.value} {metric.unit or ''}".strip(),
            )
        )
    return cards


def _build_metrics_risks(metrics_summary) -> list[str]:
    return [
        issue.message
        for issue in metrics_summary.validation_issues
        if issue.severity == "error"
    ]


def _build_metrics_recommendations(metrics_summary) -> list[str]:
    recommendations: list[str] = []
    for metric in metrics_summary.metrics:
        if (
            metric.key == "scope_churn"
            and isinstance(metric.normalized_value, (int, float))
            and metric.normalized_value > 20
        ):
            recommendations.append(
                "Reduce mid-sprint scope changes and tighten sprint commitment review."
            )
        if (
            metric.key == "utilization"
            and isinstance(metric.normalized_value, (int, float))
            and metric.normalized_value > 100
        ):
            recommendations.append(
                "Rebalance capacity because utilized hours exceed planned team capacity."
            )
        if metric.key == "defect_status" and metric.health in {"critical", "at_risk"}:
            recommendations.append(
                "Prioritize critical open defects before adding new sprint scope."
            )
    return recommendations
