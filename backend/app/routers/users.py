"""
Users Router
User management endpoints.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.postgres import get_db
from app.models.postgres_models import User
from app.models.schemas import (
    UserResponse, UserUpdate, UserListResponse, MessageResponse
)
from app.middleware.rbac import get_current_active_user, require_admin


router = APIRouter()


@router.get("/", response_model=UserListResponse)
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)."""
    # Get total count
    count_result = await db.execute(select(func.count(User.id)))
    total = count_result.scalar()

    # Get users
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()

    return UserListResponse(
        users=users,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a user by ID."""
    # Users can view their own profile, admins can view anyone
    if str(current_user.id) != str(user_id) and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a user."""
    # Users can update their own profile (limited fields), admins can update anyone
    is_self = str(current_user.id) == str(user_id)

    if not is_self and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Apply updates
    update_dict = update_data.model_dump(exclude_unset=True)

    # Non-admins can't change is_active
    if not current_user.is_admin and "is_active" in update_dict:
        del update_dict["is_active"]

    for field, value in update_dict.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    return user


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a user (admin only)."""
    # Prevent self-deletion
    if str(current_user.id) == str(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    await db.delete(user)
    await db.commit()

    return MessageResponse(message="User deleted successfully")
