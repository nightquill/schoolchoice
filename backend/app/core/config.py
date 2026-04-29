"""
app/core/config.py

Pydantic BaseSettings for loading environment variables at startup.
All required variables must be present or the application fails immediately.
"""
from __future__ import annotations

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Placeholder values that must never be used in production.
# NOTE: "test-secret-key-for-pytest-only-not-for-production" is intentionally
# NOT in this set — it is the value used by the test suite.
_FORBIDDEN_SECRET_KEYS = {
    "dev-secret-key-do-not-use-in-production-abc123",
    "CHANGE_ME",
    "changeme",
}


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS — stored as a comma-separated string, parsed to list by property
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """Split CORS_ORIGINS on commas and strip whitespace from each entry."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # AI provider configuration (Phase 2: AI-01, AI-02, AI-03)
    AI_PROVIDER: str = "gemini"
    AI_API_KEY: str = ""
    AI_MODEL: str = ""
    AI_BASE_URL: str = ""
    AI_TIMEOUT: int = 30

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        """Reject known-insecure placeholder values at startup."""
        errors: list[str] = []
        if self.SECRET_KEY in _FORBIDDEN_SECRET_KEYS:
            errors.append(
                "SECRET_KEY must not be the default placeholder value. "
                "Run scripts/generate_secrets.sh."
            )
        if not self.DATABASE_URL or self.DATABASE_URL == "CHANGE_ME":
            errors.append("DATABASE_URL is required and must not be a placeholder.")
        if errors:
            raise ValueError(
                "Startup validation failed — insecure configuration detected:\n"
                + "\n".join(f"  - {e}" for e in errors)
            )
        return self


settings = Settings()
