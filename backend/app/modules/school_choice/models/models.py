"""
app/modules/school_choice/models/models.py

All school_choice domain ORM models.
Moved from app.db.models (v1) and app.db.models_v2 during Phase 1 extraction.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import JSON as JSONB
from sqlalchemy.dialects.postgresql import TIMESTAMP
from app.db.models import UUID  # Portable UUID type (works on PostgreSQL + SQLite)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

# Import shared Base and User from platform models
from app.db.models import Base, _utcnow, User  # noqa: F401

__allow_unmapped__ = True


# ---------------------------------------------------------------------------
# students
# REQ-025, REQ-028
# ---------------------------------------------------------------------------


class Student(Base):
    """Student profile managed by a counselor."""

    __tablename__ = "students"

    __table_args__ = (
        CheckConstraint(
            "target_region IN ('local', 'international')",
            name="ck_students_target_region",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
        comment="Primary key",
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE", name="fk_students_user_id"),
        nullable=False,
        index=True,
        comment="Owning counselor — FK to users.id, cascade delete",
    )
    name = Column(
        String(255),
        nullable=False,
        comment="Student full name",
    )
    grades = Column(
        JSONB,
        nullable=False,
        server_default="{}",
        default=dict,
        comment='Map of subject (string) to grade value (string). E.g. {"math": "A"}',
    )
    interests = Column(
        JSONB,
        nullable=False,
        server_default="[]",
        default=list,
        comment='Array of interest tag strings. E.g. ["robotics", "music"]',
    )
    strengths_weaknesses = Column(
        Text,
        nullable=False,
        server_default="''",
        default="",
        comment="Free-text; may be empty string but not NULL",
    )
    target_region = Column(
        String(50),
        nullable=False,
        comment="Constrained to 'local' or 'international'",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # v2 additions — REQ-057
    preferred_name = Column(
        String(255), nullable=True,
        comment="Preferred/display name distinct from full name",
    )
    date_of_birth = Column(
        Date, nullable=True,
        comment="PII — encrypted at rest (ADR-008)",
    )
    gender = Column(
        String(20), nullable=True,
        comment="Free text",
    )
    address = Column(
        Text, nullable=True,
        comment="PII — encrypted at rest (ADR-008)",
    )
    phone = Column(
        String(50), nullable=True,
        comment="PII — encrypted at rest (ADR-008)",
    )
    email = Column(
        String(255), nullable=True,
        comment="Student contact email; distinct from counsellor account email",
    )
    class_name = Column(
        String(50), nullable=True,
        comment="E.g. '5A'",
    )
    year_of_study = Column(
        Integer, nullable=True,
        comment="Academic year",
    )
    candidate_number = Column(
        String(50), nullable=True,
        comment="HKDSE candidate number",
    )
    preferred_language = Column(
        String(10), nullable=True, default="en",
        server_default="'en'",
        comment="'en' or 'zh-HK'",
    )
    ielts_score = Column(
        JSONB, nullable=True,
        comment=(
            "Full IELTS score object: "
            "{overall, listening, reading, writing, speaking, test_date}"
        ),
    )
    other_language_scores = Column(
        JSONB, nullable=True,
        comment="Array: [{label, score, date}]",
    )
    teacher_evaluation = Column(
        JSONB, nullable=True,
        comment="Array: [{subject_code, teacher_name, rating, comment, date}]",
    )
    extra_curricular = Column(
        JSONB, nullable=True,
        comment="Array: [{activity, role, years, achievement}]",
    )
    awards = Column(
        JSONB, nullable=True,
        comment="Array: [{title, awarding_body, level, year}]",
    )
    financial_aid_flag = Column(
        Boolean, nullable=True, default=False,
        server_default="false",
        comment="True if the student is applying for financial aid",
    )
    notes = Column(
        Text, nullable=True,
        comment="Counsellor free-text notes",
    )
    # Added via ALTER TABLE — must also be declared here so ORM can read them
    personal_statement = Column(Text, nullable=True)
    is_graduated = Column(Boolean, nullable=True, default=False, server_default="false")
    graduation_year = Column(Integer, nullable=True)
    final_school_id = Column(UUID(as_uuid=True), ForeignKey("schools.id", ondelete="SET NULL", name="fk_students_final_school_id"), nullable=True, index=True)
    final_major = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", back_populates="students")
    recommendations = relationship(
        "Recommendation",
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="select",
    )
    action_plan = relationship(
        "ActionPlan",
        back_populates="student",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="select",
    )
    # v2 relationships
    subject_grades = relationship(
        "StudentSubjectGrade",
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="select",
    )
    transcripts = relationship(
        "Transcript",
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="select",
    )
    school_targets = relationship(
        "StudentSchoolTarget",
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="select",
    )
    plan_jobs = relationship(
        "PlanGenerationJob",
        back_populates="student",
        cascade="all, delete-orphan",
        lazy="select",
    )
    academic_plan = relationship(
        "AcademicPlan",
        back_populates="student",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Student id={self.id!s} name={self.name!r} user_id={self.user_id!s}>"


# ---------------------------------------------------------------------------
# schools
# REQ-026, REQ-030
# ---------------------------------------------------------------------------


class School(Base):
    """School record in the system's internal catalog."""

    __tablename__ = "schools"

    __table_args__ = (UniqueConstraint("name", name="uq_schools_name"),)

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
        comment="Primary key",
    )
    name = Column(
        String(255),
        nullable=False,
        comment="Unique school name",
    )
    location = Column(
        String(255),
        nullable=False,
        comment="Geographic location string",
    )
    min_academic_requirements = Column(
        JSONB,
        nullable=False,
        server_default="{}",
        default=dict,
        comment='Map of subject to minimum grade. E.g. {"math": "B"}',
    )
    key_strengths = Column(
        JSONB,
        nullable=False,
        server_default="[]",
        default=list,
        comment='Array of strength tag strings. E.g. ["STEM", "arts"]',
    )
    notes = Column(
        Text,
        nullable=True,
        comment="Optional free-text notes; nullable",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Added via ALTER TABLE
    is_custom = Column(Boolean, nullable=True, default=False, server_default="false")
    major_requirements = Column(JSONB, nullable=True)

    # v2 additions — REQ-058
    name_zh = Column(
        String(255), nullable=True,
        comment="Chinese name of the school",
    )
    type = Column(
        String(30), nullable=True,
        server_default="'UNIVERSITY'",
        comment="Enum: UNIVERSITY | POLYTECHNIC | COMMUNITY_COLLEGE | VOCATIONAL",
    )
    website = Column(
        String(500), nullable=True,
        comment="School website URL",
    )
    description = Column(
        Text, nullable=True,
        comment="School description",
    )
    minimum_entry_score = Column(
        Integer, nullable=True,
        comment="HKDSE best-5 aggregate threshold for admission",
    )
    required_subjects = Column(
        JSONB, nullable=True,
        comment="Array: [{subject_code, min_grade}]",
    )
    language_requirements = Column(
        JSONB, nullable=True,
        comment="E.g. {ielts_minimum: 6.5}",
    )
    faculties = Column(
        JSONB, nullable=True,
        comment="Array of faculty name strings",
    )
    notable_programs = Column(
        JSONB, nullable=True,
        comment="Array of program description strings",
    )
    acceptance_rate = Column(
        Numeric(5, 4), nullable=True,
        comment="Admission acceptance rate 0.0000-1.0000",
    )
    average_admitted_score = Column(
        Numeric(5, 2), nullable=True,
        comment="JUPAS median admitted HKDSE aggregate score",
    )
    scholarship_available = Column(
        Boolean, nullable=True, default=False,
        server_default="false",
        comment="True if scholarship opportunities exist",
    )
    data_source = Column(
        Text, nullable=True,
        comment="Source URL or reference for school profile data",
    )
    data_last_updated = Column(
        Date, nullable=True,
        comment="Date the school profile data was last refreshed",
    )

    # Relationships
    recommendations = relationship(
        "Recommendation",
        back_populates="school",
        lazy="select",
        # No cascade: school deletion does not cascade to recommendations.
    )
    student_targets = relationship(
        "StudentSchoolTarget",
        back_populates="school",
        lazy="select",
        # No cascade: school deletion is RESTRICTED by FK on student_school_targets
    )

    def __repr__(self) -> str:
        return f"<School id={self.id!s} name={self.name!r}>"


# ---------------------------------------------------------------------------
# recommendations
# REQ-027, REQ-029
# ---------------------------------------------------------------------------


class Recommendation(Base):
    """
    A single matched school result for a student.

    At most 5 rows per student at any time (REQ-019).
    The POST recommendations endpoint deletes all existing rows for the
    student before inserting new ones.
    """

    __tablename__ = "recommendations"

    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "rank",
            name="uq_recommendations_student_rank",
        ),
        CheckConstraint(
            "score >= 0 AND score <= 100",
            name="ck_recommendations_score",
        ),
        CheckConstraint(
            "rank >= 1 AND rank <= 5",
            name="ck_recommendations_rank",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
        comment="Primary key",
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "students.id",
            ondelete="CASCADE",
            name="fk_recommendations_student_id",
        ),
        nullable=False,
        index=True,
        comment="FK to students.id, cascade delete",
    )
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "schools.id",
            name="fk_recommendations_school_id",
        ),
        nullable=False,
        comment="FK to schools.id — no cascade on school delete",
    )
    school_name = Column(
        String(255),
        nullable=False,
        comment="Denormalized copy of schools.name at generation time",
    )
    score = Column(
        Numeric(5, 2),
        nullable=False,
        comment="Computed match score 0-100 (NUMERIC 5,2); API layer converts to 0.0-1.0",
    )
    explanation = Column(
        Text,
        nullable=False,
        comment="Plain-text rationale generated by the matching engine",
    )
    gaps = Column(
        Text,
        nullable=False,
        comment="Plain-text student deficiency description generated by the matching engine",
    )
    rank = Column(
        Integer,
        nullable=False,
        comment="Ordinal rank within this student's set (1 = highest); constrained 1-5",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT; replaced on each generate run",
    )

    # Relationships
    student = relationship("Student", back_populates="recommendations")
    school = relationship("School", back_populates="recommendations")

    def __repr__(self) -> str:
        return (
            f"<Recommendation id={self.id!s} student_id={self.student_id!s} "
            f"school_name={self.school_name!r} rank={self.rank} score={self.score}>"
        )


