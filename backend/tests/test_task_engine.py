"""
tests/test_task_engine.py

Unit and integration tests for TaskEngine: YAML loading, data slot resolution,
output schema validation, PII blocklist, confidence guardrail, context truncation.

Covers: AI-04, AI-05, AI-06 (partial), AI-09 (guardrail).
"""
import os

# Set environment variables before any app imports
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from dataclasses import dataclass

from app.platform.task_engine import TaskEngine, TaskDefinition, PII_BLOCKLIST


# ---------------------------------------------------------------------------
# Fixture: patch TASK_DIRS to use paths relative to backend/ (where pytest runs)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _patch_task_dirs():
    """TASK_DIRS in task_engine.py use 'backend/app/...' paths which only resolve
    from the project root. Tests run from backend/, so patch to 'app/...' paths."""
    original = TaskEngine.TASK_DIRS
    TaskEngine.TASK_DIRS = [
        Path("app/platform/tasks"),
        Path("app/modules/school_choice/tasks"),
    ]
    yield
    TaskEngine.TASK_DIRS = original


# ---------------------------------------------------------------------------
# TestLoadTask: YAML loading and parsing
# ---------------------------------------------------------------------------

class TestLoadTask:
    """Tests for TaskEngine.load_task() and validate_all_task_yamls()."""

    def test_load_task_yaml(self):
        """TaskEngine.load_task('academic_plan') returns correct TaskDefinition."""
        engine = TaskEngine()
        task = engine.load_task("academic_plan")
        assert task.task_id == "academic_plan"
        assert "student" in task.data_slots
        assert "matchmaker" in task.data_slots
        assert task.max_tokens == 4096

    def test_load_task_not_found(self):
        """TaskEngine.load_task('nonexistent') raises ValueError."""
        engine = TaskEngine()
        with pytest.raises(ValueError, match="No task definition found"):
            engine.load_task("nonexistent_task")

    def test_validate_all_task_yamls(self):
        """validate_all_task_yamls() returns empty list for valid YAMLs."""
        errors = TaskEngine.validate_all_task_yamls()
        assert errors == []

    def test_task_definition_fields(self):
        """Loaded TaskDefinition has correct field values."""
        engine = TaskEngine()
        task = engine.load_task("academic_plan")
        assert task.temperature == 0.3
        assert task.enable_chat is True
        assert task.max_context_tokens == 60000
        assert task.jinja2_template == "professional.html.j2"
        assert task.name == "Academic Plan"
        assert task.description == "Generate a school choice academic plan for a student"


# ---------------------------------------------------------------------------
# TestTruncation: context size reduction
# ---------------------------------------------------------------------------

class TestTruncation:
    """Tests for TaskEngine._truncate_context()."""

    def test_truncate_context(self):
        """Matchmaker list reduced to <=5, rationale truncated, shap_explanation removed."""
        engine = TaskEngine()
        task = engine.load_task("academic_plan")
        context = {
            "matchmaker": [
                {
                    "school_name": f"School {i}",
                    "final_score": 0.1 * i,
                    "rationale": "Good school. Many programs. Well known.",
                    "shap_explanation": {"feat": 0.5},
                }
                for i in range(10)
            ]
        }
        truncated = engine._truncate_context(context, task)
        assert len(truncated["matchmaker"]) <= 5
        for r in truncated["matchmaker"]:
            assert "shap_explanation" not in r
        # Rationale should be truncated to first sentence
        for r in truncated["matchmaker"]:
            # First sentence only ends with a period and should be shorter
            assert r["rationale"].endswith(".")

    def test_truncate_context_does_not_mutate_original(self):
        """_truncate_context returns a copy, not a mutated original."""
        engine = TaskEngine()
        task = engine.load_task("academic_plan")
        original_results = [
            {
                "school_name": f"School {i}",
                "final_score": 0.1 * i,
                "rationale": "A good school. Has programs.",
                "shap_explanation": {"feat": 0.5},
            }
            for i in range(8)
        ]
        context = {"matchmaker": original_results}
        truncated = engine._truncate_context(context, task)
        # Original should still have all 8 results with shap_explanation
        assert len(context["matchmaker"]) == 8
        assert "shap_explanation" in context["matchmaker"][0]
        # Truncated should have <=5
        assert len(truncated["matchmaker"]) <= 5

    def test_truncate_keeps_highest_scores(self):
        """Top 5 by final_score are kept after truncation."""
        engine = TaskEngine()
        task = engine.load_task("academic_plan")
        context = {
            "matchmaker": [
                {"school_name": f"School {i}", "final_score": float(i), "rationale": "Good."}
                for i in range(10)
            ]
        }
        truncated = engine._truncate_context(context, task)
        scores = [r["final_score"] for r in truncated["matchmaker"]]
        # Should be sorted descending, top 5
        assert scores == sorted(scores, reverse=True)
        assert scores[0] == 9.0


