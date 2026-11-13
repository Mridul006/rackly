import asyncio
from contextlib import suppress

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from redis.exceptions import RedisError

from ..config import settings
from ..events import CHANNEL

router = APIRouter(tags=["live"])


async def forward(pubsub, websocket: WebSocket) -> None:
    async for message in pubsub.listen():
        if message["type"] == "message":
            await websocket.send_text(message["data"])


async def drain(websocket: WebSocket) -> None:
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        return


@router.websocket("/ws/datacenter")
async def datacenter_socket(websocket: WebSocket):
    allowed = [origin.strip() for origin in settings.cors_origins.split(",")]
    if websocket.headers.get("origin") not in allowed:
        await websocket.close(code=1008)
        return

    client = aioredis.Redis.from_url(
        settings.redis_url, decode_responses=True, socket_connect_timeout=2
    )
    pubsub = client.pubsub()

    try:
        await pubsub.subscribe(CHANNEL)
    except RedisError:
        with suppress(Exception):
            await client.aclose()
        await websocket.close(code=1011)
        return

    await websocket.accept()

    forward_task = asyncio.create_task(forward(pubsub, websocket))
    drain_task = asyncio.create_task(drain(websocket))
    try:
        await asyncio.wait({forward_task, drain_task}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in (forward_task, drain_task):
            task.cancel()
        await asyncio.gather(forward_task, drain_task, return_exceptions=True)
        with suppress(Exception):
            await pubsub.unsubscribe(CHANNEL)
        with suppress(Exception):
            await pubsub.aclose()
        with suppress(Exception):
            await client.aclose()
        with suppress(Exception):
            await websocket.close()