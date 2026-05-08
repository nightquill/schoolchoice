# backend/scripts/migrate_to_orgs.py

"""
One-time migration: create default organisations and backfill organisation_id.

Usage:
    cd backend && python -m scripts.migrate_to_orgs

Safe to run multiple times -- skips already-migrated records.
"""

import os
import sys
import re

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.db.models import User, Organisation, OrganisationMembership
from app.modules.school_choice.models.models import Student, StudentCohort
import app.db.models_v2  # noqa: F401


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "org"


def migrate():
    db = SessionLocal()
    try:
        # Find all users without an org membership
        users_without_org = (
            db.query(User)
            .outerjoin(OrganisationMembership)
            .filter(OrganisationMembership.id.is_(None))
            .all()
        )

        if not users_without_org:
            print("All users already have organisations. Nothing to migrate.")
            return

        for user in users_without_org:
            # Create a personal org for each user
            org_name = f"{user.display_name or user.email}'s School"
            org_slug = slugify(org_name)

            # Ensure slug uniqueness by appending a short UUID suffix if needed
            existing = db.query(Organisation).filter(Organisation.slug == org_slug).first()
            if existing:
                org = existing
            else:
                org = Organisation(name=org_name, slug=org_slug)
                db.add(org)
                db.flush()

            # Create membership
            membership = OrganisationMembership(
                organisation_id=org.id,
                user_id=user.id,
                role="owner",
            )
            db.add(membership)

            # Backfill students
            students = db.query(Student).filter(
                Student.user_id == user.id,
                Student.organisation_id.is_(None),
            ).all()
            for s in students:
                s.organisation_id = org.id

            # Backfill cohorts
            cohorts = db.query(StudentCohort).filter(
                StudentCohort.user_id == user.id,
                StudentCohort.organisation_id.is_(None),
            ).all()
            for c in cohorts:
                c.organisation_id = org.id

            print(f"Migrated user {user.email}: {len(students)} students, {len(cohorts)} cohorts -> org '{org.name}'")

        db.commit()
        print("Migration complete.")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
