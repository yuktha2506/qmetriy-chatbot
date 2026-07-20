from pydantic import BaseModel


class PreprocessingResult(BaseModel):
    source_path: str
    processed_path: str
    original_width: int
    original_height: int
    processed_width: int
    processed_height: int
    steps_applied: list[str]
