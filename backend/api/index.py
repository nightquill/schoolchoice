"""Vercel serverless shim — re-exports FastAPI app."""
import os
from pathlib import Path

# Set env defaults before importing app
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/app.db")
os.environ.setdefault("SECRET_KEY", os.environ.get("SECRET_KEY", "vercel-deploy-key-change-in-prod"))
os.environ.setdefault("CORS_ORIGINS", "*")

# Fix data paths: on Vercel, data/ is at repo root (one level up from backend/)
_data_dir = Path(__file__).resolve().parent.parent.parent / "data"
if _data_dir.exists():
    os.environ.setdefault("SEED_DIR", str(_data_dir / "seed"))
    os.environ.setdefault("JUPAS_DATA_DIR", str(_data_dir / "jupas"))

from app.main import app  # noqa: E402, F401
