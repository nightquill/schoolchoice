"""Vercel serverless shim — re-exports FastAPI app."""
import os
import sys
import traceback
from pathlib import Path

from fastapi import FastAPI

# Default app — will be replaced by the real one if import succeeds
app = FastAPI()
_import_error = None

# Set env defaults
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/app.db")
os.environ.setdefault("SECRET_KEY", os.environ.get("SECRET_KEY", "vercel-deploy-key-change-in-prod"))
os.environ.setdefault("CORS_ORIGINS", "*")

# Find data directory
for _candidate in [
    Path("/var/task/data"),
    Path(os.getcwd()) / "data",
    Path(__file__).resolve().parent.parent / "data",
]:
    if (_candidate / "seed").exists() or (_candidate / "jupas").exists():
        os.environ.setdefault("SEED_DIR", str(_candidate / "seed"))
        os.environ.setdefault("JUPAS_DATA_DIR", str(_candidate / "jupas"))
        break

# Try importing the real app
try:
    from app.main import app  # noqa: F811
except Exception:
    _import_error = traceback.format_exc()

    @app.get("/{path:path}")
    def _error(path: str):
        return {
            "error": "App failed to start",
            "traceback": _import_error,
            "cwd": os.getcwd(),
            "python": sys.version,
        }
