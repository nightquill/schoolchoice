CREATE TABLE IF NOT EXISTS jupas_programmes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jupas_code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    institution_code VARCHAR(10) NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    faculty VARCHAR(255),
    scoring_formula JSONB NOT NULL DEFAULT '{}',
    minimum_requirements JSONB NOT NULL DEFAULT '{}',
    admission_stats JSONB NOT NULL DEFAULT '{}',
    notes TEXT,
    data_source TEXT,
    data_confidence VARCHAR(50) DEFAULT 'estimated',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jupas_programmes_institution ON jupas_programmes(institution_code);
CREATE INDEX IF NOT EXISTS idx_jupas_programmes_code ON jupas_programmes(jupas_code);
