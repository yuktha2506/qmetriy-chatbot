from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
import app.api.routes.chat as chat_route


client = TestClient(app)


def test_chat_fallback_response_is_graceful():
    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "hello", "session_id": "test-session"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["session_id"] == "test-session"
    assert "Please refine the question" in payload["answer"]


def test_chat_supports_context_propagation_for_analytics():
    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "Show sprint velocity risk",
            "session_id": "test-session",
            "companyId": "company-1",
            "projectId": "project-1",
            "boardId": "board-1",
            "sprintId": "sprint-1",
            "releaseId": "release-1",
            "repo": "qmetrix-api",
            "dashboard_context": {
                "sprintCompleteDate": {"completionPercentage": 0.78},
                "openPRs": {"stalePRs": 2},
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "Live QMetrix analytics" in payload["answer"]


def test_chat_rag_query_returns_knowledge_answer():
    response = client.post(
        "/api/v1/ai/chat",
        json={"message": "What is story churn?"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["answer"].startswith("Story churn measures")
    assert "Live QMetrix analytics" not in payload["answer"]
    assert "Unresolved blockers" not in payload["answer"]
    assert "pull requests" not in payload["answer"]
    assert "file names" not in payload["answer"].lower()
    assert "similarity_score" not in payload["answer"]


def test_chat_uses_live_dashboard_context_for_current_velocity():
    response = client.post(
        "/api/v1/ai/chat",
        json={
            "message": "What is the current average velocity?",
            "session_id": "test-session",
            "projectId": "project-1",
            "sprintId": "sprint-18",
            "dashboard_context": {
                "selectedSprintName": "Sprint 18",
                "estimationType": "Story Points",
                "velocityData": {
                    "averageVelocity": 42,
                    "velocity": 37,
                    "targetVelocity": 45,
                },
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "current average velocity for Sprint 18 is 42 Story Points" in payload["answer"]
    assert "Velocity shows how much work" not in payload["answer"]


def test_chat_forwards_qmetrix_token_header(monkeypatch):
    captured = {}

    async def fake_build_chat_response(request, *, qmetrix_token=None):
        captured["token"] = qmetrix_token
        return {
            "success": True,
            "message": "ok",
            "answer": "ok",
            "session_id": request.session_id,
        }

    monkeypatch.setattr(chat_route, "build_chat_response", fake_build_chat_response)

    response = client.post(
        "/api/v1/ai/chat",
        headers={"qmetrix-token": "jwt-token"},
        json={"message": "Show sprint velocity risk", "session_id": "test-session"},
    )

    assert response.status_code == 200
    assert captured["token"] == "jwt-token"


def test_chat_enriches_missing_context_from_headers(monkeypatch):
    captured = {}

    async def fake_build_chat_response(request, *, qmetrix_token=None):
        captured["companyId"] = request.companyId
        captured["projectId"] = request.projectId
        captured["boardId"] = request.boardId
        captured["sprintId"] = request.sprintId
        captured["releaseId"] = request.releaseId
        captured["repo"] = request.repo
        captured["token"] = qmetrix_token
        return {
            "success": True,
            "message": "ok",
            "answer": "ok",
            "session_id": request.session_id,
        }

    monkeypatch.setattr(chat_route, "build_chat_response", fake_build_chat_response)

    response = client.post(
        "/api/v1/ai/chat",
        headers={
            "authorization": "Bearer jwt-token",
            "companyId": "company-1",
            "projectId": "project-1",
            "boardId": "board-1",
            "sprintId": "sprint-1",
            "releaseId": "release-1",
            "repo": "qmetrix-api",
        },
        json={"message": "Show sprint velocity risk", "session_id": "test-session"},
    )

    assert response.status_code == 200
    assert captured == {
        "companyId": "company-1",
        "projectId": "project-1",
        "boardId": "board-1",
        "sprintId": "sprint-1",
        "releaseId": "release-1",
        "repo": "qmetrix-api",
        "token": "jwt-token",
    }
