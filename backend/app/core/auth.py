"""FastAPI dependencies for authentication and role-based access control."""
from fastapi import Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.cache import cache
from app.core.errors import AppError
from app.db.mongo import get_db
from app.utils.auth import decode_token
from app.utils.serialization import serialize

_USER_CACHE_TTL = 300  # 5 minutes


async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        raise AppError("Not authenticated", "not_authenticated", status_code=401)

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise AppError("Invalid or expired token", "invalid_token", status_code=401)

    user_id = payload.get("sub")
    if not user_id:
        raise AppError("Invalid token payload", "invalid_token", status_code=401)

    cache_key = f"user:{user_id}"
    cached_user = await cache.get(cache_key)
    if cached_user is not None:
        return cached_user

    from bson import ObjectId

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise AppError("Invalid token payload", "invalid_token", status_code=401)

    user = await db.users.find_one({"_id": oid})
    if not user:
        raise AppError("User not found", "user_not_found", status_code=401)

    doc = serialize(user)
    doc["id"] = doc.pop("_id")
    await cache.set(cache_key, doc, ttl_seconds=_USER_CACHE_TTL)
    return doc


async def get_current_active_user(
    user: dict = Depends(get_current_user),
) -> dict:
    if not user.get("is_active", True):
        raise AppError("Account is inactive", "inactive_user", status_code=403)
    return user


async def require_admin(
    user: dict = Depends(get_current_active_user),
) -> dict:
    if user.get("role") != "admin":
        raise AppError("Admin access required", "forbidden", status_code=403)
    return user
