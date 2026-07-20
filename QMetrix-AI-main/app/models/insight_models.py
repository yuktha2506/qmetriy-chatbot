from typing import Literal

from pydantic import BaseModel, Field

from app.models.metrics_models import MetricsExtractionRequest


InsightSeverity = Literal["low", "medium", "high", "critical"]
HealthStatus = Literal["healthy", "watch", "at_risk", "critical", "unknown"]


class InsightFilters(BaseModel):
    project_id: str | None = Field(default=None, description="Project identifier")
    sprint_id: str | None = Field(default=None, description="Sprint identifier")
    release_id: str | None = Field(default=None, description="Release identifier")
    session_id: str | None = Field(
        default=None,
        description="Optional session or dashboard context identifier",
    )


class SprintMetricsInput(BaseModel):
    committed_story_points: float | None = 0
    completed_story_points: float | None = 0
    scope_added_story_points: float | None = 0
    scope_removed_story_points: float | None = 0
    planned_tasks: int | None = 0
    completed_tasks: int | None = 0
    elapsed_days: int | None = 0
    total_days: int | None = 0
    current_velocity: float | None = 0
    previous_velocity: float | None = 0


class CapacityMetricsInput(BaseModel):
    team_capacity_hours: float | None = 0
    used_capacity_hours: float | None = 0
    qa_capacity_hours: float | None = 0
    qa_used_capacity_hours: float | None = 0
    active_team_members: int | None = 0


class QualityMetricsInput(BaseModel):
    open_defects: int | None = 0
    closed_defects: int | None = 0
    critical_open_defects: int | None = 0
    defect_reopen_count: int | None = 0
    manual_test_cases: int | None = 0
    automated_test_cases: int | None = 0
    executed_test_cases: int | None = 0
    passed_test_cases: int | None = 0


class SCMMetricsInput(BaseModel):
    pull_requests_opened: int | None = 0
    pull_requests_merged: int | None = 0
    merge_requests_opened: int | None = 0
    merge_requests_merged: int | None = 0
    active_contributors: int | None = 0


class InsightsContextInput(BaseModel):
    sprint: SprintMetricsInput | None = None
    capacity: CapacityMetricsInput | None = None
    quality: QualityMetricsInput | None = None
    scm: SCMMetricsInput | None = None


class InsightsRequest(InsightFilters):
    context: InsightsContextInput | None = None
    metrics_request: MetricsExtractionRequest | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "project_id": "proj-101",
                "sprint_id": "sprint-18",
                "release_id": "rel-2026-05",
                "session_id": "dash-session-123",
                "context": {
                    "sprint": {
                        "committed_story_points": 120,
                        "completed_story_points": 74,
                        "scope_added_story_points": 18,
                        "scope_removed_story_points": 4,
                        "planned_tasks": 42,
                        "completed_tasks": 25,
                        "elapsed_days": 7,
                        "total_days": 10,
                        "current_velocity": 37,
                        "previous_velocity": 45,
                    },
                    "capacity": {
                        "team_capacity_hours": 320,
                        "used_capacity_hours": 298,
                        "qa_capacity_hours": 80,
                        "qa_used_capacity_hours": 76,
                        "active_team_members": 8,
                    },
                    "quality": {
                        "open_defects": 24,
                        "closed_defects": 13,
                        "critical_open_defects": 5,
                        "defect_reopen_count": 2,
                        "manual_test_cases": 140,
                        "automated_test_cases": 58,
                        "executed_test_cases": 122,
                        "passed_test_cases": 101,
                    },
                    "scm": {
                        "pull_requests_opened": 16,
                        "pull_requests_merged": 9,
                        "merge_requests_opened": 0,
                        "merge_requests_merged": 0,
                        "active_contributors": 6,
                    },
                },
                "metrics_request": {
                    "dashboard_data": {
                        "committed_story_points": 120,
                        "completed_story_points": 74,
                        "team_capacity_hours": 320,
                        "used_capacity_hours": 298,
                        "open_defects": 24,
                        "closed_defects": 13,
                        "critical_open_defects": 5,
                    },
                    "ocr_outputs": [
                        {"label": "Scope Added", "value": "18"},
                        {"label": "Scope Removed", "value": "4"},
                    ],
                },
            }
        }
    }


class InsightCard(BaseModel):
    title: str
    severity: InsightSeverity
    summary: str


class InsightsResponse(BaseModel):
    success: bool
    message: str
    filters: InsightFilters
    health_status: HealthStatus
    summary: str
    cards: list[InsightCard]
    risks: list[str]
    recommendations: list[str]
