"""
Vercel serverless entry point.
Exports the FastAPI ASGI app for Vercel's Python runtime.
"""
import os
import sys
from pathlib import Path

# Resolve paths
_root = Path(__file__).resolve().parent.parent
backend_dir = _root / "backend"
data_dir = _root / "data"

# Add backend/ to Python path so imports work
sys.path.insert(0, str(backend_dir))

# Patch data paths: try multiple locations to find data files
# Vercel serverless runs from various base directories
_candidates = [
    data_dir,                                    # relative to api/index.py
    Path("/var/task/data"),                       # Vercel lambda
    Path(os.getcwd()) / "data",                  # cwd
    backend_dir.parent / "data",                 # repo root
]
for _cand in _candidates:
    if (_cand / "seed").exists() or (_cand / "jupas").exists():
        os.environ["SEED_DIR"] = str(_cand / "seed")
        os.environ["JUPAS_DATA_DIR"] = str(_cand / "jupas")
        break

# Vercel has writable /tmp — use it for SQLite
_db_path = Path("/tmp/app.db")

# Set env defaults for Vercel
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_db_path}")
os.environ.setdefault("SECRET_KEY", os.environ.get("SECRET_KEY", "vercel-deploy-key-change-in-production"))
os.environ.setdefault("CORS_ORIGINS", "*")

# Import the FastAPI app — triggers table creation + seeding on cold start
from app.main import app  # noqa: E402

# Vercel looks for `app` export
