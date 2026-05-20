"""Auto-generate student login accounts."""
from __future__ import annotations

import random
import re
import secrets
import uuid

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import Organisation, OrganisationMembership, User
from app.modules.school_choice.models.models import Student


def _generate_username(student: Student, org_email_domain: str | None, db: Session) -> str:
    """Generate username: {given_name_initials}{surname}@{domain}

    Examples:
      "Chan Siu Ming" → smchan@orgname.hk  (given initials 'sm' + surname 'chan')
      Dedup with sequential numbers: smchan, smchan2, smchan3...
    """
    name = student.name or ""

    # Try to parse English name (has spaces, mostly ASCII)
    # Hong Kong convention: surname is FIRST word (e.g. "Chan Siu Ming")
    if re.search(r"[a-zA-Z]", name) and " " in name:
        parts = name.strip().split()
        # Surname is first, given names follow
        surname = parts[0].lower()
        initials = "".join(p[0].lower() for p in parts[1:])
        stem = f"{initials}{surname}"
    else:
        # Chinese name or single-word — use candidate_number or student ID
        stem = student.candidate_number or f"student{str(student.id)[:8]}"
        stem = re.sub(r"[^a-zA-Z0-9]", "", stem).lower()

    domain = org_email_domain or "school.hk"

    # Try base username first, then sequential dedup
    username = f"{stem}@{domain}"
    if not db.query(User).filter(User.email == username).first():
        return username

    # Sequential dedup: stem2, stem3, ...
    counter = 2
    while counter < 1000:
        username = f"{stem}{counter}@{domain}"
        if not db.query(User).filter(User.email == username).first():
            return username
        counter += 1

    return username


def assign_account(
    student_id: str,
    db: Session,
    current_user: User,
    custom_username: str | None = None,
) -> dict:
    """Create a login account for a student. Returns {email, password}."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    # Check if student already has an account
    existing = db.query(User).filter(
        User.student_id == student.id, User.role == "student"
    ).first()
    if existing:
        raise ValueError("Student already has an account")

    # Get org info
    membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == current_user.id)
        .first()
    )

    org_domain = None
    org_id = None
    if membership:
        org_id = membership.organisation_id
        org = db.query(Organisation).filter(Organisation.id == org_id).first()
        if org:
            org_domain = org.email_domain

    # Generate username or use custom
    domain = org_domain or "school.hk"
    if custom_username:
        # Strip any existing domain — always append org domain
        local_part = custom_username.split("@")[0].strip()
        if not local_part:
            raise ValueError("Username cannot be empty")
        email = f"{local_part}@{domain}"
    else:
        email = _generate_username(student, org_domain, db)

    # Global uniqueness check
    if db.query(User).filter(User.email == email).first():
        raise ValueError(f"Account '{email}' already exists. Choose a different username.")

    # Password: random 8-char token (secure default)
    password = secrets.token_urlsafe(8)

    # Create user — display_name defaults to the student's English name
    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=get_password_hash(password),
        role="student",
        student_id=student.id,
        display_name=student.name,
        must_change_password=True,
    )
    db.add(user)
    db.flush()

    # Add org membership
    if org_id:
        om = OrganisationMembership(
            user_id=user.id,
            organisation_id=org_id,
            role="member",
        )
        db.add(om)

    db.commit()

    return {
        "email": email,
        "password": password,
        "student_id": str(student.id),
        "user_id": str(user.id),
    }