# ---------------------------------------------------------------------------
# action_plans
# REQ-025 (student-owned output), REQ-027 (generated artifact)
# ---------------------------------------------------------------------------


class ActionPlan(Base):
    """
    Action plan generated for a student.

    Enforces one-plan-per-student via UNIQUE on student_id.
    Re-generating replaces the existing row (UPSERT).
    """

    __tablename__ = "action_plans"

    __table_args__ = (UniqueConstraint("student_id", name="uq_action_plans_student_id"),)

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
        comment="Primary key",
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "students.id",
            ondelete="CASCADE",
            name="fk_action_plans_student_id",
        ),
        nullable=False,
        comment="FK to students.id, cascade delete; UNIQUE enforces one plan per student",
    )
    academic_targets = Column(
        Text,
        nullable=False,
        comment="Plain-text academic improvement targets",
    )
    extracurricular_direction = Column(
        Text,
        nullable=False,
        comment="Plain-text suggested extracurricular focus",
    )
    preparation_steps = Column(
        Text,
        nullable=False,
        comment="Plain-text general preparation guidance",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at UPDATE (replace on re-generate)",
    )

    # Relationships
    student = relationship("Student", back_populates="action_plan")

    def __repr__(self) -> str:
        return f"<ActionPlan id={self.id!s} student_id={self.student_id!s}>"


