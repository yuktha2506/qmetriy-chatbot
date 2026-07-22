from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import rag_service
from app.services.rag_service import extract_pdf_text, retrieve_knowledge_context


def setup_function():
    rag_service.reset_knowledge_index()


def test_extract_pdf_text_loads_static_knowledge_base():
    text = extract_pdf_text(rag_service.PDF_PATH)

    assert "Standup Page" in text
    assert "Velocity" in text
    assert len(text.split()) > 100


def test_pdf_chunk_generation_uses_pdf_as_primary_source():
    chunks = rag_service._build_pdf_chunks(rag_service.PDF_PATH)

    assert chunks
    assert chunks[0].source == rag_service.PDF_FILENAME
    assert chunks[0].text
    assert len(chunks[0].text.split()) >= rag_service.MIN_CHUNK_WORDS


def test_retrieval_returns_relevant_pdf_context():
    result = retrieve_knowledge_context("velocity trend report")

    assert result["retrieval_mode"] in {"semantic", "lexical"}
    assert result["success"] is True
    assert result["chunks"]
    assert result["chunks"][0]["metadata"]["source"] == rag_service.PDF_FILENAME
    assert "metadata" in result["chunks"][0]
    assert "similarity_score" in result["chunks"][0]


def test_retrieval_rejects_low_confidence_stopword_matches():
    result = retrieve_knowledge_context("what is burnup?")

    assert result["success"] is False
    assert result["chunks"] == []
    assert result["message"] == "No relevant knowledge context found."


def test_retrieval_handles_empty_query():
    result = retrieve_knowledge_context("")

    assert result["success"] is False
    assert result["chunks"] == []
    assert result["retrieval_mode"] == "none"


def test_retrieval_handles_missing_documents(monkeypatch):
    monkeypatch.setattr(rag_service, "DOCS_DIR", Path("missing-docs"))
    monkeypatch.setattr(rag_service, "PDF_PATH", Path("missing-docs/missing.pdf"))
    rag_service.reset_knowledge_index()

    result = retrieve_knowledge_context("documentation")

    assert result["success"] is False
    assert result["chunks"] == []
    assert result["retrieval_mode"] == "none"


def test_pdf_failure_falls_back_to_markdown(monkeypatch, tmp_path):
    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "fallback.md").write_text(
        "# Release Risk\n\n"
        "Release risk combines scope stability, defect pressure, delivery progress, "
        "and readiness signals for enterprise release governance. Teams use this "
        "context to prioritize validation and reduce delivery uncertainty.",
        encoding="utf-8",
    )

    monkeypatch.setattr(rag_service, "DOCS_DIR", docs_dir)
    monkeypatch.setattr(rag_service, "PDF_PATH", docs_dir / "missing.pdf")
    rag_service.reset_knowledge_index()

    result = retrieve_knowledge_context("release risk readiness")

    assert result["success"] is True
    assert result["retrieval_mode"] == "lexical"
    assert result["chunks"][0]["metadata"]["source"] == "fallback.md"
