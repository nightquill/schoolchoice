"""Tests for PDPO compliance (Decision #20)."""
from app.services.pii_filter import strip_hkid, strip_pii


def test_strip_hkid_from_text():
    text = "Student HKID: A123456(7) and notes"
    result = strip_hkid(text)
    assert "A123456(7)" not in result
    assert "[HKID REDACTED]" in result


def test_strip_hkid_various_formats():
    for text in ["ID: AB123456(7)", "id: C1234567", "HKID A123456(A)"]:
        result = strip_hkid(text)
        assert "[HKID REDACTED]" in result, f"Failed for: {text}"


def test_strip_pii_leaves_clean_text():
    text = "The student likes mathematics and science."
    assert strip_pii(text) == text


def test_consent_model_exists():
    from app.modules.school_choice.models.consent import ConsentRecord
    assert hasattr(ConsentRecord, "student_id")
    assert hasattr(ConsentRecord, "consent_type")
    assert hasattr(ConsentRecord, "granted_at")
    assert hasattr(ConsentRecord, "revoked_at")


def test_consent_endpoint_unauthenticated(client):
    resp = client.get("/api/v1/consent/00000000-0000-0000-0000-000000000001")
    assert resp.status_code == 401
