from pathlib import Path


class UploadRepository:
    def __init__(self, upload_dir: Path):
        self.upload_dir = upload_dir

    def ensure_upload_dir(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def build_storage_path(self, stored_filename: str) -> Path:
        self.ensure_upload_dir()
        return self.upload_dir / stored_filename

    def save_bytes(self, content: bytes, stored_filename: str) -> Path:
        storage_path = self.build_storage_path(stored_filename)
        storage_path.write_bytes(content)
        return storage_path

    def delete_path(self, file_path: Path) -> None:
        if file_path.exists():
            file_path.unlink()
