from pathlib import Path
from statistics import mean

import pytesseract
from PIL import Image
from pytesseract import Output

from app.core.config import settings
from app.models.ocr_models import OCRExtractionResult, OCRLine, OCRWord


def _build_tesseract_config() -> str:
    return f"--oem {settings.ocr_oem} --psm {settings.ocr_psm}"


def _parse_confidence(value: str | int | float | None) -> float | None:
    if value in (None, "", "-1"):
        return None
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return None
    return confidence if confidence >= 0 else None


async def extract_text_from_image(image_path: str | Path) -> OCRExtractionResult:
    source_path = Path(image_path)
    if not source_path.exists():
        raise FileNotFoundError(f"Image not found: {source_path}")

    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
    config = _build_tesseract_config()

    with Image.open(source_path) as image:
        full_text = pytesseract.image_to_string(
            image,
            lang=settings.ocr_language,
            config=config,
        ).strip()
        data = pytesseract.image_to_data(
            image,
            lang=settings.ocr_language,
            config=config,
            output_type=Output.DICT,
        )

    words: list[OCRWord] = []
    line_map: dict[tuple[int, int, int], list[str]] = {}
    line_conf_map: dict[tuple[int, int, int], list[float]] = {}

    total_items = len(data.get("text", []))
    for index in range(total_items):
        text = str(data["text"][index]).strip()
        confidence = _parse_confidence(data["conf"][index])
        if not text:
            continue

        words.append(OCRWord(text=text, confidence=confidence))

        line_key = (
            int(data["block_num"][index]),
            int(data["par_num"][index]),
            int(data["line_num"][index]),
        )
        line_map.setdefault(line_key, []).append(text)
        if confidence is not None:
            line_conf_map.setdefault(line_key, []).append(confidence)

    lines: list[OCRLine] = []
    for line_key in sorted(line_map):
        line_text = " ".join(line_map[line_key]).strip()
        confidences = line_conf_map.get(line_key, [])
        line_confidence = round(mean(confidences), 2) if confidences else None
        if line_text:
            lines.append(OCRLine(text=line_text, confidence=line_confidence))

    word_confidences = [word.confidence for word in words if word.confidence is not None]
    average_confidence = round(mean(word_confidences), 2) if word_confidences else None

    return OCRExtractionResult(
        source_image_path=str(source_path),
        full_text=full_text,
        lines=lines,
        words=words,
        average_confidence=average_confidence,
    )
