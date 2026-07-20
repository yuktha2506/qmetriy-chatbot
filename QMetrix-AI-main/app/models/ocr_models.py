from pydantic import BaseModel, Field


class OCRWord(BaseModel):
    text: str
    confidence: float | None = None


class OCRLine(BaseModel):
    text: str
    confidence: float | None = None


class OCRExtractionResult(BaseModel):
    source_image_path: str
    full_text: str
    lines: list[OCRLine] = Field(default_factory=list)
    words: list[OCRWord] = Field(default_factory=list)
    average_confidence: float | None = None
