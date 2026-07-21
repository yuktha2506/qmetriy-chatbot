from __future__ import annotations

import logging
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


logger = logging.getLogger(__name__)

DOCS_DIR = Path(__file__).resolve().parents[2] / "docs"
PDF_FILENAME = "qmetrix_static_knowledge.pdf"
PDF_PATH = DOCS_DIR / PDF_FILENAME
EMBEDDING_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
MAX_CHUNK_WORDS = 220
CHUNK_OVERLAP_WORDS = 35
DEFAULT_TOP_K = 4
MIN_CHUNK_WORDS = 25
MIN_LEXICAL_SCORE = 0.08
MIN_SEMANTIC_SCORE = 0.28

QUERY_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "about",
    "can",
    "define",
    "explain",
    "for",
    "how",
    "is",
    "me",
    "of",
    "or",
    "please",
    "show",
    "tell",
    "the",
    "to",
    "what",
}

_INDEX: "KnowledgeIndex | None" = None


@dataclass
class KnowledgeChunk:
    text: str
    source: str
    heading: str
    chunk_id: str


@dataclass
class KnowledgeIndex:
    chunks: list[KnowledgeChunk]
    model: Any | None = None
    faiss_index: Any | None = None
    embeddings_enabled: bool = False
    error: str | None = None
    source_type: str = "none"


def _normalize_line(line: str) -> str:
    line = line.replace("\u200b", " ").replace("\ufeff", " ")
    line = re.sub(r"\s+", " ", line)
    return line.strip()


def _is_page_number(line: str) -> bool:
    normalized = line.strip().lower()
    return bool(
        re.fullmatch(r"\d{1,4}", normalized)
        or re.fullmatch(r"page\s+\d{1,4}(\s+of\s+\d{1,4})?", normalized)
        or re.fullmatch(r"\d{1,4}\s*/\s*\d{1,4}", normalized)
    )


def _is_noisy_line(line: str) -> bool:
    if not line or len(line) < 3 or _is_page_number(line):
        return True

    compact = line.replace(" ", "")
    if not compact:
        return True

    alpha_count = len(re.findall(r"[A-Za-z]", line))
    if alpha_count == 0:
        return True

    non_text_ratio = len(re.findall(r"[^A-Za-z0-9\s.,;:!?()/%&+\-'\"\u25cf]", line)) / max(
        len(line), 1
    )
    if non_text_ratio > 0.22:
        return True

    if re.search(r"(.)\1{8,}", compact):
        return True

    if re.search(r"\b\S{45,}\b", line):
        return True

    words = re.findall(r"[A-Za-z]{2,}", line)
    if len(line) > 20 and len(words) < 2:
        return True

    return False


def _line_key(line: str) -> str:
    return re.sub(r"\W+", " ", line.lower()).strip()


def _find_repeated_margin_lines(page_lines: list[list[str]]) -> set[str]:
    if len(page_lines) < 3:
        return set()

    margin_counts: dict[str, int] = {}
    for lines in page_lines:
        candidates = lines[:4] + lines[-4:]
        for line in candidates:
            key = _line_key(line)
            if key:
                margin_counts[key] = margin_counts.get(key, 0) + 1

    threshold = max(3, int(len(page_lines) * 0.25))
    return {key for key, count in margin_counts.items() if count >= threshold}


def extract_pdf_text(pdf_path: str | Path) -> str:
    """Extract readable text from the QMetrix static knowledge PDF."""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF knowledge base not found: {pdf_path}")

    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError("PyMuPDF is required for PDF RAG parsing.") from exc

    page_lines: list[list[str]] = []
    with fitz.open(pdf_path) as document:
        logger.info("PDF loaded: %s", pdf_path.name)
        logger.info("PDF total pages: %s", document.page_count)

        for page in document:
            raw_text = page.get_text("text", sort=True)
            lines = [
                normalized
                for raw_line in raw_text.splitlines()
                if (normalized := _normalize_line(raw_line))
                and not _is_noisy_line(normalized)
            ]
            page_lines.append(lines)

    repeated_margin_lines = _find_repeated_margin_lines(page_lines)
    cleaned_pages: list[str] = []
    for lines in page_lines:
        clean_lines = [
            line
            for line in lines
            if _line_key(line) not in repeated_margin_lines
            and not _is_page_number(line)
        ]
        if clean_lines:
            cleaned_pages.append("\n".join(clean_lines))

    return "\n\n".join(cleaned_pages)


