from typing import Any

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    companyId: str | None = None
    projectId: str | None = None
    boardId: str | None = None
    sprintId: str | None = None
    releaseId: str | None = None
    repo: str | None = None
    dashboard_context: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    success: bool
    message: str
    answer: str
    session_id: str | None = None
