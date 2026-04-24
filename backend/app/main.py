"""
app/main.py

FastAPI application entrypoint.
Configures CORS middleware and includes all API routers under /api/v1.
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routes import action_plan, auth, recommendations, schools, students
from app.api.v1.routes import (
    account,
    admin,
    analytics,
    cohorts,
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

# Import models_v2 to register all v2 ORM classes with Base.metadata
import app.db.models_v2  # noqa: F401

app = FastAPI(
    title="Intelligent Academic Advisor API",
    version="2.0.0",
    description="Backend API for the Intelligent Academic Advisor (v1 + v2)",
)

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
    # Use raw psycopg2 cursor to bypass SQLAlchemy bind-parameter interpolation
    # (JSON content in seed SQL contains patterns like :N that SQLAlchemy misinterprets)
    raw_cursor = conn.connection.cursor()
    for stmt in stmts:
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
        _conn.commit()

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
app.include_router(schools_v2.router, prefix="/api/v1")
app.include_router(schools.router, prefix="/api/v1")
app.include_router(match.router, prefix="/api/v1")
app.include_router(plan.router, prefix="/api/v1")
app.include_router(account.router, prefix="/api/v1")
app.include_router(transcripts.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(cohorts.router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
