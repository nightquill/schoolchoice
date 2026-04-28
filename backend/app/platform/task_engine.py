"""
app/platform/task_engine.py

YAML-driven task execution engine for the consultant system.
Loads task definitions, resolves entity data slots, renders Jinja2 prompt templates,
calls the AI provider, and validates structured JSON output.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field as dc_field
from pathlib import Path
from typing import Any

import jsonschema
from fastapi import HTTPException
from jinja2 import Environment, BaseLoader
from sqlalchemy.orm import Session

from app.core.ai_service import call_ai

logger = logging.getLogger(__name__)

MAX_RETRIES = 2  # total attempts = 3 (initial + 2 retries)

# PII field names that must NEVER enter an AI prompt (T-05-02 mitigation)
PII_BLOCKLIST = frozenset([
    "medical_notes",
    "disciplinary_record",
    "sibling_data",
    "ssn",
    "dob",
])


@dataclass
class TaskDefinition:
    task_id: str
    name: str
    description: str
    data_slots: dict[str, str]
    system_prompt_template: str
    user_prompt_template: str
    output_schema: dict
    jinja2_template: str
    max_tokens: int = 4096
    temperature: float = 0.3
    enable_chat: bool = True
    max_context_tokens: int = 60_000


class TaskEngine:
    """
    Load YAML task definitions and execute consultant tasks.
    Data slot resolution maps slot type names to actual data from DB/services.
    """

    # Ordered by priority -- module tasks are discovered after platform tasks
    TASK_DIRS: list[Path] = [
        Path("backend/app/platform/tasks"),
        Path("backend/app/modules/school_choice/tasks"),
    ]

    def load_task(self, task_id: str) -> TaskDefinition:
        """Find and parse the first matching task YAML. Module tasks override platform tasks."""
        from app.platform.yaml_loader import load_task_yaml

        # Search in reverse order so module tasks take precedence
        for directory in reversed(self.TASK_DIRS):
            candidate = directory / f"{task_id}.yaml"
            if candidate.exists():
                return load_task_yaml(candidate)
        raise ValueError(f"No task definition found for task_id='{task_id}'")

    def build_messages(
        self,
        task: TaskDefinition,
        entity_id: str,
        db: Session,
    ) -> list[dict[str, str]]:
        """
        Resolve data slots, render Jinja2 templates, check token count, return messages list.
        Raises ValueError if prompt contains PII fields or exceeds max_context_tokens after truncation.
        """
        context = self._resolve_data_slots(task.data_slots, entity_id, db)

        env = Environment(loader=BaseLoader())
        system_prompt = env.from_string(task.system_prompt_template).render(**context)
        user_prompt = env.from_string(task.user_prompt_template).render(**context)

        # PII blocklist scan (T-05-02 mitigation)
        combined_prompt = system_prompt + user_prompt
        for pii_field in PII_BLOCKLIST:
            if pii_field in combined_prompt:
                raise ValueError(f"PII scope violation: prompt contains blocked field '{pii_field}'")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Token guard -- measure and truncate if over ceiling
        try:
            import litellm as _litellm
            from app.core.ai_service import _build_model_string

            token_count = _litellm.token_counter(model=_build_model_string(), messages=messages)
            if token_count > task.max_context_tokens:
                logger.warning(
                    "task=%s entity=%s: prompt is %d tokens, ceiling is %d. Truncating.",
                    task.task_id, entity_id, token_count, task.max_context_tokens,
                )
                context = self._truncate_context(context, task)
                system_prompt = env.from_string(task.system_prompt_template).render(**context)
                user_prompt = env.from_string(task.user_prompt_template).render(**context)
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
        except Exception as exc:
            # Token counting is best-effort; log and continue if it fails
            logger.debug("Token counting unavailable: %s", exc)

        return messages

    def execute_task(
        self,
        task_id: str,
        entity_id: str,
        db: Session,
    ) -> dict[str, Any]:
        """
        Full synchronous execution: load task -> build messages -> call AI -> validate output.
        Returns validated dict matching task output_schema.
        Retries up to MAX_RETRIES times on validation failure (total 3 attempts).
        Raises HTTPException(502) on final failure.
        """
        task = self.load_task(task_id)
        messages = self.build_messages(task, entity_id, db)
        last_error: Exception | None = None

        for attempt in range(MAX_RETRIES + 1):
            raw_text = call_ai(
                messages,
                max_tokens=task.max_tokens,
                temperature=task.temperature,
            )

            # Strip markdown code fences -- some models wrap JSON despite instructions
            raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text.strip())
            raw_text = re.sub(r"\n?```$", "", raw_text.strip())

            try:
                output = json.loads(raw_text)
            except json.JSONDecodeError as exc:
                last_error = exc
                logger.warning(
                    "task=%s entity=%s attempt=%d/%d: AI returned invalid JSON: %s",
                    task_id, entity_id, attempt + 1, MAX_RETRIES + 1, exc,
                )
                if attempt < MAX_RETRIES:
                    messages = messages + [
                        {"role": "assistant", "content": raw_text},
                        {
                            "role": "user",
                            "content": (
                                f"Your response failed JSON parsing: {exc}\n"
                                "Correct the JSON and respond with ONLY the valid JSON object. "
                                "No explanation, no markdown, no code fences."
                            ),
                        },
                    ]
                    continue
                break

            try:
                jsonschema.validate(instance=output, schema=task.output_schema)
            except jsonschema.ValidationError as exc:
                last_error = exc
                logger.warning(
                    "task=%s entity=%s attempt=%d/%d: schema validation failed: %s",
                    task_id, entity_id, attempt + 1, MAX_RETRIES + 1, exc.message,
                )
                if attempt < MAX_RETRIES:
                    messages = messages + [
                        {"role": "assistant", "content": raw_text},
                        {
                            "role": "user",
                            "content": (
                                f"Your response failed validation: {exc.message}\n"
                                "Correct the JSON and respond with ONLY the valid JSON object. "
                                "No explanation, no markdown, no code fences."
                            ),
                        },
                    ]
                    continue
                break

            return output

        logger.error(
            "task=%s entity=%s: all %d attempts failed. Last error: %s",
            task_id, entity_id, MAX_RETRIES + 1, last_error,
        )
        raise HTTPException(
            status_code=502,
            detail="AI failed to produce a valid plan. Please try again.",
        )

    def _resolve_data_slots(
        self,
        data_slots: dict[str, str],
        entity_id: str,
        db: Session,
    ) -> dict[str, Any]:
        """
        Map slot type names to actual data objects.
        Add new slot types here -- never add resolution logic to the YAML parser.
        """
        resolved: dict[str, Any] = {}
        for slot_name, slot_type in data_slots.items():
            if slot_type == "student":
                resolved[slot_name] = self._load_student(entity_id, db)
            elif slot_type == "matchmaker":
                resolved[slot_name] = self._load_matchmaker_results(entity_id, db)
            else:
                raise ValueError(f"Unknown data slot type: '{slot_type}'")
        return resolved

    def _truncate_context(self, context: dict, task: TaskDefinition) -> dict:
        """
        Reduce context size following the truncation hierarchy.
        Modifies a copy -- never mutates the original context dict.

        Steps (in order):
        1. Reduce matchmaker results to top 5 by final_score
        2. Truncate rationale to first sentence
        3. Remove SHAP explanations
        """
        ctx = dict(context)
        if "matchmaker" in ctx and isinstance(ctx["matchmaker"], list):
            results = list(ctx["matchmaker"])
            # Step 1: reduce to top 5 by final_score
            results = sorted(results, key=lambda r: r.get("final_score", 0), reverse=True)[:5]
            # Step 2: truncate rationale to first sentence
            for r in results:
                rationale = r.get("rationale", "")
                r["rationale"] = rationale.split(".")[0] + "." if "." in rationale else rationale
            # Step 3: remove SHAP explanations
            for r in results:
                r.pop("shap_explanation", None)
            ctx["matchmaker"] = results
        return ctx

    def _load_student(self, student_id: str, db: Session) -> dict:
        """Load student entity data for prompt context."""
        from app.modules.school_choice.models.models import Student

        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError(f"Student {student_id} not found")
        return {
            "name": student.name,
            "year_of_study": getattr(student, "year_of_study", None),
            "ielts_score": getattr(student, "ielts_score", None),
            "extra_curricular": getattr(student, "extra_curricular", None) or [],
            "awards": getattr(student, "awards", None) or [],
        }

    def _load_matchmaker_results(self, student_id: str, db: Session) -> list:
        """Run matchmaker and convert results to dicts for Jinja2 template rendering."""
        from app.modules.school_choice.services.matchmaker_v2 import run_matching

        results = run_matching(student_id, db)
        return [vars(r) if hasattr(r, "__dict__") else r for r in results]

    @classmethod
    def validate_all_task_yamls(cls) -> list[str]:
        """
        Scan all TASK_DIRS, parse each YAML, return list of errors.
        Called at startup for early failure detection (Pitfall 4 prevention).
        """
        from app.platform.yaml_loader import load_task_yaml

        errors: list[str] = []
        for directory in cls.TASK_DIRS:
            if not directory.exists():
                continue
            for yaml_file in sorted(directory.glob("*.yaml")):
                try:
                    load_task_yaml(yaml_file)
                except Exception as exc:
                    errors.append(f"{yaml_file}: {exc}")
        return errors
