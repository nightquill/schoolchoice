"""
Build-time script: create a fresh SQLite database with seed data.
Run during Vercel build to include app.db in the deployment.
"""
import os
import sys
from pathlib import Path

# Set up paths
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# Set env vars before importing app
db_path = backend_dir / "app.db"
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
os.environ.setdefault("SECRET_KEY", "build-time-key-not-for-production")
os.environ.setdefault("CORS_ORIGINS", "*")

# Delete existing DB to start fresh
if db_path.exists():
    db_path.unlink()

# Import triggers table creation + seeding
print(f"Building database at {db_path}...")
import app.main  # noqa: F401

# Create default admin account for demo
from app.db.session import SessionLocal
from app.db.models import User, Organisation, OrganisationMembership
from app.core.security import get_password_hash
import uuid

db = SessionLocal()
try:
    # Only create if no users exist
    if db.query(User).count() == 0:
        org = Organisation(
            id=uuid.uuid4(),
            name="Demo School",
            slug="demo-school",
            is_active=True,
        )
        db.add(org)
        db.flush()

        admin = User(
            id=uuid.uuid4(),
            email="admin@demo.school",
            hashed_password=get_password_hash("demo12345"),
            role="admin",
            display_name="Demo Admin",
        )
        db.add(admin)
        db.flush()

        db.add(OrganisationMembership(
            user_id=admin.id,
            organisation_id=org.id,
            role="owner",
        ))
        db.commit()
        print(f"Created demo admin: admin@demo.school / demo12345")
    else:
        print(f"Database already has {db.query(User).count()} users")
finally:
    db.close()

print(f"Database built: {db_path.stat().st_size} bytes")
