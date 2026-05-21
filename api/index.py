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

# Debug: log where files are on Vercel
import logging
_log = logging.getLogger("vercel.init")
_log.setLevel(logging.INFO)
_log.info(f"CWD: {os.getcwd()}")
_log.info(f"__file__: {__file__}")
_log.info(f"backend_dir: {backend_dir} exists={backend_dir.exists()}")
_log.info(f"data_dir: {data_dir} exists={data_dir.exists()}")
_log.info(f"SEED_DIR: {os.environ.get('SEED_DIR', 'NOT SET')}")
_log.info(f"JUPAS_DATA_DIR: {os.environ.get('JUPAS_DATA_DIR', 'NOT SET')}")
# List /var/task if it exists
_task = Path("/var/task")
if _task.exists():
    _log.info(f"/var/task contents: {list(_task.iterdir())[:20]}")

# Import the FastAPI app — triggers table creation + seeding on cold start
from app.main import app  # noqa: E402

# Temporary debug endpoint — remove after deploy works
@app.get("/api/v1/debug/paths")
def debug_paths():
    import glob
    cwd = os.getcwd()
    results = {
        "cwd": cwd,
        "file": str(Path(__file__).resolve()),
        "backend_dir": str(backend_dir),
        "backend_exists": backend_dir.exists(),
        "data_dir": str(data_dir),
        "data_exists": data_dir.exists(),
        "seed_dir": os.environ.get("SEED_DIR", "NOT SET"),
        "jupas_dir": os.environ.get("JUPAS_DATA_DIR", "NOT SET"),
        "var_task": list(str(p) for p in Path("/var/task").iterdir())[:20] if Path("/var/task").exists() else "not found",
        "cwd_ls": os.listdir(cwd)[:20],
        "data_glob": glob.glob("/var/task/**/jupas", recursive=True)[:5] + glob.glob(cwd + "/**/jupas", recursive=True)[:5],
    }
    return results

# Vercel looks for `app` export
