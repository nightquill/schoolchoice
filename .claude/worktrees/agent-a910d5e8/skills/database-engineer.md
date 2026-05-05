# Skills — Database Engineer
# Intelligent Academic Advisor
# Document Owner: Database Engineer
# Created: 2026-03-27
# Protocol: Never delete — only append. Written for reuse across future projects.

---

## 1. Additive Migration Pattern

### Core Principle

Every migration that touches a live system must be additive-only for zero-downtime deployment.

**Rules applied in this project:**

- **Never drop or rename a v1 column** without a PM ruling and a separate migration.
  Dropping a column breaks any in-flight queries issued by the running v1 backend before
  the backend is also deployed.
- **All new columns on existing tables must be either nullable or carry a DEFAULT**.
  Adding `NOT NULL` without a DEFAULT requires a full table rewrite (PostgreSQL rewrites
  the heap to populate the new column). For large tables this takes minutes and locks writes.
  - If a NOT NULL column is genuinely required, add it as nullable in migration N,
    backfill it in migration N+1, then add the NOT NULL constraint in migration N+2.
- **Use `IF NOT EXISTS` / `IF EXISTS`** on all DDL statements so the migration is
  idempotent and safe to re-run after a partial failure.
- **CREATE TABLE before ALTER TABLE** when the new table is referenced by an FK in the
  same migration. Create tables in FK-safe order (parent before child).

### When to ADD a new table vs ALTER an existing table

| Situation | Decision |
|-----------|----------|
| New entity with its own lifecycle | New table |
| New attributes of an existing entity, all nullable | ALTER TABLE ADD COLUMN |
| New attributes that require constraints tighter than the existing table allows | New table or new column — prefer column if the entity is the same |
| Large JSONB payload that is read-once and never queried by field | Single JSON column on the parent table |
| Relationship that is many-to-many | Junction table |

**v2 example:** `student_subject_grades` is a new table (not columns on students)
because a student can have multiple grades per subject (different sittings), which
cannot be modelled as a flat column.

**v2 example:** `ielts_score` is a single JSON column on `students` (not five float
columns) because the sub-scores are always read together and never individually filtered.

---

## 2. JSON vs JSONB — Test Compatibility Lesson

### The Problem

SQLAlchemy's `JSONB` type maps to `sqlalchemy.dialects.postgresql.JSONB`. In tests
that run against a SQLite in-memory database (not PostgreSQL), this raises a dialect
error:

```
sqlalchemy.exc.CompileError: Can't render element of type <class 'sqlalchemy.dialects.postgresql.json.JSONB'>
```

SQLite does not have a JSONB type. JSONB is a PostgreSQL-specific storage format.

### The Solution

Use `sqlalchemy.types.JSON` (the generic, dialect-agnostic type) for columns that:

1. Do not require GIN indexing in the query patterns for the current release.
2. Are read as whole objects, not queried by field path (e.g. no
   `WHERE parsed_data->>'field' = ?`).

`sqlalchemy.types.JSON` maps to:
- PostgreSQL: native `JSON` type (functionally equivalent to JSONB for INSERT/SELECT;
  lacks binary storage optimisation and GIN indexability)
- SQLite: `TEXT` (JSON is stored as a string; Python serialises/deserialises automatically)
- MySQL/MariaDB: native `JSON` type

### When to keep JSONB

The v1 `grades`, `interests`, `min_academic_requirements`, `key_strengths` columns
use `sqlalchemy.dialects.postgresql.JSONB` and are correct for their query patterns.
Do not change them. Only new columns added in v2 use `JSON`.

### Decision Matrix

| Column use case | Type to use |
|-----------------|-------------|
| Queried by field path (WHERE col->>'key' = ?) | JSONB |
| GIN-indexed for containment queries (@>, <@) | JSONB |
| Read as whole object only, no field-path queries | JSON |
| Must work in SQLite-backed unit tests | JSON |
| Large blob stored and retrieved as-is | JSON |

