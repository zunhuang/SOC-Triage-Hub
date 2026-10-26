import asyncio

from app.services.kindo_client import KindoClient


def _run(events):
    client = KindoClient(api_key="k", base_url="http://x/v1", inference_url="http://x/v1")

    async def fake_sse(self, endpoint, body, anthropic=False):
        for e in events:
            yield e

    KindoClient._stream_sse = fake_sse

    async def go():
        return [e async for e in client.stream_response(model="m", conversation_id="c", text="hi")]

    return asyncio.run(go())


def test_breaks_between_output_items_and_reports_tools():
    out = _run([
        {"type": "response.output_text.delta", "item_id": "a", "delta": "Let me check:"},
        {"type": "response.output_item.added", "item": {"type": "function_call", "name": "crowdstrike-falcon_search_devices"}},
        {"type": "response.output_text.delta", "item_id": "b", "delta": "Found it."},
        {"type": "response.completed", "response": {"status": "completed"}},
    ])
    assert [e["type"] for e in out] == ["delta", "tool", "delta", "delta"]
    assert out[2] == {"type": "delta", "text": "\n\n"}
    assert out[1]["name"] == "crowdstrike-falcon_search_devices"


def test_no_break_within_one_item():
    out = _run([
        {"type": "response.output_text.delta", "item_id": "a", "delta": "Hel"},
        {"type": "response.output_text.delta", "item_id": "a", "delta": "lo"},
        {"type": "response.completed", "response": {"status": "completed"}},
    ])
    assert "".join(e["text"] for e in out) == "Hello"
