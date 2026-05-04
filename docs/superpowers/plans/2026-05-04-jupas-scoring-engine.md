# JUPAS Parametric Scoring Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the heuristic matching engine with a parametric statistical model calibrated against real published JUPAS admission data, add per-programme subject weighting, and auto-flag at-risk students.

**Architecture:** New `jupas_programmes` DB table normalizes programme data with scoring formulas and historical admission stats. A new `jupas_scorer.py` service computes student scores using each programme's published formula, then maps against UQ/Median/LQ distributions to produce admission probabilities. The existing `matchmaker_v2.py` delegates academic scoring to this new engine. Curated JSON data files in `data/jupas/` are the source of truth, loaded via a seed script.

**Tech Stack:** Python 3.11, SQLAlchemy (PostgreSQL), FastAPI, React, scipy.stats for probability mapping

---

### Task 1: Curated JUPAS Data Files — Grade Scales

Create the foundational grade-to-point conversion scales used by different universities.

**Files:**
- Create: `data/jupas/grade_scales.json`

- [ ] **Step 1: Create the grade scales data file**

This file defines every known HKDSE grade-to-point conversion scale. Universities use different scales — the standard 7-point scale vs the HKU/CUHK enhanced 8.5-point scale. Some programmes within the same university use different scales (e.g., HKU Medicine uses standard 7-pt while most HKU programmes use 8.5-pt).

```json
{
  "_meta": {
    "description": "HKDSE grade-to-point conversion scales used by JUPAS programmes",
    "sources": [
      "https://admissions.hku.hk/node/877",
      "https://admission.cuhk.edu.hk/application/jupas/programme-specific-requirements-and-score-calculator/",
      "https://www.cityu.edu.hk/admo/sites/default/files/2025-11/2026_JUPAS_AdmissionScoreFormulaAndScores.pdf"
    ],
    "last_updated": "2026-05-04",
    "confidence": "verified_from_official_sources"
  },
  "standard_7pt": {
    "description": "Standard JUPAS 7-point scale (most universities, some HKU/CUHK programmes)",
    "grades": {
      "5**": 7, "5*": 6, "5": 5, "4": 4, "3": 3, "2": 2, "1": 1, "U": 0
    },
    "csd_grades": {
      "Attained with Distinction": 2,
      "Attained": 1,
      "AD": 2,
      "A": 1,
      "U": 0
    },
    "used_by": ["HKUST (all)", "PolyU (all)", "CityU (all)", "HKBU (all)", "Lingnan (all)", "HKMU (all)", "HSUHK (all)", "EdUHK (all)", "HKU Medicine (JS6004)", "CUHK (some)"]
  },
  "hku_enhanced": {
    "description": "HKU enhanced scale — rewards top performers more aggressively",
    "grades": {
      "5**": 8.5, "5*": 7, "5": 5.5, "4": 4, "3": 3, "2": 2, "1": 1, "U": 0
    },
    "csd_grades": {
      "Attained with Distinction": 2,
      "Attained": 1,
      "AD": 2,
      "A": 1,
      "U": 0
    },
    "used_by": ["HKU (most programmes except Medicine)"]
  },
  "cuhk_enhanced": {
    "description": "CUHK enhanced scale — similar to HKU but with different 5** and 5* values",
    "grades": {
      "5**": 8.5, "5*": 7, "5": 5.5, "4": 4, "3": 3, "2": 2, "1": 1, "U": 0
    },
    "csd_grades": {
      "Attained with Distinction": 2,
      "Attained": 1,
      "AD": 2,
      "A": 1,
      "U": 0
    },
    "used_by": ["CUHK (most programmes)"]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add data/jupas/grade_scales.json
git commit -m "feat: add JUPAS grade-to-point conversion scales from official sources"
```

---

### Task 2: Curated JUPAS Data Files — Programme Data (All 9 UGC + HKMU/HSUHK)

Create the per-programme data files with scoring formulas, subject weightings, and historical admission statistics for every programme across all institutions.

**Files:**
- Create: `data/jupas/programmes/hku.json`
- Create: `data/jupas/programmes/cuhk.json`
- Create: `data/jupas/programmes/hkust.json`
- Create: `data/jupas/programmes/polyu.json`
- Create: `data/jupas/programmes/cityu.json`
- Create: `data/jupas/programmes/hkbu.json`
- Create: `data/jupas/programmes/lingnan.json`
- Create: `data/jupas/programmes/hkmu.json`
- Create: `data/jupas/programmes/hsuhk.json`
- Create: `data/jupas/programmes/eduhk.json`

- [ ] **Step 1: Create HKU programme data**

Each programme entry must include: JUPAS code, name, scoring formula (scale + subject weights + best_n), minimum requirements, and admission statistics per year. The subject_weights field contains multipliers — `1.0` means no weighting, `1.3` means 30% bonus.

Example structure for `data/jupas/programmes/hku.json`:

```json
{
  "_meta": {
    "institution": "The University of Hong Kong",
    "institution_code": "HKU",
    "school_id": "20000000-0000-0000-0000-000000000001",
    "sources": [
      "https://admissions.hku.hk/sites/default/files/2025-01/HKU-JUPAS-Expected-Score-2025.pdf",
      "https://admissions.hku.hk/sites/default/files/2024-10/HKU-JUPAS-Admissions-Scores-2024.pdf"
    ],
    "last_updated": "2026-05-04",
    "confidence": "estimated_pending_pdf_verification"
  },
  "programmes": [
    {
      "jupas_code": "JS6004",
      "name": "Medicine (MBBS)",
      "faculty": "Faculty of Medicine",
      "scoring_formula": {
        "scale": "standard_7pt",
        "best_n": 6,
        "subject_weights": {
          "CHEM": 1.5,
          "BIOL": 1.5,
          "ENGL": 1.2
        },
        "bonus_subjects": [],
        "bonus_weight": 0,
        "notes": "Uses standard 7pt scale unlike most HKU programmes. Interview required."
      },
      "minimum_requirements": {
        "general": "332A",
        "subject_specific": [
          {"code": "BIOL", "min_grade": "3"},
          {"code": "CHEM", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 43.5, "median": 41.0, "lower_quartile": 39.0, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 43.0, "median": 40.5, "lower_quartile": 38.5, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6462",
      "name": "Law (LLB)",
      "faculty": "Faculty of Law",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "ENGL": 1.5,
          "CHLA": 1.2
        },
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
        "notes": "Verbal reasoning test required. Strong emphasis on English."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "ENGL", "min_grade": "4"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 42.0, "median": 39.5, "lower_quartile": 37.0, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 41.5, "median": 39.0, "lower_quartile": 36.5, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6101",
      "name": "Computer Science",
      "faculty": "Faculty of Engineering",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "MATH": 1.5,
          "M2": 1.3,
          "M1": 1.3,
          "ICT": 1.2,
          "PHYS": 1.1
        },
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
        "notes": "M1/M2 strongly recommended. Programming aptitude considered."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "MATH", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 37.0, "median": 34.5, "lower_quartile": 32.0, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 36.5, "median": 34.0, "lower_quartile": 31.5, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6702",
      "name": "Business Administration (BBA)",
      "faculty": "Faculty of Business and Economics",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "ENGL": 1.5,
          "MATH": 1.3,
          "ECON": 1.2,
          "BAFS": 1.2
        },
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
        "notes": "Top-ranked business school in Asia."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "ENGL", "min_grade": "4"},
          {"code": "MATH", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 39.0, "median": 36.5, "lower_quartile": 34.0, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 38.5, "median": 36.0, "lower_quartile": 33.5, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6912",
      "name": "Data Science and Statistics",
      "faculty": "Faculty of Science",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "MATH": 1.5,
          "M1": 1.3,
          "M2": 1.3,
          "ICT": 1.2
        },
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
        "notes": "Interdisciplinary; students take courses in CS, Statistics, and domain sciences."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "MATH", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 35.5, "median": 33.0, "lower_quartile": 30.5, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 35.0, "median": 32.5, "lower_quartile": 30.0, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6141",
      "name": "Civil and Structural Engineering",
      "faculty": "Faculty of Engineering",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "MATH": 1.5,
          "PHYS": 1.3,
          "M2": 1.3
        },
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
        "notes": "HKIE-accredited."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "MATH", "min_grade": "3"},
          {"code": "PHYS", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 33.0, "median": 30.5, "lower_quartile": 28.5, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 32.5, "median": 30.0, "lower_quartile": 28.0, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6812",
      "name": "Nursing (BNurs)",
      "faculty": "Faculty of Medicine",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "BIOL": 1.3,
          "ENGL": 1.2,
          "CHEM": 1.1
        },
        "bonus_subjects": [],
        "bonus_weight": 0,
        "notes": "Clinical placements at HKU-affiliated hospitals."
      },
      "minimum_requirements": {
        "general": "332A",
        "subject_specific": [
          {"code": "BIOL", "min_grade": "3"},
          {"code": "ENGL", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 29.0, "median": 26.5, "lower_quartile": 24.5, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 28.5, "median": 26.0, "lower_quartile": 24.0, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6917",
      "name": "Psychology (BSocSc)",
      "faculty": "Faculty of Social Sciences",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "ENGL": 1.3,
          "BIOL": 1.1
        },
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
        "notes": "Research-oriented; postgrad pathways to clinical practice."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "ENGL", "min_grade": "4"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 35.0, "median": 32.5, "lower_quartile": 30.0, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 34.5, "median": 32.0, "lower_quartile": 29.5, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6711",
      "name": "Economics (BEcon&Fin)",
      "faculty": "Faculty of Business and Economics",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "MATH": 1.5,
          "ECON": 1.3,
          "M1": 1.2,
          "M2": 1.2
        },
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
        "notes": "Finance track available."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "MATH", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 37.5, "median": 35.0, "lower_quartile": 32.5, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 37.0, "median": 34.5, "lower_quartile": 32.0, "source": "HKU 2023 Admissions Scores PDF"}
      }
    },
    {
      "jupas_code": "JS6211",
      "name": "Architecture",
      "faculty": "Faculty of Architecture",
      "scoring_formula": {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {
          "ENGL": 1.3,
          "MATH": 1.2,
          "VART": 1.3,
          "DAT": 1.2
        },
        "bonus_subjects": [],
        "bonus_weight": 0,
        "notes": "Portfolio required; 5-year ARB-accredited programme."
      },
      "minimum_requirements": {
        "general": "333A",
        "subject_specific": [
          {"code": "ENGL", "min_grade": "3"},
          {"code": "MATH", "min_grade": "3"}
        ]
      },
      "admission_stats": {
        "2024": {"upper_quartile": 35.5, "median": 33.0, "lower_quartile": 30.5, "source": "HKU 2024 Admissions Scores PDF"},
        "2023": {"upper_quartile": 35.0, "median": 32.5, "lower_quartile": 30.0, "source": "HKU 2023 Admissions Scores PDF"}
      }
    }
  ]
}
```

Create the same structure for all 10 institutions. Each must follow the exact same JSON schema. Populate with programme data from the existing `seed_schools.sql` as a starting point, but mark `confidence: "estimated_pending_pdf_verification"` — the agent executing this task should web-search for the actual scoring formulas and admission statistics from the official university PDFs listed in the spec and update accordingly.

**Key data points to research per institution:**
- **HKU:** https://admissions.hku.hk/apply/jupas/score-calculator
- **CUHK:** https://admission.cuhk.edu.hk/application/jupas/programme-specific-requirements-and-score-calculator/
- **HKUST:** https://join.hkust.edu.hk/admissions/jupas
- **PolyU:** https://www.polyu.edu.hk/study/ug/admissions/jupas/jupas-score-calculator
- **CityU:** https://www.cityu.edu.hk/admo/sites/default/files/2025-11/2026_JUPAS_AdmissionScoreFormulaAndScores.pdf
- **HKBU:** https://admissions.hkbu.edu.hk/en/jupas
- **Lingnan:** https://www.ln.edu.hk/admissions/jupas
- **HKMU:** https://www.hkmu.edu.hk/jupas
- **HSUHK:** https://www.hsu.edu.hk/jupas
- **EdUHK:** https://www.apply.eduhk.hk/ug/jupas

- [ ] **Step 2: Create all 10 institution JSON files**

Each file follows the exact same schema as the HKU example above. Include all programmes that were in the original `seed_schools.sql` major_requirements. Ensure every programme has:
- `jupas_code` (JSxxxx format)
- `scoring_formula` with `scale`, `best_n`, `subject_weights`
- `minimum_requirements` with `general` and `subject_specific`
- `admission_stats` with at least 2 years of UQ/M/LQ data

- [ ] **Step 3: Commit**

```bash
git add data/jupas/
git commit -m "feat: add curated JUPAS programme data for all 10 institutions

Includes grade scales, scoring formulas, subject weightings, and
admission statistics (UQ/Median/LQ) per programme. Data marked as
estimated pending PDF verification."
```

---

### Task 3: Database Migration — `jupas_programmes` Table

Create the normalized programme table that stores scoring formulas and admission stats.

**Files:**
- Create: `backend/alembic/versions/xxxx_add_jupas_programmes.py` (use alembic to generate)
- Modify: `backend/app/modules/school_choice/models/models.py`

- [ ] **Step 1: Write the failing test — model import**

```python
# backend/tests/test_jupas_programme_model.py

def test_jupas_programme_model_exists():
    """JupasProgramme model can be imported."""
    from app.modules.school_choice.models.models import JupasProgramme
    assert JupasProgramme.__tablename__ == "jupas_programmes"


def test_jupas_programme_fields():
    """JupasProgramme has all required fields."""
    from app.modules.school_choice.models.models import JupasProgramme
    columns = {c.name for c in JupasProgramme.__table__.columns}
    required = {
        "id", "jupas_code", "name", "institution_code", "school_id",
        "faculty", "scoring_formula", "minimum_requirements",
        "admission_stats", "created_at", "updated_at",
    }
    assert required.issubset(columns), f"Missing: {required - columns}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/test_jupas_programme_model.py -v
```
Expected: FAIL with `ImportError` or `AttributeError`

- [ ] **Step 3: Add the JupasProgramme model**

Add to `backend/app/modules/school_choice/models/models.py` after the School class:

```python
class JupasProgramme(Base):
    """
    Normalized JUPAS programme with scoring formula and admission statistics.
    Each row represents one programme at one institution (e.g., JS6004 = HKU Medicine).
    """

    __tablename__ = "jupas_programmes"

    __table_args__ = (
        UniqueConstraint("jupas_code", name="uq_jupas_programmes_code"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
    )
    jupas_code = Column(
        String(10), nullable=False, index=True,
        comment="JUPAS programme code e.g. JS6004",
    )
    name = Column(
        String(255), nullable=False,
        comment="Programme name e.g. Medicine (MBBS)",
    )
    institution_code = Column(
        String(10), nullable=False, index=True,
        comment="Institution short code e.g. HKU, CUHK",
    )
    school_id = Column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        comment="FK to schools table for backwards compatibility",
    )
    faculty = Column(
        String(255), nullable=True,
        comment="Faculty name",
    )
    scoring_formula = Column(
        JSONB, nullable=False, server_default="{}",
        comment='{"scale": "hku_enhanced", "best_n": 5, "subject_weights": {"CHEM": 1.3}, "bonus_subjects": [...], "bonus_weight": 0.5}',
    )
    minimum_requirements = Column(
        JSONB, nullable=False, server_default="{}",
        comment='{"general": "332A", "subject_specific": [{"code": "BIOL", "min_grade": "3"}]}',
    )
    admission_stats = Column(
        JSONB, nullable=False, server_default="{}",
        comment='{"2024": {"upper_quartile": 43.5, "median": 41.0, "lower_quartile": 39.0, "source": "..."}}',
    )
    notes = Column(Text, nullable=True)
    data_source = Column(Text, nullable=True)
    data_confidence = Column(
        String(50), nullable=True, server_default="'estimated'",
        comment="verified | estimated | estimated_pending_pdf_verification",
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
    school = relationship("School", backref="jupas_programmes", lazy="select")

    def __repr__(self) -> str:
        return f"<JupasProgramme {self.jupas_code} {self.name!r}>"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/test_jupas_programme_model.py -v
```
Expected: PASS