---

## 3. HKDSE Domain Knowledge for Schema Design

### 3.1 Grade Scale

| Grade | Numeric Equivalent | Notes |
|-------|--------------------|-------|
| 5**   | 7 | Distinction — top ~1% |
| 5*    | 6 | Distinction |
| 5     | 5 | |
| 4     | 4 | |
| 3     | 3 | |
| 2     | 2 | |
| 1     | 1 | |
| U     | 0 | Unclassified (failed) |
| X     | — | Absent (not graded) |

Grades are stored as `VARCHAR(10)` (raw string like `'5**'` or `'4'`), not integers.
Numeric conversion happens in the backend service layer for score calculations.

### 3.2 Sitting Types

| Code | Meaning | predicted_grade behaviour |
|------|---------|--------------------------|
| MOCK | School-conducted mock exam | Computed — used as predictor |
| TRIAL | Trial exam (school-internal) | Computed — used as predictor |
| OFFICIAL | HKEAA official HKDSE exam | Always null; official result is final |

A student may have multiple rows in `student_subject_grades` for the same subject —
one MOCK, one TRIAL, and one OFFICIAL. The backend reads all rows to compute the
predicted grade.

### 3.3 Subject Categories

| Category | Description | Examples |
|----------|-------------|---------|
| CORE | Compulsory for all candidates | CHLA, ENGL, MATH, CSD |
| ELECTIVE | Optional; student chooses 2–3 | BIOL, CHEM, PHYS, ECON, HIST |
| OTHER_LANGUAGE | Second language electives | FREN, GERM, JAPA, SPAN, PTH |
| APPLIED_LEARNING | Vocational/applied subjects | Graded Attained / Attained with Distinction |

### 3.4 Aggregate Score (Best-5)

The HKDSE entry score used by JUPAS is the **best-5 aggregate**:
- Must include Chinese Language + English Language (both compulsory)
- Plus the best 3 remaining subjects
- Numeric equivalent sum, maximum 35 (7×5)
- Eligibility filter in the matchmaking engine uses `minimum_entry_score` on the
  `schools` table as the threshold

### 3.5 Candidate Number

HKDSE candidates are issued a unique candidate number by HKEAA. Stored as
`VARCHAR(50)` (not integer) to accommodate leading zeros and future format changes.
Treated as PII — stored in the `candidate_number` column on `students`.

### 3.6 Applied Learning (ApL)

ApL subjects are graded differently:
- Not on the 1–5** scale
- Grades: `'Attained'` or `'Attained with Distinction'`
- Stored in `student_subject_grades.raw_grade` as the string value
- Schema accommodates this: `raw_grade VARCHAR(10)` is flexible enough for `'Attained'`
  (9 chars) and the backend converts to numeric only for non-ApL subjects

---

## 4. SQLAlchemy Relationship Patterns

### 4.1 back_populates vs backref

Use `back_populates` (explicit bidirectional declaration) in preference to `backref`
(implicit). `back_populates` requires both sides to be declared but is easier to
trace in code review and is not deprecated.

```python
# Correct — explicit back_populates
class GradeSystem(Base):
    subjects = relationship("Subject", back_populates="grade_system")

class Subject(Base):
    grade_system = relationship("GradeSystem", back_populates="subjects")
```

### 4.2 uselist=False for one-to-one relationships

When a student has exactly one action plan:

```python
class Student(Base):
    action_plan = relationship(
        "ActionPlan",
        back_populates="student",
        uselist=False,  # returns a single object or None, not a list
    )
```

### 4.3 cascade="all, delete-orphan"

Apply to relationships where the child entity has no meaning without the parent:

- `Student.subject_grades` — grades belong to a student
- `Student.transcripts` — transcripts belong to a student
- `Student.school_targets` — target list belongs to a student
- `Student.plan_jobs` — jobs belong to a student

