"""
app/db/session.py

SQLAlchemy engine, session factory, and FastAPI get_db dependency.

Environment Variables:
    DATABASE_URL (required)
        Full PostgreSQL connection string.
        Format: postgresql+psycopg2://user:password@host:port/dbname
        Example: postgresql+psycopg2://advisor:secret@localhost:5432/advisor_db

Usage in FastAPI route:
    from app.db.session import get_db
    from sqlalchemy.orm import Session

    @router.get("/example")
    def example_route(db: Session = Depends(get_db)):
        ...
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
_engine_kwargs: dict = {"echo": False}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 10

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


def get_db():
    """
    FastAPI dependency that yields a SQLAlchemy Session.

    Opens a new session, yields it to the route handler, and guarantees
    the session is closed after the request completes.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
