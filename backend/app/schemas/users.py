"""Schemas for user management endpoints."""
from typing import Literal

from pydantic import BaseModel, EmailStr


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None
    role: Literal["admin", "analyst"] = "analyst"


class UserPatchRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    role: Literal["admin", "analyst"] | None = None
    is_active: bool | None = None