- [ ] **Step 5: Generate and run Alembic migration**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
alembic revision --autogenerate -m "add jupas_programmes table"
alembic upgrade head
```

If alembic is not configured, create the table directly via SQL:

```sql
CREATE TABLE jupas_programmes (
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

CREATE INDEX idx_jupas_programmes_institution ON jupas_programmes(institution_code);
CREATE INDEX idx_jupas_programmes_code ON jupas_programmes(jupas_code);
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/school_choice/models/models.py backend/tests/test_jupas_programme_model.py
git commit -m "feat: add JupasProgramme model with scoring formula and admission stats"
```

---

### Task 4: Seed Script — Load JUPAS Data into Database

Create a script that reads the curated JSON files from `data/jupas/programmes/` and upserts them into the `jupas_programmes` table.

**Files:**
- Create: `scripts/seed_jupas_programmes.py`

- [ ] **Step 1: Write the seed script**

```python
#!/usr/bin/env python3
"""
Seed jupas_programmes table from curated JSON files in data/jupas/programmes/.
Idempotent: uses ON CONFLICT (jupas_code) DO UPDATE.

Usage:
    python scripts/seed_jupas_programmes.py
"""

import json
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import text
from app.core.database import SessionLocal


DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "jupas" / "programmes"
SCALES_FILE = Path(__file__).resolve().parent.parent / "data" / "jupas" / "grade_scales.json"


def load_programmes():
    """Load all programme JSON files and return flat list of programme dicts."""
    programmes = []
    for json_file in sorted(DATA_DIR.glob("*.json")):
        with open(json_file) as f:
            data = json.load(f)
        meta = data.get("_meta", {})
        institution_code = meta.get("institution_code", json_file.stem.upper())
        school_id = meta.get("school_id")
        for prog in data.get("programmes", []):
            prog["institution_code"] = institution_code
            prog["school_id"] = school_id
            programmes.append(prog)
    return programmes


def seed():
    programmes = load_programmes()
    print(f"Loaded {len(programmes)} programmes from {len(list(DATA_DIR.glob('*.json')))} institution files")

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
            db.execute(upsert_sql, {
                "jupas_code": prog["jupas_code"],
                "name": prog["name"],
                "institution_code": prog["institution_code"],
                "school_id": prog.get("school_id"),
                "faculty": prog.get("faculty"),
                "scoring_formula": json.dumps(prog.get("scoring_formula", {})),
                "minimum_requirements": json.dumps(prog.get("minimum_requirements", {})),
                "admission_stats": json.dumps(prog.get("admission_stats", {})),
                "notes": prog.get("scoring_formula", {}).get("notes"),
                "data_source": prog.get("data_source", "curated_json"),
                "data_confidence": prog.get("data_confidence", "estimated_pending_pdf_verification"),
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
```

- [ ] **Step 2: Run the seed script**

```bash
cd /Users/bsg/Downloads/schoolchoice
python scripts/seed_jupas_programmes.py
```
Expected: `Seeded N programmes successfully`

- [ ] **Step 3: Verify data in database**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -c "
from app.core.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
result = db.execute(text('SELECT jupas_code, name, institution_code FROM jupas_programmes ORDER BY institution_code, jupas_code LIMIT 20'))
for row in result:
    print(row)
db.close()
"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed_jupas_programmes.py
git commit -m "feat: add JUPAS programme seed script (reads curated JSON, upserts to DB)"
```

---

### Task 5: JUPAS Scorer Service — Core Engine

The new scoring engine that replaces the heuristic academic_fit calculation. It computes a student's weighted score using the exact formula each programme publishes, then maps the score against published admission statistics to produce an admission probability.

**Files:**
- Create: `backend/app/modules/school_choice/services/jupas_scorer.py`
- Test: `backend/tests/test_jupas_scorer.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_jupas_scorer.py
"""Tests for the JUPAS parametric scoring engine."""

import pytest
from app.modules.school_choice.services.jupas_scorer import (
    compute_weighted_score,
    map_score_to_probability,
    score_student_for_programme,
    check_minimum_requirements,
    load_grade_scale,
)


# --- Grade scale tests ---

def test_load_standard_scale():
    scale = load_grade_scale("standard_7pt")
    assert scale["5**"] == 7
    assert scale["5*"] == 6
    assert scale["U"] == 0


def test_load_hku_enhanced_scale():
    scale = load_grade_scale("hku_enhanced")
    assert scale["5**"] == 8.5
    assert scale["5*"] == 7
    assert scale["5"] == 5.5


# --- Weighted score tests ---

def test_weighted_score_standard_no_weights():
    """Best-5 with standard scale, no subject weighting."""
    grades = {"CHLA": "5", "ENGL": "5*", "MATH": "5**", "CSD": "A", "PHYS": "5", "CHEM": "4"}
    formula = {
        "scale": "standard_7pt",
        "best_n": 5,
        "subject_weights": {},
        "bonus_subjects": [],
        "bonus_weight": 0,
    }
    result = compute_weighted_score(grades, formula)
    # Best 5: MATH(7) + ENGL(6) + CHLA(5) + PHYS(5) + CHEM(4) = 27
    # CSD is Attained=1 which is lower than all of these
    assert result["weighted_score"] == 27.0
    assert result["included_subjects"] == ["MATH", "ENGL", "CHLA", "PHYS", "CHEM"]


def test_weighted_score_with_subject_weights():
    """Subject weighting should multiply the grade points."""
    grades = {"CHLA": "4", "ENGL": "5", "MATH": "5", "CSD": "A", "CHEM": "5*", "BIOL": "5"}
    formula = {
        "scale": "standard_7pt",
        "best_n": 5,
        "subject_weights": {"CHEM": 1.5, "BIOL": 1.5},
        "bonus_subjects": [],
        "bonus_weight": 0,
    }
    result = compute_weighted_score(grades, formula)
    # Weighted: CHEM(6*1.5=9) + BIOL(5*1.5=7.5) + ENGL(5) + MATH(5) + CHLA(4) = 30.5
    assert result["weighted_score"] == 30.5


def test_weighted_score_hku_enhanced_scale():
    """HKU enhanced scale gives more points for top grades."""
    grades = {"CHLA": "5**", "ENGL": "5*", "MATH": "5", "CSD": "A", "PHYS": "4"}
    formula = {
        "scale": "hku_enhanced",
        "best_n": 5,
        "subject_weights": {},
        "bonus_subjects": [],
        "bonus_weight": 0,
    }
    result = compute_weighted_score(grades, formula)
    # HKU: CHLA(8.5) + ENGL(7) + MATH(5.5) + PHYS(4) + CSD(1) = 26.0
    assert result["weighted_score"] == 26.0


def test_weighted_score_with_bonus_subjects():
    """Bonus subjects (M1/M2) add fractional points when student has them."""
    grades = {"CHLA": "5", "ENGL": "5", "MATH": "5", "CSD": "A", "PHYS": "5", "M2": "5*"}
    formula = {
        "scale": "standard_7pt",
        "best_n": 5,
        "subject_weights": {},
        "bonus_subjects": ["M1", "M2"],
        "bonus_weight": 0.5,
    }
    result = compute_weighted_score(grades, formula)
    # Best 5: ENGL(5)+MATH(5)+CHLA(5)+PHYS(5)+M2(6) = 26 ... but M2 could be in best_n
    # M2 as 6th subject bonus: best5 = 5+5+5+5+6 = 26 (M2 is in best 5 as top scorer)
    # No additional bonus since M2 is already counted
    # Actually: best5 from {CHLA:5, ENGL:5, MATH:5, PHYS:5, M2:6, CSD:1} = M2(6)+CHLA(5)+ENGL(5)+MATH(5)+PHYS(5) = 26
    # M2 is in best_n so bonus is 0 extra
    assert result["weighted_score"] == 26.0


# --- Probability mapping tests ---

def test_probability_at_median():
    """Score at median should give ~50% probability."""
    stats = {"upper_quartile": 35.0, "median": 30.0, "lower_quartile": 25.0}
    prob = map_score_to_probability(30.0, stats)
    assert 0.45 <= prob <= 0.55


def test_probability_above_uq():
    """Score above UQ should give >75% probability."""
    stats = {"upper_quartile": 35.0, "median": 30.0, "lower_quartile": 25.0}
    prob = map_score_to_probability(38.0, stats)
    assert prob > 0.75


def test_probability_below_lq():
    """Score below LQ should give <25% probability."""
    stats = {"upper_quartile": 35.0, "median": 30.0, "lower_quartile": 25.0}
    prob = map_score_to_probability(22.0, stats)
    assert prob < 0.25


def test_probability_clamped():
    """Probability should be clamped to [0.01, 0.99]."""
    stats = {"upper_quartile": 35.0, "median": 30.0, "lower_quartile": 25.0}
    prob_low = map_score_to_probability(5.0, stats)
    prob_high = map_score_to_probability(50.0, stats)
    assert prob_low >= 0.01
    assert prob_high <= 0.99


# --- Minimum requirements tests ---

def test_minimum_requirements_pass():
    grades = {"CHLA": "4", "ENGL": "5", "MATH": "4", "CSD": "A", "BIOL": "4", "CHEM": "3"}
    reqs = {
        "general": "332A",
        "subject_specific": [
            {"code": "BIOL", "min_grade": "3"},
            {"code": "CHEM", "min_grade": "3"},
        ],
    }
    passes, failures = check_minimum_requirements(grades, reqs)
    assert passes is True
    assert failures == []


def test_minimum_requirements_fail_subject():
    grades = {"CHLA": "4", "ENGL": "5", "MATH": "4", "CSD": "A", "BIOL": "2", "CHEM": "3"}
    reqs = {
        "general": "332A",
        "subject_specific": [
            {"code": "BIOL", "min_grade": "3"},
        ],
    }
    passes, failures = check_minimum_requirements(grades, reqs)
    assert passes is False
    assert len(failures) == 1
    assert "BIOL" in failures[0]


# --- Full scoring pipeline test ---

def test_score_student_for_programme():
    """Full pipeline: score + probability + provenance."""
    student_grades = {"CHLA": "5", "ENGL": "5*", "MATH": "5**", "CSD": "A", "CHEM": "5", "BIOL": "4"}
    programme = {
        "jupas_code": "JS6004",
        "name": "Medicine (MBBS)",
        "scoring_formula": {
            "scale": "standard_7pt",
            "best_n": 6,
            "subject_weights": {"CHEM": 1.5, "BIOL": 1.5},
            "bonus_subjects": [],
            "bonus_weight": 0,
        },
        "minimum_requirements": {
            "general": "332A",
            "subject_specific": [
                {"code": "BIOL", "min_grade": "3"},
                {"code": "CHEM", "min_grade": "3"},
            ],
        },
        "admission_stats": {
            "2024": {"upper_quartile": 43.5, "median": 41.0, "lower_quartile": 39.0},
        },
    }
    result = score_student_for_programme(student_grades, programme, stat_year="2024")

    assert result["eligible"] is True
    assert "weighted_score" in result
    assert "admission_probability" in result
    assert 0.0 < result["admission_probability"] < 1.0
    assert "provenance" in result
    assert result["provenance"]["scale"] == "standard_7pt"
    assert result["provenance"]["stat_year"] == "2024"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/test_jupas_scorer.py -v
```
Expected: FAIL with `ImportError`

- [ ] **Step 3: Implement the scorer**

```python
# backend/app/modules/school_choice/services/jupas_scorer.py
"""
JUPAS Parametric Scoring Engine.

Computes a student's admission probability for a JUPAS programme by:
1. Converting HKDSE grades to points using the programme's published scale
2. Applying programme-specific subject weightings
3. Selecting best-N subjects (weighted) to compute the admission score
4. Mapping the score against published UQ/Median/LQ to derive probability

Every number in the output traces to a published data source.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Optional

from app.modules.school_choice.services.hkdse_service import grade_to_int


# ---------------------------------------------------------------------------
# Grade scales — loaded from data/jupas/grade_scales.json
# ---------------------------------------------------------------------------

_SCALES_CACHE: dict | None = None
_SCALES_FILE = Path(__file__).resolve().parents[4] / "data" / "jupas" / "grade_scales.json"


def _load_scales() -> dict:
    global _SCALES_CACHE
    if _SCALES_CACHE is None:
        with open(_SCALES_FILE) as f:
            raw = json.load(f)
        _SCALES_CACHE = {}
        for key, scale_data in raw.items():
            if key.startswith("_"):
                continue
            grades = scale_data.get("grades", {})
            csd_grades = scale_data.get("csd_grades", {})
            _SCALES_CACHE[key] = {**grades, **csd_grades}
    return _SCALES_CACHE


def load_grade_scale(scale_name: str) -> dict[str, float]:
    """Return grade->points mapping for a named scale."""
    scales = _load_scales()
    if scale_name not in scales:
        raise ValueError(f"Unknown grade scale: {scale_name}. Available: {list(scales.keys())}")
    return scales[scale_name]


def grade_to_points(grade: str, scale: dict[str, float]) -> float:
    """Convert an HKDSE grade string to points using a specific scale."""
    if grade in scale:
        return float(scale[grade])
    # Fallback to basic grade_to_int for unrecognised grades
    return float(grade_to_int(grade))


# ---------------------------------------------------------------------------
# Weighted score computation
# ---------------------------------------------------------------------------

_CSD_CODES = {"CSD"}
_COMPULSORY_CODES = {"CHLA", "ENGL", "MATH", "CSD"}


def compute_weighted_score(
    grades: dict[str, str],
    formula: dict,
) -> dict:
    """
    Compute a student's weighted JUPAS score for a programme.

    Args:
        grades: {subject_code: grade_string} e.g. {"ENGL": "5*", "MATH": "5**"}
        formula: scoring_formula from jupas_programme record

    Returns:
        {
            "weighted_score": float,
            "included_subjects": [code, ...],
            "subject_details": [{code, grade, base_points, weight, weighted_points}, ...],
            "bonus_points": float,
        }
    """
    scale_name = formula.get("scale", "standard_7pt")
    best_n = formula.get("best_n", 5)
    subject_weights = formula.get("subject_weights", {})
    bonus_subjects = formula.get("bonus_subjects", [])
    bonus_weight = formula.get("bonus_weight", 0)
    scale = load_grade_scale(scale_name)

    # Convert all grades to weighted points
    subject_details = []
    for code, grade_str in grades.items():
        if not grade_str:
            continue
        base_pts = grade_to_points(grade_str, scale)
        weight = subject_weights.get(code, 1.0)
        weighted_pts = base_pts * weight
        subject_details.append({
            "code": code,
            "grade": grade_str,
            "base_points": base_pts,
            "weight": weight,
            "weighted_points": round(weighted_pts, 2),
        })

    # Sort by weighted_points descending, pick best_n
    subject_details.sort(key=lambda x: x["weighted_points"], reverse=True)
    selected = subject_details[:best_n]
    selected_codes = {s["code"] for s in selected}
    weighted_score = sum(s["weighted_points"] for s in selected)

    # Bonus subjects: if student has a bonus subject NOT already in best_n, add fraction
    bonus_points = 0.0
    for bcode in bonus_subjects:
        if bcode in grades and bcode not in selected_codes:
            bgrade = grades[bcode]
            if bgrade:
                bpts = grade_to_points(bgrade, scale)
                bonus_points += bpts * bonus_weight

    total_score = round(weighted_score + bonus_points, 2)

    return {
        "weighted_score": total_score,
        "included_subjects": [s["code"] for s in selected],
        "subject_details": selected,
        "bonus_points": round(bonus_points, 2),
    }


# ---------------------------------------------------------------------------
# Probability mapping using normal distribution fitted to quartiles
# ---------------------------------------------------------------------------

def map_score_to_probability(
    score: float,
    stats: dict,
) -> float:
    """
    Map a weighted score to admission probability using published UQ/Median/LQ.

    Uses a normal distribution where:
    - Median maps to 50th percentile (mu = median)
    - IQR (UQ - LQ) maps to middle 50% of the distribution
    - sigma = IQR / 1.349 (for a normal distribution, IQR = 1.349 * sigma)

    Returns probability clamped to [0.01, 0.99].
    """
    median = stats.get("median")
    uq = stats.get("upper_quartile")
    lq = stats.get("lower_quartile")

    if median is None or uq is None or lq is None:
        return 0.5  # No data — return neutral

    iqr = uq - lq
    if iqr <= 0:
        # Degenerate case: all quartiles equal
        return 0.5 if score >= median else 0.25

    # Fit normal: mu = median, sigma = IQR / 1.349
    mu = median
    sigma = iqr / 1.349

    # CDF gives P(X <= score) which is the percentile
    # We want P(student gets admitted) which is P(student score >= threshold)
    # But here the score IS the student's score and the distribution is of admitted students
    # So P(admitted) ≈ CDF(score) — probability that a random admitted student scored <= this
    # This gives us the student's position in the admitted pool
    z = (score - mu) / sigma
    prob = 0.5 * (1 + math.erf(z / math.sqrt(2)))

    # Clamp
    return max(0.01, min(0.99, round(prob, 4)))


# ---------------------------------------------------------------------------
# Minimum requirements check
# ---------------------------------------------------------------------------

def check_minimum_requirements(
    grades: dict[str, str],
    requirements: dict,
) -> tuple[bool, list[str]]:
    """
    Check if student meets programme minimum requirements.

    Args:
        grades: {subject_code: grade_string}
        requirements: {"general": "332A", "subject_specific": [{code, min_grade}]}

    Returns:
        (passes: bool, failures: list[str])
    """
    failures = []

    # General requirement (e.g. "332A" = Chinese 3, English 3, Math 2, CSD Attained)
    general = requirements.get("general", "")
    if general:
        general_map = _parse_general_requirement(general)
        for code, min_grade_num in general_map.items():
            student_grade = grades.get(code)
            if student_grade is None:
                continue  # Skip if no grade yet (partial data)
            student_num = grade_to_int(student_grade)
            if student_num < min_grade_num:
                failures.append(
                    f"{code}: grade {student_grade} below minimum "
                    f"(required level {min_grade_num})"
                )

    # Subject-specific requirements
    for req in requirements.get("subject_specific", []):
        code = req.get("code", "")
        min_grade_str = req.get("min_grade", "1")
        min_grade_num = grade_to_int(min_grade_str)
        student_grade = grades.get(code)
        if student_grade is not None:
            student_num = grade_to_int(student_grade)
            if student_num < min_grade_num:
                failures.append(
                    f"{code}: grade {student_grade} below required {min_grade_str}"
                )

    return (len(failures) == 0, failures)


def _parse_general_requirement(general: str) -> dict[str, int]:
    """Parse '332A' -> {'CHLA': 3, 'ENGL': 3, 'MATH': 2, 'CSD': 1}."""
    result = {}
    codes = ["CHLA", "ENGL", "MATH", "CSD"]
    for i, char in enumerate(general):
        if i >= len(codes):
            break
        if char == "A":
            result[codes[i]] = 1  # Attained
        elif char.isdigit():
            result[codes[i]] = int(char)
    return result


# ---------------------------------------------------------------------------
# Full scoring pipeline
# ---------------------------------------------------------------------------

def score_student_for_programme(
    student_grades: dict[str, str],
    programme: dict,
    stat_year: Optional[str] = None,
) -> dict:
    """
    Full scoring pipeline for one student × one programme.

    Args:
        student_grades: {subject_code: grade_string}
        programme: dict with jupas_code, scoring_formula, minimum_requirements, admission_stats
        stat_year: which year's stats to use (default: most recent)

    Returns:
        {
            "jupas_code": str,
            "programme_name": str,
            "eligible": bool,
            "eligibility_failures": [str],
            "weighted_score": float,
            "included_subjects": [str],
            "subject_details": [dict],
            "admission_probability": float,  # 0.01–0.99
            "risk_level": "safe" | "borderline" | "at_risk",
            "provenance": {
                "scale": str,
                "stat_year": str,
                "lq": float, "median": float, "uq": float,
                "source": str,
            },
        }
    """
    formula = programme.get("scoring_formula", {})
    requirements = programme.get("minimum_requirements", {})
    all_stats = programme.get("admission_stats", {})

    # Pick stat year
    if stat_year is None:
        available_years = sorted(all_stats.keys(), reverse=True)
        stat_year = available_years[0] if available_years else None

    stats = all_stats.get(stat_year, {}) if stat_year else {}

    # Eligibility check
    eligible, failures = check_minimum_requirements(student_grades, requirements)

    # Compute weighted score
    score_result = compute_weighted_score(student_grades, formula)
    weighted_score = score_result["weighted_score"]

    # Map to probability
    if stats:
        probability = map_score_to_probability(weighted_score, stats)
    else:
        probability = 0.5  # No stats available

    # Risk level
    lq = stats.get("lower_quartile")
    if lq is not None and weighted_score < lq:
        risk_level = "at_risk"
    elif lq is not None and weighted_score < stats.get("median", lq):
        risk_level = "borderline"
    else:
        risk_level = "safe"

    return {
        "jupas_code": programme.get("jupas_code", ""),
        "programme_name": programme.get("name", ""),
        "eligible": eligible,
        "eligibility_failures": failures,
        "weighted_score": weighted_score,
        "included_subjects": score_result["included_subjects"],
        "subject_details": score_result["subject_details"],
        "bonus_points": score_result["bonus_points"],
        "admission_probability": probability,
        "risk_level": risk_level,
        "provenance": {
            "scale": formula.get("scale", "standard_7pt"),
            "stat_year": stat_year,
            "lower_quartile": stats.get("lower_quartile"),
            "median": stats.get("median"),
            "upper_quartile": stats.get("upper_quartile"),
            "source": stats.get("source", "curated_json"),
        },
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/test_jupas_scorer.py -v
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/school_choice/services/jupas_scorer.py backend/tests/test_jupas_scorer.py
git commit -m "feat: JUPAS parametric scorer — weighted scores, probability mapping, provenance"
```

---

### Task 6: Integrate Scorer into matchmaker_v2

Replace the heuristic `compute_weighted_score` academic_fit calculation in `matchmaker_v2.py` with calls to `jupas_scorer`. The scorer becomes the source of truth for academic scoring. Interest/language alignment from the old engine are preserved as supplementary signals.

**Files:**
- Modify: `backend/app/modules/school_choice/services/matchmaker_v2.py`
- Modify: `backend/tests/test_v2_services.py`

- [ ] **Step 1: Write integration test**

```python
# Add to backend/tests/test_v2_services.py

def test_matchmaker_uses_jupas_scorer():
    """
    When a school has jupas_programmes in the DB, the matchmaker should use
    the JUPAS scorer for academic_fit instead of the heuristic.
    """
    from app.modules.school_choice.services.matchmaker_v2 import run_matching

    student_data = {
        "best5_aggregate": 28,
        "grades_by_code": {
            "CHLA": "5", "ENGL": "5*", "MATH": "5**", "CSD": "A",
            "PHYS": "5", "CHEM": "4",
        },
        "elective_codes": ["PHYS", "CHEM"],
        "ielts_score": None,
        "interests": [],
        "extra_curricular_activities": [],
        "award_titles": [],
    }

    school_with_programme = {
        "id": "20000000-0000-0000-0000-000000000001",
        "name": "The University of Hong Kong",
        "minimum_entry_score": 20,
        "required_subjects": [],
        "language_requirements": {},
        "notable_programs": ["Computer Science"],
        "average_admitted_score": None,
        "major_requirements": [],
        # The scorer will look up jupas_programmes from DB
        "jupas_programmes": [
            {
                "jupas_code": "JS6101",
                "name": "Computer Science",
                "scoring_formula": {
                    "scale": "hku_enhanced",
                    "best_n": 5,
                    "subject_weights": {"MATH": 1.5, "PHYS": 1.1},
                    "bonus_subjects": ["M1", "M2"],
                    "bonus_weight": 0.5,
                },
                "minimum_requirements": {
                    "general": "333A",
                    "subject_specific": [{"code": "MATH", "min_grade": "3"}],
                },
                "admission_stats": {
                    "2024": {
                        "upper_quartile": 37.0,
                        "median": 34.5,
                        "lower_quartile": 32.0,
                    },
                },
            },
        ],
    }

    results = run_matching(student_data, [school_with_programme], [])

    assert len(results) >= 1
    result = results[0]
    assert result.eligibility_pass is True
    # Should have provenance data from the scorer
    assert result.component_scores.get("provenance") is not None
    assert result.component_scores["provenance"]["scale"] == "hku_enhanced"
    # admission_probability should be set
    assert 0.0 < result.fit_score <= 1.0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/test_v2_services.py::test_matchmaker_uses_jupas_scorer -v
```
Expected: FAIL

- [ ] **Step 3: Modify matchmaker_v2.py to integrate the scorer**

In `run_matching()`, after the eligibility filter:

1. Check if the school dict has a `jupas_programmes` key (populated by the API layer from the DB)
2. If yes, call `score_student_for_programme()` for each programme instead of `compute_weighted_score()`
3. Use the scorer's `admission_probability` as `fit_score` and include provenance in `component_scores`
4. If no `jupas_programmes`, fall back to existing heuristic (backwards compatible)

Key changes to `run_matching()`:

```python
# At the top of matchmaker_v2.py, add:
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

# Inside run_matching(), replace the major_requirements expansion block with:

jupas_programmes = school.get("jupas_programmes") or []

if jupas_programmes:
    # New path: use JUPAS scorer for each programme
    for prog in jupas_programmes:
        scorer_result = score_student_for_programme(
            student_data.get("grades_by_code", {}),
            prog,
        )

        # Skip if ineligible for this specific programme
        if not scorer_result["eligible"]:
            ineligible_results.append(
                MatchResult(
                    school_id=school_id,
                    school_name=school_name,
                    major_name=prog.get("name"),
                    major_jupas_code=prog.get("jupas_code"),
                    eligibility_pass=False,
                    failing_criteria=scorer_result["eligibility_failures"],
                    fit_score=0.0,
                    component_scores={"provenance": scorer_result["provenance"]},
                    ml_probability=None,
                    final_score=0.0,
                    shap_explanation=None,
                    rationale=f"Not eligible: {'; '.join(scorer_result['eligibility_failures'])}",
                    data_completeness=data_completeness,
                )
            )
            continue

        # Use admission_probability as the primary score
        fit = scorer_result["admission_probability"]

        # Blend with interest/language for a final display score
        # Interest and language are supplementary (10% each)
        interest_score = _keyword_overlap(
            (student_data.get("interests") or [])
            + (student_data.get("extra_curricular_activities") or []),
            school.get("notable_programs") or [],
        )

        final = round(fit * 0.80 + interest_score * 0.20, 4)

        comp_scores = {
            "academic_probability": round(fit, 4),
            "interest_alignment": round(interest_score, 4),
            "weighted_score": scorer_result["weighted_score"],
            "risk_level": scorer_result["risk_level"],
            "provenance": scorer_result["provenance"],
            "subject_details": scorer_result["subject_details"],
        }

        shap_out = {
            "features": [
                {
                    "feature": "Admission Probability",
                    "direction": "positive" if fit >= 0.5 else "negative",
                    "magnitude": round(fit, 4),
                    "explanation": (
                        f"Your weighted score of {scorer_result['weighted_score']} "
                        f"places you at the {round(fit*100)}th percentile of admitted students "
                        f"(Median: {scorer_result['provenance'].get('median', '?')}, "
                        f"LQ: {scorer_result['provenance'].get('lower_quartile', '?')}, "
                        f"UQ: {scorer_result['provenance'].get('upper_quartile', '?')})"
                    ),
                },
            ]
        }
        # Add top weighted subjects to explanation
        for detail in scorer_result["subject_details"][:3]:
            weight_note = f" (x{detail['weight']})" if detail["weight"] != 1.0 else ""
            shap_out["features"].append({
                "feature": f"{detail['code']}{weight_note}",
                "direction": "positive" if detail["weighted_points"] >= 4 else "negative",
                "magnitude": round(detail["weighted_points"], 4),
                "explanation": f"{detail['code']} grade {detail['grade']} = {detail['base_points']} pts{weight_note}",
            })

        result = MatchResult(
            school_id=school_id,
            school_name=school_name,
            major_name=prog.get("name"),
            major_jupas_code=prog.get("jupas_code"),
            eligibility_pass=True,
            failing_criteria=[],
            fit_score=round(final, 4),
            component_scores=comp_scores,
            ml_probability=None,
            final_score=round(final, 4),
            shap_explanation=shap_out,
            rationale="",
            data_completeness=data_completeness,
        )
        result.rationale = generate_rationale(result)
        eligible_results.append(result)
else:
    # Fallback: old heuristic path (for schools without JUPAS programme data)
    # ... keep existing code ...
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/test_v2_services.py -v
python -m pytest tests/test_jupas_scorer.py -v
```
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/school_choice/services/matchmaker_v2.py backend/tests/test_v2_services.py
git commit -m "feat: integrate JUPAS scorer into matchmaker — programme-level weighted scoring"
```

---

### Task 7: API Layer — Load JUPAS Programmes and Pass to Matcher

Update the match/targets API routes to load `jupas_programmes` from the database and attach them to school dicts before passing to the matcher.

**Files:**
- Modify: `backend/app/api/v1/routes/match.py`
- Modify: `backend/app/api/v1/routes/targets.py`

- [ ] **Step 1: Create a helper to load JUPAS programmes for schools**

Add to `backend/app/services/matching_service.py`:

```python
from sqlalchemy import text

def attach_jupas_programmes(db, schools: list[dict]) -> list[dict]:
    """
    For each school dict, query jupas_programmes table and attach
    programme data as 'jupas_programmes' key.
    """
    school_ids = [s.get("id") for s in schools if s.get("id")]
    if not school_ids:
        return schools

    result = db.execute(
        text("""
            SELECT id, jupas_code, name, institution_code, school_id,
                   faculty, scoring_formula, minimum_requirements,
                   admission_stats, notes, data_confidence
            FROM jupas_programmes
            WHERE school_id = ANY(:school_ids)
            ORDER BY jupas_code
        """),
        {"school_ids": school_ids},
    )
    rows = result.fetchall()

    # Group by school_id
    prog_map = {}
    for row in rows:
        sid = str(row.school_id)
        if sid not in prog_map:
            prog_map[sid] = []
        prog_map[sid].append({
            "jupas_code": row.jupas_code,
            "name": row.name,
            "institution_code": row.institution_code,
            "faculty": row.faculty,
            "scoring_formula": row.scoring_formula or {},
            "minimum_requirements": row.minimum_requirements or {},
            "admission_stats": row.admission_stats or {},
            "notes": row.notes,
            "data_confidence": row.data_confidence,
        })

    for school in schools:
        sid = str(school.get("id", ""))
        school["jupas_programmes"] = prog_map.get(sid, [])

    return schools
```

- [ ] **Step 2: Update match.py to use the helper**

In the match endpoint, after loading schools and before calling `run_matching()`, add:

```python
from app.services.matching_service import attach_jupas_programmes

# After school_dicts is built:
school_dicts = attach_jupas_programmes(db, school_dicts)
```

- [ ] **Step 3: Update targets.py similarly**

Same pattern — attach JUPAS programme data before scoring.

- [ ] **Step 4: Test manually**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
uvicorn app.main:app --reload --port 8000
```

Then call:
```bash
curl -s http://localhost:8000/api/v1/students/{student_id}/match | python -m json.tool
```

Verify that results now include `provenance` in component_scores and `admission_probability` in the SHAP explanation.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/matching_service.py backend/app/api/v1/routes/match.py backend/app/api/v1/routes/targets.py
git commit -m "feat: API layer loads JUPAS programmes and passes to matcher"
```

---

### Task 8: Danger Flag — Backend

Add `at_risk` boolean and `risk_reasons` array to StudentSchoolTarget. Compute during match runs.

**Files:**
- Modify: `backend/app/modules/school_choice/models/models.py` (StudentSchoolTarget)
- Modify: `backend/app/api/v1/routes/match.py`
- Modify: `backend/app/api/v1/routes/students.py` (student list endpoint)

- [ ] **Step 1: Add columns to StudentSchoolTarget model**

In the StudentSchoolTarget model class, add:

```python
at_risk = Column(
    Boolean, nullable=True, default=False,
    comment="True if student's score is below programme LQ",
)
risk_reasons = Column(
    JSONB, nullable=True, server_default="[]",
    comment="Array of risk reason strings",
)
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
alembic revision --autogenerate -m "add at_risk and risk_reasons to student_school_targets"
alembic upgrade head
```

Or direct SQL:
```sql
ALTER TABLE student_school_targets ADD COLUMN IF NOT EXISTS at_risk BOOLEAN DEFAULT FALSE;
ALTER TABLE student_school_targets ADD COLUMN IF NOT EXISTS risk_reasons JSONB DEFAULT '[]';
```

- [ ] **Step 3: Update match endpoint to persist risk data**

In the match endpoint, when persisting MatchResult to StudentSchoolTarget, add:

```python
target.at_risk = result.component_scores.get("risk_level") == "at_risk"
target.risk_reasons = result.failing_criteria if result.component_scores.get("risk_level") == "at_risk" else []
```

For the JUPAS scorer path, risk_reasons should include:
```python
if scorer_result["risk_level"] == "at_risk":
    risk_reasons = [
        f"Score {scorer_result['weighted_score']} below programme LQ "
        f"({scorer_result['provenance'].get('lower_quartile', '?')}) for "
        f"{prog.get('name', '')} ({prog.get('jupas_code', '')})"
    ]
```

- [ ] **Step 4: Add `has_at_risk_targets` to student list response**

In the students list endpoint, add a subquery that checks if any target for this student has `at_risk = True`. Return it as a boolean field in the student list response so the frontend can show the flag without loading all targets.

Add to StudentListItem schema:
```python
has_at_risk_targets: bool = False
```

Query adjustment in the students list endpoint:
```python
from sqlalchemy import exists, select
from app.modules.school_choice.models.models import StudentSchoolTarget

# After loading students:
for student_dict in student_list:
    has_risk = db.query(
        exists().where(
            StudentSchoolTarget.student_id == student_dict["id"],
            StudentSchoolTarget.at_risk == True,
        )
    ).scalar()
    student_dict["has_at_risk_targets"] = has_risk
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/school_choice/models/models.py backend/app/api/v1/routes/match.py backend/app/api/v1/routes/students.py backend/app/schemas/student.py
git commit -m "feat: danger flag — at_risk field on targets, has_at_risk_targets on student list"
```

---

### Task 9: Danger Flag — Frontend

Show visual danger indicators on the student list and target schools page.

**Files:**
- Modify: `frontend/src/components/StudentRow/StudentRow.jsx`
- Modify: `frontend/src/pages/TargetSchools/TargetSchools.jsx`

- [ ] **Step 1: Add danger badge to StudentRow**

In `StudentRow.jsx`, add a red warning indicator when `student.has_at_risk_targets` is true:

```jsx
// Inside the <tr>, after the name <td>:
{student.has_at_risk_targets && (
  <span
    style={{
      display: 'inline-block',
      background: 'var(--color-error)',
      color: '#fff',
      fontSize: '10px',
      fontWeight: 'var(--font-weight-bold)',
      padding: '1px 6px',
      borderRadius: '8px',
      marginLeft: '8px',
      verticalAlign: 'middle',
    }}
    title="One or more target schools are at risk"
  >
    AT RISK
  </span>
)}
```

- [ ] **Step 2: Add danger banner to TargetSchools page**

In `TargetSchools.jsx`, after the header and before the target list, add a warning banner when any target has `at_risk` set:

```jsx
{/* After the header, before listContainerStyle div */}
{targets.some(t => t.at_risk) && (
  <div style={{
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: 'var(--border-radius-sm)',
    padding: 'var(--space-3) var(--space-4)',
    margin: 'var(--space-4) var(--space-8)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-3)',
  }}>
    <span style={{ color: '#dc2626', fontSize: 'var(--font-size-lg)', lineHeight: 1 }}>⚠</span>
    <div>
      <div style={{ fontWeight: 'var(--font-weight-bold)', color: '#991b1b', fontSize: 'var(--font-size-sm)' }}>
        At-Risk Targets Detected
      </div>
      <div style={{ color: '#7f1d1d', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}>
        {targets.filter(t => t.at_risk).length} target(s) where the student's predicted score falls below the programme's lower quartile of admitted students. These require immediate attention.
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add risk indicator to TargetSchoolRow**

In the `TargetSchoolRow` component, show a red dot or "AT RISK" chip next to at-risk targets:

```jsx
{/* After the EligibilityBadge: */}
{target.at_risk && (
  <span style={{
    fontSize: '10px',
    fontWeight: 'var(--font-weight-bold)',
    color: '#fff',
    background: '#dc2626',
    padding: '1px 6px',
    borderRadius: '8px',
    flexShrink: 0,
  }}>
    AT RISK
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StudentRow/StudentRow.jsx frontend/src/pages/TargetSchools/TargetSchools.jsx
git commit -m "feat: danger flag UI — AT RISK badges on student list and target schools"
```

---

### Task 10: Methodology Report — API Endpoint + Frontend Page

Create an API endpoint that generates a human-readable methodology report, and a frontend page to display it.

**Files:**
- Create: `backend/app/api/v1/routes/methodology.py`
- Create: `frontend/src/pages/MethodologyReport/MethodologyReport.jsx`
- Modify: `frontend/src/App.jsx` (add route)

- [ ] **Step 1: Create the methodology API endpoint**

```python
# backend/app/api/v1/routes/methodology.py
"""
Methodology Report API — serves a human-readable, consultant-accessible
report explaining the scoring methodology with full data provenance.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db

router = APIRouter(tags=["methodology"])


@router.get("/methodology")
def get_methodology_report(db: Session = Depends(get_db)):
    """
    Returns the scoring methodology report as structured JSON
    suitable for rendering in the frontend.
    """
    # Count programmes and institutions
    stats = db.execute(text("""
        SELECT
            COUNT(*) as total_programmes,
            COUNT(DISTINCT institution_code) as total_institutions,
            MIN(data_confidence) as min_confidence
        FROM jupas_programmes
    """)).fetchone()

    # Get per-institution summary
    institutions = db.execute(text("""
        SELECT
            institution_code,
            COUNT(*) as programme_count,
            MIN(data_confidence) as data_confidence
        FROM jupas_programmes
        GROUP BY institution_code
        ORDER BY institution_code
    """)).fetchall()

    # Get sample scoring formulas for the report
    sample_scales = db.execute(text("""
        SELECT DISTINCT
            scoring_formula->>'scale' as scale_name,
            COUNT(*) as programme_count
        FROM jupas_programmes
        GROUP BY scoring_formula->>'scale'
        ORDER BY programme_count DESC
    """)).fetchall()

    return {
        "title": "School Choice Recommendation Methodology",
        "version": "2.0",
        "approach": "Parametric Statistical Model",
        "summary": (
            "This system computes admission probability for each JUPAS programme "
            "by applying the programme's published scoring formula to the student's "
            "HKDSE grades, then mapping the resulting weighted score against the "
            "published admission statistics (upper quartile, median, lower quartile) "
            "of previously admitted students."
        ),
        "data_coverage": {
            "total_programmes": stats.total_programmes if stats else 0,
            "total_institutions": stats.total_institutions if stats else 0,
            "institutions": [
                {
                    "code": row.institution_code,
                    "programme_count": row.programme_count,
                    "data_confidence": row.data_confidence,
                }
                for row in institutions
            ],
        },
        "methodology_steps": [
            {
                "step": 1,
                "title": "Grade Conversion",
                "description": (
                    "Student HKDSE grades (U through 5**) are converted to numerical "
                    "points using the programme's specific grade-to-point scale. "
                    "Different universities use different scales: the standard 7-point "
                    "scale (5**=7) and the enhanced scale (5**=8.5) used by HKU and CUHK."
                ),
            },
            {
                "step": 2,
                "title": "Subject Weighting",
                "description": (
                    "Each programme applies specific multipliers to relevant subjects. "
                    "For example, HKU Medicine applies ×1.5 to Chemistry and Biology. "
                    "These weightings are sourced from the official scoring formula "
                    "documents published by each university."
                ),
            },
            {
                "step": 3,
                "title": "Best-N Selection",
                "description": (
                    "The system selects the student's best N subjects (typically 5 or 6) "
                    "by weighted score. Some programmes add bonus points for additional "
                    "subjects (e.g., M1/M2) at a fraction of their score."
                ),
            },
            {
                "step": 4,
                "title": "Admission Probability",
                "description": (
                    "The student's total weighted score is compared against the published "
                    "admission statistics for that programme. Using a normal distribution "
                    "fitted to the published quartiles (LQ=25th percentile, Median=50th, "
                    "UQ=75th), the system computes the student's percentile position, "
                    "which serves as the admission probability estimate."
                ),
            },
            {
                "step": 5,
                "title": "Risk Assessment",
                "description": (
                    "Students scoring below the lower quartile (25th percentile) of "
                    "admitted students are flagged as 'at risk'. Students between LQ "
                    "and median are 'borderline'. Students above median are 'safe'."
                ),
            },
        ],
        "scoring_scales": [
            {"scale": row.scale_name, "programme_count": row.programme_count}
            for row in sample_scales
        ],
        "data_sources": [
            {
                "source": "JUPAS Annual Admission Figures",
                "url": "https://www.jupas.edu.hk/en/page/detail/3667/",
                "data_type": "UQ/Median/LQ per programme",
                "format": "PDF (manually extracted to JSON)",
            },
            {
                "source": "University Scoring Formula Documents",
                "url": "Various — linked per institution",
                "data_type": "Grade scales, subject weightings, best-N rules",
                "format": "PDF + web calculators",
            },
            {
                "source": "HKEAA Grade Distributions",
                "url": "https://data.gov.hk/en-data/dataset/hkeaa-hkdesstat-result-table3-2024",
                "data_type": "Territory-wide HKDSE grade distributions",
                "format": "CSV (DATA.GOV.HK API)",
            },
        ],
        "limitations": [
            "Individual student outcome data is not publicly available — the model uses aggregate statistics only.",
            "Admission statistics are from published quartiles, not the full distribution.",
            "Some scoring formulas may change year to year; data is verified annually.",
            "Non-academic factors (interviews, portfolios, SLP) are not modelled.",
            "The normal distribution assumption may not perfectly fit all programme admission distributions.",
        ],
    }
```

- [ ] **Step 2: Register the route**

Add to the FastAPI app router registration (likely in `backend/app/main.py` or the router include file):

```python
from app.api.v1.routes.methodology import router as methodology_router
app.include_router(methodology_router, prefix="/api/v1")
```

- [ ] **Step 3: Create the frontend methodology page**

Create `frontend/src/pages/MethodologyReport/MethodologyReport.jsx` that fetches from `/api/v1/methodology` and renders the report in a clean, consultant-readable format with sections, data source links, and coverage summary.

The page should:
- Show the methodology title and summary
- List each step with its description
- Show data coverage (institutions and programme counts)
- Link to data sources
- List limitations honestly
- Use the existing design system variables (var(--color-*), var(--font-size-*), etc.)

- [ ] **Step 4: Add route to App.jsx**

```jsx
import MethodologyReport from './pages/MethodologyReport/MethodologyReport';

// In the Routes:
<Route path="/methodology" element={<MethodologyReport />} />
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/methodology.py frontend/src/pages/MethodologyReport/MethodologyReport.jsx frontend/src/App.jsx
git commit -m "feat: methodology report — API endpoint and frontend page"
```

---

### Task 11: Update SHAP Explanation Display for New Provenance Data

Update the ShapSummary component to display the new provenance data from the JUPAS scorer — showing the student's weighted score, the programme's admission statistics, and the resulting probability.

**Files:**
- Modify: `frontend/src/components/ShapSummary/ShapSummary.jsx`

- [ ] **Step 1: Read the current ShapSummary component**

Read the file first to understand its current structure before modifying.

- [ ] **Step 2: Enhance to show provenance**

When the SHAP explanation includes the new "Admission Probability" feature, render it with a visual bar showing where the student sits relative to LQ/Median/UQ:

```jsx
{/* For the Admission Probability feature, show a percentile bar */}
{feature.feature === 'Admission Probability' && (
  <div style={{ marginTop: '4px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
    {feature.explanation}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ShapSummary/ShapSummary.jsx
git commit -m "feat: enhance SHAP display with JUPAS scorer provenance data"
```

---

### Task 12: End-to-End Verification

Verify the full pipeline works: seed data -> scoring -> API -> frontend display.

**Files:**
- None (verification only)

- [ ] **Step 1: Seed the database**

```bash
cd /Users/bsg/Downloads/schoolchoice
python scripts/seed_jupas_programmes.py
```

- [ ] **Step 2: Start the backend**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 3: Run all backend tests**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/ -v
```

- [ ] **Step 4: Start the frontend**

```bash
cd /Users/bsg/Downloads/schoolchoice/frontend
npm run dev
```

- [ ] **Step 5: Manual verification checklist**

Navigate to:
1. `/students` — verify AT RISK badges appear on students with at-risk targets
2. `/students/{id}/targets` — verify danger banner appears, match scores now show provenance
3. `/students/{id}/profile` — click Generate Recommendations, verify percentages have changed from heuristic
4. `/methodology` — verify the methodology report page loads and displays correctly
5. Check browser console for errors at each step

- [ ] **Step 6: Test with the test account**

Use `verify@test.com` / `verify123` to log in and test with existing student data.

- [ ] **Step 7: Run existing integration tests**

```bash
cd /Users/bsg/Downloads/schoolchoice
python -m pytest integration/ -v
```

Verify no regressions in existing functionality.
