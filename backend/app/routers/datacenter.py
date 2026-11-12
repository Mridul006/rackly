from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GPU, AvailabilityWindow, Booking
from ..schemas import DatacenterGPU

router = APIRouter(prefix="/datacenter", tags=["datacenter"])


@router.get("", response_model=list[DatacenterGPU])
def read_datacenter(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    gpus = db.scalars(
        select(GPU)
        .where(GPU.is_active.is_(True), GPU.rack_no.is_not(None))
        .order_by(GPU.rack_no, GPU.slot_no)
    ).all()

    rented_ids = set(
        db.scalars(
            select(Booking.gpu_id).where(
                Booking.status != "cancelled",
                Booking.start_at <= now,
                Booking.end_at > now,
            )
        ).all()
    )
    open_ids = set(
        db.scalars(
            select(AvailabilityWindow.gpu_id).where(AvailabilityWindow.end_at > now)
        ).all()
    )

    result = []
    for g in gpus:
        if g.id in rented_ids:
            status = "rented"
        elif g.id in open_ids:
            status = "available"
        else:
            status = "offline"
        result.append(
            DatacenterGPU(
                id=g.id,
                model=g.model,
                vram_gb=g.vram_gb,
                gpu_count=g.gpu_count,
                price_per_hour=g.price_per_hour,
                location=g.location,
                rack_no=g.rack_no,
                slot_no=g.slot_no,
                status=status,
            )
        )
    return result