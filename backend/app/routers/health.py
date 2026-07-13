from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.mongo import get_db

router = APIRouter()


@router.get("/health")
async def health_check() -> JSONResponse:
    db = get_db()
    try:
        await db.command("ping")
        db_status = "ok"
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": settings.APP_NAME,
                "version": settings.APP_VERSION,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "checks": {"mongodb": f"unreachable: {exc}"},
            },
        )

    return JSONResponse(
        content={
            "status": "ok",
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {"mongodb": db_status},
        }
    )
