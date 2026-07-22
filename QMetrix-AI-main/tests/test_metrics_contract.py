
from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


client = TestClient(app)


def test_metrics_extraction_normalizes_dashboard_and_ocr_inputs():
    response = client.post(
        "/api/v1/ai/metrics/extract",
        json={
            "dashboard_data": {
                "committed_story_points": 120,
                "completed_story_points": 96,
                "team_capacity_hours": 320,
                "used_capacity_hours": "280h",
                "planned_tasks": 40,
                "completed_tasks": 30,
                "open_defects": 8,
                "closed_defects": 12,
                "critical_open_defects": 1,
            },
            "ocr_outputs": [
                {"label": "Scope Added", "value": "18"},
                {"label": "Scope Removed", "value": "6"},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["success"] is True
    assert payload["normalized_context"]["velocity"] == 96.0
    assert payload["normalized_context"]["utilization"] == 87.5
    assert payload["normalized_context"]["sprint_progress"] == 75.0
    assert payload["normalized_context"]["scope_churn"] == 20.0
    assert payload["validation_issues"] == []

    metric_keys = {metric["key"] for metric in payload["metrics"]}
    assert metric_keys == {
        "velocity",
        "utilization",
        "sprint_progress",
        "defect_status",
        "scope_churn",
    }


def test_metrics_extraction_reports_invalid_data():
    response = client.post(
        "/api/v1/ai/metrics/extract",
        json={
            "dashboard_data": {
                "completed_story_points": -5,
                "team_capacity_hours": 0,
                "used_capacity_hours": 10,
                "scope_added_story_points": 3,
                "scope_removed_story_points": 1,
            }
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["success"] is False
    assert len(payload["validation_issues"]) >= 2
    assert any(issue["field"] == "completed_story_points" for issue in payload["validation_issues"])
    assert any(issue["field"] == "team_capacity_hours" for issue in payload["validation_issues"])
