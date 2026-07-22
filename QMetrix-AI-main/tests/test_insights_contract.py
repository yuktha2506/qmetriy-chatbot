from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


client = TestClient(app)


def test_get_insights_supports_query_filters():
    response = client.get(
        "/api/v1/ai/insights",
        params={
            "project_id": "proj-101",
            "sprint_id": "sprint-18",
            "release_id": "rel-2026-05",
            "session_id": "dash-session-123",
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["success"] is True
    assert payload["filters"] == {
        "project_id": "proj-101",
        "sprint_id": "sprint-18",
        "release_id": "rel-2026-05",
        "session_id": "dash-session-123",
    }
    assert payload["health_status"] == "unknown"
    assert payload["cards"] == []
    assert payload["risks"] == []
    assert payload["recommendations"] == []


def test_post_insights_accepts_structured_context_payload():
    response = client.post(
        "/api/v1/ai/insights",
        json={
            "project_id": "proj-101",
            "sprint_id": "sprint-18",
            "release_id": "rel-2026-05",
            "context": {
                "sprint": {
                    "committed_story_points": 120,
                    "completed_story_points": 74,
                    "scope_added_story_points": 18,
                    "planned_tasks": 42,
                    "completed_tasks": 25,
                    "elapsed_days": 7,
                    "total_days": 10,
                    "current_velocity": 37,
                    "previous_velocity": 45,
                },
                "quality": {
                    "open_defects": 24,
                    "closed_defects": 13,
                    "critical_open_defects": 5,
                },
                "scm": {
                    "pull_requests_opened": 16,
                    "pull_requests_merged": 9,
                    "active_contributors": 6,
                },
            },
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["success"] is True
    assert payload["health_status"] == "critical"
    assert payload["message"] == "Insights generated successfully."
    assert len(payload["cards"]) == 4
    assert "Immediate action required" in payload["summary"]


def test_post_insights_accepts_metrics_request_for_direct_insight_generation():
    response = client.post(
        "/api/v1/ai/insights",
        json={
            "project_id": "proj-101",
            "metrics_request": {
                "dashboard_data": {
                    "committed_story_points": 100,
                    "completed_story_points": 82,
                    "team_capacity_hours": 200,
                    "used_capacity_hours": 210,
                    "planned_tasks": 20,
                    "completed_tasks": 16,
                    "open_defects": 5,
                    "closed_defects": 9,
                    "critical_open_defects": 0,
                },
                "ocr_outputs": [
                    {"label": "Scope Added", "value": "8"},
                    {"label": "Scope Removed", "value": "4"},
                ],
            },
        },
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["success"] is True
    assert payload["health_status"] == "watch"
    assert len(payload["cards"]) == 5
    assert payload["recommendations"] == [
        "Rebalance capacity because utilized hours exceed planned team capacity."
    ]
