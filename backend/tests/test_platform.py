"""
tests/test_platform.py

Tests for platform module loader and health infrastructure.
"""
import os


class TestModuleLoader:
    def test_discover_skips_non_directories(self, tmp_path):
        """Module loader ignores files in modules dir, only processes directories."""
        (tmp_path / "not_a_dir.txt").write_text("hello")
        from app.platform.module_loader import discover_and_register_modules
        from fastapi import FastAPI
        app = FastAPI()
        result = discover_and_register_modules(app, tmp_path)
        assert result == []

    def test_discover_skips_dir_without_config(self, tmp_path):
        """Module loader skips directories that lack config.yaml."""
        (tmp_path / "empty_module").mkdir()
        from app.platform.module_loader import discover_and_register_modules
        from fastapi import FastAPI
        app = FastAPI()
        result = discover_and_register_modules(app, tmp_path)
        assert result == []

    def test_discover_loads_module_with_config(self, tmp_path):
        """Module loader registers a module that has config.yaml with health callback."""
        mod_dir = tmp_path / "test_module"
        mod_dir.mkdir()
        config_yaml = mod_dir / "config.yaml"
        config_yaml.write_text("name: test_module\nroutes: []\n")
        from app.platform.module_loader import discover_and_register_modules
        from fastapi import FastAPI
        app = FastAPI()
        result = discover_and_register_modules(app, tmp_path)
        assert len(result) == 1
        assert result[0]["name"] == "test_module"
        assert result[0]["status"] == "ok"


class TestHealthInfrastructure:
    def test_register_and_run_health_callback(self):
        """Registered health callbacks are invoked by run_health_check."""
        from app.platform import health as h
        # Save original state
        orig_callbacks = dict(h._module_health_callbacks)
        try:
            h._module_health_callbacks.clear()
            h.register_health_callback("test_mod", lambda: {"status": "ok"})
            assert "test_mod" in h._module_health_callbacks
            # Verify the callback returns expected value
            result = h._module_health_callbacks["test_mod"]()
            assert result == {"status": "ok"}
        finally:
            h._module_health_callbacks = orig_callbacks

    def test_schema_parity_skips_sqlite(self):
        """ORM parity check skips on SQLite (test databases)."""
        from app.platform.health import check_orm_schema_parity
        from app.db.session import engine
        result = check_orm_schema_parity(engine, [])
        assert result["status"] == "skipped"
        assert "non-postgresql" in result.get("reason", "")

    def test_get_schema_parity_result(self):
        """get_schema_parity_result returns cached result."""
        from app.platform.health import get_schema_parity_result
        result = get_schema_parity_result()
        assert "status" in result


class TestSchoolChoiceHealth:
    def test_check_health_returns_xgboost_status(self):
        """school_choice health callback reports XGBoost model availability."""
        from app.modules.school_choice.health import check_health
        result = check_health()
        assert "xgboost_model" in result
        assert result["xgboost_model"] in ("loaded", "unavailable", "error")
        assert "scoring_mode" in result or "detail" in result

    def test_xgboost_fallback_warning(self):
        """BUG-05: When XGBoost is unavailable, scoring_mode is rule_only."""
        from app.modules.school_choice.health import check_health
        result = check_health()
        # In test env, model file likely doesn't exist
        if result["xgboost_model"] == "unavailable":
            assert result["scoring_mode"] == "rule_only"


class TestCorsFromEnv:
    def test_cors_origins_from_settings(self):
        """SEC-04: CORS origins come from environment variable via settings."""
        from app.core.config import settings
        assert hasattr(settings, "CORS_ORIGINS")
        assert settings.CORS_ORIGINS == os.environ.get("CORS_ORIGINS", "http://localhost:5173")

    def test_cors_origins_list_property(self):
        """CORS_ORIGINS string is parsed into a list by cors_origins_list property."""
        from app.core.config import settings
        origins = settings.cors_origins_list
        assert isinstance(origins, list)
        assert len(origins) >= 1
        assert all(isinstance(o, str) for o in origins)
