"""
tests/test_reports.py

Tests for cohort report endpoints (Decision #15).
"""


def test_target_distribution_unauthenticated(client):
    resp = client.get("/api/v1/reports/cohort/00000000-0000-0000-0000-000000000001/target-distribution")
    assert resp.status_code == 401


def test_risk_breakdown_unauthenticated(client):
    resp = client.get("/api/v1/reports/cohort/00000000-0000-0000-0000-000000000001/risk-breakdown")
    assert resp.status_code == 401


def test_subject_performance_unauthenticated(client):
    resp = client.get("/api/v1/reports/cohort/00000000-0000-0000-0000-000000000001/subject-performance")
    assert resp.status_code == 401


def test_target_distribution_not_found(client, auth_headers):
    resp = client.get(
        "/api/v1/reports/cohort/00000000-0000-0000-0000-000000000099/target-distribution",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_risk_breakdown_not_found(client, auth_headers):
    resp = client.get(
        "/api/v1/reports/cohort/00000000-0000-0000-0000-000000000099/risk-breakdown",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_subject_performance_not_found(client, auth_headers):
    resp = client.get(
        "/api/v1/reports/cohort/00000000-0000-0000-0000-000000000099/subject-performance",
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_target_distribution_empty_cohort(client, auth_headers, db):
    """Create a cohort with no members and verify empty distribution."""
    import uuid
    from app.db.models_v2 import StudentCohort
    from app.db.models import User

    user = db.query(User).filter(User.email == "test@example.com").first()
    cohort = StudentCohort(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Empty Report Cohort",
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)

    resp = client.get(
        f"/api/v1/reports/cohort/{cohort.id}/target-distribution",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cohort_name"] == "Empty Report Cohort"
    assert data["distribution"] == []

    # Cleanup
    db.delete(cohort)
    db.commit()


def test_risk_breakdown_empty_cohort(client, auth_headers, db):
    """Create a cohort with no members and verify empty breakdown."""
    import uuid
    from app.db.models_v2 import StudentCohort
    from app.db.models import User

    user = db.query(User).filter(User.email == "test@example.com").first()
    cohort = StudentCohort(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Empty Risk Cohort",
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)

    resp = client.get(
        f"/api/v1/reports/cohort/{cohort.id}/risk-breakdown",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cohort_name"] == "Empty Risk Cohort"
    assert data["breakdown"] == []

    db.delete(cohort)
    db.commit()


def test_subject_performance_empty_cohort(client, auth_headers, db):
    """Create a cohort with no members and verify empty subjects."""
    import uuid
    from app.db.models_v2 import StudentCohort
    from app.db.models import User

    user = db.query(User).filter(User.email == "test@example.com").first()
    cohort = StudentCohort(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Empty Perf Cohort",
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)

    resp = client.get(
        f"/api/v1/reports/cohort/{cohort.id}/subject-performance",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cohort_name"] == "Empty Perf Cohort"
    assert data["subjects"] == []

    db.delete(cohort)
    db.commit()