# ---------------------------------------------------------------------------
# grade_systems
# REQ-053, REQ-061
# ---------------------------------------------------------------------------

class GradeSystem(Base):
    """
    Lookup table for the four supported grading frameworks.

    Seeded at migration time with HKDSE, A_LEVEL, IB, CUSTOM.
    All Subject rows reference exactly one GradeSystem.
    """

    __tablename__ = "grade_systems"
    __allow_unmapped__ = True

    __table_args__ = (
        UniqueConstraint("name", name="uq_grade_systems_name"),
        CheckConstraint(
            "name IN ('HKDSE', 'A_LEVEL', 'IB', 'CUSTOM')",
            name="ck_grade_systems_name",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key — UUID generated by the application",
    )
    name = Column(
        String(20),
        nullable=False,
        comment="Enum: HKDSE | A_LEVEL | IB | CUSTOM",
    )
    description = Column(
        Text,
        nullable=True,
        comment="Human-readable description of the grade system",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT; not modifiable",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    subjects: list[Subject] = relationship(
        "Subject",
        back_populates="grade_system",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<GradeSystem id={self.id!s} name={self.name!r}>"


# ---------------------------------------------------------------------------
# subjects
# REQ-054, REQ-061, REQ-062
# ---------------------------------------------------------------------------

class Subject(Base):
    """
    Subject catalog row for a given grade system.

    (grade_system_id, code) is unique.
    HKDSE compulsory subjects have is_compulsory=True.
    """

    __tablename__ = "subjects"
    __allow_unmapped__ = True

    __table_args__ = (
        UniqueConstraint(
            "grade_system_id", "code",
            name="uq_subjects_grade_system_code",
        ),
        CheckConstraint(
            "category IN ('CORE', 'ELECTIVE', 'OTHER_LANGUAGE', 'APPLIED_LEARNING')",
            name="ck_subjects_category",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key",
    )
    grade_system_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "grade_systems.id",
            ondelete="RESTRICT",
            name="fk_subjects_grade_system_id",
        ),
        nullable=False,
        index=True,
        comment="FK to grade_systems.id — RESTRICT on delete",
    )
    name = Column(
        String(255),
        nullable=False,
        comment="Display name e.g. 'English Language'",
    )
    code = Column(
        String(20),
        nullable=False,
        comment="Subject code e.g. 'ENGL'; unique within grade system",
    )
    category = Column(
        String(30),
        nullable=False,
        comment="Enum: CORE | ELECTIVE | OTHER_LANGUAGE | APPLIED_LEARNING",
    )
    is_compulsory = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="True for HKDSE compulsory subjects (CHLA, ENGL, MATH, CSD)",
    )
    hkdse_subject_code = Column(
        String(10),
        nullable=True,
        comment="Official HKDSE code from HKEAA; null for non-HKDSE subjects",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    grade_system: GradeSystem = relationship(
        "GradeSystem",
        back_populates="subjects",
    )
    student_grades: list[StudentSubjectGrade] = relationship(
        "StudentSubjectGrade",
        back_populates="subject",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<Subject id={self.id!s} code={self.code!r} "
            f"name={self.name!r} category={self.category!r}>"
        )


# ---------------------------------------------------------------------------
# student_subject_grades
# REQ-055, REQ-061, REQ-062
# ---------------------------------------------------------------------------

class StudentSubjectGrade(Base):
    """
    One row per student-subject-sitting combination.

    Multiple rows may exist for the same (student_id, subject_id) when the
    student has both MOCK and OFFICIAL sittings.

    predicted_grade is always null when sitting='OFFICIAL'; the backend
    service layer enforces this rule, not a DB constraint.
    """

    __tablename__ = "student_subject_grades"
    __allow_unmapped__ = True

    __table_args__ = (
        CheckConstraint(
            "sitting IN ('MOCK', 'TRIAL', 'OFFICIAL')",
            name="ck_ssg_sitting",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key",
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "students.id",
            ondelete="CASCADE",
            name="fk_ssg_student_id",
        ),
        nullable=False,
        index=True,
        comment="FK to students.id — cascade delete",
    )
    subject_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "subjects.id",
            ondelete="RESTRICT",
            name="fk_ssg_subject_id",
        ),
        nullable=False,
        comment="FK to subjects.id — RESTRICT on delete",
    )
    year_of_exam = Column(
        Integer,
        nullable=True,
        comment="Exam year e.g. 2025; null if not yet known",
    )
    sitting = Column(
        String(10),
        nullable=False,
        comment="Enum: MOCK | TRIAL | OFFICIAL",
    )
    raw_grade = Column(
        String(10),
        nullable=True,
        comment="Grade string e.g. '5**', '4', 'A', 'Attained'; null until result known",
    )
    predicted_grade = Column(
        String(10),
        nullable=True,
        comment="Computed by backend (REQ-066); always null when sitting='OFFICIAL'",
    )
    transcript_uploaded = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="True once a transcript file is associated with this grade",
    )
    transcript_file_path = Column(
        Text,
        nullable=True,
        comment="Internal storage path; not a public URL",
    )
    notes = Column(
        Text,
        nullable=True,
        comment="Free-text notes from counsellor",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    student: Student = relationship(
        "Student",
        back_populates="subject_grades",
    )
    subject: Subject = relationship(
        "Subject",
        back_populates="student_grades",
    )

    def __repr__(self) -> str:
        return (
            f"<StudentSubjectGrade id={self.id!s} "
            f"student_id={self.student_id!s} "
            f"subject_id={self.subject_id!s} "
            f"sitting={self.sitting!r} raw_grade={self.raw_grade!r}>"
        )


# ---------------------------------------------------------------------------
# transcripts
# REQ-056, REQ-061, REQ-062
# ---------------------------------------------------------------------------

class Transcript(Base):
    """
    One row per uploaded transcript file.

    parsed_data is populated by the async parsing task when
    processing_status transitions to 'DONE'. The parsed suggestions are
    NEVER automatically written to student_subject_grades (REQ-067).
    """

    __tablename__ = "transcripts"
    __allow_unmapped__ = True

    __table_args__ = (
        CheckConstraint(
            "processing_status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')",
            name="ck_transcripts_processing_status",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key",
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "students.id",
            ondelete="CASCADE",
            name="fk_transcripts_student_id",
        ),
        nullable=False,
        index=True,
        comment="FK to students.id — cascade delete",
    )
    file_path = Column(
        Text,
        nullable=False,
        comment="Path relative to UPLOAD_DIR; not a public URL",
    )
    uploaded_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT; represents when the user uploaded the file",
    )
    parsed_data = Column(
        JSON,
        nullable=True,
        comment=(
            "Populated when processing_status='DONE'. "
            "Structure: {suggested_grades: [{subject_name, raw_grade}], "
            "parser_confidence: float, raw_text_excerpt: string}"
        ),
    )
    processing_status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default="'PENDING'",
        comment="Enum: PENDING | PROCESSING | DONE | FAILED",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    student: Student = relationship(
        "Student",
        back_populates="transcripts",
    )

    def __repr__(self) -> str:
        return (
            f"<Transcript id={self.id!s} student_id={self.student_id!s} "
            f"processing_status={self.processing_status!r}>"
        )


