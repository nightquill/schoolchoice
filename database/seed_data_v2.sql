-- seed_data_v2.sql
-- Intelligent Academic Advisor — v2 Seed Data
-- Document Owner: Database Engineer
-- Date: 2026-03-27
--
-- Dev/test only — real data populated by Data Agent
--
-- Prerequisites:
--   - Migration 0002_v2_schema must have been applied (grade_systems and
--     subjects tables must exist).
--   - pgcrypto extension must be enabled: CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- Safe to run multiple times: all inserts use ON CONFLICT DO NOTHING.
-- Apply with: psql $DATABASE_URL -f database/seed_data_v2.sql

-- ---------------------------------------------------------------------------
-- 1. grade_systems — 4 rows
-- ---------------------------------------------------------------------------

INSERT INTO grade_systems (id, name, description, created_at, updated_at)
VALUES
    (
        gen_random_uuid(),
        'HKDSE',
        'Hong Kong Diploma of Secondary Education — the primary exam system '
        'for local Hong Kong secondary school students. Grades: 5**, 5*, 5, 4, 3, 2, 1, U, X. '
        'Numeric equivalents: 5**=7, 5*=6, 5=5, 4=4, 3=3, 2=2, 1=1, U=0.',
        now(),
        now()
    ),
    (
        gen_random_uuid(),
        'A_LEVEL',
        'GCE Advanced Level — used by students in the UK system or '
        'international schools offering British curriculum. '
        'Structurally present; not fully implemented in v2 MVP.',
        now(),
        now()
    ),
    (
        gen_random_uuid(),
        'IB',
        'International Baccalaureate Diploma Programme — '
        'scored 1–7 per subject. Structurally present; not fully implemented in v2 MVP.',
        now(),
        now()
    ),
    (
        gen_random_uuid(),
        'CUSTOM',
        'Custom grade system for schools or programs that do not follow '
        'a standard grading framework. Grade definitions are free-form.',
        now(),
        now()
    )
ON CONFLICT (name) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 2. subjects — HKDSE compulsory (4 rows)
--
-- All four HKDSE compulsory subjects that every candidate must sit:
--   Chinese Language (CHLA)
--   English Language (ENGL)
--   Mathematics — Compulsory Part (MATH)
--   Citizenship and Social Development / Liberal Studies (CSD)
--
-- is_compulsory = true for all four.
-- category = 'CORE' for all four.
-- ---------------------------------------------------------------------------

INSERT INTO subjects (
    id,
    grade_system_id,
    name,
    code,
    category,
    is_compulsory,
    hkdse_subject_code,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    gs.id,
    s.name,
    s.code,
    s.category,
    s.is_compulsory,
    s.hkdse_subject_code,
    now(),
    now()
FROM grade_systems gs
CROSS JOIN (
    VALUES
        ('Chinese Language',                            'CHLA', 'CORE', true,  '01'),
        ('English Language',                            'ENGL', 'CORE', true,  '02'),
        ('Mathematics (Compulsory Part)',               'MATH', 'CORE', true,  '06'),
        ('Citizenship and Social Development',          'CSD',  'CORE', true,  '07')
) AS s(name, code, category, is_compulsory, hkdse_subject_code)
WHERE gs.name = 'HKDSE'
ON CONFLICT (grade_system_id, code) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 3. subjects — HKDSE representative electives (5 rows)
--
-- Five commonly chosen elective subjects representing the main subject areas:
--   Biology (BIOL)  — STEM
--   Chemistry (CHEM) — STEM
--   Physics (PHYS)  — STEM
--   Economics (ECON) — Business & Economics
--   History (HIST)  — Arts & Humanities
--
-- is_compulsory = false for all electives.
-- ---------------------------------------------------------------------------

INSERT INTO subjects (
    id,
    grade_system_id,
    name,
    code,
    category,
    is_compulsory,
    hkdse_subject_code,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    gs.id,
    s.name,
    s.code,
    s.category,
    s.is_compulsory,
    s.hkdse_subject_code,
    now(),
    now()
FROM grade_systems gs
CROSS JOIN (
    VALUES
        ('Biology',    'BIOL', 'ELECTIVE', false, '09'),
        ('Chemistry',  'CHEM', 'ELECTIVE', false, '10'),
        ('Physics',    'PHYS', 'ELECTIVE', false, '11'),
        ('Economics',  'ECON', 'ELECTIVE', false, '20'),
        ('History',    'HIST', 'ELECTIVE', false, '22')
) AS s(name, code, category, is_compulsory, hkdse_subject_code)
WHERE gs.name = 'HKDSE'
ON CONFLICT (grade_system_id, code) DO NOTHING;


-- ---------------------------------------------------------------------------
-- End of seed_data_v2.sql
-- Dev/test only — real data populated by Data Agent
-- ---------------------------------------------------------------------------
