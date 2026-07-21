from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.models.upload_models import UploadAnalysisResponse, UploadedScreenshot
from app.repositories.upload_repository import UploadRepository
from app.services.image_preprocessing_service import ImagePreprocessingService
from app.services.ocr_service import extract_text_from_image
from app.services.vision_service import analyze_dashboard_image
from app.utils.upload_utils import build_storage_filename, is_allowed_upload


async def analyze_uploaded_dashboard(file: UploadFile) -> UploadAnalysisResponse:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "message": "No file was provided."},
        )

    original_filename = Path(file.filename).name

    if not is_allowed_upload(
        original_filename,
        file.content_type,
        settings.allowed_upload_extensions,
        settings.allowed_upload_content_types,
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "success": False,
                "message": "Only PNG, JPG, and JPEG images are allowed.",
            },
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"success": False, "message": "Uploaded file is empty."},
            )

        if len(content) > settings.max_upload_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={"success": False, "message": "File size must be 5MB or less."},
            )

        stored_filename = build_storage_filename(original_filename)
        upload_repository = UploadRepository(settings.uploads_dir)
        storage_path = upload_repository.save_bytes(content, stored_filename)
        preprocessing_service = ImagePreprocessingService()
        processed_repository = UploadRepository(settings.processed_images_dir)
        processed_path: Path | None = None

        try:
            processed_result = await preprocessing_service.preprocess_image(storage_path)
            processed_path = Path(processed_result.processed_path)
            _ocr_result = await extract_text_from_image(processed_path)
            await analyze_dashboard_image(processed_path)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "success": False,
                    "message": "Screenshot preprocessing failed.",
                },
            ) from exc
        finally:
            if processed_path is not None:
                processed_repository.delete_path(processed_path)

        return UploadAnalysisResponse(
            success=True,
            message="Screenshot uploaded successfully.",
            upload=UploadedScreenshot(
                original_filename=original_filename,
                stored_filename=stored_filename,
                content_type=file.content_type or "application/octet-stream",
                file_size=len(content),
                storage_path=str(storage_path),
            ),
        )
    finally:
        await file.close()
