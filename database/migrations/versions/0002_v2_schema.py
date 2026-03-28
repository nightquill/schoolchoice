"""0002_v2_schema

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-27

v2 schema changes for the Intelligent Academic Advisor.

Additive-only migration:
  - Creates 6 new tables: grade_systems, subjects, student_subject_grades,
    transcripts, student_school_targets, plan_generation_jobs
  - ALTER TABLE students: adds all v2 profile columns
  - ALTER TABLE schools: adds all v2 school profile columns
  - ALTER TABLE action_plans: adds recommended_schools, action_items,
    html_content, version
  - Adds indexes for query patterns in api_contracts_v2.md

REQ-IDs: REQ-049, REQ-053, REQ-054, REQ-055, REQ-056, REQ-057, REQ-058,
         REQ-059, REQ-060, REQ-061, REQ-062, REQ-078

No v1 column is removed or renamed.
All ADD COLUMN operations use IF NOT EXISTS for idempotency.
All new tables use CREATE TABLE IF NOT EXISTS for idempotency.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# ---------------------------------------------------------------------------
# Revision identifiers
# ---------------------------------------------------------------------------
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1. grade_systems  (no FKs — create first)
    # -----------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS grade_systems (
            id                UUID        NOT NULL DEFAULT gen_random_uuid(),
            name              VARCHAR(20) NOT NULL,
            description       TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_grade_systems PRIMARY KEY (id),
            CONSTRAINT uq_grade_systems_name UNIQUE (name),
            CONSTRAINT ck_grade_systems_name
                CHECK (name IN ('HKDSE', 'A_LEVEL', 'IB', 'CUSTOM'))
        )
    """)

    # -----------------------------------------------------------------------
    # 2. subjects  (FK → grade_systems)
    # -----------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS subjects (
            id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
            grade_system_id      UUID         NOT NULL,
            name                 VARCHAR(255) NOT NULL,
            code                 VARCHAR(20)  NOT NULL,
            category             VARCHAR(30)  NOT NULL,
            is_compulsory        BOOLEAN      NOT NULL DEFAULT false,
            hkdse_subject_code   VARCHAR(10),
            created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
            CONSTRAINT pk_subjects PRIMARY KEY (id),
            CONSTRAINT uq_subjects_grade_system_code
                UNIQUE (grade_system_id, code),
            CONSTRAINT ck_subjects_category
                CHECK (category IN ('CORE', 'ELECTIVE', 'OTHER_LANGUAGE', 'APPLIED_LEARNING')),
            CONSTRAINT fk_subjects_grade_system_id
                FOREIGN KEY (grade_system_id)
                REFERENCES grade_systems (id)
                ON DELETE RESTRICT
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_subjects_grade_system_id
            ON subjects (grade_system_id)
    """)

    # -----------------------------------------------------------------------
    # 3. student_subject_grades  (FK → students, subjects)
    # -----------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS student_subject_grades (
            id                   UUID        NOT NULL DEFAULT gen_random_uuid(),
            student_id           UUID        NOT NULL,
            subject_id           UUID        NOT NULL,
            year_of_exam         INTEGER,
            sitting              VARCHAR(10) NOT NULL,
            raw_grade            VARCHAR(10),
            predicted_grade      VARCHAR(10),
            transcript_uploaded  BOOLEAN     NOT NULL DEFAULT false,
            transcript_file_path TEXT,
            notes                TEXT,
            created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_student_subject_grades PRIMARY KEY (id),
            CONSTRAINT ck_ssg_sitting
                CHECK (sitting IN ('MOCK', 'TRIAL', 'OFFICIAL')),
            CONSTRAINT fk_ssg_student_id
                FOREIGN KEY (student_id)
                REFERENCES students (id)
                ON DELETE CASCADE,
            CONSTRAINT fk_ssg_subject_id
                FOREIGN KEY (subject_id)
                REFERENCES subjects (id)
                ON DELETE RESTRICT
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ssg_student_id
            ON student_subject_grades (student_id)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_ssg_student_subject
            ON student_subject_grades (student_id, subject_id)
    """)

    # -----------------------------------------------------------------------
    # 4. transcripts  (FK → students)
    # -----------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS transcripts (
            id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
            student_id         UUID        NOT NULL,
            file_path          TEXT        NOT NULL,
            uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            parsed_data        JSON,
            processing_status  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_transcripts PRIMARY KEY (id),
            CONSTRAINT ck_transcripts_processing_status
                CHECK (processing_status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
            CONSTRAINT fk_transcripts_student_id
                FOREIGN KEY (student_id)
                REFERENCES students (id)
                ON DELETE CASCADE
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_transcripts_student_id
            ON transcripts (student_id)
    """)

    # -----------------------------------------------------------------------
    # 5. student_school_targets  (FK → students, schools)
    # -----------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS student_school_targets (
            id                UUID        NOT NULL DEFAULT gen_random_uuid(),
            student_id        UUID        NOT NULL,
            school_id         UUID        NOT NULL,
            student_rank      INTEGER,
            match_score       NUMERIC(5,4),
            eligibility_pass  BOOLEAN,
            shap_explanation  JSON,
            status            VARCHAR(20) NOT NULL DEFAULT 'CONSIDERING',
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_student_school_targets PRIMARY KEY (id),
            CONSTRAINT uq_sst_student_school
                UNIQUE (student_id, school_id),
            CONSTRAINT uq_sst_student_rank
                UNIQUE (student_id, student_rank),
            CONSTRAINT ck_sst_status
                CHECK (status IN ('CONSIDERING', 'APPLIED', 'ADMITTED', 'REJECTED', 'WITHDRAWN')),
            CONSTRAINT fk_sst_student_id
                FOREIGN KEY (student_id)
                REFERENCES students (id)
                ON DELETE CASCADE,
            CONSTRAINT fk_sst_school_id
                FOREIGN KEY (school_id)
                REFERENCES schools (id)
                ON DELETE RESTRICT
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_sst_student_id
            ON student_school_targets (student_id)
    """)

    # -----------------------------------------------------------------------
    # 6. plan_generation_jobs  (FK → students)
    # -----------------------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS plan_generation_jobs (
            id             UUID        NOT NULL DEFAULT gen_random_uuid(),
            student_id     UUID        NOT NULL,
            status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            error_message  TEXT,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_plan_generation_jobs PRIMARY KEY (id),
            CONSTRAINT ck_pgj_status
                CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
            CONSTRAINT fk_pgj_student_id
                FOREIGN KEY (student_id)
                REFERENCES students (id)
                ON DELETE CASCADE
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_pgj_student_id
            ON plan_generation_jobs (student_id)
    """)

    # -----------------------------------------------------------------------
    # 7. ALTER TABLE students — add v2 profile columns
    #    All ADD COLUMN IF NOT EXISTS for idempotency.
    #    All nullable (or nullable with DEFAULT) to preserve v1 row compatibility.
    # -----------------------------------------------------------------------
    student_columns = [
        "ADD COLUMN IF NOT EXISTS preferred_name       VARCHAR(255)",
        "ADD COLUMN IF NOT EXISTS date_of_birth        DATE",
        "ADD COLUMN IF NOT EXISTS gender               VARCHAR(20)",
        "ADD COLUMN IF NOT EXISTS address              TEXT",
        "ADD COLUMN IF NOT EXISTS phone                VARCHAR(50)",
        "ADD COLUMN IF NOT EXISTS email                VARCHAR(255)",
        "ADD COLUMN IF NOT EXISTS class_name           VARCHAR(50)",
        "ADD COLUMN IF NOT EXISTS year_of_study        INTEGER",
        "ADD COLUMN IF NOT EXISTS candidate_number     VARCHAR(50)",
        "ADD COLUMN IF NOT EXISTS preferred_language   VARCHAR(10) DEFAULT 'en'",
        "ADD COLUMN IF NOT EXISTS ielts_score          JSON",
        "ADD COLUMN IF NOT EXISTS other_language_scores JSON",
        "ADD COLUMN IF NOT EXISTS teacher_evaluation   JSON",
        "ADD COLUMN IF NOT EXISTS extra_curricular     JSON",
        "ADD COLUMN IF NOT EXISTS awards               JSON",
        "ADD COLUMN IF NOT EXISTS financial_aid_flag   BOOLEAN DEFAULT false",
    ]
    for clause in student_columns:
        op.execute(f"ALTER TABLE students {clause}")

    # -----------------------------------------------------------------------
    # 8. ALTER TABLE schools — add v2 school profile columns
    # -----------------------------------------------------------------------
    school_columns = [
        "ADD COLUMN IF NOT EXISTS name_zh                VARCHAR(255)",
        "ADD COLUMN IF NOT EXISTS type                   VARCHAR(30) NOT NULL DEFAULT 'UNIVERSITY' CONSTRAINT ck_schools_type CHECK (type IN ('UNIVERSITY','POLYTECHNIC','COMMUNITY_COLLEGE','VOCATIONAL'))",
        "ADD COLUMN IF NOT EXISTS website                VARCHAR(500)",
        "ADD COLUMN IF NOT EXISTS description            TEXT",
        "ADD COLUMN IF NOT EXISTS minimum_entry_score    INTEGER",
        "ADD COLUMN IF NOT EXISTS required_subjects      JSON",
        "ADD COLUMN IF NOT EXISTS language_requirements  JSON",
        "ADD COLUMN IF NOT EXISTS faculties              JSON",
        "ADD COLUMN IF NOT EXISTS notable_programs       JSON",
        "ADD COLUMN IF NOT EXISTS acceptance_rate        NUMERIC(5,4)",
        "ADD COLUMN IF NOT EXISTS average_admitted_score NUMERIC(5,2)",
        "ADD COLUMN IF NOT EXISTS scholarship_available  BOOLEAN DEFAULT false",
        "ADD COLUMN IF NOT EXISTS data_source            TEXT",
        "ADD COLUMN IF NOT EXISTS data_last_updated      DATE",
    ]
    for clause in school_columns:
        op.execute(f"ALTER TABLE schools {clause}")

    # Add school search indexes
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_schools_type
            ON schools (type)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_schools_location
            ON schools (location)
    """)

    # -----------------------------------------------------------------------
    # 9. ALTER TABLE action_plans — add v2 academic plan columns
    # -----------------------------------------------------------------------
    plan_columns = [
        "ADD COLUMN IF NOT EXISTS recommended_schools  JSON",
        "ADD COLUMN IF NOT EXISTS action_items         JSON",
        "ADD COLUMN IF NOT EXISTS html_content         TEXT",
        "ADD COLUMN IF NOT EXISTS version              INTEGER NOT NULL DEFAULT 1",
    ]
    for clause in plan_columns:
        op.execute(f"ALTER TABLE action_plans {clause}")


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    # -----------------------------------------------------------------------
    # Reverse order: drop indexes, drop new columns, drop new tables
    # -----------------------------------------------------------------------

    # 9 reverse: remove action_plans v2 columns
    plan_columns_down = [
        "DROP COLUMN IF EXISTS version",
        "DROP COLUMN IF EXISTS html_content",
        "DROP COLUMN IF EXISTS action_items",
        "DROP COLUMN IF EXISTS recommended_schools",
    ]
    for clause in plan_columns_down:
        op.execute(f"ALTER TABLE action_plans {clause}")

    # 8 reverse: remove schools v2 columns and index
    op.execute("DROP INDEX IF EXISTS idx_schools_location")
    op.execute("DROP INDEX IF EXISTS idx_schools_type")

    school_columns_down = [
        "DROP COLUMN IF EXISTS data_last_updated",
        "DROP COLUMN IF EXISTS data_source",
        "DROP COLUMN IF EXISTS scholarship_available",
        "DROP COLUMN IF EXISTS average_admitted_score",
        "DROP COLUMN IF EXISTS acceptance_rate",
        "DROP COLUMN IF EXISTS notable_programs",
        "DROP COLUMN IF EXISTS faculties",
        "DROP COLUMN IF EXISTS language_requirements",
        "DROP COLUMN IF EXISTS required_subjects",
        "DROP COLUMN IF EXISTS minimum_entry_score",
        "DROP COLUMN IF EXISTS description",
        "DROP COLUMN IF EXISTS website",
        "DROP COLUMN IF EXISTS type",
        "DROP COLUMN IF EXISTS name_zh",
    ]
    for clause in school_columns_down:
        op.execute(f"ALTER TABLE schools {clause}")

    # 7 reverse: remove students v2 columns
    student_columns_down = [
        "DROP COLUMN IF EXISTS financial_aid_flag",
        "DROP COLUMN IF EXISTS awards",
        "DROP COLUMN IF EXISTS extra_curricular",
        "DROP COLUMN IF EXISTS teacher_evaluation",
        "DROP COLUMN IF EXISTS other_language_scores",
        "DROP COLUMN IF EXISTS ielts_score",
        "DROP COLUMN IF EXISTS preferred_language",
        "DROP COLUMN IF EXISTS candidate_number",
        "DROP COLUMN IF EXISTS year_of_study",
        "DROP COLUMN IF EXISTS class_name",
        "DROP COLUMN IF EXISTS email",
        "DROP COLUMN IF EXISTS phone",
        "DROP COLUMN IF EXISTS address",
        "DROP COLUMN IF EXISTS gender",
        "DROP COLUMN IF EXISTS date_of_birth",
        "DROP COLUMN IF EXISTS preferred_name",
    ]
    for clause in student_columns_down:
        op.execute(f"ALTER TABLE students {clause}")

    # 6 reverse: drop plan_generation_jobs
    op.execute("DROP INDEX IF EXISTS idx_pgj_student_id")
    op.execute("DROP TABLE IF EXISTS plan_generation_jobs")

    # 5 reverse: drop student_school_targets
    op.execute("DROP INDEX IF EXISTS idx_sst_student_id")
    op.execute("DROP TABLE IF EXISTS student_school_targets")

    # 4 reverse: drop transcripts
    op.execute("DROP INDEX IF EXISTS idx_transcripts_student_id")
    op.execute("DROP TABLE IF EXISTS transcripts")

    # 3 reverse: drop student_subject_grades
    op.execute("DROP INDEX IF EXISTS idx_ssg_student_subject")
    op.execute("DROP INDEX IF EXISTS idx_ssg_student_id")
    op.execute("DROP TABLE IF EXISTS student_subject_grades")

    # 2 reverse: drop subjects
    op.execute("DROP INDEX IF EXISTS idx_subjects_grade_system_id")
    op.execute("DROP TABLE IF EXISTS subjects")

    # 1 reverse: drop grade_systems
    op.execute("DROP TABLE IF EXISTS grade_systems")
