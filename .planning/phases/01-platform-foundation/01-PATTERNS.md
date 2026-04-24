# Phase 1: Platform Foundation - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 17 new/modified files
**Analogs found:** 15 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/platform/__init__.py` | config | — | `backend/app/services/__init__.py` | role-match |
| `backend/app/platform/yaml_loader.py` | utility | transform | `backend/app/core/config.py` | partial |
| `backend/app/platform/entity_registry.py` | utility | transform | `backend/app/db/models.py` | partial |
| `backend/app/platform/crud_generator.py` | utility | request-response | `backend/app/api/v1/routes/students.py` | role-match |
| `backend/app/platform/module_loader.py` | utility | event-driven | `backend/app/main.py` | role-match |
| `backend/app/platform/health.py` | utility | request-response | `backend/app/main.py` (health_check) | role-match |
| `backend/app/modules/school_choice/config.yaml` | config | — | none | no-analog |
| `backend/app/modules/school_choice/entities/student.yaml` | config | — | none | no-analog |
| `backend/app/modules/school_choice/models/models.py` | model | CRUD | `backend/app/db/models_v2.py` | exact |
| `backend/app/modules/school_choice/services/hkdse_service.py` | service | transform | `backend/app/services/hkdse_service.py` | exact (move) |
| `backend/app/modules/school_choice/services/matchmaker_v2.py` | service | transform | `backend/app/services/matchmaker_v2.py` | exact (move) |
| `backend/app/modules/school_choice/services/plan_generator.py` | service | transform | `backend/app/services/plan_generator.py` | exact (move) |
| `backend/app/modules/school_choice/services/plan_chat_service.py` | service | request-response | `backend/app/services/plan_chat_service.py` | exact (move) |
| `backend/app/modules/school_choice/health.py` | utility | request-response | `backend/app/main.py` (health_check) | role-match |
| `backend/app/main.py` (modified) | config | event-driven | `backend/app/main.py` | exact (self) |
| `backend/app/db/models.py` (trimmed) | model | CRUD | `backend/app/db/models.py` | exact (self) |
| `backend/tests/test_platform.py` | test | request-response | `backend/tests/test_v2_services.py` | exact |

---

## Pattern Assignments

### `backend/app/platform/yaml_loader.py` (utility, transform)

**Analog:** `backend/app/core/config.py`

**Imports pattern** (`backend/app/core/config.py` lines 1-9):
```python
from __future__ import annotations
from pydantic_settings import BaseSettings, SettingsConfigDict
```

**Core pattern — use `yaml.safe_load()` + null guard + Pydantic dataclass:**
```python
# Pattern derived from RESEARCH.md Pattern 3 + config.py Settings approach
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any

@dataclass
class FieldConfig:
    name: str
    type: str = "string"
    required: bool = False
    max_length: int | None = None
    min: int | float | None = None
    max: int | float | None = None
    regex: str | None = None
    choices: list[str] = field(default_factory=list)

@dataclass
class EntityConfig:
    name: str
    table: str
    fields: list[FieldConfig] = field(default_factory=list)
    auto_crud: bool = True

def load_entity_yaml(path: Path) -> EntityConfig:
    with open(path) as f:
        raw = yaml.safe_load(f) or {}   # null guard — RESEARCH.md Pitfall 3
    fields = [FieldConfig(**fd) for fd in raw.get("fields", [])]
    return EntityConfig(
        name=raw["name"],
        table=raw.get("table", raw["name"] + "s"),
        fields=fields,
        auto_crud=raw.get("auto_crud", True),
    )
```

**Error handling:** Wrap in `try/except` and `logger.error()` — see `module_loader.py` pattern below.

---

### `backend/app/platform/entity_registry.py` (utility, transform)

**Analog:** `backend/app/db/models.py`

**Core model declaration pattern** (`backend/app/db/models.py` lines 17-51):
```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy import JSON as JSONB
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    pass

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
```

**Registry core pattern — dynamic model construction:**
```python
# backend/app/platform/entity_registry.py
from sqlalchemy import Column, String, Integer, Text, Boolean, Date, DateTime, Numeric
from sqlalchemy import JSON as JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func
from app.db.models import Base   # shared Base — same metadata object
import uuid

