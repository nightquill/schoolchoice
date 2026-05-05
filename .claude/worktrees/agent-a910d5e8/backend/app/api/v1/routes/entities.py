"""
app/api/v1/routes/entities.py

Entity registry endpoints — list all registered entities and return their
YAML config as JSON for frontend schema-driven rendering (PLAT-03 D-06, D-08).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.db.models import User
from app.platform.entity_registry import registry

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("", status_code=200)
def list_entities(current_user: User = Depends(get_current_user)):
    """Return list of all registered entity names and metadata (D-08)."""
    return [
        {
            "name": c.name,
            "table": c.table,
            "auto_crud": getattr(c, "auto_crud", True),
        }
        for c in registry.all_configs()
    ]


@router.get("/{name}/schema", status_code=200)
def get_entity_schema(name: str, current_user: User = Depends(get_current_user)):
    """Return entity config as JSON for frontend schema-driven rendering (D-06)."""
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
    return {
        "name": config.name,
        "table": config.table,
        "fields": [
            {
                "name": f.name,
                "type": f.type,
                "required": f.required,
                "choices": getattr(f, "choices", None),
                "max_length": getattr(f, "max_length", None),
            }
            for f in config.fields
        ],
    }
