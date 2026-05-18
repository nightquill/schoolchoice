import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import pytest
from app.services.permission_service import merge_permissions, TOOL_FIELDS, ROLE_DEFAULTS


class TestMergePermissions:
    def test_single_permission(self):
        perms = [{"visible": True, "grades": "read_only", "submissions": "none", "programme_choices": "read_write", "plan_generation": "read_write", "reports": "read_only", "cohort_management": "none"}]
        result = merge_permissions(perms)
        assert result["visible"] is True
        assert result["grades"] == "read_only"
        assert result["submissions"] == "none"

    def test_most_permissive_wins(self):
        perms = [
            {"visible": True, "grades": "read_only", "submissions": "none", "programme_choices": "read_write", "plan_generation": "none", "reports": "none", "cohort_management": "none"},
            {"visible": True, "grades": "read_write", "submissions": "read_only", "programme_choices": "none", "plan_generation": "read_write", "reports": "read_only", "cohort_management": "none"},
        ]
        result = merge_permissions(perms)
        assert result["grades"] == "read_write"
        assert result["submissions"] == "read_only"
        assert result["programme_choices"] == "read_write"
        assert result["plan_generation"] == "read_write"

    def test_visible_true_wins(self):
        perms = [
            {"visible": False, **{f: "none" for f in TOOL_FIELDS}},
            {"visible": True, **{f: "read_only" for f in TOOL_FIELDS}},
        ]
        result = merge_permissions(perms)
        assert result["visible"] is True

    def test_empty_returns_defaults(self):
        result = merge_permissions([])
        assert result["visible"] is False
        for f in TOOL_FIELDS:
            assert result[f] == "none"


class TestRoleDefaults:
    def test_admin_all_readwrite(self):
        d = ROLE_DEFAULTS["admin"]
        assert d["visible"] is True
        for f in TOOL_FIELDS:
            assert d[f] == "read_write"

    def test_counsellor_defaults(self):
        d = ROLE_DEFAULTS["counsellor"]
        assert d["visible"] is True and d["grades"] == "read_write" and d["cohort_management"] == "none"

    def test_student_defaults(self):
        d = ROLE_DEFAULTS["student"]
        assert d["grades"] == "read_only" and d["plan_generation"] == "none"

    def test_counsellor_no_elevated(self):
        d = ROLE_DEFAULTS["counsellor"]
        assert d["data_import"] == "none"
        assert d["account_assignment"] == "none"

    def test_student_no_elevated(self):
        d = ROLE_DEFAULTS["student"]
        assert d["data_import"] == "none"
        assert d["account_assignment"] == "none"

    def test_tool_fields_count(self):
        assert len(TOOL_FIELDS) == 8
        assert "data_import" in TOOL_FIELDS
        assert "account_assignment" in TOOL_FIELDS
