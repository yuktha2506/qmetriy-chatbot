from pydantic import BaseModel


class UploadedScreenshot(BaseModel):
    original_filename: str
    stored_filename: str
    content_type: str
    file_size: int
    storage_path: str


class UploadAnalysisResponse(BaseModel):
    success: bool
    message: str
    upload: UploadedScreenshot | None = None
