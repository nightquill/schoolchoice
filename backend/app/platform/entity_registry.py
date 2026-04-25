"""
app/platform/entity_registry.py

Dynamic SQLAlchemy model generation from EntityConfig.
Models share the same Base/metadata as hand-written models.
"""
import uuid
import logging
from sqlalchemy import Column, String, Integer, Text, Boolean, Date, DateTime, Numeric, CheckConstraint
from sqlalchemy import JSON as JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.sql import func
from app.db.models import Base
from app.platform.yaml_loader import EntityConfig, FieldConfig

logger = logging.getLogger(__name__)

FIELD_TYPE_MAP = {
    "string":   lambda cfg: Column(String(cfg.max_length or 255), nullable=not cfg.required),
    "text":     lambda cfg: Column(Text, nullable=not cfg.required),
    "int":      lambda cfg: Column(Integer, nullable=not cfg.required),
    "decimal":  lambda cfg: Column(Numeric(10, 4), nullable=not cfg.required),
    "date":     lambda cfg: Column(Date, nullable=not cfg.required),
    "datetime": lambda cfg: Column(DateTime(timezone=True), nullable=not cfg.required),
    "boolean":  lambda cfg: Column(Boolean, nullable=True, default=False),
    "jsonb":    lambda cfg: Column(JSONB, nullable=True),
}


class EntityRegistry:
    def __init__(self):
        self._models: dict[str, type] = {}
        self._configs: dict[str, EntityConfig] = {}

    def register(self, config: EntityConfig) -> type:
        """Build and register a SQLAlchemy model class for the entity config."""
        attrs = {
            "__tablename__": config.table,
            "__allow_unmapped__": True,
            "id": Column(
                PG_UUID(as_uuid=True), primary_key=True,
                default=uuid.uuid4, server_default=func.gen_random_uuid(), nullable=False,
            ),
        }
        table_args = []
        for fd in config.fields:
            if fd.type == "enum":
                col = Column(String(50), nullable=not fd.required)
                if fd.choices:
                    constraint_name = f"ck_{config.table}_{fd.name}"
                    choices_str = ", ".join(f"'{c}'" for c in fd.choices)
                    table_args.append(CheckConstraint(
                        f"{fd.name} IN ({choices_str})", name=constraint_name
                    ))
                attrs[fd.name] = col
            else:
                builder = FIELD_TYPE_MAP.get(fd.type, FIELD_TYPE_MAP["string"])
                attrs[fd.name] = builder(fd)
        if table_args:
            attrs["__table_args__"] = tuple(table_args)
        model_cls = type(config.name.capitalize(), (Base,), attrs)
        self._models[config.name] = model_cls
        self._configs[config.name] = config
        logger.info(f"Entity registered: {config.name} -> table '{config.table}'")
        return model_cls

    def get_model(self, name: str):
        return self._models.get(name)

    def get_config(self, name: str):
        return self._configs.get(name)

    def all_configs(self) -> list[EntityConfig]:
        return list(self._configs.values())

    def all_models(self) -> list[type]:
        return list(self._models.values())


# Module-level singleton
registry = EntityRegistry()
