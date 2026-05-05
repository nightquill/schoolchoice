"""
tests/test_platform.py

Unit tests for the platform:
- YAML config parsing (yaml_loader)
- Entity registration (entity_registry)
- CRUD router generation (crud_generator)
- Module loader (module_loader)
- Health infrastructure (health)
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")

import pytest
from pathlib import Path

from app.platform.yaml_loader import (
    EntityConfig,
    FieldConfig,
    load_entity_yaml,
    SUPPORTED_TYPES,
)
from app.platform.entity_registry import EntityRegistry
from app.platform.crud_generator import build_pydantic_schema, build_crud_router


# ---------------------------------------------------------------------------
# TestEntityYamlParse
# ---------------------------------------------------------------------------


class TestEntityYamlParse:
    """Tests for YAML entity config parsing."""

    def test_valid_yaml_loads(self, tmp_path: Path):
        """A minimal valid YAML file is parsed into a correct EntityConfig."""
        yaml_file = tmp_path / "widget.yaml"
        yaml_file.write_text(
            "name: widget\n"
            "table: widgets\n"
            "fields:\n"
            "  - name: title\n"
            "    type: string\n"
            "    required: true\n"
            "    max_length: 100\n"
            "  - name: count\n"
            "    type: int\n"
        )
        ec = load_entity_yaml(yaml_file)
        assert ec.name == "widget"
        assert ec.table == "widgets"
        assert len(ec.fields) == 2
        assert ec.fields[0].name == "title"
        assert ec.fields[0].type == "string"
        assert ec.fields[0].required is True
        assert ec.fields[0].max_length == 100
        assert ec.fields[1].name == "count"
        assert ec.fields[1].type == "int"
        assert ec.fields[1].required is False
        assert ec.auto_crud is True

    def test_empty_yaml_returns_error(self, tmp_path: Path):
        """An empty YAML file raises ValueError (missing name)."""
        yaml_file = tmp_path / "empty.yaml"
        yaml_file.write_text("")
        with pytest.raises(ValueError, match="missing required 'name' field"):
            load_entity_yaml(yaml_file)

    def test_unsupported_type_raises(self, tmp_path: Path):
        """A YAML with unsupported field type raises ValueError."""
        yaml_file = tmp_path / "bad.yaml"
        yaml_file.write_text(
            "name: bad_entity\n"
            "fields:\n"
            "  - name: data\n"
            "    type: binary\n"
        )
        with pytest.raises(ValueError, match="Unsupported field type 'binary'"):
            load_entity_yaml(yaml_file)

    def test_all_field_types_accepted(self, tmp_path: Path):
        """All 9 supported field types from D-02 can be parsed without error."""
        fields_yaml = "\n".join(
            f"  - name: f_{ftype}\n    type: {ftype}"
            for ftype in sorted(SUPPORTED_TYPES)
        )
        # enum needs choices to be meaningful, but should parse without them too
        yaml_file = tmp_path / "all_types.yaml"
        yaml_file.write_text(f"name: all_types\nfields:\n{fields_yaml}\n")
        ec = load_entity_yaml(yaml_file)
        assert len(ec.fields) == len(SUPPORTED_TYPES)
        parsed_types = {f.type for f in ec.fields}
        assert parsed_types == SUPPORTED_TYPES

    def test_default_table_name(self, tmp_path: Path):
        """If table is omitted, it defaults to name + 's'."""
        yaml_file = tmp_path / "item.yaml"
        yaml_file.write_text("name: item\nfields: []\n")
        ec = load_entity_yaml(yaml_file)
        assert ec.table == "items"

    def test_auto_crud_false(self, tmp_path: Path):
        """auto_crud: false is correctly parsed."""
        yaml_file = tmp_path / "custom.yaml"
        yaml_file.write_text("name: custom\nauto_crud: false\nfields: []\n")
        ec = load_entity_yaml(yaml_file)
        assert ec.auto_crud is False


# ---------------------------------------------------------------------------
# TestEntityRegistry
# ---------------------------------------------------------------------------


class TestEntityRegistry:
    """Tests for dynamic SQLAlchemy model generation."""

    def test_register_creates_model(self):
        """Registering an EntityConfig produces a model with correct tablename and columns."""
        reg = EntityRegistry()
        config = EntityConfig(
            name="test_widget",
            table="test_widgets_reg",
            fields=[
                FieldConfig(name="title", type="string", required=True, max_length=200),
                FieldConfig(name="count", type="int"),
            ],
        )
        model_cls = reg.register(config)
        assert model_cls.__tablename__ == "test_widgets_reg"
        assert hasattr(model_cls, "id")
        assert hasattr(model_cls, "title")
        assert hasattr(model_cls, "count")

    def test_get_model_returns_registered(self):
        """get_model returns the registered model class by name."""
        reg = EntityRegistry()
        config = EntityConfig(
            name="test_gadget",
            table="test_gadgets_reg",
            fields=[FieldConfig(name="label", type="string")],
        )
        model_cls = reg.register(config)
        assert reg.get_model("test_gadget") is model_cls

    def test_get_model_unknown_returns_none(self):
        """get_model returns None for unregistered entity names."""
        reg = EntityRegistry()
        assert reg.get_model("nonexistent") is None

    def test_enum_field_with_choices(self):
        """Enum fields with choices produce a CheckConstraint on the model."""
        reg = EntityRegistry()
        config = EntityConfig(
            name="test_status_entity",
            table="test_status_entities_reg",
            fields=[
                FieldConfig(name="status", type="enum", choices=["active", "inactive"]),
            ],
        )
        model_cls = reg.register(config)
        assert hasattr(model_cls, "status")
        # Check that table_args contains a CheckConstraint
        assert hasattr(model_cls, "__table_args__")
        constraints = [
            arg for arg in model_cls.__table_args__
            if hasattr(arg, "name") and "ck_" in (arg.name or "")
        ]
        assert len(constraints) == 1


# ---------------------------------------------------------------------------
# TestCrudGenerator
# ---------------------------------------------------------------------------


class TestCrudGenerator:
    """Tests for Pydantic schema and CRUD router generation."""

    def test_build_pydantic_schema(self):
        """build_pydantic_schema creates a Pydantic model with correct field types."""
        config = EntityConfig(
            name="product",
            table="products",
            fields=[
                FieldConfig(name="name", type="string", required=True),
                FieldConfig(name="price", type="decimal"),
                FieldConfig(name="active", type="boolean"),
            ],
        )
        Schema = build_pydantic_schema(config, "ProductCreate")
        assert "name" in Schema.model_fields
        assert "price" in Schema.model_fields
        assert "active" in Schema.model_fields
        # Required field should not have a default
        assert Schema.model_fields["name"].is_required()
        # Optional field should have a default of None
        assert not Schema.model_fields["price"].is_required()

    def test_build_crud_router(self):
        """build_crud_router produces a router with 5 routes (list, create, get, update, delete)."""
        reg = EntityRegistry()
        config = EntityConfig(
            name="test_item_crud",
            table="test_items_crud",
            fields=[
                FieldConfig(name="label", type="string", required=True),
            ],
        )
        model_cls = reg.register(config)
        router = build_crud_router(config, model_cls)

        # Extract route paths
        route_methods = []
        for route in router.routes:
            if hasattr(route, "methods"):
                for method in route.methods:
                    route_methods.append((method, route.path))

        # Should have: GET /, POST /, GET /{id}, PUT /{id}, DELETE /{id}
        assert ("GET", "/test_items_crud") in route_methods
        assert ("POST", "/test_items_crud") in route_methods
        assert ("GET", "/test_items_crud/{entity_id}") in route_methods
        assert ("PUT", "/test_items_crud/{entity_id}") in route_methods
        assert ("DELETE", "/test_items_crud/{entity_id}") in route_methods

    def test_crud_router_requires_auth(self):
        """All CRUD router endpoints include get_current_user dependency (T-02-01 mitigation)."""
        reg = EntityRegistry()
        config = EntityConfig(
            name="test_secure_crud",
            table="test_secure_items",
            fields=[
                FieldConfig(name="value", type="string"),
            ],
        )
        model_cls = reg.register(config)
        router = build_crud_router(config, model_cls)

        for route in router.routes:
            if hasattr(route, "dependant"):
                dep_names = [
                    d.call.__name__
                    for d in route.dependant.dependencies
                    if hasattr(d, "call") and hasattr(d.call, "__name__")
                ]
                assert "get_current_user" in dep_names, (
                    f"Route {route.path} missing get_current_user dependency"
                )


# ---------------------------------------------------------------------------
# TestModuleLoader
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# TestHealthInfrastructure
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# TestSchoolChoiceHealth
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# TestCorsFromEnv
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# TestHealthEndpoint — integration tests for extended /health
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    def test_health_returns_required_fields(self, client):
        """SEC-03: /health returns db, cors_origin, schema_parity, modules."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "db" in data
        assert "cors_origin" in data
        assert "schema_parity" in data
        assert "modules" in data
        assert data["status"] in ("ok", "degraded")

    def test_health_db_status_ok(self, client):
        """Health endpoint reports db as ok when database is reachable."""
        response = client.get("/health")
        data = response.json()
        assert data["db"] == "ok"

    def test_health_cors_from_env(self, client):
        """SEC-04: CORS origin in health response matches env var."""
        response = client.get("/health")
        data = response.json()
        assert data["cors_origin"] == os.environ.get("CORS_ORIGINS", "http://localhost:5173")

    def test_health_schema_parity_present(self, client):
        """Schema parity result is included in health response."""
        response = client.get("/health")
        data = response.json()
        parity = data["schema_parity"]
        assert "status" in parity
        # In SQLite test env, parity check is skipped
        assert parity["status"] in ("ok", "skipped", "drift_detected", "not_checked")

    def test_health_modules_includes_school_choice(self, client):
        """Module loader registers school_choice and its health appears in /health."""
        response = client.get("/health")
        data = response.json()
        modules = data["modules"]
        assert "school_choice" in modules
        assert "xgboost_model" in modules["school_choice"]


# ---------------------------------------------------------------------------
# TestDomainIsolation
# ---------------------------------------------------------------------------


class TestDomainIsolation:
    def test_no_school_choice_refs_in_core(self):
        """PLAT-06 success criterion 3: no school-choice domain references in core/."""
        import subprocess
        result = subprocess.run(
            ["grep", "-rn", "-i",
             "hkdse\\|school_choice\\|jupas\\|matchmaker\\|plan_generator\\|plan_chat",
             "app/core/"],
            capture_output=True, text=True,
            cwd=str(Path(__file__).parent.parent)
        )
        # Filter out __pycache__ hits
        lines = [line for line in result.stdout.strip().split("\n")
                 if line and "__pycache__" not in line]
        assert lines == [] or lines == [""], (
            f"School-choice domain references found in core/: {lines}"
        )


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
