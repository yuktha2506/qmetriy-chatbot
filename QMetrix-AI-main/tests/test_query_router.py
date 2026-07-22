from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.query_router import route_query


def test_routes_analytics_queries():
    route = route_query("Show sprint velocity and defect risk")

    assert route == {
        "intent": "analytics",
        "route": "analytics_context",
        "requires_context": True,
    }


def test_routes_rag_queries():
    route = route_query("Explain the QMetrix dashboard workflow")

    assert route == {
        "intent": "rag",
        "route": "knowledge_base",
        "requires_context": False,
    }


def test_routes_definition_queries_as_rag_even_for_analytics_terms():
    route = route_query("What is story churn?")

    assert route == {
        "intent": "rag",
        "route": "knowledge_base",
        "requires_context": False,
    }


def test_routes_current_metric_questions_as_analytics():
    route = route_query("What is the current average velocity?")

    assert route == {
        "intent": "analytics",
        "route": "analytics_context",
        "requires_context": True,
    }


def test_routes_hybrid_queries():
    route = route_query("Explain sprint burndown risk")

    assert route == {
        "intent": "hybrid",
        "route": "hybrid_orchestration",
        "requires_context": True,
    }


def test_routes_fallback_queries():
    route = route_query("hello")

    assert route == {
        "intent": "fallback",
        "route": "fallback",
        "requires_context": False,
    }
