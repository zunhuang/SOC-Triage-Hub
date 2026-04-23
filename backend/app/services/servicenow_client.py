"""ServiceNow Table API client."""
from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.core.errors import AppError, ExternalServiceError


class ServiceNowClient:
    def __init__(
        self,
        *,
        base_url: str,
        username: str,
        password: str,
        assignment_group: str,
    ) -> None:
        self.base_url = self._normalize_base_url(base_url)
        self.username = username
        self.password = password
        self.assignment_group = assignment_group

    @staticmethod
    def _normalize_base_url(raw_url: str) -> str:
        value = (raw_url or "").strip()
        if not value:
            return value

        parsed = urlparse(value)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        return value.rstrip("/")

    def _validate_configuration(self) -> None:
        if "your-instance.service-now.com" in self.base_url:
            raise AppError(
                message="ServiceNow instance URL is still a placeholder. Update Settings > ServiceNow first.",
                code="servicenow_config_invalid",
                status_code=400,
                details={"instanceUrl": self.base_url},
            )

    @classmethod
    def from_settings(cls, runtime_settings: dict | None) -> "ServiceNowClient":
        service_now = (runtime_settings or {}).get("serviceNow", {})
        return cls(
            base_url=str(service_now.get("instanceUrl") or settings.SERVICENOW_INSTANCE_URL),
            username=str(service_now.get("username") or settings.SERVICENOW_USERNAME),
            password=str(service_now.get("password") or settings.SERVICENOW_PASSWORD),
            assignment_group=str(service_now.get("assignmentGroup") or settings.SERVICENOW_ASSIGNMENT_GROUP),
        )

    async def fetch_open_incidents(self, *, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        self._validate_configuration()

        query = f"assignment_group={self.assignment_group}^stateIN1,2,3"
        params = {
            "sysparm_query": query,
            "sysparm_display_value": "true",
            "sysparm_limit": str(limit),
            "sysparm_offset": str(offset),
        }

        fields = [
            "sys_id",
            "number",
            "short_description",
            "description",
            "severity",
            "priority",
            "state",
            "assignment_group",
            "assigned_to",
            "caller_id",
            "category",
            "subcategory",
            "cmdb_ci",
            "opened_at",
            "sys_updated_on",
        ]
        params["sysparm_fields"] = ",".join(fields)

        try:
            async with httpx.AsyncClient(timeout=30.0, verify=True) as client:
                response = await client.get(
                    f"{self.base_url}/api/now/table/incident",
                    params=params,
                    auth=(self.username, self.password),
                )
        except httpx.HTTPError as exc:
            raise ExternalServiceError(
                "ServiceNow is unreachable",
                code="servicenow_unreachable",
                details={"reason": str(exc)},
            ) from exc

        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to fetch incidents from ServiceNow",
                code="servicenow_fetch_failed",
                details={"status": response.status_code, "body": response.text[:500]},
            )

        payload = response.json()
        return payload.get("result", [])

    async def get_incident(self, sys_id: str) -> dict[str, Any]:
        self._validate_configuration()

        try:
            async with httpx.AsyncClient(timeout=30.0, verify=True) as client:
                response = await client.get(
                    f"{self.base_url}/api/now/table/incident/{sys_id}",
                    params={"sysparm_display_value": "true"},
                    auth=(self.username, self.password),
                )
        except httpx.HTTPError as exc:
            raise ExternalServiceError(
                "ServiceNow is unreachable",
                code="servicenow_unreachable",
                details={"reason": str(exc)},
            ) from exc

        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to fetch incident from ServiceNow",
                code="servicenow_get_incident_failed",
                details={"status": response.status_code, "body": response.text[:500]},
            )

        return response.json().get("result", {})

    async def test_connection(self) -> dict[str, Any]:
        incidents = await self.fetch_open_incidents(limit=1, offset=0)
        return {
            "success": True,
            "message": f"Connected to ServiceNow. Retrieved {len(incidents)} sample incident(s).",
        }
