def test_jupas_programme_model_exists():
    from app.modules.school_choice.models.models import JupasProgramme
    assert JupasProgramme.__tablename__ == "jupas_programmes"

def test_jupas_programme_fields():
    from app.modules.school_choice.models.models import JupasProgramme
    columns = {c.name for c in JupasProgramme.__table__.columns}
    required = {
        "id", "jupas_code", "name", "institution_code", "school_id",
        "faculty", "scoring_formula", "minimum_requirements",
        "admission_stats", "created_at", "updated_at",
    }
    assert required.issubset(columns), f"Missing: {required - columns}"