# ---------------------------------------------------------------------------
# student_school_targets
# REQ-059, REQ-061, REQ-062
# ---------------------------------------------------------------------------

class StudentSchoolTarget(Base):
    """
    One row per student-school pairing in the student's target list.

    UPSERT pattern: the match engine updates match_score, eligibility_pass,
    and shap_explanation in-place on each run.

    Unique constraints:
    - (student_id, school_id): no duplicate school in a student's target list
    - (student_id, student_rank): preference rank is unique per student
    """

    __tablename__ = "student_school_targets"
    __allow_unmapped__ = True

    __table_args__ = (
        UniqueConstraint(
            "student_id", "school_id",
            name="uq_sst_student_school",
        ),
        CheckConstraint(
            "status IN ('CONSIDERING', 'APPLIED', 'ADMITTED', 'REJECTED', 'WITHDRAWN')",
            name="ck_sst_status",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key",
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "students.id",
            ondelete="CASCADE",
            name="fk_sst_student_id",
        ),
        nullable=False,
        index=True,
        comment="FK to students.id — cascade delete",
    )
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "schools.id",
            ondelete="RESTRICT",
            name="fk_sst_school_id",
        ),
        nullable=False,
        comment="FK to schools.id — RESTRICT on delete",
    )
    student_rank = Column(
        Integer,
        nullable=True,
        comment="Student preference order (1 = most preferred); unique per student",
    )
    match_score = Column(
        Numeric(5, 4),
        nullable=True,
        comment="Combined fit score 0.0000-1.0000; null before first match run",
    )
    eligibility_pass = Column(
        Boolean,
        nullable=True,
        comment="null before first match run; true/false after eligibility filter",
    )
    shap_explanation = Column(
        JSON,
        nullable=True,
        comment=(
            "Top-3 SHAP features for this student-school pair. "
            "Structure: {top_features: [{feature, value, direction, plain_text}]}"
        ),
    )
    status = Column(
        String(20),
        nullable=False,
        default="CONSIDERING",
        server_default="'CONSIDERING'",
        comment="Enum: CONSIDERING | APPLIED | ADMITTED | REJECTED | WITHDRAWN",
    )
    # Added via ALTER TABLE
    intended_majors = Column(JSON, nullable=True)
    year_of_entry = Column(Integer, nullable=True)
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    student: Student = relationship(
        "Student",
        back_populates="school_targets",
    )
    school: School = relationship(
        "School",
        back_populates="student_targets",
    )

    def __repr__(self) -> str:
        return (
            f"<StudentSchoolTarget id={self.id!s} "
            f"student_id={self.student_id!s} "
            f"school_id={self.school_id!s} "
            f"status={self.status!r} match_score={self.match_score}>"
        )