def _load_markdown_documents(docs_dir: Path | None = None) -> list[tuple[Path, str]]:
    docs_dir = docs_dir or DOCS_DIR
    if not docs_dir.exists():
        logger.warning("RAG docs directory not found: %s", docs_dir)
        return []

    documents = []
    for path in sorted(docs_dir.glob("*.md")):
        try:
            documents.append((path, path.read_text(encoding="utf-8")))
        except OSError as exc:
            logger.warning("Unable to load markdown document %s: %s", path, exc)
    return documents


def _split_markdown_sections(markdown: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, list[str]]] = []
    current_heading = "Overview"
    current_lines: list[str] = []

    for line in markdown.splitlines():
        if line.lstrip().startswith("#"):
            if current_lines:
                sections.append((current_heading, current_lines))
            current_heading = line.lstrip("#").strip() or "Overview"
            current_lines = []
            continue
        current_lines.append(line)

    if current_lines:
        sections.append((current_heading, current_lines))

    return [(heading, "\n".join(lines).strip()) for heading, lines in sections]


def _chunk_section(text: str, max_words: int = MAX_CHUNK_WORDS) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks = []
    step = max(max_words - CHUNK_OVERLAP_WORDS, 1)
    for start in range(0, len(words), step):
        chunk_words = words[start : start + max_words]
        if chunk_words:
            chunks.append(" ".join(chunk_words))
        if start + max_words >= len(words):
            break
    return chunks


def _is_pdf_heading(line: str) -> bool:
    if len(line) > 90 or line.endswith((".", ",", ";", ":")):
        return False

    words = re.findall(r"[A-Za-z0-9]+", line)
    if not words or len(words) > 10:
        return False

    lower = line.lower()
    if lower.startswith(("the ", "this ", "it ", "use ", "when ", "where ")):
        return False

    title_like = line.istitle() or line.isupper()
    short_label = len(words) <= 4 and len(line) <= 45
    return title_like or short_label


def _split_pdf_sections(text: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, list[str]]] = []
    current_heading = "Overview"
    current_lines: list[str] = []

    for raw_line in text.splitlines():
        line = _normalize_line(raw_line)
        if not line:
            continue

        if _is_pdf_heading(line):
            if current_lines:
                sections.append((current_heading, current_lines))
            current_heading = line
            current_lines = []
            continue

        current_lines.append(line)

    if current_lines:
        sections.append((current_heading, current_lines))

    return [(heading, " ".join(lines).strip()) for heading, lines in sections]


def _has_enough_information(text: str) -> bool:
    words = re.findall(r"[A-Za-z0-9]+", text)
    alpha_chars = len(re.findall(r"[A-Za-z]", text))
    unique_terms = {word.lower() for word in words if len(word) > 2}
    return (
        len(words) >= MIN_CHUNK_WORDS
        and len(unique_terms) >= 12
        and alpha_chars >= 100
        and not _is_noisy_line(text[:200])
    )


def _build_chunks() -> list[KnowledgeChunk]:
    chunks: list[KnowledgeChunk] = []
    try:
        chunks = _build_pdf_chunks(PDF_PATH)
    except Exception as exc:
        logger.warning("PDF RAG parsing failed; falling back to markdown: %s", exc)

    if chunks:
        logger.info("PDF RAG chunks created: %s", len(chunks))
        return chunks

    logger.warning("PDF RAG produced no usable chunks; falling back to markdown.")
    for path, markdown in _load_markdown_documents():
        for section_index, (heading, section_text) in enumerate(
            _split_markdown_sections(markdown)
        ):
            for chunk_index, chunk_text in enumerate(_chunk_section(section_text)):
                if not _has_enough_information(chunk_text):
                    continue
                chunks.append(
                    KnowledgeChunk(
                        text=chunk_text,
                        source=path.name,
                        heading=heading,
                        chunk_id=f"{path.stem}:{section_index}:{chunk_index}",
                    )
                )
    logger.info("Markdown fallback RAG chunks created: %s", len(chunks))
    return chunks


def _build_pdf_chunks(pdf_path: Path | None = None) -> list[KnowledgeChunk]:
    pdf_path = pdf_path or PDF_PATH
    text = extract_pdf_text(pdf_path)
    chunks: list[KnowledgeChunk] = []

    for section_index, (heading, section_text) in enumerate(_split_pdf_sections(text)):
        if not _has_enough_information(section_text):
            continue

        for chunk_index, chunk_text in enumerate(_chunk_section(section_text)):
            if not _has_enough_information(chunk_text):
                continue

            chunks.append(
                KnowledgeChunk(
                    text=chunk_text,
                    source=pdf_path.name,
                    heading=heading,
                    chunk_id=f"{pdf_path.stem}:{section_index}:{chunk_index}",
                )
            )

    return chunks


