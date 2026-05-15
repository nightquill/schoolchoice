"""
app/main.py

FastAPI application entrypoint.
Configures CORS middleware, discovers platform modules, runs startup
diagnostics (ORM-schema parity), and includes all API routers under /api/v1.
"""

import logging as _logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.routes import action_plan, auth, consultant, recommendations, students
from app.api.v1.routes.alerts import router as alerts_router
from app.api.v1.routes.consent import router as consent_router
from app.api.v1.routes.student_import import router as student_import_router
from app.api.v1.routes.methodology import router as methodology_router
from app.api.v1.routes.organisations import router as organisations_router
from app.api.v1.routes import (
    account,
    admin,
    analytics,
    cohorts,
    entities,
    grades,
    match,
    plan,
    schools_v2,
    subjects as subjects_route,
    targets,
    transcripts,
)
from app.core.config import settings
from app.db.models import Base
from app.db.session import engine
from app.platform.module_loader import discover_and_register_modules
from app.platform.health import check_orm_schema_parity, run_health_check

# Import models_v2 to register all v2 ORM classes with Base.metadata
# (safety net — module loader also imports models, but create_all runs before discovery)
import app.db.models_v2  # noqa: F401
from app.modules.school_choice.models.submissions import StudentChoiceSubmission  # noqa: F401
from app.modules.school_choice.models.grade_builds import GradeBuild  # noqa: F401
from app.api.v1.routes.jupas_search import router as jupas_search_router
from app.api.v1.routes.self_financing import router as sf_router
from app.api.v1.routes.grade_builds import router as grade_builds_router

_startup_logger = _logging.getLogger("app.startup")

app = FastAPI(
    title="Intelligent Academic Advisor API",
    version="2.0.0",
    description="Backend API for the Intelligent Academic Advisor (v1 + v2)",
)

# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
from app.api.v1.routes.auth import limiter  # noqa: E402

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# Create tables on startup (v1 + v2 share the same Base.metadata)
# ---------------------------------------------------------------------------
Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# Auto-seed subjects and schools on startup if tables are empty
# ---------------------------------------------------------------------------
def _split_sql_statements(sql: str):
    """Split SQL into individual statements, respecting single-quoted string literals."""
    stmts = []
    current = []
    in_string = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        if in_string:
            current.append(ch)
            if ch == "'":
                # Escaped quote '' stays in string
                if i + 1 < len(sql) and sql[i + 1] == "'":
                    current.append(sql[i + 1])
                    i += 2
                    continue
                else:
                    in_string = False
        else:
            if ch == "'":
                in_string = True
                current.append(ch)
            elif ch == "-" and i + 1 < len(sql) and sql[i + 1] == "-":
                # Skip line comment
                while i < len(sql) and sql[i] != "\n":
                    i += 1
                continue
            elif ch == ";":
                stmt = "".join(current).strip()
                if stmt:
                    stmts.append(stmt)
                current = []
            else:
                current.append(ch)
        i += 1
    stmt = "".join(current).strip()
    if stmt:
        stmts.append(stmt)
    return stmts


def _run_sql_file(conn, path) -> int:
    """Execute a SQL seed file using per-statement savepoints for error isolation."""
    sql = path.read_text()
    stmts = _split_sql_statements(sql)
    executed = 0

    # Detect dialect — SQLite needs function replacements
    dialect = engine.dialect.name
    is_sqlite = dialect == "sqlite"

    # Use raw cursor to bypass SQLAlchemy bind-parameter interpolation
    # (JSON content in seed SQL contains patterns like :N that SQLAlchemy misinterprets)
    raw_cursor = conn.connection.cursor()
    for stmt in stmts:
        # Replace PostgreSQL-specific functions for SQLite
        if is_sqlite:
            stmt = stmt.replace("NOW()", "datetime('now')")
            stmt = stmt.replace("now()", "datetime('now')")
            stmt = stmt.replace("::uuid", "")
            stmt = stmt.replace("::text", "")
            # SQLAlchemy stores UUIDs as 32-char hex on SQLite (no hyphens).
            # Seed SQL uses hyphenated UUIDs — convert them.
            import re
            stmt = re.sub(
                r"'([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})'",
                lambda m: "'" + m.group(0)[1:-1].replace("-", "") + "'",
                stmt,
            )
        try:
            raw_cursor.execute("SAVEPOINT sp")
            raw_cursor.execute(stmt)
            raw_cursor.execute("RELEASE SAVEPOINT sp")
            executed += 1
        except Exception:
            raw_cursor.execute("ROLLBACK TO SAVEPOINT sp")
    conn.commit()
    return executed


