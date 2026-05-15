import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-invite-testing")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import uuid
import pytest
from app.services.invite_service import (
    generate_invite_token, validate_invite_token, generate_reset_token,
    validate_reset_token, InviteError,
)

class TestGenerateInviteToken:
    def test_generates_token_string(self):
        token = generate_invite_token(student_id=str(uuid.uuid4()), email="s@school.hk", org_id=str(uuid.uuid4()))
        assert isinstance(token, str) and len(token) > 20

    def test_token_contains_expected_claims(self):
        sid = str(uuid.uuid4())
        token = generate_invite_token(student_id=sid, email="t@school.hk", org_id=str(uuid.uuid4()))
        payload = validate_invite_token(token)
        assert payload["student_id"] == sid
        assert payload["type"] == "invite"
        assert "jti" in payload

class TestValidateInviteToken:
    def test_valid_token(self):
        sid = str(uuid.uuid4())
        token = generate_invite_token(student_id=sid, email="a@b.com", org_id=str(uuid.uuid4()))
        assert validate_invite_token(token)["student_id"] == sid

    def test_expired_token(self):
        token = generate_invite_token(student_id=str(uuid.uuid4()), email="a@b.com", org_id=str(uuid.uuid4()), expires_hours=0)
        with pytest.raises(InviteError, match="expired"):
            validate_invite_token(token)

    def test_tampered_token(self):
        token = generate_invite_token(student_id=str(uuid.uuid4()), email="a@b.com", org_id=str(uuid.uuid4()))
        with pytest.raises(InviteError):
            validate_invite_token(token[:-5] + "XXXXX")

    def test_wrong_type(self):
        token = generate_reset_token(user_id=str(uuid.uuid4()), email="a@b.com")
        with pytest.raises(InviteError, match="type"):
            validate_invite_token(token)

class TestResetToken:
    def test_generates_and_validates(self):
        uid = str(uuid.uuid4())
        token = generate_reset_token(user_id=uid, email="a@b.com")
        payload = validate_reset_token(token)
        assert payload["type"] == "reset" and payload["user_id"] == uid

    def test_invite_rejected_as_reset(self):
        token = generate_invite_token(student_id=str(uuid.uuid4()), email="a@b.com", org_id=str(uuid.uuid4()))
        with pytest.raises(InviteError, match="type"):
            validate_reset_token(token)
