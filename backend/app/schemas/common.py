from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: str
    code: str
    details: object | None = None
