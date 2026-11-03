#this file contains the routers for the bookings endpoints done by renters for the gpus available on the platform

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GPU, AvailabilityWindow, Booking, User, WalletTransaction
from ..wallet import get_balance
from ..pricing import calculate_total
from ..schemas import BookingCreate, BookingOut
from ..security import get_current_user, require_renter


router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=BookingOut)
def create_booking(
    booking_in: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_renter),
):
    if booking_in.start_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking must start in the future",
        )

    gpu = db.get(GPU, booking_in.gpu_id)
    if gpu is None or not gpu.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GPU not found")

    window_id = db.scalar(
        select(AvailabilityWindow.id)
        .where(
            AvailabilityWindow.gpu_id == gpu.id,
            AvailabilityWindow.start_at <= booking_in.start_at,
            AvailabilityWindow.end_at >= booking_in.end_at,
        )
        .limit(1)
    )
    if window_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested time is outside this GPU's availability",
        )

    conflict_id = db.scalar(
        select(Booking.id)
        .where(
            Booking.gpu_id == gpu.id,
            Booking.status != "cancelled",
            Booking.start_at < booking_in.end_at,
            Booking.end_at > booking_in.start_at,
        )
        .limit(1)
    )
    if conflict_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="GPU is already booked for part of that time",
        )

    total = calculate_total(gpu.price_per_hour, booking_in.start_at, booking_in.end_at)

    db.execute(select(User.id).where(User.id == current_user.id).with_for_update())

    if get_balance(db, current_user.id) < total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient wallet balance",
        )

    booking = Booking(
        gpu_id=gpu.id,
        renter_id=current_user.id,
        start_at=booking_in.start_at,
        end_at=booking_in.end_at,
        price_per_hour=gpu.price_per_hour,
        total_price=total,
    )
    try:
        db.add(booking)
        db.flush()  
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="GPU is already booked for part of that time",
        )

    db.add(
        WalletTransaction(
            user_id=current_user.id,
            booking_id=booking.id,
            type="booking_charge",
            amount=-total,
        )
    )
    db.add(
        WalletTransaction(
            user_id=gpu.owner_id,
            booking_id=booking.id,
            type="provider_payout",
            amount=total,
        )
    )
    db.commit()
    db.refresh(booking)
    return booking


@router.get("", response_model=list[BookingOut])
def list_my_bookings(
    when: Literal["upcoming", "active", "past", "cancelled"] | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_renter),
):
    now = datetime.now(timezone.utc)
    query = select(Booking).where(Booking.renter_id == current_user.id)

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


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    gpu_owner_id = db.scalar(select(GPU.owner_id).where(GPU.id == booking.gpu_id))
    if current_user.id not in (booking.renter_id, gpu_owner_id):
        # 404, not 403, so strangers can't tell which booking ids exist
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_renter),
):
    booking = db.get(Booking, booking_id, with_for_update=True)
    if booking is None or booking.renter_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking is already cancelled")

    now = datetime.now(timezone.utc)
    if booking.start_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A booking that has already started cannot be cancelled",
        )

    gpu = db.get(GPU, booking.gpu_id)

    booking.status = "cancelled"
    booking.cancelled_at = now
    db.add(
        WalletTransaction(
            user_id=current_user.id,
            booking_id=booking.id,
            type="refund",
            amount=booking.total_price,
        )
    )
    db.add(
        WalletTransaction(
            user_id=gpu.owner_id,
            booking_id=booking.id,
            type="payout_reversal",
            amount=-booking.total_price,
        )
    )
    db.commit()
    db.refresh(booking)
    return booking