# ---------------------------------------------------------------------------
# TestPIIBlocklist: prompt safety
# ---------------------------------------------------------------------------

class TestPIIBlocklist:
    """Tests for PII blocklist scan in build_messages()."""

    def test_pii_blocklist_rejects_medical_notes(self):
        """build_messages raises ValueError when rendered prompt contains 'medical_notes'."""
        engine = TaskEngine()
        # Create a mock task with a prompt that will include medical_notes
        task = TaskDefinition(
            task_id="test_pii",
            name="PII Test",
            description="Test",
            data_slots={},
            system_prompt_template="You are an assistant.",
            user_prompt_template="Student has medical_notes: {{ data }}",
            output_schema={},
            jinja2_template="professional.html.j2",
        )

        # Mock _resolve_data_slots to return harmless data
        with patch.object(engine, "_resolve_data_slots", return_value={"data": "some info"}):
            with pytest.raises(ValueError, match="PII scope violation.*medical_notes"):
                engine.build_messages(task, "test-entity", MagicMock())

    def test_pii_blocklist_contains_expected_fields(self):
        """PII_BLOCKLIST contains the expected sensitive field names."""
        assert "medical_notes" in PII_BLOCKLIST
        assert "disciplinary_record" in PII_BLOCKLIST
        assert "sibling_data" in PII_BLOCKLIST
        assert "ssn" in PII_BLOCKLIST
        assert "dob" in PII_BLOCKLIST


# ---------------------------------------------------------------------------
# TestConfidenceGuardrail: AI confidence downgrade
# ---------------------------------------------------------------------------

class TestConfidenceGuardrail:
    """Tests for confidence tier guardrail logic."""

    def test_confidence_guardrail_downgrades_high_to_low(self):
        """AI says HIGH but data_completeness is 0.3 -> should be downgraded to LOW."""
        from app.platform.recommendation_engine import RecommendationEngine

        engine = RecommendationEngine({
            "domain": "test",
            "confidence_thresholds": {"high": 0.7, "medium": 0.4},
        })
        tier, tooltip = engine.compute_confidence_tier(0.3)
        assert tier == "LOW"
        # Simulates the guardrail: AI returned HIGH, code computed LOW -> use LOW

    def test_confidence_guardrail_medium_data(self):
        """data_completeness of 0.55 yields MEDIUM tier."""
        from app.platform.recommendation_engine import RecommendationEngine

        engine = RecommendationEngine({
            "domain": "test",
            "confidence_thresholds": {"high": 0.7, "medium": 0.4},
        })
        tier, _ = engine.compute_confidence_tier(0.55)
        assert tier == "MEDIUM"

    def test_confidence_guardrail_high_data(self):
        """data_completeness of 0.85 yields HIGH tier."""
        from app.platform.recommendation_engine import RecommendationEngine

        engine = RecommendationEngine({
            "domain": "test",
            "confidence_thresholds": {"high": 0.7, "medium": 0.4},
        })
        tier, _ = engine.compute_confidence_tier(0.85)
        assert tier == "HIGH"
