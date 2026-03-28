# PM → Database Engineer — v2 Requirements Packet
# Intelligent Academic Advisor — v2 Pipeline
# Date: 2026-03-27
# Note: REQ-001–REQ-042 are DONE. This packet covers NEW requirements only.

---

## Context

v1 delivered: Users, Students (basic fields), Schools (basic fields), Recommendations, ActionPlan tables. These exist and must not be dropped or broken. Your task is to author migrations extending the schema and adding new tables. All migrations must be backward-compatible with the running v1 system.

---

## Owned Requirements (v2)

### REQ-053 [DATABASE] — GradeSystem Table
Create table `grade_systems`: id (UUID PK), name (enum/varchar: HKDSE, A_LEVEL, IB, CUSTOM), description (text nullable), created_at, updated_at.

### REQ-054 [DATABASE] — Subject Table
Create table `subjects`: id (UUID PK), grade_system_id (FK → grade_systems), name (varchar), code (varchar), category (enum: CORE, ELECTIVE, OTHER_LANGUAGE, APPLIED_LEARNING), is_compulsory (boolean default false), hkdse_subject_code (varchar nullable), created_at, updated_at.

### REQ-055 [DATABASE] — StudentSubjectGrade Table
Create table `student_subject_grades`: id (UUID PK), student_id (FK → students), subject_id (FK → subjects), year_of_exam (integer nullable), sitting (enum: MOCK, TRIAL, OFFICIAL), raw_grade (varchar), predicted_grade (varchar nullable), transcript_uploaded (boolean default false), transcript_file_path (varchar nullable), notes (text nullable), created_at, updated_at.

### REQ-056 [DATABASE] — Transcript Table
Create table `transcripts`: id (UUID PK), student_id (FK → students), file_path (varchar), uploaded_at (timestamptz), parsed_data (JSONB nullable), created_at, updated_at.

### REQ-057 [DATABASE] — Student Table Expansion
Add the following nullable columns to the existing `students` table via migration:
- date_of_birth (date)
- gender (varchar)
- address (text)
- phone (varchar)
- email (varchar)
- preferred_name (varchar)
- class_name (varchar)
- year_of_study (integer)
- candidate_number (varchar — HKDSE candidate number)
- preferred_language (varchar)
- ielts_score (float)
- ielts_date (date)
- other_language_scores (JSONB)
- teacher_evaluation (JSONB)
- extra_curricular (JSONB)
- awards (JSONB)
- financial_aid_flag (boolean default false)
Do not remove existing fields (name, grades, interests, target_region, notes).

### REQ-058 [DATABASE] — School Table Expansion
Add the following nullable columns to the existing `schools` table via migration:
- name_zh (varchar — Chinese name)
- type (varchar — enum: UNIVERSITY, POLYTECHNIC, COMMUNITY_COLLEGE, VOCATIONAL)
- website (varchar)
- description (text)
- minimum_entry_score (integer)
- required_subjects (JSONB)
- language_requirements (JSONB)
- faculties (JSONB)
- notable_programs (JSONB)
- acceptance_rate (float)
- average_admitted_score (float)
- scholarship_available (boolean default false)
- data_source (varchar)
- data_last_updated (date)
Do not remove existing fields (name, location, min_grade_requirements, strengths, notes).

### REQ-059 [DATABASE] — StudentSchoolTarget Table
Create table `student_school_targets`: id (UUID PK), student_id (FK → students), school_id (FK → schools), student_rank (integer nullable), match_score (float nullable), eligibility_pass (boolean nullable), shap_explanation (JSONB nullable), status (varchar enum: CONSIDERING, APPLIED, ADMITTED, REJECTED, WITHDRAWN default CONSIDERING), created_at, updated_at.

### REQ-060 [DATABASE] — AcademicPlan Table Expansion
Add the following columns to the existing `action_plans` / `academic_plans` table (whichever name v1 used):
- recommended_schools (JSONB nullable)
- action_items (JSONB nullable)
- html_content (text nullable)
- version (integer default 1)
Ensure created_at and updated_at are present; add if missing.

### REQ-061 [DATABASE] — Schema Rules Enforcement
- Confirm all new and existing mutable tables have created_at and updated_at (add via migration if missing).
- All new PKs must be UUID.
- JSONB must be used for all variable-structure columns.
- No field may be removed without a PM ruling and a corresponding migration.

### REQ-062 [DATABASE] — Relationship Enforcement
Ensure all FK constraints are created with ON DELETE CASCADE or ON DELETE SET NULL as appropriate:
- student_subject_grades.student_id → students(id) ON DELETE CASCADE
- student_subject_grades.subject_id → subjects(id) ON DELETE RESTRICT
- transcripts.student_id → students(id) ON DELETE CASCADE
- student_school_targets.student_id → students(id) ON DELETE CASCADE
- student_school_targets.school_id → schools(id) ON DELETE RESTRICT
- academic_plans.student_id → students(id) ON DELETE CASCADE
- subjects.grade_system_id → grade_systems(id) ON DELETE RESTRICT

---

## Migration Guidelines

- All changes must be Alembic migrations (one migration per logical change group).
- Migrations must be reversible (include downgrade logic).
- All new enum types must be created as PostgreSQL ENUM types or CHECK constraints — document your choice.
- Indexes: add index on student_subject_grades(student_id), student_school_targets(student_id), transcripts(student_id).

---

## Deliverables

- `database/schema_spec_v2.md` — updated schema spec covering all new/modified tables
- `database/orm_models_v2.py` — SQLAlchemy model additions/extensions
- `database/migrations/` — Alembic migration files for all v2 schema changes
- `skills/database-engineer.md` — skills file (create or append)

---
*Packet owner: Database Engineer. All items PENDING.*
