"""
app/platform/schemas/consultant_output.py

Pydantic v2 output models for the consultant engine.
ConsultantPlanOutput validates AI-generated school choice plan JSON.
Request/response schemas for consultant task endpoints.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class SchoolRecommendation(BaseModel):
    school_name: str
    jupas_code: Optional[str] = None
    rationale: str = Field(min_length=20)
    fit_score: float = Field(ge=0.0, le=1.0)
    confidence_tier: str = Field(pattern=r"^(LOW|MEDIUM|HIGH)$")
    action_items: list[str] = Field(default_factory=list)


class ConsultantPlanOutput(BaseModel):
    student_summary: str = Field(min_length=50)
    recommended_schools: list[SchoolRecommendation] = Field(min_length=1, max_length=15)
    skill_gaps: list[str] = Field(default_factory=list)
    language_readiness: Optional[str] = None
    action_plan: list[dict] = Field(default_factory=list)

    @field_validator("recommended_schools")
    @classmethod
    def schools_have_rationale(cls, schools: list[SchoolRecommendation]) -> list[SchoolRecommendation]:
        for s in schools:
            if not s.rationale.strip():
                raise ValueError(f"School '{s.school_name}' has empty rationale")
        return schools


class ConsultantTaskRequest(BaseModel):
    task_id: str
    entity_id: str


class ConsultantSaveRequest(BaseModel):
    task_id: str
    entity_id: str
    ai_output_json: str  # raw JSON string from frontend SSE buffer


class ConsultantTaskResponse(BaseModel):
    id: str  # plan ID (UUID as string)
    version: int
    html_content: Optional[str] = None
    recommended_schools: Optional[list] = None
    action_items: Optional[list] = None

    model_config = {"from_attributes": True}
