"""User management routes (admin-only CRUD)."""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.auth import get_current_active_user, require_admin
from app.core.errors import AppError
from app.core.logger import log_json
from app.db.mongo import get_db
from app.schemas.users import UserCreateRequest, UserPatchRequest
from app.utils.auth import get_password_hash
from app.utils.serialization import serialize

router = APIRouter(tags=["users"])


def _user_out(user: dict) -> dict:
    u = serialize(user)
    u["id"] = u.pop("_id")
    u.pop("password_hash", None)
    return u


@router.get("/api/users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    total = await db.users.count_documents({})
    cursor = db.users.find({}).sort("created_at", -1).skip(skip).limit(limit)
    users = [_user_out(u) async for u in cursor]
    return {"users": users, "total": total, "skip": skip, "limit": limit}


@router.post("/api/users", status_code=201)
async def create_user(
    body: UserCreateRequest,
    _admin: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise AppError("Email already registered", "email_conflict", status_code=409)

    now = datetime.now(timezone.utc)
    doc = {
        "email": email,
        "password_hash": get_password_hash(body.password),
        "first_name": body.first_name,
        "last_name": body.last_name,
        "role": body.role,
        "auth_provider": "local",
        "azure_oid": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
        "last_login": None,
    }
    result = await db.users.insert_one(doc)
    user = await db.users.find_one({"_id": result.inserted_id})
    log_json("info", "users", "create", "User created", email=email)
    return _user_out(user)


@router.patch("/api/users/{user_id}")
async def patch_user(
    user_id: str,
    body: UserPatchRequest,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise AppError("Invalid user ID", "invalid_id", status_code=400)

    is_self = current_user["id"] == user_id
    is_admin = current_user.get("role") == "admin"

    if not is_self and not is_admin:
        raise AppError("Not authorised", "forbidden", status_code=403)

    updates = body.model_dump(exclude_unset=True)
    # Non-admins may only update their own name
    if not is_admin:
        updates = {k: v for k, v in updates.items() if k in ("first_name", "last_name")}

    if not updates:
        user = await db.users.find_one({"_id": oid})
        return _user_out(user)

    updates["updated_at"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": oid}, {"$set": updates})
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise AppError("User not found", "not_found", status_code=404)
    return _user_out(user)


@router.delete("/api/users/{user_id}")
async def deactivate_user(
    user_id: str,
    current_user: dict = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    if current_user["id"] == user_id:
        raise AppError("Cannot deactivate your own account", "self_deactivate", status_code=400)

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise AppError("Invalid user ID", "invalid_id", status_code=400)

    user = await db.users.find_one({"_id": oid})
    if not user:
        raise AppError("User not found", "not_found", status_code=404)

    is_active = user.get("is_active", True)
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"is_active": not is_active, "updated_at": datetime.now(timezone.utc)}},
    )
    log_json("info", "users", "toggle_active", f"User {'deactivated' if is_active else 'reactivated'}", target=user["email"])
    return {"message": f"User {'deactivated' if is_active else 'reactivated'}"}
