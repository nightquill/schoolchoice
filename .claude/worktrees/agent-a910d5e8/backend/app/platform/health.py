"""
app/platform/health.py

Health check orchestrator. Provides:
- ORM-schema parity check (runs once at startup, result cached)
- Module health callback registry
- Aggregated health check function for the /health endpoint
"""
import logging
from typing import Callable

from sqlalchemy import inspect as sa_inspect, text as _t
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

_schema_parity_result: dict = {"status": "not_checked", "issues": []}
_module_health_callbacks: dict[str, Callable] = {}


def check_orm_schema_parity(engine: Engine, orm_models: list) -> dict:
    """Compare ORM column definitions against live DB schema.

    Runs once at startup. Logs warnings for drift. Does not block startup.
    Only runs against PostgreSQL (SQLite in tests has no information_schema).
    """
    global _schema_parity_result
    if engine.dialect.name != "postgresql":
        _schema_parity_result = {"status": "skipped", "issues": [], "reason": "non-postgresql dialect"}
        return _schema_parity_result
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
    if not issues:
        logger.info("[SCHEMA PARITY] All ORM models match DB schema.")
    _schema_parity_result = {"status": "drift_detected" if issues else "ok", "issues": issues}
    return _schema_parity_result


def register_health_callback(name: str, fn: Callable) -> None:
    """Register a module health check function. Called by module_loader during discovery."""
    _module_health_callbacks[name] = fn


def get_schema_parity_result() -> dict:
    """Return the cached schema parity check result."""
    return _schema_parity_result


def run_health_check(engine: Engine, cors_origins: str) -> dict:
    """Aggregated health check for /health endpoint.

    Reports: DB status, CORS origin, schema parity, per-module health.
    Per SEC-03: db status, AI provider configured, ML model loaded, background jobs.
    Per D-15: DB status, CORS origin, schema parity, per-module health.
    """
    # DB connectivity
    try:
        with engine.connect() as conn:
            conn.execute(_t("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    # Module health callbacks
    module_health = {}
    for name, fn in _module_health_callbacks.items():
        try:
            module_health[name] = fn()
        except Exception as e:
            module_health[name] = {"status": "error", "detail": str(e)}

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "cors_origin": cors_origins,
        "schema_parity": _schema_parity_result,
        "modules": module_health,
    }
