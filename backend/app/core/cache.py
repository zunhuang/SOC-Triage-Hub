"""Async cache: Redis when REDIS_URL is set, in-memory TTL dict otherwise.

Usage::

    from app.core.cache import cache

    value = await cache.get("my_key")
    await cache.set("my_key", value, ttl_seconds=30)
    await cache.delete("my_key")
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

_MISS = object()


def _json_default(obj: Any) -> str:
    return str(obj)


class _InMemoryCache:
    """Single-process in-memory TTL cache. Safe in asyncio (single-threaded event loop)."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float]] = {}

    async def get(self, key: str) -> Any:
        entry = self._store.get(key, _MISS)
        if entry is _MISS:
            return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        return value

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._store[key] = (value, time.monotonic() + ttl_seconds)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def close(self) -> None:
        pass


class _RedisCache:
    def __init__(self, url: str) -> None:
        import redis.asyncio as aioredis
        self._client = aioredis.from_url(url, decode_responses=True)

    async def get(self, key: str) -> Any:
        raw = await self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        await self._client.set(
            key, json.dumps(value, default=_json_default), ex=ttl_seconds
        )

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def close(self) -> None:
        await self._client.aclose()


def _build() -> _InMemoryCache | _RedisCache:
    url = os.environ.get("REDIS_URL", "").strip()
    if not url:
        return _InMemoryCache()
    try:
        import redis.asyncio  # noqa: F401
    except ImportError as exc:
        raise ImportError(
            "REDIS_URL is set but the 'redis' package is not installed. "
            "Run: pip install 'redis[asyncio]'"
        ) from exc
    return _RedisCache(url)


cache: _InMemoryCache | _RedisCache = _build()
