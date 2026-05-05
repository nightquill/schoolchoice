"""
app/platform/yaml_loader.py

Parse entity YAML config files into EntityConfig dataclasses.
Supports field types per D-02: string, text, int, decimal, date, datetime, enum, boolean, jsonb.
Validation rules per D-03: required/optional, min/max, max_length, regex, choices (for enum).
"""
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

SUPPORTED_TYPES = {"string", "text", "int", "decimal", "date", "datetime", "enum", "boolean", "jsonb"}


@dataclass
class FieldConfig:
    name: str
    type: str = "string"
    required: bool = False
    max_length: Optional[int] = None
    min: Optional[float] = None
    max: Optional[float] = None
    regex: Optional[str] = None
    choices: list[str] = field(default_factory=list)


@dataclass
class EntityConfig:
    name: str
    table: str
    fields: list[FieldConfig] = field(default_factory=list)
    auto_crud: bool = True


def load_entity_yaml(path: Path) -> EntityConfig:
    """Parse a YAML entity config file into an EntityConfig dataclass.

    Raises ValueError if name is missing or field type is unsupported.
    Returns EntityConfig with null-guard for empty YAML files.
    """
    with open(path) as f:
        raw = yaml.safe_load(f) or {}  # null guard per RESEARCH.md Pitfall 3
    if "name" not in raw:
        raise ValueError(f"Entity YAML missing required 'name' field: {path}")
    fields = []
    for fd in raw.get("fields", []):
        ftype = fd.get("type", "string")
        if ftype not in SUPPORTED_TYPES:
            raise ValueError(
                f"Unsupported field type '{ftype}' in entity '{raw['name']}' "
                f"field '{fd.get('name', '?')}'"
            )
        fields.append(FieldConfig(
            name=fd["name"],
            type=ftype,
            required=fd.get("required", False),
            max_length=fd.get("max_length"),
            min=fd.get("min"),
            max=fd.get("max"),
            regex=fd.get("regex"),
            choices=fd.get("choices", []),
        ))
    return EntityConfig(
        name=raw["name"],
        table=raw.get("table", raw["name"] + "s"),
        fields=fields,
        auto_crud=raw.get("auto_crud", True),
    )
