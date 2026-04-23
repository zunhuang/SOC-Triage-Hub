"""
Authentication Router
Login, register, token refresh, and password management.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.postgres import get_db
from app.models.postgres_models import User
from app.models.schemas import (
    RegisterRequest, Token, TokenRefresh, PasswordChange,
    UserResponse, MessageResponse
)
from app.utils.auth import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, decode_token
)
from app.middleware.rbac import get_current_active_user


router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if username already exists (if provided)
    if request.username:
        result = await db.execute(select(User).where(User.username == request.username))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )

    # Create user
    user = User(
        email=request.email,
        username=request.username,
        password_hash=get_password_hash(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login with email and password."""
    # Find user by email (username field contains email)
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()

    # Generate tokens
    token_data = {"user_id": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return Token(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: TokenRefresh,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token."""
    payload = decode_token(request.refresh_token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = payload.get("user_id")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Generate new tokens
    token_data = {"user_id": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user profile."""
    return current_user


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password."""
    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change password for SSO users"
        )

    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    current_user.password_hash = get_password_hash(request.new_password)
    await db.commit()

    return MessageResponse(message="Password changed successfully")


@router.post("/logout", response_model=MessageResponse)
async def logout(current_user: User = Depends(get_current_active_user)):
    """Logout (client should discard tokens)."""
    # In a more complex setup, you might blacklist the token here
    return MessageResponse(message="Logged out successfully")
