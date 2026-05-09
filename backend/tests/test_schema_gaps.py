"""Tests for grilling plan schema additions."""
from app.modules.school_choice.models.models import StudentCohort, JupasProgramme, StudentSchoolTarget


def test_student_cohort_has_academic_year():
    assert hasattr(StudentCohort, "academic_year")


def test_jupas_programme_has_admission_year():
    assert hasattr(JupasProgramme, "admission_year")


def test_student_school_target_has_counselor_fields():
    assert hasattr(StudentSchoolTarget, "is_pinned")
    assert hasattr(StudentSchoolTarget, "is_dismissed")
    assert hasattr(StudentSchoolTarget, "counselor_notes")