def _build_index() -> KnowledgeIndex:
    chunks = _build_chunks()
    if not chunks:
        return KnowledgeIndex(
            chunks=[],
            error="No PDF or markdown knowledge documents found.",
        )

    try:
        if os.getenv("QMETRIX_ENABLE_SEMANTIC_RAG", "false").lower() != "true":
            raise RuntimeError(
                "Semantic RAG disabled. Set QMETRIX_ENABLE_SEMANTIC_RAG=true "
                "after installing FAISS, sentence-transformers, and caching the model."
            )

        import faiss
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(EMBEDDING_MODEL_NAME, local_files_only=True)
        embeddings = model.encode(
            [chunk.text for chunk in chunks],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        index = faiss.IndexFlatIP(embeddings.shape[1])
        index.add(embeddings)
        logger.info(
            "Built FAISS RAG index with %s chunks using %s",
            len(chunks),
            EMBEDDING_MODEL_NAME,
        )
        return KnowledgeIndex(
            chunks=chunks,
            model=model,
            faiss_index=index,
            embeddings_enabled=True,
            source_type="pdf_primary",
        )
    except Exception as exc:
        logger.warning("Embedding index unavailable; using lexical RAG fallback: %s", exc)
        return KnowledgeIndex(
            chunks=chunks,
            embeddings_enabled=False,
            error=f"Embedding index unavailable: {exc}",
            source_type="pdf_primary",
        )


def _get_index() -> KnowledgeIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = _build_index()
    return _INDEX


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
        if len(token) > 2 and token not in QUERY_STOPWORDS
    }


def _lexical_score(query: str, chunk: KnowledgeChunk) -> float:
    query_tokens = _tokens(query)
    chunk_tokens = _tokens(f"{chunk.heading} {chunk.text}")
    if not query_tokens or not chunk_tokens:
        return 0.0
    overlap = len(query_tokens & chunk_tokens)
    return overlap / math.sqrt(len(query_tokens) * len(chunk_tokens))


def _format_result(chunk: KnowledgeChunk, score: float) -> dict[str, Any]:
    return {
        "text": chunk.text,
        "metadata": {
            "source": chunk.source,
            "heading": chunk.heading,
            "chunk_id": chunk.chunk_id,
        },
        "similarity_score": round(float(score), 4),
    }


def retrieve_knowledge_context(query: str, top_k: int = DEFAULT_TOP_K) -> dict[str, Any]:
    index = _get_index()
    if not query.strip():
        return {
            "success": False,
            "chunks": [],
            "message": "A question is required for knowledge retrieval.",
            "retrieval_mode": "none",
        }

    if not index.chunks:
        return {
            "success": False,
            "chunks": [],
            "message": index.error or "Knowledge base is empty.",
            "retrieval_mode": "none",
        }

    try:
        if index.embeddings_enabled and index.model and index.faiss_index:
            query_embedding = index.model.encode(
                [query],
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )
            scores, indices = index.faiss_index.search(query_embedding, top_k)
            chunks = [
                _format_result(index.chunks[int(chunk_index)], float(score))
                for score, chunk_index in zip(scores[0], indices[0])
                if int(chunk_index) >= 0 and float(score) >= MIN_SEMANTIC_SCORE
            ]
            logger.info(
                "RAG retrieval matches mode=semantic query=%r count=%s",
                query,
                len(chunks),
            )
            return {
                "success": bool(chunks),
                "chunks": chunks,
                "message": "Knowledge context retrieved."
                if chunks
                else "No relevant knowledge context found.",
                "retrieval_mode": "semantic",
            }
    except Exception as exc:
        logger.exception("Vector search failed; falling back to lexical retrieval.")
        index.error = f"Vector search failed: {exc}"

    scored_chunks = sorted(
        ((_lexical_score(query, chunk), chunk) for chunk in index.chunks),
        key=lambda item: item[0],
        reverse=True,
    )
    chunks = [
        _format_result(chunk, score)
        for score, chunk in scored_chunks[:top_k]
        if score >= MIN_LEXICAL_SCORE
    ]
    logger.info(
        "RAG retrieval matches mode=lexical query=%r count=%s",
        query,
        len(chunks),
    )

    return {
        "success": bool(chunks),
        "chunks": chunks,
        "message": "Knowledge context retrieved with lexical fallback."
        if chunks
        else "No relevant knowledge context found.",
        "retrieval_mode": "lexical",
    }


def reset_knowledge_index() -> None:
    global _INDEX
    _INDEX = None
