"""
database/migrations/env.py

Standard Alembic environment script.

- Reads DATABASE_URL from the environment (never hardcoded).
- Imports the SQLAlchemy metadata from the ORM models so that
  `alembic revision --autogenerate` can detect schema drift.
- Supports both offline mode (generates SQL) and online mode
  (applies migrations against a live database).

Prerequisites before running:
    export DATABASE_URL=postgresql+psycopg2://user:password@host:port/dbname
    pip install alembic psycopg2-binary sqlalchemy
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# Make the project root importable so that `database.orm_models` can be found.
# Adjust this path if the project layout changes.
# ---------------------------------------------------------------------------

# This file lives at: database/migrations/env.py
# The project root is three levels up:  ../../..
_project_root = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# ---------------------------------------------------------------------------
# Import ORM metadata — must happen after sys.path is extended.
# ---------------------------------------------------------------------------

from database.orm_models import Base  # noqa: E402  (import after sys.path fix)

target_metadata = Base.metadata

# ---------------------------------------------------------------------------
# Alembic Config object (gives access to alembic.ini values).
# ---------------------------------------------------------------------------

config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the sqlalchemy.url from environment so the DSN is never
# stored in alembic.ini or committed to source control.
database_url: str = os.environ["DATABASE_URL"]
config.set_main_option("sqlalchemy.url", database_url)


# ---------------------------------------------------------------------------
# Offline migration (generates SQL without a live DB connection)
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine; calls to
    context.execute() emit the SQL to stdout (or a file).

    Usage:
        alembic upgrade head --sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Include schemas and compare types for thorough autogenerate diffs.
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online migration (applies directly against a live PostgreSQL instance)
# ---------------------------------------------------------------------------

def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    Creates an Engine, associates a connection with the context, and runs
    all pending migrations.

    Usage:
        alembic upgrade head
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # NullPool for migration scripts: no pooling.
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
