"""Kindo Agent and Inference API client."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.errors import ExternalServiceError

logger = logging.getLogger(__name__)


class KindoClient:
    def __init__(self, *, api_key: str, base_url: str, inference_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.inference_url = inference_url.rstrip("/")

    @classmethod
    def from_settings(cls, runtime_settings: dict | None) -> "KindoClient":
        kindo_settings = (runtime_settings or {}).get("kindo", {})
        return cls(
            api_key=str(kindo_settings.get("apiKey") or settings.KINDO_API_KEY),
            base_url=str(kindo_settings.get("tenantUrl") or settings.KINDO_API_BASE_URL),
            inference_url=str(kindo_settings.get("inferenceUrl") or settings.KINDO_INFERENCE_URL),
        )

    @property
    def _headers(self) -> dict[str, str]:
        # Some Kindo tenants require x-api-key for Agent APIs.
        return {
            "api-key": self.api_key,
            "x-api-key": self.api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def list_agents(self) -> list[dict[str, Any]]:
        endpoints = ("/agents/list", "/agents")
        last_error: ExternalServiceError | None = None

        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            for endpoint in endpoints:
                response = await client.get(f"{self.base_url}{endpoint}", headers=self._headers)
                if response.status_code >= 400:
                    last_error = ExternalServiceError(
                        "Failed to list Kindo agents",
                        code="kindo_list_agents_failed",
                        details={"status": response.status_code, "body": response.text[:500], "endpoint": endpoint},
                    )
                    # Some tenants only support one listing endpoint.
                    if response.status_code in {404, 405}:
                        continue
                    # Keep trying fallback endpoint on auth/permission failures too.
                    continue

                payload = response.json()
                if isinstance(payload, list):
                    return payload
                if isinstance(payload, dict):
                    if isinstance(payload.get("items"), list):
                        return payload["items"]
                    if isinstance(payload.get("data"), list):
                        return payload["data"]
                    if isinstance(payload.get("agents"), list):
                        return payload["agents"]
                    if isinstance(payload.get("results"), list):
                        return payload["results"]
                    if isinstance(payload.get("rows"), list):
                        return payload["rows"]
                return []

        if last_error is not None:
            raise last_error
        return []

    async def invoke_agent(self, agent_id: str, input_payload: dict[str, Any]) -> dict[str, Any]:
        direct_inputs = input_payload.get("inputs") if isinstance(input_payload, dict) else None
        inputs_array = None
        if isinstance(direct_inputs, dict):
            # Some tenants require an array of {name, value} pairs, with value serialized as string.
            inputs_array = []
            for name, raw_value in direct_inputs.items():
                if isinstance(raw_value, bool):
                    value = "true" if raw_value else "false"
                elif raw_value is None:
                    value = ""
                elif isinstance(raw_value, (dict, list)):
                    value = json.dumps(raw_value, default=str)
                else:
                    value = str(raw_value)
                inputs_array.append({"name": str(name), "value": value})

        candidates = (
            (
                f"{self.base_url}/agents/runs",
                {"agentId": agent_id, "inputs": inputs_array},
            ),
            (
                f"{self.base_url}/agents/runs",
                {"agent_id": agent_id, "inputs": inputs_array},
            ),
            (
                f"{self.base_url}/agents/runs",
                {"agentId": agent_id, "inputs": direct_inputs if isinstance(direct_inputs, dict) else input_payload},
            ),
            (
                f"{self.base_url}/agents/runs",
                {"agent_id": agent_id, "inputs": direct_inputs if isinstance(direct_inputs, dict) else input_payload},
            ),
            (f"{self.base_url}/agents/runs", {"agentId": agent_id, "input": input_payload}),
            (f"{self.base_url}/agents/runs", {"agent_id": agent_id, "input": input_payload}),
            (f"{self.base_url}/agents/{agent_id}/runs", {"input": input_payload}),
        )
        last_error: ExternalServiceError | None = None

        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            for idx, (endpoint, body) in enumerate(candidates):
                logger.info("invoke attempt %d: POST %s body=%s", idx, endpoint, json.dumps(body, default=str)[:500])
                response = await client.post(endpoint, headers=self._headers, json=body)
                if response.status_code >= 400:
                    logger.warning("invoke attempt %d failed: %d %s", idx, response.status_code, response.text[:500])
                    last_error = ExternalServiceError(
                        "Failed to invoke Kindo agent",
                        code="kindo_invoke_failed",
                        details={"status": response.status_code, "body": response.text[:500], "endpoint": endpoint},
                    )
                    if response.status_code in {400, 404, 405, 422}:
                        continue
                    continue
                logger.info("invoke attempt %d succeeded: %s", idx, response.text[:500])
                return response.json()

        if last_error is not None:
            raise last_error
        raise ExternalServiceError("Failed to invoke Kindo agent", code="kindo_invoke_failed")

    async def get_agent_details(self, agent_id: str) -> dict[str, Any]:
        endpoint = f"{self.base_url}/agents/{agent_id}"
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(endpoint, headers=self._headers)
        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to get Kindo agent details",
                code="kindo_agent_details_failed",
                details={"status": response.status_code, "body": response.text[:500], "endpoint": endpoint},
            )
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get("agent"), dict):
            return payload["agent"]
        if isinstance(payload, dict):
            return payload
        return {}

    async def get_run_result(self, agent_id: str, run_id: str) -> dict[str, Any]:
        endpoints = (
            f"{self.base_url}/agents/{agent_id}/runs/{run_id}",
            f"{self.base_url}/runs/{run_id}",
        )
        last_error: ExternalServiceError | None = None

        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            for endpoint in endpoints:
                response = await client.get(endpoint, headers=self._headers)
                if response.status_code >= 400:
                    last_error = ExternalServiceError(
                        "Failed to get Kindo run result",
                        code="kindo_run_result_failed",
                        details={"status": response.status_code, "body": response.text[:500], "endpoint": endpoint},
                    )
                    if response.status_code in {404, 405}:
                        continue
                    continue
                return response.json()

        if last_error is not None:
            raise last_error
        raise ExternalServiceError("Failed to get Kindo run result", code="kindo_run_result_failed")

    async def inference(self, messages: list[dict[str, str]], model: str = "gpt-4o-mini") -> str:
        payload = {"model": model, "messages": messages}
        async with httpx.AsyncClient(timeout=45.0, verify=False) as client:
            response = await client.post(
                f"{self.inference_url}/chat/completions",
                headers=self._headers,
                json=payload,
            )

        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to call Kindo inference API",
                code="kindo_inference_failed",
                details={"status": response.status_code, "body": response.text[:500]},
            )

        body = response.json()
        return (
            body.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
