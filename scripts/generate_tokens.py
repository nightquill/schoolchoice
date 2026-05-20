#!/usr/bin/env python3
"""Generate registration tokens for admin onboarding."""
import argparse
import json
import secrets
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.db.session import engine, SessionLocal
from app.db.models import Base, Organisation, RegistrationToken
import uuid


def main():
    parser = argparse.ArgumentParser(description='Generate registration tokens')
    parser.add_argument('--count', type=int, default=10, help='Number of tokens')
    parser.add_argument('--output', type=str, default='registration-tokens.json', help='Output file')
    args = parser.parse_args()

    # Ensure all tables exist (creates registration_tokens if missing)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        tokens = []
        for i in range(args.count):
            # Create a placeholder org for each token
            org_id = uuid.uuid4()
            org = Organisation(
                id=org_id,
                name=f"pending-{str(org_id)[:8]}",
                slug=f"pending-{str(org_id)[:8]}",
            )
            db.add(org)
            db.flush()

            token_str = secrets.token_urlsafe(32)
            reg_token = RegistrationToken(
                token=token_str,
                organisation_id=org_id,
            )
            db.add(reg_token)
            tokens.append({
                "token": token_str,
                "organisation_id": str(org_id),
            })

        db.commit()

        with open(args.output, 'w') as f:
            json.dump(tokens, f, indent=2)

        print(f"Generated {args.count} tokens -> {args.output}")
        for t in tokens:
            print(f"  {t['token']}")
    finally:
        db.close()


if __name__ == '__main__':
    main()
