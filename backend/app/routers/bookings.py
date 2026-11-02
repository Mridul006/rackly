#this file contains the routers for the bookings endpoints done by renters for the gpus available on the platform

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import GPU, AvailabilityWindow, Booking, User
from ..pricing import calculate_total
from ..schemas import BookingCreate, BookingOut
from ..security import require_renter

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
    booking = Booking(
        gpu_id=gpu.id,
        renter_id=current_user.id,
        start_at=booking_in.start_at,
        end_at=booking_in.end_at,
        price_per_hour=gpu.price_per_hour,
        total_price=calculate_total(gpu.price_per_hour, booking_in.start_at, booking_in.end_at),
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="GPU is already booked for part of that time",
        )
    db.refresh(booking)
    return booking