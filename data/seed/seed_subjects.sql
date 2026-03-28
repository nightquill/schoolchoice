-- =============================================================================
-- Seed: Grade Systems and HKDSE Subjects
-- Source: training_knowledge (estimated from HKEAA published statistics)
-- Generated: 2026-03-28
-- WARNING: All grade distributions are approximations based on published HKEAA
--          data. Verify against official HKEAA publications before production use.
-- =============================================================================

-- Step 1: Insert the HKDSE grade system row
INSERT INTO grade_systems (id, name, description, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'HKDSE',
  'Hong Kong Diploma of Secondary Education. Grades: 5**=7, 5*=6, 5=5, 4=4, 3=3, 2=2, 1=1, U=0. Applied Learning grades: Attained / Attained with Distinction.',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Step 2: Insert all HKDSE subjects
-- Fixed UUIDs for deterministic re-seeding; all reference the HKDSE grade system.
-- Columns: id, grade_system_id, name, code, category, is_compulsory,
--          hkdse_subject_code, created_at, updated_at
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CORE (Compulsory) subjects
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Chinese Language',
    'CHLA',
    'CORE',
    TRUE,
    'CHLA',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'English Language',
    'ENGL',
    'CORE',
    TRUE,
    'ENGL',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Mathematics (Compulsory Part)',
    'MATH',
    'CORE',
    TRUE,
    'MATH',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Citizenship and Social Development',
    'CSD',
    'CORE',
    TRUE,
    'CSD',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ELECTIVE subjects — Mathematics Extended Modules
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Mathematics Extended Module 1 (Calculus and Statistics)',
    'M1',
    'ELECTIVE',
    FALSE,
    'M1',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Mathematics Extended Module 2 (Algebra and Calculus)',
    'M2',
    'ELECTIVE',
    FALSE,
    'M2',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ELECTIVE subjects — Sciences
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'Physics',
    'PHYS',
    'ELECTIVE',
    FALSE,
    'PHYS',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000001',
    'Chemistry',
    'CHEM',
    'ELECTIVE',
    FALSE,
    'CHEM',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000009',
    '00000000-0000-0000-0000-000000000001',
    'Biology',
    'BIOL',
    'ELECTIVE',
    FALSE,
    'BIOL',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'Combined Science',
    'CSCI',
    'ELECTIVE',
    FALSE,
    'CSCI',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    'Integrated Science',
    'ISCI',
    'ELECTIVE',
    FALSE,
    'ISCI',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ELECTIVE subjects — Business & Economics
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    'Economics',
    'ECON',
    'ELECTIVE',
    FALSE,
    'ECON',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    'Business, Accounting and Financial Studies',
    'BAFS',
    'ELECTIVE',
    FALSE,
    'BAFS',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ELECTIVE subjects — Technology & ICT
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000001',
    'Information and Communication Technology',
    'ICT',
    'ELECTIVE',
    FALSE,
    'ICT',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000015',
    '00000000-0000-0000-0000-000000000001',
    'Design and Applied Technology',
    'DAT',
    'ELECTIVE',
    FALSE,
    'DAT',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000016',
    '00000000-0000-0000-0000-000000000001',
    'Technology and Living',
    'TL',
    'ELECTIVE',
    FALSE,
    'TL',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ELECTIVE subjects — Humanities & Social Sciences
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000017',
    '00000000-0000-0000-0000-000000000001',
    'History',
    'HIST',
    'ELECTIVE',
    FALSE,
    'HIST',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000018',
    '00000000-0000-0000-0000-000000000001',
    'Chinese History',
    'CHIH',
    'ELECTIVE',
    FALSE,
    'CHIH',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000019',
    '00000000-0000-0000-0000-000000000001',
    'Geography',
    'GEOG',
    'ELECTIVE',
    FALSE,
    'GEOG',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000001',
    'Ethics and Religious Studies',
    'ERS',
    'ELECTIVE',
    FALSE,
    'ERS',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000001',
    'Tourism and Hospitality Studies',
    'TOUR',
    'ELECTIVE',
    FALSE,
    'TOUR',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000001',
    'Health Management and Social Care',
    'HMSC',
    'ELECTIVE',
    FALSE,
    'HMSC',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- ELECTIVE subjects — Arts
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000001',
    'Chinese Literature',
    'CHIL',
    'ELECTIVE',
    FALSE,
    'CHIL',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000024',
    '00000000-0000-0000-0000-000000000001',
    'English Literature',
    'ENLIT',
    'ELECTIVE',
    FALSE,
    'ENLIT',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000025',
    '00000000-0000-0000-0000-000000000001',
    'Visual Arts',
    'VART',
    'ELECTIVE',
    FALSE,
    'VART',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000026',
    '00000000-0000-0000-0000-000000000001',
    'Music',
    'MUSC',
    'ELECTIVE',
    FALSE,
    'MUSC',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000027',
    '00000000-0000-0000-0000-000000000001',
    'Physical Education',
    'PE',
    'ELECTIVE',
    FALSE,
    'PE',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- OTHER_LANGUAGE subjects
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000028',
    '00000000-0000-0000-0000-000000000001',
    'French',
    'FREN',
    'OTHER_LANGUAGE',
    FALSE,
    'FREN',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000029',
    '00000000-0000-0000-0000-000000000001',
    'German',
    'GERM',
    'OTHER_LANGUAGE',
    FALSE,
    'GERM',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000030',
    '00000000-0000-0000-0000-000000000001',
    'Japanese',
    'JAPA',
    'OTHER_LANGUAGE',
    FALSE,
    'JAPA',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000001',
    'Spanish',
    'SPAN',
    'OTHER_LANGUAGE',
    FALSE,
    'SPAN',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000001',
    'Putonghua',
    'PTH',
    'OTHER_LANGUAGE',
    FALSE,
    'PTH',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- APPLIED_LEARNING subjects
-- ApL uses Attained / Attained with Distinction — no numeric grade distribution.
-- ---------------------------------------------------------------------------
INSERT INTO subjects (id, grade_system_id, name, code, category, is_compulsory, hkdse_subject_code, created_at, updated_at)
VALUES
  (
    '10000000-0000-0000-0000-000000000033',
    '00000000-0000-0000-0000-000000000001',
    'Applied Learning (Generic)',
    'APL_GEN',
    'APPLIED_LEARNING',
    FALSE,
    'APL_GEN',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000034',
    '00000000-0000-0000-0000-000000000001',
    'Applied Learning — Creative Studies',
    'APL_CRST',
    'APPLIED_LEARNING',
    FALSE,
    'APL_CRST',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000035',
    '00000000-0000-0000-0000-000000000001',
    'Applied Learning — Engineering and Production',
    'APL_ENGP',
    'APPLIED_LEARNING',
    FALSE,
    'APL_ENGP',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000036',
    '00000000-0000-0000-0000-000000000001',
    'Applied Learning — Services',
    'APL_SERV',
    'APPLIED_LEARNING',
    FALSE,
    'APL_SERV',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000037',
    '00000000-0000-0000-0000-000000000001',
    'Applied Learning — Business, Management and Law',
    'APL_BML',
    'APPLIED_LEARNING',
    FALSE,
    'APL_BML',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000038',
    '00000000-0000-0000-0000-000000000001',
    'Applied Learning — Information Technology',
    'APL_IT',
    'APPLIED_LEARNING',
    FALSE,
    'APL_IT',
    NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000039',
    '00000000-0000-0000-0000-000000000001',
    'Applied Learning — Health and Medical Sciences',
    'APL_HMS',
    'APPLIED_LEARNING',
    FALSE,
    'APL_HMS',
    NOW(), NOW()
  )
ON CONFLICT (grade_system_id, code) DO NOTHING;

-- =============================================================================
-- End of seed_subjects.sql
-- Total subjects: 39 (4 CORE + 23 ELECTIVE + 5 OTHER_LANGUAGE + 7 APPLIED_LEARNING)
-- Grade distribution data is stored externally in data/processed/hkdse_subject_stats.json
-- =============================================================================
