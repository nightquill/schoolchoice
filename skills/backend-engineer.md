# Backend Engineer — Skills File
# Intelligent Academic Advisor Project
# Last updated: 2026-03-27

---

## 1. HKDSE Aggregate Calculation Pattern

### Grade Scale

```python
GRADE_MAP = {"5**": 7, "5*": 6, "5": 5, "4": 4, "3": 3, "2": 2, "1": 1, "U": 0, "X": 0}
COMPULSORY_CODES = {"CHLA", "ENGL", "MATH", "CSD"}
APL_CATEGORY = "APPLIED_LEARNING"
```

### Best-5 Aggregate Algorithm

- Must include ALL 4 compulsory subjects (CHLA, ENGL, MATH, CSD). If any missing → return 0.
- Add the best 1 elective score (or more if needed to reach 5 total).
- Applied Learning (ApL) grades are EXCLUDED from the aggregate but may contribute to interest alignment.
- When a student has multiple sittings for the same subject, always use the best score for aggregate.
- Input format: `[{subject_code, numeric_value, is_compulsory, category}]`

### Predicted Grade Logic (REQ-066)

- If sitting == OFFICIAL → predicted_grade = None (never set)
- If only one non-official sitting → use raw_grade as predicted
- If multiple non-official sittings → use the most recent one (sort by year_of_exam desc, None years last)
- If teacher_rating present (1-5): `blended = 0.7 * latest_numeric + 0.3 * teacher_numeric`, then convert back using `_int_to_grade(round(blended))`
- teacher_rating 1-5 maps directly to HKDSE numeric 1-5

---

## 2. FastAPI BackgroundTasks Pattern for Async Jobs

### The Standard Pattern

```python
# 1. Create job record in DB synchronously (returns job_id immediately)
job = PlanGenerationJob(student_id=student_id, status="PENDING")
db.add(job); db.commit(); db.refresh(job)

# 2. Register background task AFTER the job record is committed
background_tasks.add_task(_my_task, job.id, student_id)

# 3. Return 202 Accepted with job_id
return {"job_id": job.id, "status": "PENDING"}
```

### Background Task Requirements

- Background tasks run AFTER the response is sent, in the same process.
- Background tasks do NOT share the request's DB session. Always open a NEW SessionLocal() inside the task.
- Always close the session in a finally block.
- Pattern for status updates:

```python
def _task(job_id: UUID, ...) -> None:
    db = SessionLocal()
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        job.status = "RUNNING"; db.commit()
        # ... do work ...
        job.status = "DONE"; db.commit()
    except Exception as exc:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error_message = str(exc)
            db.commit()
    finally:
        db.close()
```

### Polling Endpoints

- `GET /plan/status` → query latest job by `student_id` ordered by `created_at DESC`.
- Return `status`, `error_message`, timestamps. Never block on the background task.

---

## 3. XGBoost + SHAP Integration with Graceful Fallback

### ML Model Loading Pattern

```python
def _load_ml_model():
    model_path = os.environ.get("ML_MODEL_PATH", "")
    if not model_path or ".." in model_path:  # path traversal guard
        return None
    if not os.path.isfile(model_path):
        return None
    try:
        import joblib
        return joblib.load(model_path)
    except Exception:
        return None

_CACHED_MODEL = None
_MODEL_LOAD_ATTEMPTED = False

def _get_model():
    global _CACHED_MODEL, _MODEL_LOAD_ATTEMPTED
    if not _MODEL_LOAD_ATTEMPTED:
        _CACHED_MODEL = _load_ml_model()
        _MODEL_LOAD_ATTEMPTED = True
    return _CACHED_MODEL
```

### Feature Vector (v2 admission model)

```
[best5_aggregate, ielts_score_or_0, elective_count, award_count,
 extracurricular_count, academic_fit, subject_alignment]
```

### SHAP Extraction Pattern

```python
import shap
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X)
# For binary XGBoost: shap_values is a list [class0_array, class1_array]
if isinstance(shap_values, list):
    sv = shap_values[1][0]  # class 1 (admission) values for first sample
else:
    sv = shap_values[0]
# Top 3 by absolute value:
top3 = sorted(zip(feature_names, sv), key=lambda x: abs(x[1]), reverse=True)[:3]
```

### Final Score Combination

```python
if ml_prob is not None:
    final_score = 0.6 * weighted_score + 0.4 * ml_prob
else:
    final_score = weighted_score  # rule-only fallback
```

### Fallback Behaviour

- When `ML_MODEL_PATH` is unset or file missing: `ml_probability = None`, `shap_explanation = None`.
- The API response shape is identical in both paths — callers check `ml_probability is None` to know which path ran.
- Never fail the entire match run because ML is unavailable.

---

## 4. SQLAlchemy Additive Model Pattern (models_v2 importing Base from models)

### Key Rule

All models must share the SAME `Base.metadata` object. Achieve this by importing `Base` from the v1 file:

```python
# app/db/models_v2.py
from app.db.models import Base, Student, School  # noqa: F401
```

### SQLAlchemy 2.0 with `DeclarativeBase` Requires `__allow_unmapped__`

When using the new-style `DeclarativeBase` (v1 pattern), Python-style type annotations on relationship attributes cause an error:

```
sqlalchemy.exc.ArgumentError: Type annotation for "GradeSystem.subjects" can't be
correctly interpreted for Annotated Declarative Table form.
```

Fix: add `__allow_unmapped__ = True` to every model class that uses bare type annotations on relationships.

```python
class GradeSystem(Base):
    __tablename__ = "grade_systems"
    __allow_unmapped__ = True  # required for SQLAlchemy 2.0 with legacy-style annotations
    ...
    subjects: list[Subject] = relationship(...)  # type annotation without Mapped[]
```