# ---------------------------------------------------------------------------
# academic_plans (v2 — replaces/extends action_plans)
# REQ-060, REQ-061, REQ-077
# ---------------------------------------------------------------------------

class AcademicPlan(Base):
    """
    Full academic plan document for a student.

    One plan per student (unique on student_id).
    html_content stores the full rendered HTML document.
    version is incremented each time the plan is regenerated.
    """

    __tablename__ = "academic_plans"
    __allow_unmapped__ = True

    __table_args__ = (
        UniqueConstraint("student_id", name="uq_academic_plans_student_id"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key",
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "students.id",
            ondelete="CASCADE",
            name="fk_academic_plans_student_id",
        ),
        nullable=False,
        comment="FK to students.id — cascade delete; UNIQUE enforces one plan per student",
    )
    generated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="Set when generation completes; null until complete",
    )
    version = Column(
        Integer,
        nullable=False,
        default=1,
        server_default="1",
        comment="Starts at 1; incremented on each regeneration",
    )
    recommended_schools = Column(
        JSON,
        nullable=True,
        comment="Ordered list: [{school_id, school_name, rationale}]",
    )
    action_items = Column(
        JSON,
        nullable=True,
        comment="Array: [{task, deadline, related_school_id, priority}]",
    )
    html_content = Column(
        Text,
        nullable=True,
        comment="Full rendered HTML document; null until generation completes",
    )
    template_id = Column(
        String(50),
        nullable=True,
        default="professional",
        server_default="professional",
        comment="Template name used for the last render: professional | modern | minimal",
    )
    overrides = Column(
        JSON,
        nullable=True,
        default=dict,
        comment="Per-section HTML overrides keyed by section_key",
    )
    chat_request_counts = Column(
        JSON,
        nullable=True,
        default=dict,
        comment="Rate-limit counters: {date_counsellor_planid: count}",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    student: Student = relationship(
        "Student",
        back_populates="academic_plan",
    )

    def __repr__(self) -> str:
        return (
            f"<AcademicPlan id={self.id!s} "
            f"student_id={self.student_id!s} "
            f"version={self.version}>"
        )


# ---------------------------------------------------------------------------
# plan_generation_jobs
# REQ-049, REQ-061, REQ-078
# ---------------------------------------------------------------------------

class PlanGenerationJob(Base):
    """
    Async job tracking for the plan generation pipeline.

    One row is created per POST /students/{id}/plan request.
    The row id is returned as job_id in the 202 Accepted response.
    The frontend polls GET /plan/status until status='DONE'.

    Jobs are never deleted; they form an audit trail.
    """

    __tablename__ = "plan_generation_jobs"
    __allow_unmapped__ = True

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')",
            name="ck_pgj_status",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key; used as job_id in API 202 response",
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "students.id",
            ondelete="CASCADE",
            name="fk_pgj_student_id",
        ),
        nullable=False,
        index=True,
        comment="FK to students.id — cascade delete",
    )
    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default="'PENDING'",
        comment="Enum: PENDING | RUNNING | DONE | FAILED",
    )
    error_message = Column(
        Text,
        nullable=True,
        comment="Populated when status='FAILED'; null otherwise",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT; represents job submission time",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    student: Student = relationship(
        "Student",
        back_populates="plan_jobs",
    )

    def __repr__(self) -> str:
        return (
            f"<PlanGenerationJob id={self.id!s} "
            f"student_id={self.student_id!s} "
            f"status={self.status!r}>"
        )


