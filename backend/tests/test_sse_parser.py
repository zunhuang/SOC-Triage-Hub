import asyncio

from app.services.kindo_client import iter_sse_data


async def _lines(items):
    for item in items:
        yield item


def _collect(items):
    async def run():
        return [d async for d in iter_sse_data(_lines(items))]

    return asyncio.run(run())


def test_parses_events_and_skips_ping_and_done():
    lines = [
        "event: ping", 'data: {"type":"ping"}', "",
        "event: content_block_delta",
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}', "",
        "data: [DONE]", "",
    ]
    out = _collect(lines)
    assert len(out) == 1 and out[0]["delta"]["text"] == "Hi"


def test_flushes_trailing_event_without_blank_line():
    assert _collect(['data: {"type":"x"}']) == [{"type": "x"}]


def test_ignores_malformed_json():
    assert _collect(["data: {oops", "", 'data: {"type":"ok"}', ""]) == [{"type": "ok"}]
