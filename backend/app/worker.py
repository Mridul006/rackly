"""Background worker: moves bookings to active and completed on time.

Run:  python -m app.worker   (docker compose starts it as the `worker` service)
"""

import logging
import signal
import threading
from datetime import datetime, timezone

from sqlalchemy import update

from .database import SessionLocal
from .events import notify_datacenter
from .models import Booking

logger = logging.getLogger("rackly.worker")

INTERVAL_SECONDS = 10
stop = threading.Event()


def tick() -> None:
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        started = db.execute(
            update(Booking)
            .where(
                Booking.status == "confirmed",
                Booking.start_at <= now,
                Booking.end_at > now,
            )
            .values(status="active")
            .returning(Booking.id, Booking.gpu_id)
            .execution_options(synchronize_session=False)
        ).all()

        ended = db.execute(
            update(Booking)
            .where(Booking.status.in_(["confirmed", "active"]), Booking.end_at <= now)
            .values(status="completed")
            .returning(Booking.id, Booking.gpu_id)
            .execution_options(synchronize_session=False)
        ).all()

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    for booking_id, gpu_id in started:
        logger.info("booking %s started (gpu %s)", booking_id, gpu_id)
        notify_datacenter(gpu_id, "booking_started")
    for booking_id, gpu_id in ended:
        logger.info("booking %s ended (gpu %s)", booking_id, gpu_id)
        notify_datacenter(gpu_id, "booking_ended")


def handle_signal(signum, frame) -> None:
    stop.set()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    logger.info("worker started, checking every %s seconds", INTERVAL_SECONDS)

    while not stop.is_set():
        try:
            tick()
        except Exception:
            logger.exception("tick failed")
        stop.wait(INTERVAL_SECONDS)

    logger.info("worker stopped")


if __name__ == "__main__":
    main()