def _seed_database():
    """Auto-seed subjects and schools on startup if tables are empty."""
    from sqlalchemy import text as _t

    seed_dir = Path(__file__).parent.parent / "data" / "seed"

    with engine.connect() as conn:
        # Seed subjects if empty
        subject_count = conn.execute(_t("SELECT COUNT(*) FROM subjects")).scalar()
        if subject_count == 0:
            subjects_sql_path = seed_dir / "seed_subjects.sql"
            if subjects_sql_path.exists():
                _run_sql_file(conn, subjects_sql_path)

        # Seed canonical schools if empty (exclude custom rows)
        school_count = conn.execute(
            _t("SELECT COUNT(*) FROM schools WHERE is_custom = FALSE OR is_custom IS NULL")
        ).scalar()
        if school_count == 0:
            schools_sql_path = seed_dir / "seed_schools.sql"
            if schools_sql_path.exists():
                _run_sql_file(conn, schools_sql_path)


_seed_database()

# ---------------------------------------------------------------------------
# Runtime column migrations (PostgreSQL only — SQLite does not support
# IF NOT EXISTS in ALTER TABLE; guard prevents test suite collection errors)
# ---------------------------------------------------------------------------
if engine.dialect.name == "postgresql":
    from sqlalchemy import text as _sql_text
    with engine.connect() as _conn:
        _conn.execute(_sql_text("ALTER TABLE students ADD COLUMN IF NOT EXISTS personal_statement TEXT"))
        _conn.execute(_sql_text("ALTER TABLE student_school_targets ADD COLUMN IF NOT EXISTS intended_majors JSON"))
        _conn.execute(_sql_text("ALTER TABLE student_school_targets ADD COLUMN IF NOT EXISTS year_of_entry INTEGER"))
        _conn.execute(_sql_text("ALTER TABLE schools ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE"))
        _conn.execute(_sql_text("ALTER TABLE schools ADD COLUMN IF NOT EXISTS major_requirements JSON"))
        _conn.execute(_sql_text("ALTER TABLE schools DROP CONSTRAINT IF EXISTS ck_schools_type"))
        _conn.execute(_sql_text(
            "ALTER TABLE schools ADD CONSTRAINT ck_schools_type CHECK "
            "(type IN ('UNIVERSITY', 'POLYTECHNIC', 'COMMUNITY_COLLEGE', 'VOCATIONAL', 'HIGH_SCHOOL') OR type IS NULL)"
        ))
        # Graduation columns on students
        _conn.execute(_sql_text("ALTER TABLE students ADD COLUMN IF NOT EXISTS is_graduated BOOLEAN DEFAULT FALSE"))
        _conn.execute(_sql_text("ALTER TABLE students ADD COLUMN IF NOT EXISTS graduation_year INTEGER"))
        _conn.execute(_sql_text("ALTER TABLE students ADD COLUMN IF NOT EXISTS final_school_id UUID REFERENCES schools(id) ON DELETE SET NULL"))
        _conn.execute(_sql_text("ALTER TABLE students ADD COLUMN IF NOT EXISTS final_major VARCHAR(255)"))
        # AcademicPlan — template, overrides, and chat rate-limit columns (Point 16/17)
        _conn.execute(_sql_text("ALTER TABLE academic_plans ADD COLUMN IF NOT EXISTS template_id VARCHAR(50) DEFAULT 'professional'"))
        _conn.execute(_sql_text("ALTER TABLE academic_plans ADD COLUMN IF NOT EXISTS overrides JSON DEFAULT '{}'"))
        _conn.execute(_sql_text("ALTER TABLE academic_plans ADD COLUMN IF NOT EXISTS chat_request_counts JSON DEFAULT '{}'"))
        # Preference confidence on student_school_targets (ship-ready spec)
        _conn.execute(_sql_text("ALTER TABLE student_school_targets ADD COLUMN IF NOT EXISTS preference_confidence INTEGER DEFAULT 3 NOT NULL"))
        _conn.execute(_sql_text(
            "ALTER TABLE student_school_targets DROP CONSTRAINT IF EXISTS ck_sst_preference_confidence"
        ))
        _conn.execute(_sql_text(
            "ALTER TABLE student_school_targets ADD CONSTRAINT ck_sst_preference_confidence "
            "CHECK (preference_confidence >= 1 AND preference_confidence <= 5)"
        ))
        _conn.commit()

