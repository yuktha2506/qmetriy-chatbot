from fastapi import APIRouter, Query

from app.models.insight_models import InsightsRequest, InsightsResponse
from app.services.insights_service import build_insights_response

router = APIRouter()


@router.get("/insights", response_model=InsightsResponse)
async def get_insights(
    project_id: str | None = Query(default=None),
    sprint_id: str | None = Query(default=None),
    release_id: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
):
    return await build_insights_response(
        InsightsRequest(
            project_id=project_id,
            sprint_id=sprint_id,
            release_id=release_id,
            session_id=session_id,
        )
    )


@router.post("/insights", response_model=InsightsResponse)
async def insights(request: InsightsRequest):
    return await build_insights_response(request)
