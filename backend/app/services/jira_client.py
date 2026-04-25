"""Jira Data Center REST API client."""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import ExternalServiceError


class JiraClient:
    def __init__(
        self,
        *,
        base_url: str,
        username: str,
        password: str,
        jql: str,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.jql = jql

    @classmethod
    def from_settings(cls, runtime_settings: dict | None) -> "JiraClient":
        jira = (runtime_settings or {}).get("jira", {})
        return cls(
            base_url=str(jira.get("baseUrl") or settings.JIRA_BASE_URL).rstrip("/"),
            username=str(jira.get("username") or settings.JIRA_USERNAME),
            password=str(jira.get("password") or settings.JIRA_PASSWORD),
            jql=str(jira.get("jql") or settings.JIRA_JQL),
        )

    async def test_connection(
        self,
        *,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ) -> dict[str, Any]:
        url = (base_url or self.base_url).rstrip("/")
        user = username or self.username
        pwd = password or self.password

        try:
            async with httpx.AsyncClient(timeout=15.0, verify=True) as client:
                response = await client.get(
                    f"{url}/rest/api/2/myself",
                    auth=httpx.BasicAuth(user, pwd),
                )
        except httpx.HTTPError as exc:
            raise ExternalServiceError(
                "Jira is unreachable",
                code="jira_unreachable",
                details={"reason": str(exc)},
            ) from exc

        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to authenticate with Jira",
                code="jira_auth_failed",
                details={"status": response.status_code, "body": response.text[:500]},
            )

        data = response.json()
        return {
            "success": True,
            "message": f"Connected to Jira as {data.get('displayName', data.get('name', 'unknown'))}",
        }

    async def fetch_issues(self, *, max_results: int = 100) -> list[dict[str, Any]]:
        fields = "project,summary,status,priority,assignee,description,customfield_17701"

        try:
            async with httpx.AsyncClient(timeout=30.0, verify=True) as client:
                response = await client.get(
                    f"{self.base_url}/rest/api/2/search",
                    params={
                        "jql": self.jql,
                        "fields": fields,
                        "maxResults": str(max_results),
                    },
                    auth=httpx.BasicAuth(self.username, self.password),
                )
        except httpx.HTTPError as exc:
            raise ExternalServiceError(
                "Jira is unreachable",
                code="jira_unreachable",
                details={"reason": str(exc)},
            ) from exc

        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to fetch issues from Jira",
                code="jira_fetch_failed",
                details={"status": response.status_code, "body": response.text[:500]},
            )

        payload = response.json()
        return payload.get("issues", [])

    async def add_comment(self, issue_key: str, body: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=15.0, verify=True) as client:
                response = await client.post(
                    f"{self.base_url}/rest/api/2/issue/{issue_key}/comment",
                    auth=httpx.BasicAuth(self.username, self.password),
                    json={"body": body},
                )
        except httpx.HTTPError as exc:
            raise ExternalServiceError(
                "Jira is unreachable",
                code="jira_unreachable",
                details={"reason": str(exc)},
            ) from exc

        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to post comment to Jira",
                code="jira_comment_failed",
                details={"status": response.status_code, "body": response.text[:500]},
            )

        return response.json()
