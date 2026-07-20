from fastapi import APIRouter, File, UploadFile

from app.models.upload_models import UploadAnalysisResponse
from app.services.upload_analysis_service import analyze_uploaded_dashboard

router = APIRouter()


@router.post("/upload-analysis", response_model=UploadAnalysisResponse)
async def upload_analysis(file: UploadFile = File(...)):
    return await analyze_uploaded_dashboard(file)