# ---------------------------------------------------------------------------
# student_cohorts
# REQ-093 (cohort management)
# ---------------------------------------------------------------------------

class StudentCohort(Base):
    """
    A named group of students, owned by a counsellor.

    Cohorts allow bulk analysis: filter students by class/year/subject/grade
    and compute aggregate statistics across the group.
    """

    __tablename__ = "student_cohorts"
    __allow_unmapped__ = True

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
        comment="Primary key",
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE", name="fk_cohorts_user_id"),
        nullable=False,
        index=True,
        comment="Owning counsellor — FK to users.id",
    )
    name = Column(
        String(255),
        nullable=False,
        comment="Display name for the cohort, e.g. '5A 2025'",
    )
    description = Column(
        Text,
        nullable=True,
        comment="Optional free-text description",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
    )

    # Relationships
    memberships: list["CohortMembership"] = relationship(
        "CohortMembership",
        back_populates="cohort",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<StudentCohort id={self.id!s} name={self.name!r}>"


# ---------------------------------------------------------------------------
# cohort_memberships
# ---------------------------------------------------------------------------

class CohortMembership(Base):
    """Join table linking students to cohorts."""

    __tablename__ = "cohort_memberships"
    __allow_unmapped__ = True

    __table_args__ = (
        UniqueConstraint("cohort_id", "student_id", name="uq_cohort_membership"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    cohort_id = Column(
        UUID(as_uuid=True),
        ForeignKey("student_cohorts.id", ondelete="CASCADE", name="fk_cm_cohort_id"),
        nullable=False,
        index=True,
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE", name="fk_cm_student_id"),
        nullable=False,
        index=True,
    )
    added_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )

    # Relationships
    cohort: StudentCohort = relationship("StudentCohort", back_populates="memberships")
    student: Student = relationship("Student")

    def __repr__(self) -> str:
        return f"<CohortMembership cohort={self.cohort_id!s} student={self.student_id!s}>"


# ---------------------------------------------------------------------------
# plan_history
# ---------------------------------------------------------------------------

class PlanHistory(Base):
    """Historical plan snapshots — one row per generated plan."""

    __tablename__ = "plan_history"
    __allow_unmapped__ = True

    id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False,
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE", name="fk_ph_student_id"),
        nullable=False, index=True,
    )
    version = Column(Integer, nullable=False, default=1)
    plan_label = Column(String(255), nullable=True, comment="Auto-label e.g. 'Plan v3 — 2026-03-28'")
    html_content = Column(Text, nullable=True)
    recommended_schools = Column(JSON, nullable=True)
    action_items = Column(JSON, nullable=True)
    snapshot_data = Column(JSON, nullable=True, comment="Grade/target snapshot at generation time")
    generated_at = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow,
    )

    student: Student = relationship("Student")

    def __repr__(self) -> str:
        return f"<PlanHistory id={self.id!s} student_id={self.student_id!s} version={self.version}>"
