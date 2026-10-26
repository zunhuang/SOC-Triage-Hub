"""Kindo Agent and Inference API client."""
from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from app.core.config import settings
from app.core.errors import ExternalServiceError

logger = logging.getLogger(__name__)


async def iter_sse_data(lines: AsyncIterator[str]) -> AsyncIterator[dict[str, Any]]:
    """Parse an SSE line stream into JSON `data:` payloads. Ignores comments, pings and `[DONE]`."""
    data_lines: list[str] = []
    async for line in lines:
        if line == "":
            if data_lines:
                raw = "\n".join(data_lines)
                data_lines = []
                if raw.strip() != "[DONE]":
                    try:
                        parsed = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if isinstance(parsed, dict) and parsed.get("type") != "ping":
                        yield parsed
            continue
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
    if data_lines:
        try:
            parsed = json.loads("\n".join(data_lines))
        except json.JSONDecodeError:
            return
        if isinstance(parsed, dict) and parsed.get("type") != "ping":
            yield parsed


def _stream_error(data: dict[str, Any]) -> ExternalServiceError:
    err = data.get("error") or (data.get("response") or {}).get("error") or {}
    message = err.get("message") if isinstance(err, dict) else None
    return ExternalServiceError(message or "Kindo stream error", code="kindo_stream_failed", details=data)


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

    # ------------------------------------------------------------------
    # CDA chat
    # ------------------------------------------------------------------

    def _stream_headers(self, *, anthropic: bool = False) -> dict[str, str]:
        headers = {**self._headers, "Authorization": f"Bearer {self.api_key}", "Accept": "text/event-stream"}
        if anthropic:
            headers["anthropic-version"] = "2023-06-01"
        return headers

    async def get_run(self, run_id: str) -> dict[str, Any]:
        endpoint = f"{self.base_url}/runs/{run_id}"
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(
                endpoint, headers={**self._headers, "Authorization": f"Bearer {self.api_key}"}
            )
        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to get Kindo run",
                code="kindo_run_failed",
                details={"status": response.status_code, "body": response.text[:500], "endpoint": endpoint},
            )
        payload = response.json()
        return payload if isinstance(payload, dict) else {}

    async def list_models(self) -> list[str]:
        endpoint = f"{self.base_url}/models"
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.get(
                endpoint, headers={**self._headers, "Authorization": f"Bearer {self.api_key}"}
            )
        if response.status_code >= 400:
            raise ExternalServiceError(
                "Failed to list Kindo models",
                code="kindo_models_failed",
                details={"status": response.status_code, "body": response.text[:500], "endpoint": endpoint},
            )
        payload = response.json()
        items = payload.get("data", []) if isinstance(payload, dict) else payload
        return [str(m["id"]) for m in items if isinstance(m, dict) and m.get("id")]

    async def stream_message(
        self,
        *,
        model: str,
        messages: list[dict[str, str]],
        system: str | None = None,
        max_tokens: int = 2048,
    ) -> AsyncIterator[str]:
        """Stream text deltas from the stateless Messages API (Anthropic event format)."""
        body: dict[str, Any] = {"model": model, "max_tokens": max_tokens, "stream": True, "messages": messages}
        if system:
            body["system"] = system
        endpoint = f"{self.base_url}/messages"
        async for data in self._stream_sse(endpoint, body, anthropic=True):
            event_type = data.get("type")
            if event_type == "content_block_delta":
                delta = data.get("delta") or {}
                if delta.get("type") == "text_delta" and delta.get("text"):
                    yield delta["text"]
            elif event_type == "error":
                raise _stream_error(data)
            elif event_type == "message_stop":
                return

    async def stream_response(
        self, *, model: str, conversation_id: str, text: str
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream a follow-up turn on an existing Kindo conversation (Responses API).

        Yields `{"type": "delta", "text"}` and `{"type": "tool", "name"}` events. When the model starts a new
        output item after tool calls, a paragraph break is emitted so narration segments don't run together.
        """
        body = {
            "model": model,
            "conversation": conversation_id,
            "input": text,
            "stream": True,
            "kindo": {"system_prompt": "agent_default"},
        }
        endpoint = f"{self.base_url}/responses"
        completed = False
        emitted = False
        last_item: Any = None
        async for data in self._stream_sse(endpoint, body):
            event_type = data.get("type")
            if event_type == "response.output_text.delta":
                chunk = data.get("delta")
                if not chunk:
                    continue
                item = data.get("item_id") if data.get("item_id") is not None else data.get("output_index")
                if emitted and item is not None and item != last_item:
                    yield {"type": "delta", "text": "\n\n"}
                if item is not None:
                    last_item = item
                emitted = True
                yield {"type": "delta", "text": chunk}
            elif event_type == "response.output_item.added":
                item_obj = data.get("item") or {}
                if item_obj.get("type") == "function_call" and item_obj.get("name"):
                    yield {"type": "tool", "name": str(item_obj["name"])}
            elif event_type == "response.completed":
                status = (data.get("response") or {}).get("status")
                if status != "completed":
                    raise ExternalServiceError(
                        f"Follow-up ended with status {status}", code="kindo_stream_failed", details=data
                    )
                completed = True
            elif event_type in ("response.failed", "response.incomplete", "error"):
                raise _stream_error(data)
        if not completed:
            raise ExternalServiceError("Follow-up stream ended early", code="kindo_stream_incomplete")

    async def _stream_sse(
        self, endpoint: str, body: dict[str, Any], *, anthropic: bool = False
    ) -> AsyncIterator[dict[str, Any]]:
        timeout = httpx.Timeout(30.0, read=180.0)
        async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
            async with client.stream(
                "POST", endpoint, headers=self._stream_headers(anthropic=anthropic), json=body
            ) as response:
                if response.status_code >= 400:
                    raw = (await response.aread()).decode(errors="replace")[:500]
                    raise ExternalServiceError(
                        "Kindo chat request failed",
                        code="kindo_chat_failed",
                        details={"status": response.status_code, "body": raw, "endpoint": endpoint},
                    )
                async for data in iter_sse_data(response.aiter_lines()):
                    yield data

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
