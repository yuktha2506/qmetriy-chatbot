from pathlib import Path
import re
from uuid import uuid4


def normalize_filename(filename: str) -> str:
    safe_name = Path(filename).name
    safe_name = safe_name.strip().replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", safe_name)
    return safe_name or "upload"


def get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def build_storage_filename(original_filename: str) -> str:
    safe_name = normalize_filename(original_filename)
    extension = get_file_extension(safe_name)
    return f"{uuid4().hex}{extension}"


def is_allowed_upload(
    original_filename: str,
    content_type: str | None,
    allowed_extensions: tuple[str, ...],
    allowed_content_types: tuple[str, ...],
) -> bool:
    extension = get_file_extension(original_filename)
    return extension in allowed_extensions and (content_type or "") in allowed_content_types