FIELD_TYPE_MAP = {
    "string":   lambda cfg: Column(String(cfg.max_length or 255), nullable=not cfg.required),
    "text":     lambda cfg: Column(Text, nullable=not cfg.required),
    "int":      lambda cfg: Column(Integer, nullable=not cfg.required),
    "decimal":  lambda cfg: Column(Numeric(10, 4), nullable=not cfg.required),
    "date":     lambda cfg: Column(Date, nullable=not cfg.required),
    "datetime": lambda cfg: Column(DateTime(timezone=True), nullable=not cfg.required),
    "boolean":  lambda cfg: Column(Boolean, nullable=True, default=False),
    "jsonb":    lambda cfg: Column(JSONB, nullable=True),
    # enum: Column(String(50)) + CheckConstraint built separately
}

class EntityRegistry:
    def __init__(self):
        self._models: dict[str, type] = {}
        self._configs: dict[str, "EntityConfig"] = {}

    def register(self, config: "EntityConfig") -> type:
        """Build and register a SQLAlchemy model class for the entity config."""
        attrs = {
            "__tablename__": config.table,
            "__allow_unmapped__": True,    # v1-compat pattern from models_v2.py line 68
            "id": Column(
                PG_UUID(as_uuid=True), primary_key=True,
                default=uuid.uuid4, server_default=func.gen_random_uuid(), nullable=False,
            ),
        }
        for fd in config.fields:
            if fd.type == "enum":
                from sqlalchemy import CheckConstraint as CC
                col = Column(String(50), nullable=not fd.required)
                attrs[fd.name] = col
            else:
                builder = FIELD_TYPE_MAP.get(fd.type, FIELD_TYPE_MAP["string"])
                attrs[fd.name] = builder(fd)
        model_cls = type(config.name.capitalize(), (Base,), attrs)
        self._models[config.name] = model_cls
        self._configs[config.name] = config
        return model_cls

    def get_model(self, name: str) -> type | None:
        return self._models.get(name)

registry = EntityRegistry()
```

---

### `backend/app/platform/crud_generator.py` (utility, request-response)

**Analog:** `backend/app/api/v1/routes/students.py`

**Router + auth dependency pattern** (`backend/app/api/v1/routes/students.py` lines 1-30):
```python
from __future__ import annotations
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
```

**CRUD endpoint pattern** (`backend/app/api/v1/routes/students.py` lines 83-122):
```python
router = APIRouter(prefix="/students", tags=["students"])

@router.get("", status_code=status.HTTP_200_OK)
def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # ALL routes require auth
):
    ...

