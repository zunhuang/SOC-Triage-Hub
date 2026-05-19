"""Schemas for authentication endpoints."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    role: Literal["admin", "analyst"]
    auth_provider: Literal["local", "azure"]
    is_active: bool
    last_login: datetime | None = None
