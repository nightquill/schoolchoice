"""
Vercel serverless entry point.
Exports the FastAPI ASGI app for Vercel's Python runtime.
"""
import os
import sys
import shutil
from pathlib import Path

# Add backend/ to Python path so imports work
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# Vercel has writable /tmp — copy SQLite DB there on cold start
_db_source = backend_dir / "app.db"
_db_target = Path("/tmp/app.db")

if _db_source.exists() and not _db_target.exists():
    shutil.copy2(_db_source, _db_target)

# Set env defaults for Vercel
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_db_target}")
os.environ.setdefault("SECRET_KEY", os.environ.get("SECRET_KEY", "vercel-deploy-key-change-in-production"))

# Import the FastAPI app
from app.main import app  # noqa: E402

# Vercel looks for `app` export
