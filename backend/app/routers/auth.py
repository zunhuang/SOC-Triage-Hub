"""Authentication routes — local login and Azure AD SSO."""
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.auth import get_current_active_user
from app.core.config import settings
from app.core.errors import AppError
from app.core.logger import log_json
from app.db.mongo import get_db
from app.schemas.auth import LoginRequest, UserResponse
from app.utils.auth import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    set_auth_cookies,
    verify_password,
)
from app.utils.serialization import serialize

router = APIRouter(tags=["auth"])

_AZURE_AUTHORIZE_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
_AZURE_TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"


def _build_user_response(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "first_name": user.get("first_name"),
        "last_name": user.get("last_name"),
        "role": user["role"],
        "auth_provider": user["auth_provider"],
        "is_active": user["is_active"],
        "last_login": user.get("last_login"),
    }


@router.post("/api/auth/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash"):
        raise AppError("Invalid email or password", "invalid_credentials", status_code=401)

    if not verify_password(body.password, user["password_hash"]):
        raise AppError("Invalid email or password", "invalid_credentials", status_code=401)

    if not user.get("is_active", True):
        raise AppError("Account is inactive", "inactive_user", status_code=403)

    user_id = str(user["_id"])
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})
    set_auth_cookies(response, access_token, refresh_token)

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}},
    )

    log_json("info", "auth", "login", "Local login", email=body.email)
    return _build_user_response(serialize(user))


@router.post("/api/auth/logout")
async def logout(response: Response) -> dict:
    clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/api/auth/refresh")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    token = request.cookies.get("refresh_token")
    if not token:
        raise AppError("No refresh token", "not_authenticated", status_code=401)

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise AppError("Invalid refresh token", "invalid_token", status_code=401)

    user_id = payload.get("sub")
    if not user_id:
        raise AppError("Invalid token payload", "invalid_token", status_code=401)

    from bson import ObjectId

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("is_active", True):
        raise AppError("User not found or inactive", "user_not_found", status_code=401)

    new_access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token({"sub": user_id})
    set_auth_cookies(response, new_access, new_refresh)
    return {"message": "Token refreshed"}


@router.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_active_user)) -> dict:
    return _build_user_response(current_user)


# ── Azure AD SSO ──────────────────────────────────────────────────────────────

@router.get("/api/auth/azure/login")
async def azure_login(request: Request) -> RedirectResponse:
    if not settings.AZURE_ENABLED:
        raise AppError("Azure AD SSO is not configured", "sso_not_configured", status_code=400)

    state = secrets.token_urlsafe(32)
    next_path = request.query_params.get("next", "/dashboard")
    state_value = f"{state}|{next_path}"

    params = {
        "client_id": settings.AZURE_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": f"{_backend_base()}/api/auth/azure/callback",
        "response_mode": "query",
        "scope": "openid profile email User.Read",
        "state": state_value,
    }
    authorize_url = _AZURE_AUTHORIZE_URL.format(tenant=settings.AZURE_TENANT_ID)
    redirect = RedirectResponse(url=f"{authorize_url}?{urlencode(params)}")
    redirect.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        max_age=600,
    )
    return redirect


@router.get("/api/auth/azure/callback")
async def azure_callback(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> RedirectResponse:
    if not settings.AZURE_ENABLED:
        raise AppError("Azure AD SSO is not configured", "sso_not_configured", status_code=400)

    code = request.query_params.get("code")
    state_param = request.query_params.get("state", "")
    stored_state = request.cookies.get("oauth_state", "")
    error = request.query_params.get("error")

    if error:
        raise AppError(f"Azure AD error: {error}", "sso_error", status_code=400)

    state_token = state_param.split("|")[0]
    next_path = state_param.split("|", 1)[1] if "|" in state_param else "/dashboard"

    if not stored_state or state_token != stored_state:
        raise AppError("Invalid OAuth state", "invalid_state", status_code=400)

    if not code:
        raise AppError("Missing authorization code", "sso_error", status_code=400)

    token_url = _AZURE_TOKEN_URL.format(tenant=settings.AZURE_TENANT_ID)
    async with httpx.AsyncClient(verify=False) as client:
        token_resp = await client.post(
            token_url,
            data={
                "client_id": settings.AZURE_CLIENT_ID,
                "client_secret": settings.AZURE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": f"{_backend_base()}/api/auth/azure/callback",
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            log_json("error", "auth", "azure_token_exchange", token_resp.text)
            raise AppError("Failed to exchange Azure code", "sso_error", status_code=502)

        azure_access_token = token_resp.json().get("access_token")

        me_resp = await client.get(
            _GRAPH_ME_URL,
            headers={"Authorization": f"Bearer {azure_access_token}"},
        )
        if me_resp.status_code != 200:
            raise AppError("Failed to fetch Azure user profile", "sso_error", status_code=502)

        graph_user = me_resp.json()

    azure_oid = graph_user.get("id")
    email = (graph_user.get("mail") or graph_user.get("userPrincipalName", "")).lower()
    first_name = graph_user.get("givenName")
    last_name = graph_user.get("surname")

    if not azure_oid or not email:
        raise AppError("Incomplete profile from Azure AD", "sso_error", status_code=502)

    now = datetime.now(timezone.utc)
    existing = await db.users.find_one({"azure_oid": azure_oid})
    if not existing:
        existing = await db.users.find_one({"email": email})

    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "azure_oid": azure_oid,
                "auth_provider": "azure",
                "first_name": first_name or existing.get("first_name"),
                "last_name": last_name or existing.get("last_name"),
                "last_login": now,
                "updated_at": now,
            }},
        )
        user = await db.users.find_one({"_id": existing["_id"]})
    else:
        doc = {
            "email": email,
            "password_hash": None,
            "first_name": first_name,
            "last_name": last_name,
            "role": "analyst",
            "auth_provider": "azure",
            "azure_oid": azure_oid,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "last_login": now,
        }
        result = await db.users.insert_one(doc)
        user = await db.users.find_one({"_id": result.inserted_id})

    user_id = str(user["_id"])
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})

    redirect = RedirectResponse(url=f"{settings.FRONTEND_URL}{next_path}")
    set_auth_cookies(redirect, access_token, refresh_token)
    redirect.delete_cookie("oauth_state")

    log_json("info", "auth", "azure_login", "Azure SSO login", email=email)
    return redirect


def _backend_base() -> str:
    return "http://localhost:8000"
