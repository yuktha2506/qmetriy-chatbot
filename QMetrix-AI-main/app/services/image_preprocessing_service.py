from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image

from app.core.config import settings
from app.models.preprocessing_models import PreprocessingResult
from app.repositories.upload_repository import UploadRepository
from app.utils.image_preprocessing import preprocess_for_ocr


class ImagePreprocessingService:
    def __init__(self) -> None:
        self.repository = UploadRepository(settings.processed_images_dir)

    async def preprocess_image(self, source_path: Path) -> PreprocessingResult:
        with Image.open(source_path) as image:
            original_width, original_height = image.size
            processed_image = preprocess_for_ocr(
                image=image,
                max_width=settings.preprocessing_max_width,
                max_height=settings.preprocessing_max_height,
                contrast_factor=settings.preprocessing_contrast_factor,
                sharpness_factor=settings.preprocessing_sharpness_factor,
            )

        output_buffer = BytesIO()
        processed_image.save(output_buffer, format="PNG")
        processed_bytes = output_buffer.getvalue()

        processed_filename = f"{source_path.stem}_{uuid4().hex}_processed.png"
        processed_path = self.repository.save_bytes(processed_bytes, processed_filename)

        return PreprocessingResult(
            source_path=str(source_path),
            processed_path=str(processed_path),
            original_width=original_width,
            original_height=original_height,
            processed_width=processed_image.size[0],
            processed_height=processed_image.size[1],
            steps_applied=[
                "resize",
                "grayscale",
                "noise_reduction",
                "contrast_enhancement",
                "sharpness_enhancement",
                "ocr_normalization",
            ],
        )
