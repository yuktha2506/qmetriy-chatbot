from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "QMetrix AI Service"
    api_prefix: str = "/api/v1"
    uploads_dir: Path = Path(__file__).resolve().parents[2] / "uploads"
    processed_images_dir: Path = Path(__file__).resolve().parents[2] / "tmp" / "processed-images"
    tesseract_cmd: str = r"C:\Users\monica_r\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
    ocr_language: str = "eng"
    ocr_psm: int = 6
    ocr_oem: int = 3
    max_upload_size_bytes: int = 5 * 1024 * 1024
    allowed_upload_extensions: tuple[str, ...] = (".png", ".jpg", ".jpeg")
    allowed_upload_content_types: tuple[str, ...] = (
        "image/png",
        "image/jpeg",
    )
    preprocessing_max_width: int = 1600
    preprocessing_max_height: int = 1600
    preprocessing_contrast_factor: float = 1.6
    preprocessing_sharpness_factor: float = 1.2


settings = Settings()