### Back-Populates Must Be Added Atomically

When you add a relationship to a v2 model with `back_populates="something"`, you MUST add the `something` relationship to the v1 model too, or SQLAlchemy will raise a configuration error at startup. The v1 model must have:

```python
# In Student (v1 model), added as v2 patch:
subject_grades = relationship("StudentSubjectGrade", back_populates="student", ...)
```

### Registering v2 Models at Startup

Import models_v2 before `Base.metadata.create_all()` so SQLAlchemy registers all tables:

```python
# In main.py:
import app.db.models_v2  # noqa: F401 — registers v2 ORM classes with Base.metadata
Base.metadata.create_all(bind=engine)
```

Same in test conftest:

```python
import app.db.models_v2  # noqa: F401
```

---

## 5. Python 3.9 Compatibility Patterns

### `from __future__ import annotations`

Add to every new `.py` file. This enables PEP 563 postponed evaluation, allowing forward references in type hints without quotes:

```python
from __future__ import annotations

class GradeSystem(Base):
    subjects: list[Subject] = relationship(...)  # Subject not yet defined — OK with __future__
```

Without this, `list[Subject]` would fail because `Subject` is defined later in the same file.

### `JSON` not `JSONB` for ORM Columns

Use `from sqlalchemy.types import JSON` rather than `from sqlalchemy.dialects.postgresql import JSONB`.

- In PostgreSQL: functionally equivalent for INSERT/SELECT.
- In SQLite (tests): `JSON` maps to TEXT natively; `JSONB` raises a dialect error.
- Only use `JSONB` if you need GIN indexing — none of the v2 columns require it.

```python
from sqlalchemy.types import JSON
# NOT: from sqlalchemy.dialects.postgresql import JSONB
parsed_data = Column(JSON, nullable=True)
```

### `int | None` vs `Optional[int]`

In Python 3.9, `int | None` union syntax requires `from __future__ import annotations`. Alternatively use `Optional[int]` from `typing`. With `__future__`, both work:

```python
from __future__ import annotations
from typing import Optional

def foo(x: int | None) -> str | None: ...  # OK with __future__
def bar(x: Optional[int]) -> Optional[str]: ...  # Always OK
```

---

## 6. SQLite UUID Querying in Tests

### The Problem

`UUID(as_uuid=True)` columns in PostgreSQL work fine with string UUIDs in queries because psycopg2 handles the conversion. In SQLite, SQLAlchemy calls `.hex` on the input value, which fails for plain strings.

### Root Cause Scenario

When `create_access_token(data={"sub": str(user.id)})` stores a string UUID in the JWT, and `get_current_user` does `db.query(User).filter(User.id == user_id).first()` with `user_id` as that string, SQLite raises:

```
AttributeError: 'str' object has no attribute 'hex'
```

### Fix for Tests

Override `get_current_user` in the conftest to inject the user object directly, bypassing the DB query:

```python
@pytest.fixture
def auth_headers(client, db):
    user = db.query(User).filter(User.email == email).first()

    def _override_get_current_user():
        return user

    app.dependency_overrides[get_current_user] = _override_get_current_user
    yield {"Authorization": f"Bearer {token}"}
    del app.dependency_overrides[get_current_user]  # restore after test
```

### Fix for Production Routes

Use `db.merge(current_user)` when the current_user object may come from a different session (e.g., test fixtures):

```python
def update_account(payload, db, current_user):
    user = db.merge(current_user)  # safe across session boundaries
    user.display_name = payload.display_name
    db.commit()
    db.refresh(user)
    return user
```

---

## 7. Matchmaking Architecture Decisions

### Eligibility vs Scoring Separation

Always run eligibility FIRST as a hard gate. Ineligible schools still appear in results but are appended at the end with `eligibility_pass=False`. Never exclude them entirely — the counsellor needs to see WHY a school is out of reach.

### Preference Adjustment (Gale-Shapley-inspired)

```python
median_rank = sorted(ranks)[len(ranks) // 2]
boost = max(0, median_rank - student_rank)  # higher preference = above median → positive boost
```

Boost is applied by swapping positions in the ordered list, not by changing the `fit_score`. The stored `match_score` always reflects pure academic/program fit.

### Student Data Dict Shape (canonical)

```python
student_data = {
    "best5_aggregate": int,
    "grades_by_code": {"ENGL": "5*", "MATH": "4", ...},
    "ielts_score": float or None,
    "elective_codes": ["BIOL", "CHEM"],
    "extra_curricular_activities": ["robotics", "debate"],
    "award_titles": ["STEM Champion"],
}
```

### School Dict Shape (canonical)

```python
school_dict = {
    "id": str(uuid),
    "name": str,
    "minimum_entry_score": int or None,
    "average_admitted_score": float or None,  # None → use minimum_entry_score + 2
    "required_subjects": [{"subject_code": "BIOL", "min_grade": "3"}],
    "language_requirements": {"ielts_minimum": 6.5} or {},
    "notable_programs": ["engineering", "computer science"],
}
```

---

## 8. HTML Plan Generation Pattern

### Key Constraints

- Inline CSS only — no `<link>` tags, no external stylesheets
- No JavaScript — static HTML only
- `@media print { ... }` block required for printability
- Use Python f-strings for templating (not Jinja2 import) for simplicity
- Always HTML-escape user data with `html.escape(str(value))`

### Structure Pattern

```python
def generate_html_plan(student: dict, match_results: list, action_items: list) -> str:
    css = "..."
    sections = "".join([_section_fn(student) for _section_fn in [...]])
    return f"<!DOCTYPE html><html>...<style>{css}</style>...{sections}...</html>"
```

### Section Functions

Each section takes `(student: dict, match_results: list)` or similar, returns an HTML string fragment. Compose them with `"".join([...])`.
