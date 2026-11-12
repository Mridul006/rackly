"""Create demo data.

Run:   docker compose exec api python -m app.seed
Reset: docker compose exec api python -m app.seed --reset

Never run this against a real deployment: the demo accounts share a known password.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, or_, select

from .database import SessionLocal
from .models import GPU, AvailabilityWindow, Booking, ProblemReport, User, WalletTransaction
from .pricing import calculate_total
from .routers.gpus import next_free_position
from .security import hash_password

PASSWORD = os.environ.get("SEED_PASSWORD", "demo-password-123")
PROVIDERS = ["demo.provider1@rackly.dev", "demo.provider2@rackly.dev"]
RENTERS = ["demo.renter1@rackly.dev", "demo.renter2@rackly.dev"]

# owner index, model, vram, gpu count, price per hour, location, has an availability window
GPU_SPECS = [
    (0, "RTX 4090", 24, 1, "1.50", "Delhi", True),
    (0, "RTX 4090", 24, 2, "2.80", "Delhi", True),
    (0, "A100", 80, 4, "8.00", "Mumbai", True),
    (0, "H100", 80, 8, "12.00", "Mumbai", True),
    (0, "RTX 3080", 10, 1, "0.90", "Pune", True),
    (0, "L40S", 48, 2, "3.20", "Pune", False),
    (1, "RTX 4090", 24, 1, "1.60", "Bengaluru", True),
    (1, "A100", 80, 2, "7.50", "Bengaluru", True),
    (1, "H100", 80, 4, "11.50", "Chennai", True),
    (1, "RTX 3080", 10, 2, "1.70", "Chennai", True),
    (1, "L40S", 48, 1, "3.10", "Delhi", True),
    (1, "A100", 80, 8, "15.00", "Mumbai", False),
]


def add_ledger(db, user, type_, amount, booking=None):
    db.add(
        WalletTransaction(
            user_id=user.id,
            booking_id=booking.id if booking else None,
            type=type_,
            amount=amount,
        )
    )


def make_booking(db, renter, gpu, provider, start, hours, cancelled=False):
    end = start + timedelta(hours=hours)
    total = calculate_total(gpu.price_per_hour, start, end)

    booking = Booking(
        gpu_id=gpu.id,
        renter_id=renter.id,
        start_at=start,
        end_at=end,
        price_per_hour=gpu.price_per_hour,
        total_price=total,
    )
    db.add(booking)
    db.flush()

    add_ledger(db, renter, "booking_charge", -total, booking)
    add_ledger(db, provider, "provider_payout", total, booking)

    if cancelled:
        booking.status = "cancelled"
        booking.cancelled_at = datetime.now(timezone.utc)
        add_ledger(db, renter, "refund", total, booking)
        add_ledger(db, provider, "payout_reversal", -total, booking)

    return booking


def wipe(db):
    emails = PROVIDERS + RENTERS
    user_ids = select(User.id).where(User.email.in_(emails))
    gpu_ids = select(GPU.id).where(GPU.owner_id.in_(user_ids))
    booking_ids = select(Booking.id).where(
        or_(Booking.gpu_id.in_(gpu_ids), Booking.renter_id.in_(user_ids))
    )
    keep = {"synchronize_session": False}

    db.execute(
        delete(WalletTransaction)
        .where(
            or_(
                WalletTransaction.user_id.in_(user_ids),
                WalletTransaction.booking_id.in_(booking_ids),
            )
        )
        .execution_options(**keep)
    )
    db.execute(
        delete(ProblemReport)
        .where(
            or_(
                ProblemReport.booking_id.in_(booking_ids),
                ProblemReport.reporter_id.in_(user_ids),
            )
        )
        .execution_options(**keep)
    )
    db.execute(delete(Booking).where(Booking.id.in_(booking_ids)).execution_options(**keep))
    db.execute(
        delete(AvailabilityWindow)
        .where(AvailabilityWindow.gpu_id.in_(gpu_ids))
        .execution_options(**keep)
    )
    db.execute(delete(GPU).where(GPU.id.in_(gpu_ids)).execution_options(**keep))
    db.execute(delete(User).where(User.id.in_(user_ids)).execution_options(**keep))
    db.flush()


def create(db):
    password_hash = hash_password(PASSWORD)
    providers = [User(email=e, password_hash=password_hash, role="provider") for e in PROVIDERS]
    renters = [User(email=e, password_hash=password_hash, role="renter") for e in RENTERS]
    db.add_all(providers + renters)
    db.flush()

    for renter in renters:
        add_ledger(db, renter, "deposit", Decimal("500.00"))

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    gpus = []
    owners = []
    for owner, model, vram, count, price, location, has_window in GPU_SPECS:
        rack, slot = next_free_position(db)
        gpu = GPU(
            owner_id=providers[owner].id,
            model=model,
            vram_gb=vram,
            gpu_count=count,
            price_per_hour=Decimal(price),
            location=location,
            rack_no=rack,
            slot_no=slot,
        )
        db.add(gpu)
        db.flush()
        gpus.append(gpu)
        owners.append(providers[owner])

        if has_window:
            db.add(
                AvailabilityWindow(
                    gpu_id=gpu.id,
                    start_at=now - timedelta(days=10),
                    end_at=now + timedelta(days=90),
                )
            )

    def book(renter, gpu_index, start, hours, cancelled=False):
        return make_booking(db, renter, gpus[gpu_index], owners[gpu_index], start, hours, cancelled)

    book(renters[0], 0, now - timedelta(hours=1), 2)
    book(renters[1], 2, now - timedelta(hours=2), 3)
    book(renters[0], 1, now + timedelta(days=1, hours=9 - now.hour), 6)
    book(renters[1], 6, now + timedelta(days=2), 4)
    book(renters[0], 8, now + timedelta(days=3), 8)
    book(renters[0], 3, now - timedelta(days=3), 4)
    book(renters[1], 7, now - timedelta(days=5), 6)
    book(renters[1], 4, now + timedelta(days=2, hours=5), 3, cancelled=True)

    return len(gpus)


def main():
    reset = "--reset" in sys.argv
    db = SessionLocal()
    try:
        exists = db.scalar(select(User.id).where(User.email == PROVIDERS[0]))
        if exists and not reset:
            print("Demo data already exists. Run with --reset to rebuild it.")
            return
        if reset:
            wipe(db)
        gpu_count = create(db)
        db.commit()
    finally:
        db.close()

    print(f"Created 2 providers, 2 renters and {gpu_count} GPUs with bookings and ledger rows.")
    print(f"Password for every demo account: {PASSWORD}")
    for email in PROVIDERS + RENTERS:
        print(f"  {email}")


if __name__ == "__main__":
    main()