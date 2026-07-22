from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.response_synthesizer import (
    FALLBACK_RESPONSE,
    clean_retrieved_chunks,
    generate_final_response,
    summarize_analytics_context,
    summarize_rag_context,
)


def test_clean_retrieved_chunks_removes_duplicates_and_noise():
    rag_context = {
        "chunks": [
            {
                "text": "## Story Churn\nStory churn measures added or removed sprint scope. "
                "It helps identify unstable planning."
            },
            {
                "text": "Story churn measures added or removed sprint scope. "
                "It helps identify unstable planning."
            },
            {"text": "![chart](image.png) OCR confidence 0.11 a7f9" * 8},
        ]
    }

    cleaned = clean_retrieved_chunks(rag_context)

    assert len(cleaned) == 1
    assert "##" not in cleaned[0]
    assert "image.png" not in cleaned[0]


def test_summarize_rag_context_uses_business_template():
    summary = summarize_rag_context(
        "What is story churn?",
        {"chunks": [{"text": "Raw markdown that should not be dumped directly."}]},
    )

    assert summary.startswith("Story churn measures")
    assert "Raw markdown" not in summary


def test_summarize_analytics_context_is_professional():
    summary = summarize_analytics_context(
        {
            "sources": [
                {
                    "domain": "project_management",
                    "metrics": {"sprint_completion": 0.78},
                },
                {"domain": "standup", "metrics": {"blocked_items": 2}},
                {"domain": "git", "metrics": {"stale_prs": 2}},
                {
                    "domain": "cxo",
                    "metrics": {"release_readiness": "needs_attention"},
                },
            ],
            "summary": {"primary_risks": ["Sprint completion is below target."]},
        }
    )

    assert summary == (
        "Live QMetrix analytics indicate current engineering health is being "
        "monitored. Sprint completion is below the "
        "expected trend. Unresolved blockers may slow delivery. Stale pull "
        "requests may create review bottlenecks. Release readiness needs closer "
        "validation."
    )


def test_generate_hybrid_response_combines_context_without_sources():
    answer = generate_final_response(
        {
            "user_query": "Explain sprint burndown risk",
            "routing": {"intent": "hybrid"},
            "rag_context": {
                "chunks": [
                    {
                        "text": "Burndown tracks remaining work over time and helps identify delivery risk.",
                        "metadata": {"source": "knowledge_base.md"},
                        "similarity_score": 0.91,
                    }
                ]
            },
            "analytics_context": {
                "sources": [
                    {
                        "domain": "project_management",
                        "metrics": {"sprint_completion": 0.78},
                    },
                    {"domain": "standup", "metrics": {"blocked_items": 1}},
                ]
            },
        }
    )

    assert "Live QMetrix analytics" in answer
    assert "Burndown tracks" in answer
    assert "knowledge_base.md" not in answer
    assert "0.91" not in answer


def test_rag_response_does_not_include_analytics_summary():
    answer = generate_final_response(
        {
            "user_query": "What is story churn?",
            "routing": {"intent": "rag"},
            "rag_context": {
                "chunks": [
                    {
                        "text": "Story churn measures added or removed sprint scope."
                    }
                ]
            },
            "analytics_context": {
                "sources": [
                    {
                        "domain": "project_management",
                        "metrics": {"sprint_completion": 0.78},
                    },
                    {"domain": "standup", "metrics": {"blocked_items": 2}},
                    {"domain": "git", "metrics": {"stale_prs": 2}},
                    {
                        "domain": "cxo",
                        "metrics": {"release_readiness": "needs_attention"},
                    },
                ]
            },
        }
    )

    assert answer.startswith("Story churn measures")
    assert "Live QMetrix analytics" not in answer
    assert "Unresolved blockers" not in answer
    assert "pull requests" not in answer
    assert "Release readiness" not in answer


def test_analytics_response_does_not_include_documentation_explanation():
    answer = generate_final_response(
        {
            "user_query": "Show sprint risk",
            "routing": {"intent": "analytics"},
            "rag_context": {
                "chunks": [
                    {
                        "text": "Burndown tracks remaining sprint work over time."
                    }
                ]
            },
            "analytics_context": {
                "sources": [
                    {
                        "domain": "project_management",
                        "metrics": {"sprint_completion": 0.78},
                    },
                    {"domain": "standup", "metrics": {"blocked_items": 1}},
                    {
                        "domain": "cxo",
                        "metrics": {"release_readiness": "needs_attention"},
                    },
                ]
            },
        }
    )

    assert "Live QMetrix analytics" in answer
    assert "Burndown tracks" not in answer


def test_generate_fallback_response_for_weak_context():
    answer = generate_final_response(
        {
            "user_query": "unknown thing",
            "routing": {"intent": "rag"},
            "rag_context": {"chunks": []},
            "analytics_context": {},
        }
    )

    assert answer == FALLBACK_RESPONSE
    assert "not present" in answer
