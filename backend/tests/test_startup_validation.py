"""
tests/test_startup_validation.py

Tests for startup config validation (DEP-04).
Verifies that Settings() rejects forbidden placeholder SECRET_KEY values
and accepts legitimate secrets.

NOTE: These tests manipulate os.environ and reload the config module.
The restore step after each test is critical to avoid breaking other modules.
"""
from __future__ import annotations

import os

# Ensure baseline env vars are set so the module can load initially.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")

import pytest


def _reload_config():
    """Reload app.core.config to re-instantiate Settings."""
    from importlib import reload

    import app.core.config as cfg_module
    reload(cfg_module)
    return cfg_module


def test_placeholder_secret_key_raises():
    """Settings must reject the default .env.example SECRET_KEY."""
    orig_sk = os.environ.get("SECRET_KEY")
    orig_db = os.environ.get("DATABASE_URL")

    os.environ["SECRET_KEY"] = "dev-secret-key-do-not-use-in-production-abc123"
    os.environ["DATABASE_URL"] = "postgresql+psycopg2://x:x@localhost/db"

    try:
        with pytest.raises((ValueError, Exception)):
            _reload_config()
    finally:
        # Restore originals
        if orig_sk is not None:
            os.environ["SECRET_KEY"] = orig_sk
        if orig_db is not None:
            os.environ["DATABASE_URL"] = orig_db
        _reload_config()


def test_changeme_secret_key_raises():
    """Settings must reject CHANGE_ME as SECRET_KEY."""
    orig_sk = os.environ.get("SECRET_KEY")
    orig_db = os.environ.get("DATABASE_URL")

    os.environ["SECRET_KEY"] = "CHANGE_ME"
    os.environ["DATABASE_URL"] = "postgresql+psycopg2://x:x@localhost/db"

    try:
        with pytest.raises((ValueError, Exception)):
            _reload_config()
    finally:
        if orig_sk is not None:
            os.environ["SECRET_KEY"] = orig_sk
        if orig_db is not None:
            os.environ["DATABASE_URL"] = orig_db
        _reload_config()


def test_changeme_lowercase_secret_key_raises():
    """Settings must reject 'changeme' as SECRET_KEY."""
    orig_sk = os.environ.get("SECRET_KEY")
    orig_db = os.environ.get("DATABASE_URL")

    os.environ["SECRET_KEY"] = "changeme"
    os.environ["DATABASE_URL"] = "postgresql+psycopg2://x:x@localhost/db"

    try:
        with pytest.raises((ValueError, Exception)):
            _reload_config()
    finally:
        if orig_sk is not None:
            os.environ["SECRET_KEY"] = orig_sk
        if orig_db is not None:
            os.environ["DATABASE_URL"] = orig_db
        _reload_config()


def test_valid_secret_key_passes():
    """Settings must accept a legitimate secret key (the test key)."""
    orig_sk = os.environ.get("SECRET_KEY")
    orig_db = os.environ.get("DATABASE_URL")

    os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only-not-for-production"
    os.environ["DATABASE_URL"] = "sqlite:///:memory:"

    try:
        cfg = _reload_config()
        assert cfg.settings.SECRET_KEY == "test-secret-key-for-pytest-only-not-for-production"
    finally:
        if orig_sk is not None:
            os.environ["SECRET_KEY"] = orig_sk
        if orig_db is not None:
            os.environ["DATABASE_URL"] = orig_db
        _reload_config()
