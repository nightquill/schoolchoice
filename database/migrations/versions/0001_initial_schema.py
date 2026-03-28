"""Initial schema — create all tables.

Revision ID: 0001
Revises: (none — this is the first migration)
Create Date: 2026-03-27 00:00:00.000000 UTC

Creates:
    users
    students
    schools
    recommendations
    action_plans

Down revision drops all tables in reverse dependency order.

REQ-IDs: REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030

NOTE: Requires a running PostgreSQL instance with the pgcrypto extension
available for gen_random_uuid(). Run `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
once on the target database before executing this migration.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ---------------------------------------------------------------------------
# Alembic revision identifiers
# ---------------------------------------------------------------------------

revision: str = "0001"
down_revision = None      # First migration — no parent.
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Upgrade: create all tables
# ---------------------------------------------------------------------------

def upgrade() -> None:
    # Enable pgcrypto for gen_random_uuid() if not already enabled.
    # Safe to run repeatedly (IF NOT EXISTS).
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ------------------------------------------------------------------
    # users
    # REQ-024
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "email",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "hashed_password",
            sa.String(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    # ------------------------------------------------------------------
    # schools
    # REQ-026, REQ-030
    # Created before students because recommendations reference both;
    # schools has no foreign keys.
    # ------------------------------------------------------------------
    op.create_table(
        "schools",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "location",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "min_academic_requirements",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "key_strengths",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("name", name="uq_schools_name"),
    )

    # ------------------------------------------------------------------
    # students
    # REQ-025, REQ-028
    # ------------------------------------------------------------------
    op.create_table(
        "students",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_students_user_id"),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "grades",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "interests",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "strengths_weaknesses",
            sa.Text(),
            server_default=sa.text("''"),
            nullable=False,
        ),
        sa.Column(
            "target_region",
            sa.String(50),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "target_region IN ('local', 'international')",
            name="ck_students_target_region",
        ),
    )
    op.create_index(
        "idx_students_user_id",
        "students",
        ["user_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # recommendations
    # REQ-027, REQ-029
    # ------------------------------------------------------------------
    op.create_table(
        "recommendations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "students.id",
                ondelete="CASCADE",
                name="fk_recommendations_student_id",
            ),
            nullable=False,
        ),
        sa.Column(
            "school_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "schools.id",
                name="fk_recommendations_school_id",
                # No ondelete: school deletion does not cascade.
            ),
            nullable=False,
        ),
        sa.Column(
            "school_name",
            sa.String(255),
            nullable=False,
        ),
        sa.Column(
            "score",
            sa.Numeric(5, 2),
            nullable=False,
        ),
        sa.Column(
            "explanation",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "gaps",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "rank",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "student_id", "rank",
            name="uq_recommendations_student_rank",
        ),
        sa.CheckConstraint(
            "score >= 0 AND score <= 100",
            name="ck_recommendations_score",
        ),
        sa.CheckConstraint(
            "rank >= 1 AND rank <= 5",
            name="ck_recommendations_rank",
        ),
    )
    op.create_index(
        "idx_recommendations_student_id",
        "recommendations",
        ["student_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # action_plans
    # REQ-025, REQ-027
    # ------------------------------------------------------------------
    op.create_table(
        "action_plans",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(
                "students.id",
                ondelete="CASCADE",
                name="fk_action_plans_student_id",
            ),
            nullable=False,
        ),
        sa.Column(
            "academic_targets",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "extracurricular_direction",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "preparation_steps",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("student_id", name="uq_action_plans_student_id"),
    )


# ---------------------------------------------------------------------------
# Downgrade: drop all tables in reverse dependency order
# ---------------------------------------------------------------------------

def downgrade() -> None:
    # Drop in reverse foreign-key dependency order to avoid FK violations.
    op.drop_table("action_plans")
    op.drop_index("idx_recommendations_student_id", table_name="recommendations")
    op.drop_table("recommendations")
    op.drop_index("idx_students_user_id", table_name="students")
    op.drop_table("students")
    op.drop_table("schools")
    op.drop_table("users")
