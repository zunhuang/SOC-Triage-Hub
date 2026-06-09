"""Abstract database backend interface — implemented by MongoBackend and PostgresBackend."""
from __future__ import annotations

from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from typing import Any


class DatabaseBackend(ABC):
    # ── Incidents ──────────────────────────────────────────────────────────────

    @abstractmethod
    async def list_incidents(
        self,
        filters: dict[str, Any],
        sort_fields: list[tuple[str, int]],
        skip: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        """Return (page_docs, total_count). sort_fields uses MongoDB-style field names."""

    @abstractmethod
    async def get_incident(self, incident_id: str) -> dict | None: ...

    @abstractmethod
    async def get_incident_by_jira_key(self, jira_key: str) -> dict | None: ...

    @abstractmethod
    async def create_incident(self, data: dict) -> tuple[dict, str]:
        """Insert a new incident. Returns (serialized_doc, inserted_id_str)."""

    @abstractmethod
    async def update_incident(
        self,
        incident_id: str,
        set_fields: dict[str, Any],
        push_activity: list[dict] | None = None,
    ) -> dict:
        """Update incident fields. push_activity entries are appended to activityLog."""

    @abstractmethod
    async def delete_incident(self, incident_id: str) -> None:
        """Delete incident and its triage runs (cascade)."""

    # ── Agents ─────────────────────────────────────────────────────────────────

    @abstractmethod
    async def list_agents(self, sort_by: str = "name") -> list[dict]: ...

    @abstractmethod
    async def get_agent_by_kindo_id(self, kindo_agent_id: str) -> dict | None: ...

    @abstractmethod
    async def upsert_agent(
        self,
        kindo_agent_id: str,
        set_fields: dict[str, Any],
        set_on_insert: dict[str, Any] | None = None,
    ) -> None:
        """Upsert by kindoAgentId. set_on_insert fields only written on creation."""

    @abstractmethod
    async def update_agent(self, kindo_agent_id: str, fields: dict[str, Any]) -> dict | None:
        """Returns None if agent not found (used to detect 404)."""

    @abstractmethod
    async def find_first_active_triage_agent(self) -> dict | None:
        """Return first agent where isActive=True, purpose=triage, agentType in [workflow, chatbot]."""

    # ── Triage Runs ────────────────────────────────────────────────────────────

    @abstractmethod
    async def create_triage_run(self, data: dict) -> None: ...

    @abstractmethod
    async def update_triage_run(self, kindo_run_id: str, fields: dict[str, Any]) -> None: ...

    @abstractmethod
    async def list_triage_runs(self, limit: int = 20) -> list[dict]: ...

    @abstractmethod
    async def get_triage_run(self, kindo_run_id: str) -> dict | None: ...

    # ── Settings ───────────────────────────────────────────────────────────────

    @abstractmethod
    async def get_raw_settings(self) -> dict | None:
        """Return raw settings document/row or None if not yet initialized."""

    @abstractmethod
    async def save_settings(self, data: dict) -> None:
        """Upsert settings (create or overwrite)."""

    # ── Activity Feed ──────────────────────────────────────────────────────────

    @abstractmethod
    async def insert_activity(self, entry: dict) -> None: ...

    @abstractmethod
    async def list_activity(self, limit: int = 50) -> list[dict]: ...

    # ── Users ──────────────────────────────────────────────────────────────────

    @abstractmethod
    async def get_user_by_id(self, user_id: str) -> dict | None: ...

    @abstractmethod
    async def get_user_by_email(self, email: str) -> dict | None: ...

    @abstractmethod
    async def get_user_by_azure_oid(self, oid: str) -> dict | None: ...

    @abstractmethod
    async def create_user(self, data: dict) -> dict: ...

    @abstractmethod
    async def update_user(self, user_id: str, fields: dict[str, Any]) -> dict | None:
        """Returns None if user not found."""

    @abstractmethod
    async def list_users(self, skip: int = 0, limit: int = 50) -> tuple[list[dict], int]: ...

    @abstractmethod
    async def count_users(self) -> int: ...


# ── Context manager for use outside FastAPI DI (scheduler, main.py startup) ──

@asynccontextmanager
async def get_backend_ctx():
    """Use this outside FastAPI routes (e.g. scheduler jobs, startup hooks)."""
    from app.core.config import settings

    if settings.DATABASE_BACKEND == "postgres":
        from app.db.postgres import AsyncSessionLocal
        from app.db.postgres_backend import PostgresBackend
        async with AsyncSessionLocal() as session:
            yield PostgresBackend(session)
    else:
        from app.db.mongo import get_db as get_mongo_db
        from app.db.mongo_backend import MongoBackend
        yield MongoBackend(get_mongo_db())