@router.post("", status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...
```

**Auto-CRUD generator pattern — produce a router per entity:**
```python
# backend/app/platform/crud_generator.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, create_model
from sqlalchemy.orm import Session
from typing import Any, Optional
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.db.models import User

def build_pydantic_schema(entity_config, schema_name: str) -> type[BaseModel]:
    fields: dict[str, Any] = {}
    for fd in entity_config.fields:
        py_type = {"string": str, "text": str, "int": int, "decimal": float,
                   "date": str, "datetime": str, "boolean": bool,
                   "jsonb": Any, "enum": str}.get(fd.type, str)
        if fd.required:
            fields[fd.name] = (py_type, ...)
        else:
            fields[fd.name] = (Optional[py_type], None)
    return create_model(schema_name, **fields)

def build_crud_router(entity_config, model_cls) -> APIRouter:
    CreateSchema = build_pydantic_schema(entity_config, f"{entity_config.name}Create")
    router = APIRouter(prefix=f"/{entity_config.name}s", tags=[entity_config.name])

    @router.get("", status_code=status.HTTP_200_OK)
    def list_entities(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
        return db.query(model_cls).all()

    @router.post("", status_code=status.HTTP_201_CREATED)
    def create_entity(payload: CreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
        obj = model_cls(**payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @router.get("/{entity_id}", status_code=status.HTTP_200_OK)
    def get_entity(entity_id, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
        obj = db.query(model_cls).filter(model_cls.id == entity_id).first()
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{entity_config.name} not found")
        return obj

    @router.put("/{entity_id}", status_code=status.HTTP_200_OK)
    def update_entity(entity_id, payload: CreateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
        obj = db.query(model_cls).filter(model_cls.id == entity_id).first()
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{entity_config.name} not found")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return obj

    @router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_entity(entity_id, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
        obj = db.query(model_cls).filter(model_cls.id == entity_id).first()
        if obj is None:
            raise HTTPException(status_code=404, detail=f"{entity_config.name} not found")
        db.delete(obj)
        db.commit()

    return router
```

---

### `backend/app/platform/module_loader.py` (utility, event-driven)

**Analog:** `backend/app/main.py`

**Startup registration pattern** (`backend/app/main.py` lines 8-33, 182-200):
```python
import os
from pathlib import Path
from fastapi import FastAPI
from app.core.config import settings
from app.db.models import Base
from app.db.session import engine
import app.db.models_v2  # noqa: F401  ← import models before create_all

# include_router pattern:
app.include_router(auth.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
```

**Module loader pattern — importlib + config.yaml scan:**
```python
# backend/app/platform/module_loader.py
import importlib
import logging
import yaml
from pathlib import Path
from fastapi import FastAPI

logger = logging.getLogger(__name__)

def discover_and_register_modules(app: FastAPI, modules_dir: Path) -> list[dict]:
    """Scan modules_dir for config.yaml manifests; import models first, then routers."""
    registered = []
    for module_dir in sorted(modules_dir.iterdir()):
        if not module_dir.is_dir():
            continue
        config_path = module_dir / "config.yaml"
        if not config_path.exists():
            continue
        config = yaml.safe_load(config_path.read_text()) or {}   # null guard
        module_name = config.get("name", module_dir.name)
        try:
            # CRITICAL: import models BEFORE routes so Base.metadata is populated
            # before include_router triggers relationship resolution.
            # Pattern: mirrors `import app.db.models_v2` in main.py line 33.
            importlib.import_module(f"app.modules.{module_dir.name}.models.models")

            routes_pkg = importlib.import_module(f"app.modules.{module_dir.name}.routes")
            for router_ref in config.get("routes", []):
                mod_name, attr = router_ref.rsplit(".", 1)
                sub_mod = importlib.import_module(f"app.modules.{module_dir.name}.routes.{mod_name}")
                router = getattr(sub_mod, attr)
                app.include_router(router, prefix="/api/v1")

            registered.append({"name": module_name, "status": "ok"})
            logger.info(f"Module registered: {module_name}")
        except Exception as e:
            logger.error(f"Module load failed: {module_name} — {e}")
            registered.append({"name": module_name, "status": "error", "detail": str(e)})
    return registered
```

---

### `backend/app/platform/health.py` (utility, request-response)

**Analog:** `backend/app/main.py` health_check (lines 207-210) + RESEARCH.md Pattern 5

**Health endpoint pattern** (`backend/app/main.py` lines 207-210):
```python
@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
```

**Extended health pattern — ORM parity check + module callbacks:**
```python
# backend/app/platform/health.py
import logging
from sqlalchemy import inspect as sa_inspect, text as _t
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

_schema_parity_result: dict = {"status": "not_checked"}
_module_health_callbacks: list[callable] = []

def check_orm_schema_parity(engine: Engine, orm_models: list) -> dict:
    """Compare ORM column definitions against live DB schema. Run once at startup."""
    inspector = sa_inspect(engine)
    issues = []
    for model in orm_models:
        table_name = model.__tablename__
        if not inspector.has_table(table_name):
            issues.append(f"Table missing in DB: {table_name}")
            continue
        db_cols = {c["name"] for c in inspector.get_columns(table_name)}
        orm_cols = {c.key for c in model.__table__.columns}
        missing_in_db = orm_cols - db_cols
        if missing_in_db:
            issues.append(f"{table_name}: ORM has columns not in DB: {missing_in_db}")
    for issue in issues:
        logger.warning(f"[SCHEMA PARITY] {issue}")
    return {"status": "drift_detected" if issues else "ok", "issues": issues}

def register_health_callback(fn: callable) -> None:
    _module_health_callbacks.append(fn)

def run_health_check(engine: Engine) -> dict:
    try:
        with engine.connect() as conn:
            conn.execute(_t("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    module_health = {}
    for fn in _module_health_callbacks:
        try:
            result = fn()
            module_health[fn.__module__] = result
        except Exception as e:
            module_health[fn.__module__] = {"status": "error", "detail": str(e)}

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "schema_parity": _schema_parity_result,
        "modules": module_health,
    }
```

---

### `backend/app/modules/school_choice/models/models.py` (model, CRUD)

**Analog:** `backend/app/db/models_v2.py`

**Model file header + Base import pattern** (`backend/app/db/models_v2.py` lines 1-43):
```python
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, CheckConstraint, Column, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# Import v1 Base so all models share a single MetaData object.
from app.db.models import Base, Student, School  # noqa: F401

__allow_unmapped__ = True  # required for compat with SQLAlchemy 2.0 in 1.x mode

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
```

**Column declaration pattern** (`backend/app/db/models_v2.py` lines 59-130):
```python
class GradeSystem(Base):
    __tablename__ = "grade_systems"
    __allow_unmapped__ = True

    __table_args__ = (
        UniqueConstraint("name", name="uq_grade_systems_name"),
        CheckConstraint("name IN ('HKDSE', 'A_LEVEL', 'IB', 'CUSTOM')", name="ck_grade_systems_name"),
    )

    id = Column(
        UUID(as_uuid=True), primary_key=True,
        default=uuid.uuid4, server_default=func.gen_random_uuid(), nullable=False,
    )
    # ... other columns follow same pattern as models.py
```

**Critical:** All domain models (`Student`, `School`, `AcademicPlan`, `Subject`, `StudentSubjectGrade`, `StudentSchoolTarget`, `Transcript`, `PlanGenerationJob`, `GradeSystem`, `StudentCohort`, `CohortMembership`, `PlanHistory`) move here from `models.py` and `models_v2.py`. The existing `User` and `Base` remain in `backend/app/db/models.py`.

---

### `backend/app/modules/school_choice/services/hkdse_service.py` (service, transform)

**Analog:** `backend/app/services/hkdse_service.py` (exact move)

**Service file pattern** (`backend/app/services/hkdse_service.py` lines 1-46):
```python
"""
app/services/hkdse_service.py
HKDSE domain logic — grade scale, best-5 aggregate, predicted grade.
REQ-063, REQ-064, REQ-065, REQ-066
"""
from __future__ import annotations

GRADE_MAP: dict[str, int] = { "5**": 7, "5*": 6, ... }
COMPULSORY_CODES: set[str] = {"CHLA", "ENGL", "MATH", "CSD"}

def grade_to_int(grade: str) -> int:
    if grade is None:
        return 0
    return GRADE_MAP.get(grade.strip(), 0)
```

**Strangler fig stub at old path** (`backend/app/services/hkdse_service.py` becomes):
```python
# backend/app/services/hkdse_service.py  (re-export stub after move)
from app.modules.school_choice.services.hkdse_service import *  # noqa: F401, F403
```

**Test imports that must keep working:**
```python
# backend/tests/test_v2_services.py lines 24-29 — these import paths must not break
from app.services.hkdse_service import (
    COMPULSORY_CODES, GRADE_MAP, compute_best5_aggregate,
    compute_predicted_grade, grade_to_int,
)
```

---

### `backend/app/modules/school_choice/services/matchmaker_v2.py` (service, transform)

**Analog:** `backend/app/services/matchmaker_v2.py` (exact move + BUG-02 fix)

**Dataclass pattern** (`backend/app/services/matchmaker_v2.py` lines 19-32):
```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class MatchResult:
    school_id: str
    school_name: str
    major_name: Optional[str]
    major_jupas_code: Optional[str]
    eligibility_pass: bool
    failing_criteria: list[str]
    fit_score: float
    component_scores: dict
    ml_probability: Optional[float]
    final_score: float
    shap_explanation: Optional[dict]
    rationale: str
    # BUG-02: NEW field — add after rationale
    data_completeness: float  # 0.0–1.0 fraction of expected grade fields present
```

**BUG-02 `data_completeness` computation:**
```python
def compute_data_completeness(student_data: dict) -> float:
    grades = student_data.get("grades_by_code", {})
    compulsory_present = sum(1 for c in ["CHLA", "ENGL", "MATH", "CSD"] if c in grades and grades[c])
    compulsory_score = compulsory_present / 4
    elective_grades = [v for k, v in grades.items() if k not in {"CHLA", "ENGL", "MATH", "CSD"}]
    elective_score = min(len([g for g in elective_grades if g]) / 2, 1.0) if elective_grades else 0.0
    return round((compulsory_score * 0.7 + elective_score * 0.3), 2)
```

**Strangler fig stub:**
```python
# backend/app/services/matchmaker_v2.py  (re-export stub)
from app.modules.school_choice.services.matchmaker_v2 import *  # noqa: F401, F403
```

---

### `backend/app/modules/school_choice/services/plan_chat_service.py` (service, request-response)

**Analog:** `backend/app/services/plan_chat_service.py` (exact move + BUG-01 fix)

**Current broken rate-limit pattern** (`backend/app/services/plan_chat_service.py` lines 50-69):
```python
def _rate_limit_key(counsellor_id, plan_id) -> str:
    return f"{date.today().isoformat()}:{counsellor_id}:{plan_id}"   # BUG-01: calendar day

def _check_and_increment_rate_limit(db, plan, counsellor_id) -> None:
    key = _rate_limit_key(counsellor_id, plan.id)
    counts: dict = dict(plan.chat_request_counts or {})
    current_count = counts.get(key, 0)
    if current_count >= 20:
        raise HTTPException(status_code=429, detail="Daily AI chat limit...")
    counts[key] = current_count + 1
    plan.chat_request_counts = counts
```

**BUG-01 fixed rolling window pattern:**
```python
from datetime import datetime, timezone, timedelta

def _check_and_increment_rate_limit(db, plan, counsellor_id) -> None:
    key = f"{counsellor_id}:{plan.id}"
    counts: dict = dict(plan.chat_request_counts or {})
    entry = counts.get(key, {"count": 0, "window_start": None})
    now = datetime.now(timezone.utc)
    window_start_str = entry.get("window_start")
    if window_start_str:
        window_start = datetime.fromisoformat(window_start_str)
        if now - window_start > timedelta(hours=24):
            entry = {"count": 0, "window_start": now.isoformat()}
    else:
        entry["window_start"] = now.isoformat()
    if entry["count"] >= 20:
        raise HTTPException(status_code=429, detail="Daily AI chat limit (20 requests) reached for this plan.")
    entry["count"] += 1
    counts[key] = entry
    plan.chat_request_counts = counts
```

**Strangler fig stub:**
```python
# backend/app/services/plan_chat_service.py  (re-export stub)
from app.modules.school_choice.services.plan_chat_service import *  # noqa: F401, F403
```

---

### `backend/app/modules/school_choice/services/plan_generator.py` (service, transform)

**Analog:** `backend/app/services/plan_generator.py` (exact move + BUG-04 fix)

**Existing `_esc()` pattern** (`backend/app/services/plan_generator.py` — present in file, pattern to preserve):
```python
import html

def _esc(value: object) -> str:
    """HTML-escape a value for safe embedding in generated HTML."""
    return html.escape(str(value) if value is not None else "")
```

**BUG-04: unescaped f-strings to fix (lines cited in RESEARCH.md):**
```python
# BEFORE (unsafe — lines 510, 725, 727, 729, 762, 768, 796, 1005, 1007):
rows += f"<tr><td>{subj}</td><td>{sitting}</td><td>{raw}</td>...</tr>"

# AFTER (safe):
rows += f"<tr><td>{_esc(subj)}</td><td>{_esc(sitting)}</td><td>{_esc(raw)}</td>...</tr>"
```

**Strangler fig stub:**
```python
# backend/app/services/plan_generator.py  (re-export stub)
from app.modules.school_choice.services.plan_generator import *  # noqa: F401, F403
```

---

### `backend/app/modules/school_choice/health.py` (utility, request-response)

**Analog:** `backend/app/main.py` health_check pattern

**Module health callback pattern:**
```python
# backend/app/modules/school_choice/health.py
import logging

logger = logging.getLogger(__name__)

def check_health() -> dict:
    """school_choice module health: reports XGBoost model status (BUG-05)."""
    from app.modules.school_choice.services.matchmaker_v2 import _get_model
    model = _get_model()
    if model is None:
        logger.warning(
            "[STARTUP] XGBoost model not loaded — ML_MODEL_PATH not set or file not found. "
            "Matchmaker will use rule-only scoring (no ML component)."
        )
        return {"xgboost_model": "unavailable", "scoring_mode": "rule_only"}
    return {"xgboost_model": "loaded", "scoring_mode": "hybrid"}
```

---

### `backend/app/main.py` (modified — config, event-driven)

**Analog:** `backend/app/main.py` (self)

**Current router registration pattern** (`backend/app/main.py` lines 182-200):
```python
app.include_router(auth.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
# ... 12 more include_router calls
```

**ALTER TABLE dialect guard pattern (fixes SQLite test crash):**
```python
# BEFORE (main.py lines 140-160 — PostgreSQL-only, crashes SQLite):
from sqlalchemy import text as _sql_text
with engine.connect() as _conn:
    _conn.execute(_sql_text("ALTER TABLE students ADD COLUMN IF NOT EXISTS personal_statement TEXT"))

# AFTER (guarded):
from sqlalchemy import text as _sql_text
if engine.dialect.name == "postgresql":
    with engine.connect() as _conn:
        _conn.execute(_sql_text("ALTER TABLE students ADD COLUMN IF NOT EXISTS personal_statement TEXT"))
        # ... all other ALTER TABLE statements
        _conn.commit()
```

**Updated health endpoint pattern:**
```python
from app.platform.health import run_health_check
from app.db.session import engine

@app.get("/health", tags=["health"])
def health_check():
    from app.core.config import settings
    result = run_health_check(engine)
    result["cors_origin"] = settings.CORS_ORIGINS
    return result
```

---

### `backend/tests/test_platform.py` (test, request-response)

**Analog:** `backend/tests/test_v2_services.py`

**Test file header + env setup pattern** (`backend/tests/test_v2_services.py` lines 1-21):
```python
from __future__ import annotations
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")

import pytest
```

**TestClient + auth fixture pattern** (`backend/tests/conftest.py` lines 80-144):
```python
@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def auth_headers(client, db):
    # Creates user directly in DB, overrides get_current_user, yields headers
    app.dependency_overrides[get_current_user] = _override_get_current_user
    yield {"Authorization": f"Bearer {token}"}
    del app.dependency_overrides[get_current_user]
```

**Unit test class pattern** (`backend/tests/test_v2_services.py` lines 46-70):
```python
class TestEntityYamlParse:
    def test_valid_yaml_loads(self, tmp_path):
        ...
    def test_empty_yaml_returns_defaults(self, tmp_path):
        # Tests null-guard: yaml.safe_load() or {}
        ...
    def test_missing_required_field_raises(self, tmp_path):
        ...
```

---

## Shared Patterns

### Authentication (apply to ALL route files and auto-generated CRUD)

**Source:** `backend/app/core/dependencies.py` lines 22-55

```python
from app.core.dependencies import get_current_user
from app.db.models import User
from fastapi import Depends

# All route handlers that require auth:
def my_handler(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # always second, after get_db
):
    ...
```

The `get_current_user` dependency (`backend/app/core/dependencies.py`) validates the JWT Bearer token and returns the `User` ORM object. It raises HTTP 401 automatically if the token is absent or invalid — route handlers do not need to repeat this check.

### Database Session (apply to ALL route handlers)

**Source:** `backend/app/db/session.py` lines 56-67

```python
from app.db.session import get_db
from sqlalchemy.orm import Session
from fastapi import Depends

def my_handler(db: Session = Depends(get_db)):
    # db is yielded and closed automatically after the request
    ...
```

### HTTP 404 + Ownership Enforcement (apply to all GET/PUT/DELETE by ID)

**Source:** `backend/app/services/student_service.py` lines 26-43

```python
from fastapi import HTTPException, status

def get_resource(db, resource_id, user_id):
    obj = db.query(Model).filter(Model.id == resource_id).first()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if str(obj.user_id) != str(user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return obj
```

### Logging Convention (apply to all platform and module files)

**Source:** used throughout — `backend/app/services/plan_chat_service.py` implicit + RESEARCH.md

```python
import logging
logger = logging.getLogger(__name__)   # module-level logger; __name__ gives file path

logger.info("Module registered: school_choice")
logger.warning("[STARTUP] XGBoost model not loaded — ...")
logger.error(f"Module load failed: {module_name} — {e}")
```

### Model Commit Pattern (apply to all service write operations)

**Source:** `backend/app/services/student_service.py` lines 46-63

```python
obj = Model(**data.model_dump())
db.add(obj)
db.commit()
db.refresh(obj)   # refresh to populate server_default fields (id, timestamps)
return obj
```

### YAML Safe-Load Null Guard (apply to all yaml.safe_load() calls)

**Source:** RESEARCH.md Pitfall 3 — never call `.get()` on a None result

```python
config = yaml.safe_load(f) or {}   # `or {}` guards against empty/comment-only YAML files
```

### HTML Escaping (apply to ALL f-strings in plan_generator.py that embed user data)

**Source:** `backend/app/services/plan_generator.py` (existing `_esc()` helper)

```python
import html

def _esc(value: object) -> str:
    return html.escape(str(value) if value is not None else "")

# Usage: always wrap user-provided variables before embedding in f-strings
f"<td>{_esc(subj)}</td>"   # not f"<td>{subj}</td>"
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend/app/modules/school_choice/config.yaml` | config | — | YAML manifests do not exist in the codebase yet; use RESEARCH.md Pattern 3 format directly |
| `backend/app/modules/school_choice/entities/student.yaml` | config | — | Entity YAML format is new greenfield; use RESEARCH.md Pattern 4 format directly |

---

## Metadata

**Analog search scope:** `backend/app/` (all subdirectories), `backend/tests/`
**Files scanned:** 17 source files read directly; glob across services/, api/, db/, schemas/, tests/
**Pattern extraction date:** 2026-04-24
