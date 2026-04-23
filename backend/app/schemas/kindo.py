from pydantic import BaseModel, Field, model_validator


class TriageRequest(BaseModel):
    incidentIds: list[str] = Field(min_length=1)
    agentId: str | None = None


class AgentPatchRequest(BaseModel):
    isActive: bool | None = None
    agentType: str | None = None

    @model_validator(mode="after")
    def validate_update(self) -> "AgentPatchRequest":
        if self.isActive is None and self.agentType is None:
            raise ValueError("Provide at least one field to update")
        return self