Do NOT apply cascade to reference-data relationships (subjects, schools). These use
`ON DELETE RESTRICT` at the FK level, which raises an error if deletion is attempted
while dependents exist. This is intentional — it forces the caller to explicitly
handle the dependent rows first.

### 4.4 lazy="select" (default)

All relationships in this project use `lazy="select"` (the default). This means
related objects are fetched in a separate SELECT when first accessed. For the
async FastAPI + SQLAlchemy pattern, use `selectinload()` or `joinedload()` in
the query explicitly rather than relying on lazy loading — lazy loading triggers
a synchronous DB call from async context, which is a bug.

Pattern for async routes:
```python
from sqlalchemy.orm import selectinload

result = await session.execute(
    select(Student)
    .options(selectinload(Student.subject_grades))
    .where(Student.id == student_id)
)
student = result.scalar_one_or_none()
```

### 4.5 Relationship targets across modules

When v2 models (in `orm_models_v2.py`) declare `back_populates` targets on v1 models
(in `orm_models.py`), the v1 model must also declare the relationship. The v2 module
imports from the v1 module and adds to the same shared `Base.metadata`. SQLAlchemy
resolves string references (`"Student"`, `"Subject"`) at mapper configuration time
(when the first query or `configure_mappers()` is called). Both modules must be
imported before any query runs.

Safe import pattern in `app/db/__init__.py`:
```python
from app.db.models import *       # v1 — defines Base, User, Student, etc.
from app.db.models_v2 import *    # v2 — extends Base metadata
```

### 4.6 UNIQUE constraint on nullable FK column (student_rank)

`student_rank` is nullable (not all target entries have been ranked yet). A
`UNIQUE(student_id, student_rank)` constraint treats two NULLs as distinct in
PostgreSQL (NULLs are never equal). This means multiple target entries with
`student_rank = NULL` do not conflict. The application must enforce rank uniqueness
in its own service logic when student_rank is set.

---

## 5. Migration Sequencing for FK-Safe Table Creation

When creating multiple tables with FK relationships in a single migration, always
create parent tables before child tables:

```
grade_systems          (no FKs)
  → subjects           (FK → grade_systems)
      → student_subject_grades  (FK → students, subjects)

students [v1]
  → transcripts        (FK → students)
  → student_school_targets (FK → students, schools)
  → plan_generation_jobs   (FK → students)
```

Down migrations reverse this: drop child tables before parent tables.

---

## 6. CHECK Constraint Style Decision

This project uses `VARCHAR + CHECK IN (...)` for enum-like columns rather than
PostgreSQL ENUM types. Rationale:

- PostgreSQL ENUM types require `ALTER TYPE ... ADD VALUE` to extend — this is a
  DDL statement that requires a lock and cannot be done inside a transaction in
  older PostgreSQL versions.
- VARCHAR + CHECK can be modified via `ALTER TABLE ... DROP CONSTRAINT` +
  `ALTER TABLE ... ADD CONSTRAINT` inside a normal Alembic migration.
- VARCHAR + CHECK is compatible with SQLite for unit tests.
- The set of values for all v2 enums is expected to remain stable.

Trade-off: PostgreSQL ENUM types provide stronger type safety at the driver level
and marginally better storage efficiency. For this application, developer ergonomics
and test compatibility outweigh those benefits.

---

## 7. Seed Data Pattern

The seed data file (`seed_data_v2.sql`) uses a `SELECT ... FROM ... CROSS JOIN ... VALUES`
pattern to avoid hardcoding the `grade_system_id` UUID:

```sql
INSERT INTO subjects (id, grade_system_id, ...)
SELECT gen_random_uuid(), gs.id, s.name, ...
FROM grade_systems gs
CROSS JOIN (VALUES (...)) AS s(name, ...)
WHERE gs.name = 'HKDSE'
ON CONFLICT (grade_system_id, code) DO NOTHING;
```

This is robust against the grade_systems UUID changing between environments
(dev, staging, prod all generate different UUIDs at migration time).
`ON CONFLICT DO NOTHING` makes the seed idempotent.
