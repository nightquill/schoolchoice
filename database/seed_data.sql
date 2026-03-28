-- =============================================================================
-- seed_data.sql
-- Intelligent Academic Advisor — MVP
-- Database Engineer — 2026-03-27
--
-- PURPOSE: Minimal seed data for local development and testing.
--          Provides two sample schools so the matching engine has data
--          to work against during backend integration testing.
--
-- WARNING: FOR TEST/DEV USE ONLY. Do NOT run against production databases.
--
-- USAGE:
--   psql $DATABASE_URL -f database/seed_data.sql
--
-- PREREQUISITE:
--   Run the Alembic migration first:
--     alembic upgrade head
-- =============================================================================

-- Use a DO block to make the seed idempotent:
-- inserts are skipped if a school with the same name already exists.

DO $$
BEGIN

    -- ------------------------------------------------------------------
    -- School 1: Riverside STEM Academy
    -- A locally-focused school with strong STEM and engineering programs.
    -- Useful for testing local-region matching with high math requirements.
    -- ------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM schools WHERE name = 'Riverside STEM Academy'
    ) THEN
        INSERT INTO schools (
            id,
            name,
            location,
            min_academic_requirements,
            key_strengths,
            notes,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'Riverside STEM Academy',
            'Riverside, CA — Local',
            '{"math": "B+", "science": "B", "english": "C+"}'::jsonb,
            '["STEM", "engineering", "robotics"]'::jsonb,
            'Strong robotics club and annual science fair. Partners with local tech firms for internship placements.',
            now(),
            now()
        );
    END IF;

    -- ------------------------------------------------------------------
    -- School 2: International College of Arts and Commerce
    -- An internationally-oriented school with arts and business focus.
    -- Useful for testing international-region matching with arts emphasis.
    -- ------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM schools WHERE name = 'International College of Arts and Commerce'
    ) THEN
        INSERT INTO schools (
            id,
            name,
            location,
            min_academic_requirements,
            key_strengths,
            notes,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'International College of Arts and Commerce',
            'Toronto, ON — International',
            '{"math": "C+", "english": "B+", "history": "B"}'::jsonb,
            '["arts", "business", "economics", "international studies"]'::jsonb,
            'Accepts students from over 40 countries. Strong humanities and economics faculty.',
            now(),
            now()
        );
    END IF;

END $$;
