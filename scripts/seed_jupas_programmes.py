#!/usr/bin/env python3
"""
Seed jupas_programmes table from curated JSON files in data/jupas/programmes/.
Idempotent: uses ON CONFLICT (jupas_code) DO UPDATE.

Usage:
    python scripts/seed_jupas_programmes.py
"""

import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import text
from app.core.database import SessionLocal

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "jupas" / "programmes"


def load_programmes():
    """Load all programme JSON files and return flat list."""
    programmes = []
    for json_file in sorted(DATA_DIR.glob("*.json")):
        with open(json_file) as f:
            data = json.load(f)
        meta = data.get("_meta", {})
        institution_code = meta.get("institution_code", json_file.stem.upper())
        school_id = meta.get("school_id")
        confidence = meta.get("confidence", "estimated")
        for prog in data.get("programmes", []):
            prog["institution_code"] = institution_code
            prog["school_id"] = school_id
            prog["data_confidence"] = confidence
            programmes.append(prog)
    return programmes


def seed():
    programmes = load_programmes()
    file_count = len(list(DATA_DIR.glob("*.json")))
    print(f"Loaded {len(programmes)} programmes from {file_count} institution files")

    db = SessionLocal()
    try:
        upsert_sql = text("""
            INSERT INTO jupas_programmes (
                jupas_code, name, institution_code, school_id, faculty,
                scoring_formula, minimum_requirements, admission_stats,
                notes, data_source, data_confidence
            ) VALUES (
                :jupas_code, :name, :institution_code,
                CAST(:school_id AS UUID), :faculty,
                CAST(:scoring_formula AS JSONB),
                CAST(:minimum_requirements AS JSONB),
                CAST(:admission_stats AS JSONB),
                :notes, :data_source, :data_confidence
            )
            ON CONFLICT (jupas_code) DO UPDATE SET
                name = EXCLUDED.name,
                institution_code = EXCLUDED.institution_code,
                school_id = EXCLUDED.school_id,
                faculty = EXCLUDED.faculty,
                scoring_formula = EXCLUDED.scoring_formula,
                minimum_requirements = EXCLUDED.minimum_requirements,
                admission_stats = EXCLUDED.admission_stats,
                notes = EXCLUDED.notes,
                data_source = EXCLUDED.data_source,
                data_confidence = EXCLUDED.data_confidence,
                updated_at = NOW()
        """)

        for prog in programmes:
            sf = prog.get("scoring_formula", {})
            db.execute(upsert_sql, {
                "jupas_code": prog["jupas_code"],
                "name": prog["name"],
                "institution_code": prog["institution_code"],
                "school_id": prog.get("school_id"),
                "faculty": prog.get("faculty"),
                "scoring_formula": json.dumps(sf),
                "minimum_requirements": json.dumps(prog.get("minimum_requirements", {})),
                "admission_stats": json.dumps(prog.get("admission_stats", {})),
                "notes": sf.get("notes") or prog.get("notes"),
                "data_source": "curated_json",
                "data_confidence": prog.get("data_confidence", "estimated"),
            })

        db.commit()
        print(f"Seeded {len(programmes)} programmes successfully")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
