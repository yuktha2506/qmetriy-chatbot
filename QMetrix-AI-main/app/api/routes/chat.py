from fastapi import APIRouter, Request

from app.models.chat_models import ChatRequest, ChatResponse
from app.services.chat_service import build_chat_response

router = APIRouter()


def _first_header(http_request: Request, *names: str) -> str | None:
    for name in names:
        value = http_request.headers.get(name)
        if value:
            return value
    return None


def _auth_token(http_request: Request) -> str | None:
    token = http_request.headers.get("qmetrix-token")
    if token:
        return token

    authorization = http_request.headers.get("authorization")
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def _with_header_context(request: ChatRequest, http_request: Request) -> ChatRequest:
    header_context = {
        "companyId": _first_header(http_request, "companyId", "company-id", "x-company-id"),
        "projectId": _first_header(http_request, "projectId", "project-id", "x-project-id"),
        "boardId": _first_header(http_request, "boardId", "board-id", "x-board-id"),
        "sprintId": _first_header(http_request, "sprintId", "sprint-id", "x-sprint-id"),
        "releaseId": _first_header(http_request, "releaseId", "release-id", "x-release-id"),
        "repo": _first_header(http_request, "repo", "repository", "x-repo"),
    }
    updates = {
        key: value
        for key, value in header_context.items()
        if value and not getattr(request, key)
    }
    if not updates:
        return request

    if hasattr(request, "model_copy"):
        return request.model_copy(update=updates)
    return request.copy(update=updates)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, http_request: Request):
    return await build_chat_response(
        _with_header_context(request, http_request),
        qmetrix_token=_auth_token(http_request),
    )
