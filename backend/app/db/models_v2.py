"""
app/db/models_v2.py

Re-export stub — all v2 models now live in app.modules.school_choice.models.models.
This file exists for backward compatibility with existing imports.

Import chain: this file imports app.db.models first (to ensure Base/User are
loaded before domain models), then re-exports v2 models from the module.
"""
# Ensure platform models (Base, User) are fully loaded first to prevent
# circular import when this file is imported before app.db.models.
import app.db.models as _platform_models  # noqa: F401

from app.modules.school_choice.models.models import (  # noqa: F401
    GradeSystem, Subject, StudentSubjectGrade, Transcript,
    StudentSchoolTarget, PlanGenerationJob, AcademicPlan,
    StudentCohort, CohortMembership, PlanHistory,
)
from app.modules.school_choice.models.consent import ConsentRecord  # noqa: F401
