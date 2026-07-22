from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from app.services.analytics_service import (
    AnalyticsService,
    normalize_sprint_metrics,
    normalize_standup_metrics,
)


class FakeAsyncClient:
    def __init__(self, payloads=None, exc=None):
        self.payloads = payloads or {}
        self.exc = exc
        self.calls = []

    async def get(self, url, params=None, headers=None):
        self.calls.append({"url": url, "params": params or {}, "headers": headers or {}})
        if self.exc:
            raise self.exc
        payload = self.payloads.get(url, {})
        return httpx.Response(200, json=payload, request=httpx.Request("GET", url))


def test_fetch_sprint_metrics_calls_live_backend_and_propagates_context():
    url = (
        "http://node.test/api/analytics/getProjectManagementData/"
        "company-1/project-1/board-1"
    )
    client = FakeAsyncClient(
        {
            url: {
                "velocity": {
                    "averageVelocity": 42,
                    "completedStoryPoints": 37,
                    "committedStoryPoints": 45,
                },
                "sprintCompleteDate": {"completionPercentage": 0.72},
            }
        }
    )
    service = AnalyticsService(
        base_url="http://node.test",
        token="token-1",
        client=client,
    )

    result = __import__("asyncio").run(
        service.fetch_sprint_metrics(
            {
                "companyId": "company-1",
                "projectId": "project-1",
                "boardId": "board-1",
                "sprintId": "sprint-1",
            }
        )
    )

    assert result["success"] is True
    assert result["domain"] == "sprint_metrics"
    assert result["context"]["sprintId"] == "sprint-1"
    assert result["metrics"]["average_velocity"] == 42
    assert result["metrics"]["current_velocity"] == 37
    assert result["metrics"]["target_velocity"] == 45
    assert client.calls[0]["params"]["sprintId"] == "sprint-1"
    assert client.calls[0]["headers"]["qmetrix-token"] == "token-1"


def test_fetch_standup_metrics_uses_documented_aggregate_endpoint():
    url = "http://node.test/api/analytics/getStandupData/company-1/project-1/board-1"
    client = FakeAsyncClient(
        {
            url: {
                "storyChurn": {"churnPercentage": 0.16},
                "jiraStatusByDev": {"blockedItems": 3},
            }
        }
    )
    service = AnalyticsService(base_url="http://node.test", client=client)

    result = __import__("asyncio").run(
        service.fetch_standup_metrics(
            {
                "companyId": "company-1",
                "projectId": "project-1",
                "boardId": "board-1",
                "sprintId": "sprint-1",
                "repo": "qmetrix-api",
            }
        )
    )

    assert result["success"] is True
    assert result["domain"] == "standup_metrics"
    assert result["metrics"]["story_churn"] == 0.16
    assert result["metrics"]["blocked_items"] == 3
    assert client.calls[0]["params"]["repo"] == "qmetrix-api"
    assert "storyChurn" in client.calls[0]["params"]["sections"]


def test_retrieve_analytics_context_handles_backend_failure_gracefully():
    client = FakeAsyncClient(exc=httpx.ConnectError("backend offline"))
    service = AnalyticsService(base_url="http://node.test/api", client=client)

    result = __import__("asyncio").run(
        service.retrieve_analytics_context(
            {
                "companyId": "company-1",
                "projectId": "project-1",
                "boardId": "board-1",
                "sprintId": "sprint-1",
                "releaseId": "release-1",
                "repo": "qmetrix-api",
            }
        )
    )

    assert result["success"] is False
    assert result["summary"]["overall_health"] == "unavailable"
    assert "sprint_metrics" in result["summary"]["failed_domains"]
    assert all(source["success"] is False for source in result["sources"])


def test_dashboard_context_is_normalized_without_backend_call():
    client = FakeAsyncClient()
    service = AnalyticsService(base_url="http://node.test", client=client)

    result = __import__("asyncio").run(
        service.retrieve_analytics_context(
            {"projectId": "project-1", "sprintId": "sprint-18"},
            {
                "selectedSprintName": "Sprint 18",
                "velocityData": {"averageVelocity": 42, "targetVelocity": 45},
            },
        )
    )

    assert result["success"] is True
    assert result["sources"][0]["domain"] == "live_dashboard"
    assert result["sources"][0]["metrics"]["average_velocity"] == 42
    assert client.calls == []


def test_normalize_sprint_metrics_is_ai_friendly():
    source = normalize_sprint_metrics(
        {
            "velocity": {"averageVelocity": 30},
            "burndown": {"remainingStoryPoints": 12},
        },
        {"companyId": "company-1"},
    )

    assert source["domain"] == "sprint_metrics"
    assert source["metrics"]["average_velocity"] == 30
    assert source["metrics"]["remaining_work"] == 12
    assert "retrieved from the QMetrix backend" in source["summary_text"]


def test_normalize_standup_metrics_is_ai_friendly():
    source = normalize_standup_metrics(
        {
            "jiraStatusByDev": {"blockedItems": 2},
            "storyChurn": {"churnPercentage": 0.12},
        },
        {"companyId": "company-1"},
    )

    assert source["domain"] == "standup_metrics"
    assert source["metrics"]["blocked_items"] == 2
    assert source["metrics"]["story_churn"] == 0.12
