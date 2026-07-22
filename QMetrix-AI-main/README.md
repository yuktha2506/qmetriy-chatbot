# QMetrix AI Service

Python FastAPI service for:

- application support chatbot
- dynamic dashboard insights
- screenshot upload analysis
- OCR and vision processing
- sprint metrics extraction
- risk detection and recommendations

This service is intended to be called by the existing QMetrix backend and/or frontend.

## Execution commands

Run these commands from PowerShell.

```powershell
# Go to the AI service folder.
cd D:\qmetrix-chatbot\QMetry-AI-Insights\QMetrix-AI-main

# Create a local Python virtual environment if it does not already exist.
python -m venv venv

# Activate the virtual environment for this terminal session.
.\venv\Scripts\Activate.ps1

# Install the FastAPI service dependencies.
python -m pip install -r requirements.txt

# Optional: enable semantic RAG retrieval for document-backed answers.
$env:QMETRIX_ENABLE_SEMANTIC_RAG = "true"

# Start the FastAPI service on http://127.0.0.1:8000.
# Keep reload limited to the app folder so Uvicorn does not scan venv or cache folders.
uvicorn app.main:app --reload --reload-dir app --host 127.0.0.1 --port 8000
```

Useful local URLs after the service starts:

- Health check: `http://127.0.0.1:8000/health`
- Swagger docs: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

To run the automated tests:

```powershell
# Run the full pytest suite.
pytest

# Run one test file while working on a specific area.
pytest tests\test_metrics_contract.py
```

Avoid running `uvicorn app.main:app --reload` without `--reload-dir app`, because
Uvicorn will recursively scan the whole repository, including `venv` and generated
pytest cache folders, which can cause `MemoryError` on Windows.
