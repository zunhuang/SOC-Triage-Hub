"""
Pydantic Schemas for Request/Response Validation
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# ============================================
# Auth Schemas
# ============================================

class LoginRequest(BaseModel):
    """Login request body."""
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    """Registration request body."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None


class TokenRefresh(BaseModel):
    """Token refresh request."""
    refresh_token: str


class PasswordChange(BaseModel):
    """Password change request."""
    old_password: str
    new_password: str = Field(..., min_length=8)


# ============================================
# User Schemas
# ============================================

class UserBase(BaseModel):
    """Base user fields."""
    email: EmailStr
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserCreate(UserBase):
    """User creation schema."""
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    """User update schema."""
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """User response schema."""
    id: UUID
    is_active: bool
    is_verified: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Paginated user list response."""
    users: list[UserResponse]
    total: int
    skip: int
    limit: int


# ============================================
# Common Schemas
# ============================================

class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response schema."""
    detail: str
    error_code: Optional[str] = None