# ---------------------------------------------------------------------------
# Module discovery and registration
# ---------------------------------------------------------------------------
_modules_dir = Path(__file__).parent / "modules"
if _modules_dir.exists():
    _registered_modules = discover_and_register_modules(app, _modules_dir)
    _startup_logger.info(f"Modules loaded: {[m['name'] for m in _registered_modules if m['status'] == 'ok']}")
else:
    _registered_modules = []
    _startup_logger.info("No modules directory found — skipping module discovery")

# ---------------------------------------------------------------------------
# ORM-schema parity check (runs once at startup, logs warnings)
# ---------------------------------------------------------------------------
_check_models = []
_queue = list(Base.__subclasses__())
while _queue:
    _cls = _queue.pop(0)
    if hasattr(_cls, '__tablename__'):
        _check_models.append(_cls)
    _queue.extend(_cls.__subclasses__())
_parity_result = check_orm_schema_parity(engine, _check_models)
_startup_logger.info(f"Schema parity: {_parity_result['status']}")

_startup_logger.info(f"CORS origin: {settings.CORS_ORIGINS}")

# ---------------------------------------------------------------------------
# Ensure UPLOAD_DIR exists on startup
# ---------------------------------------------------------------------------
_upload_dir = os.environ.get("UPLOAD_DIR", "/tmp/advisor_uploads")
Path(_upload_dir).mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# CORS middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers — v1 (unchanged)
# ---------------------------------------------------------------------------
app.include_router(auth.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(action_plan.router, prefix="/api/v1")

# ---------------------------------------------------------------------------
# Routers — v2 (new)
# ---------------------------------------------------------------------------
app.include_router(grades.router, prefix="/api/v1")
app.include_router(subjects_route.router, prefix="/api/v1")
app.include_router(targets.router, prefix="/api/v1")
app.include_router(targets.targets_flat_router, prefix="/api/v1")
app.include_router(schools_v2.router, prefix="/api/v1")
# NOTE: schools.py (v1) removed — its routes were shadowed by schools_v2.
# schools_v2 provides: GET/POST /schools, GET/DELETE /schools/{id}
# PUT /schools/{id} was v1-only and unused by frontend/tests.
app.include_router(match.router, prefix="/api/v1")
app.include_router(plan.router, prefix="/api/v1")
app.include_router(account.router, prefix="/api/v1")
app.include_router(transcripts.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(cohorts.router, prefix="/api/v1")
app.include_router(entities.router, prefix="/api/v1")
app.include_router(consultant.router, prefix="/api/v1")
app.include_router(organisations_router, prefix="/api/v1")
app.include_router(methodology_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(consent_router, prefix="/api/v1")
app.include_router(student_import_router, prefix="/api/v1")
app.include_router(jupas_search_router, prefix="/api/v1")
app.include_router(sf_router, prefix="/api/v1")
app.include_router(grade_builds_router, prefix="/api/v1")

from app.api.v1.routes.reports import router as reports_router
app.include_router(reports_router, prefix="/api/v1")

from app.api.v1.routes.student_portal import router as student_portal_router
app.include_router(student_portal_router, prefix="/api/v1")

from app.api.v1.routes.submissions import router as submissions_router
app.include_router(submissions_router, prefix="/api/v1")

from app.api.v1.routes.plan_release import router as plan_release_router
app.include_router(plan_release_router, prefix="/api/v1")

from app.api.v1.routes.invite import router as invite_router
app.include_router(invite_router, prefix="/api/v1")

# ---------------------------------------------------------------------------
# Task YAML validation at startup (Pitfall 4 prevention)
# ---------------------------------------------------------------------------
try:
    from app.platform.task_engine import TaskEngine as _TaskEngine
    _yaml_errors = _TaskEngine.validate_all_task_yamls()
    if _yaml_errors:
        _startup_logger.warning("Task YAML validation errors: %s", _yaml_errors)
    else:
        _startup_logger.info("Task YAML validation: all tasks OK")
except Exception as _yaml_exc:
    _startup_logger.warning("Task YAML validation skipped: %s", _yaml_exc)


# ---------------------------------------------------------------------------
# Health check — extended with DB, CORS, schema parity, module health
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
def health_check():
    """Extended health check: DB, CORS, schema parity, module health."""
    return run_health_check(engine, settings.CORS_ORIGINS)
