"""
app/platform/crud_generator.py

Auto-generate FastAPI CRUD routers and Pydantic schemas from EntityConfig.
All generated endpoints require authentication via get_current_user dependency.
"""
import json
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam, status
from pydantic import BaseModel, create_model
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.platform.yaml_loader import EntityConfig

# Mapping from YAML field types to Python types for Pydantic schema generation
PYDANTIC_TYPE_MAP: dict[str, type] = {
    "string": str,
    "text": str,
    "int": int,
    "decimal": float,
    "date": str,
    "datetime": str,
    "boolean": bool,
    "jsonb": Any,
    "enum": str,
}


def build_pydantic_schema(entity_config: EntityConfig, schema_name: str) -> type[BaseModel]:
    """Build a Pydantic model from an EntityConfig.

    Required fields use (py_type, ...), optional fields use (Optional[py_type], None).
    """
    field_definitions: dict[str, Any] = {}
    for fd in entity_config.fields:
        py_type = PYDANTIC_TYPE_MAP.get(fd.type, str)
        if fd.required:
            field_definitions[fd.name] = (py_type, ...)
        else:
            field_definitions[fd.name] = (Optional[py_type], None)
    return create_model(schema_name, **field_definitions)


def build_crud_router(entity_config: EntityConfig, model_cls: type) -> APIRouter:
    """Build a FastAPI CRUD router for an entity.

    Produces 5 endpoints: list, create, get-by-id, update, delete.
    All endpoints require authentication via Depends(get_current_user).
    Router prefix is /{entity_config.table} (e.g. /students).
    """
    prefix = f"/{entity_config.table}"
    tag = entity_config.name
    router = APIRouter(prefix=prefix, tags=[tag])

    CreateSchema = build_pydantic_schema(entity_config, f"{entity_config.name.capitalize()}Create")
    UpdateSchema = build_pydantic_schema(entity_config, f"{entity_config.name.capitalize()}Update")

    @router.get("", status_code=status.HTTP_200_OK)
    def list_entities(
        q: Optional[str] = QueryParam(None, description="Text search across string/text/enum fields"),
        filters: Optional[str] = QueryParam(None, description="JSON-encoded field filter dict, e.g. {\"status\": \"active\", \"age__gte\": 18}"),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        from sqlalchemy import or_
        query = db.query(model_cls)

        # Text search: ILIKE across all string/text/enum fields (per D-09, DATA-07)
        if q:
            ilike_clauses = []
            for f in entity_config.fields:
                if f.type in ("string", "text", "enum") and hasattr(model_cls, f.name):
                    ilike_clauses.append(
                        getattr(model_cls, f.name).ilike(f"%{q}%")
                    )
            if ilike_clauses:
                query = query.filter(or_(*ilike_clauses))

        # Field filters: JSON dict of field_name -> value or field_name__op -> value (per D-10, DATA-08)
        if filters:
            try:
                filter_dict = json.loads(filters)
            except (ValueError, TypeError):
                filter_dict = {}
            for key, value in filter_dict.items():
                if value in (None, "", {}):
                    continue
                # Support range operators: field__gte, field__lte
                if "__gte" in key:
                    field_name = key.replace("__gte", "")
                    if hasattr(model_cls, field_name):
                        query = query.filter(getattr(model_cls, field_name) >= value)
                elif "__lte" in key:
                    field_name = key.replace("__lte", "")
                    if hasattr(model_cls, field_name):
                        query = query.filter(getattr(model_cls, field_name) <= value)
                elif hasattr(model_cls, key):
                    query = query.filter(getattr(model_cls, key) == value)

        return query.all()

    @router.post("", status_code=status.HTTP_201_CREATED)
    def create_entity(
        payload: CreateSchema,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        obj = model_cls(**payload.model_dump())
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    @router.get("/{entity_id}", status_code=status.HTTP_200_OK)
    def get_entity(
        entity_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        obj = db.query(model_cls).filter(model_cls.id == entity_id).first()
        if not obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_config.name} not found",
            )
        return obj

    @router.put("/{entity_id}", status_code=status.HTTP_200_OK)
    def update_entity(
        entity_id: UUID,
        payload: UpdateSchema,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        obj = db.query(model_cls).filter(model_cls.id == entity_id).first()
        if not obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_config.name} not found",
            )
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(obj, key, value)
        db.commit()
        db.refresh(obj)
        return obj

    @router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_entity(
        entity_id: UUID,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ):
        obj = db.query(model_cls).filter(model_cls.id == entity_id).first()
        if not obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{entity_config.name} not found",
            )
        db.delete(obj)
        db.commit()
        return None

    return router
