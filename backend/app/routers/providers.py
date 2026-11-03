#providers own data dashboard endpoints

from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GPU, Booking, User, WalletTransaction
from ..schemas import BookingOut, EarningsOut, GPUDashboardOut, GPUEarnings, GPUOut
from ..security import require_provider

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/me/earnings", response_model=EarningsOut)
def read_earnings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    rows = db.execute(
        select(
            GPU.id,
            GPU.model,
            func.coalesce(func.sum(WalletTransaction.amount), 0),
        )
        .select_from(GPU)
        .outerjoin(Booking, Booking.gpu_id == GPU.id)
        .outerjoin(
            WalletTransaction,
            and_(
                WalletTransaction.booking_id == Booking.id,
                WalletTransaction.user_id == current_user.id,
                WalletTransaction.type.in_(["provider_payout", "payout_reversal"]),
            ),
        )
        .where(GPU.owner_id == current_user.id)
        .group_by(GPU.id, GPU.model)
        .order_by(GPU.id)
    ).all()

    gpus = [
        GPUEarnings(gpu_id=gpu_id, model=model, earned=Decimal(earned).quantize(Decimal("0.01")))
        for gpu_id, model, earned in rows
    ]
    total = sum((g.earned for g in gpus), Decimal("0.00"))
    return EarningsOut(total=total, gpus=gpus)

@router.get("/me/gpus", response_model=list[GPUDashboardOut])
def list_my_gpus(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    now = datetime.now(timezone.utc)

    gpus = db.scalars(
        select(GPU).where(GPU.owner_id == current_user.id).order_by(GPU.id)
    ).all()

    rented_ids = set(
        db.scalars(
            select(Booking.gpu_id)
            .join(GPU, GPU.id == Booking.gpu_id)
            .where(
                GPU.owner_id == current_user.id,
                Booking.status != "cancelled",
                Booking.start_at <= now,
                Booking.end_at > now,
            )
        ).all()
    )

    return [
        GPUDashboardOut(
            **GPUOut.model_validate(gpu).model_dump(),
            rented_now=gpu.id in rented_ids,
        )
        for gpu in gpus
    ]


@router.get("/me/bookings", response_model=list[BookingOut])
def list_bookings_on_my_gpus(
    when: Literal["upcoming", "active", "past", "cancelled"] | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    now = datetime.now(timezone.utc)
    query = (
        select(Booking)
        .join(GPU, GPU.id == Booking.gpu_id)
        .where(GPU.owner_id == current_user.id)
    )

    if when == "cancelled":
        query = query.where(Booking.status == "cancelled")
    elif when is not None:
        query = query.where(Booking.status != "cancelled")
        if when == "upcoming":
            query = query.where(Booking.start_at > now)
        elif when == "active":
            query = query.where(Booking.start_at <= now, Booking.end_at > now)
        elif when == "past":
            query = query.where(Booking.end_at <= now)

    query = query.order_by(Booking.start_at.desc(), Booking.id.desc()).limit(limit).offset(offset)
    return db.scalars(query).all()