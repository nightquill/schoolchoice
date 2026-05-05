ALTER TABLE student_school_targets ADD COLUMN IF NOT EXISTS at_risk BOOLEAN DEFAULT FALSE;
ALTER TABLE student_school_targets ADD COLUMN IF NOT EXISTS risk_reasons JSONB DEFAULT '[]';
