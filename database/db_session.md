# Database Session
# Intelligent Academic Advisor — MVP
# Document Owner: Database Engineer
# Date: 2026-03-27
# Status: BASELINE

SQLAlchemy engine setup, session factory, and FastAPI dependency injection. Import path: `database.db_session`.

---

## Full Module

```python
"""
database/db_session.py

SQLAlchemy engine, session factory, and FastAPI get_db dependency.

Environment Variables:
    DATABASE_URL (required)
        Full PostgreSQL connection string.
        Format: postgresql+psycopg2://user:password@host:port/dbname
        Example: postgresql+psycopg2://advisor:secret@localhost:5432/advisor_db

Usage in FastAPI route:
    from database.db_session import get_db
    from sqlalchemy.orm import Session

    @router.get("/example")
    def example_route(db: Session = Depends(get_db)):
        ...
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

DATABASE_URL: str = os.environ["DATABASE_URL"]
# Raises KeyError immediately at import time if DATABASE_URL is not set,
# giving a clear startup failure rather than a silent misconfiguration.

engine = create_engine(
    DATABASE_URL,
    # Pool settings suitable for a single-process FastAPI application.
    # Adjust pool_size / max_overflow for production workloads.
    pool_pre_ping=True,       # Recycles stale connections before use.
    pool_size=5,              # Connections kept open in the pool.
    max_overflow=10,          # Connections allowed beyond pool_size under load.
    echo=False,               # Set to True (or via LOG_LEVEL) to log SQL statements.
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)
# autocommit=False  — transactions must be committed explicitly.
# autoflush=False   — changes are not flushed to the DB before queries
#                     unless explicitly requested; avoids unexpected writes.

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db():
    """
    FastAPI dependency that yields a SQLAlchemy Session.

    Opens a new session, yields it to the route handler, and guarantees
    the session is closed after the request completes — whether it
    succeeded or raised an exception.

    Usage:
        from fastapi import Depends
        from sqlalchemy.orm import Session
        from database.db_session import get_db

        @router.post("/students")
        def create_student(
            payload: StudentCreateSchema,
            db: Session = Depends(get_db),
        ):
            ...
            db.add(student)
            db.commit()
            db.refresh(student)
            return student
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Full SQLAlchemy-compatible PostgreSQL DSN. Format: `postgresql+psycopg2://user:password@host:port/dbname` |

## Design Notes

1. **`pool_pre_ping=True`** — Before handing a connection from the pool to a session, SQLAlchemy issues a lightweight `SELECT 1` to verify the connection is alive. This handles cases where the database restarts or the TCP connection is dropped silently (e.g., behind a load balancer with idle timeouts).

2. **`autocommit=False`** — Every database mutation performed through `get_db` sessions must be committed explicitly with `db.commit()`. This matches the standard FastAPI + SQLAlchemy pattern and prevents accidental partial writes.

3. **`autoflush=False`** — ORM objects are not flushed to the database automatically before a query. The route handler controls exactly when writes happen.

4. **Generator pattern** — Using `yield` in `get_db` rather than `return` ensures the `finally` block always runs, closing the session even if the route handler raises an HTTP exception or an unhandled error. FastAPI's `Depends` mechanism understands generator-style dependencies natively.

5. **No `db.rollback()` in the finally block** — If the route commits successfully, `db.close()` is sufficient. If it raises before committing, `db.close()` calls `db.rollback()` internally for any uncommitted transaction. Explicit rollback is only needed when catching exceptions and continuing in the same session, which is not the pattern used here.

6. **`echo=False`** — SQL logging is disabled by default. Set `echo=True` (or wire it to an environment variable) during local development to inspect generated SQL.
