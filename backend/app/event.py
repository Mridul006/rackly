import json
import logging

import redis

from .config import settings

logger = logging.getLogger(__name__)

CHANNEL = "datacenter"

_client = redis.Redis.from_url(
    settings.redis_url, socket_connect_timeout=1, socket_timeout=1
)


def notify_datacenter(gpu_id: int, reason: str) -> None:
    try:
        _client.publish(
            CHANNEL, json.dumps({"type": "gpu_changed", "gpu_id": gpu_id, "reason": reason})
        )
    except redis.RedisError:
        logger.warning("Could not publish datacenter event", exc_info=True)