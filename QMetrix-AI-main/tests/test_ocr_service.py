import asyncio
from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ocr_service import extract_text_from_image


def test_extract_text_from_image_returns_structured_output(monkeypatch, tmp_path):
    image_path = tmp_path / "dashboard.png"
    Image.new("RGB", (200, 100), color="white").save(image_path)

    def fake_image_to_string(*args, **kwargs):
        return "Sprint Velocity 42"

    def fake_image_to_data(*args, **kwargs):
        return {
            "text": ["Sprint", "Velocity", "42"],
            "conf": ["92.0", "91.0", "88.0"],
            "block_num": [1, 1, 1],
            "par_num": [1, 1, 1],
            "line_num": [1, 1, 1],
        }

    monkeypatch.setattr(
        "app.services.ocr_service.pytesseract.image_to_string",
        fake_image_to_string,
    )
    monkeypatch.setattr(
        "app.services.ocr_service.pytesseract.image_to_data",
        fake_image_to_data,
    )

    result = asyncio.run(extract_text_from_image(image_path))

    assert result.source_image_path == str(image_path)
    assert result.full_text == "Sprint Velocity 42"
    assert [word.text for word in result.words] == ["Sprint", "Velocity", "42"]
    assert [line.text for line in result.lines] == ["Sprint Velocity 42"]
    assert result.average_confidence == 90.33
