from fastapi import APIRouter

from app.models.metrics_models import MetricsExtractionRequest, MetricsExtractionResponse
from app.services.metrics_service import extract_metrics

router = APIRouter()


@router.post("/metrics/extract", response_model=MetricsExtractionResponse)
async def extract_dashboard_metrics(request: MetricsExtractionRequest):
    return await extract_metrics(request)
