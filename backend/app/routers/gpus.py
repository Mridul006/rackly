# this file contains the routers for the gpus endpoints
from ..events import notify_datacenter
from datetime import datetime, timezone
from decimal import Decimal
from ..config import settings
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GPU, AvailabilityWindow, User
from ..schemas import AvailabilityCreate, AvailabilityOut, GPUCreate, GPUOut, GPUUpdate
from ..security import require_provider
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/gpus", tags=["gpus"])


def get_owned_gpu(gpu_id: int, db: Session, current_user: User) -> GPU:
    gpu = db.get(GPU, gpu_id)
    if gpu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GPU not found")
    if gpu.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your GPU")
    return gpu

def ensure_slot_free(db: Session, rack_no, slot_no, exclude_gpu_id: int | None = None) -> None:
    if rack_no is None or slot_no is None:
        return
    query = select(GPU.id).where(
        GPU.rack_no == rack_no,
        GPU.slot_no == slot_no,
        GPU.is_active.is_(True),
    )
    if exclude_gpu_id is not None:
        query = query.where(GPU.id != exclude_gpu_id)
    if db.scalar(query.limit(1)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Rack {rack_no}, slot {slot_no} is already taken",
        )

def check_slot_in_range(slot_no: int | None) -> None:
    if slot_no is not None and slot_no > settings.slots_per_rack:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"slot_no must be between 1 and {settings.slots_per_rack}",
        )


def next_free_position(db: Session) -> tuple[int, int]:
    last = db.execute(
        select(GPU.rack_no, GPU.slot_no)
        .where(GPU.is_active.is_(True), GPU.rack_no.is_not(None))
        .order_by(GPU.rack_no.desc(), GPU.slot_no.desc())
        .limit(1)
    ).first()

    if last is None:
        return 1, 1
    rack, slot = last
    if slot < settings.slots_per_rack:
        return rack, slot + 1
    return rack + 1, 1

@router.post("", status_code=status.HTTP_201_CREATED, response_model=GPUOut)
def create_gpu(
    gpu_in: GPUCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    data = gpu_in.model_dump()
    auto_assign = data["rack_no"] is None  

    if not auto_assign:
        check_slot_in_range(data["slot_no"])
        ensure_slot_free(db, data["rack_no"], data["slot_no"])

    for _ in range(5):
        if auto_assign:
            data["rack_no"], data["slot_no"] = next_free_position(db)

        gpu = GPU(**data, owner_id=current_user.id)
        db.add(gpu)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if not auto_assign:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="That rack and slot is already taken",
                )
            continue  
        db.refresh(gpu)
        notify_datacenter(gpu.id, "gpu_listed")
        return gpu

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Could not assign a position, please try again",
    )

@router.get("", response_model=list[GPUOut])
def list_gpus(
    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),
    model: str | None = None,
    min_gpu_count: int | None = Query(default=None, ge=1),
    location: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(GPU).where(GPU.is_active.is_(True))

    if min_price is not None:
        query = query.where(GPU.price_per_hour >= min_price)
    if max_price is not None:
        query = query.where(GPU.price_per_hour <= max_price)
    if model:
        query = query.where(GPU.model.ilike(f"%{model}%"))
    if min_gpu_count is not None:
        query = query.where(GPU.gpu_count >= min_gpu_count)
    if location:
        query = query.where(GPU.location.ilike(f"%{location}%"))

    query = query.order_by(GPU.created_at.desc(), GPU.id.desc()).limit(limit).offset(offset)
    return db.scalars(query).all()


@router.get("/{gpu_id}", response_model=GPUOut)
def get_gpu(gpu_id: int, db: Session = Depends(get_db)):
    gpu = db.get(GPU, gpu_id)
    if gpu is None or not gpu.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GPU not found")
    return gpu


@router.patch("/{gpu_id}", response_model=GPUOut)
def update_gpu(gpu_id: int,gpu_in: GPUUpdate,db: Session = Depends(get_db),current_user: User = Depends(require_provider),):
    gpu = db.get(GPU, gpu_id)
    if gpu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GPU not found")
    if gpu.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your GPU")

    changes = gpu_in.model_dump(exclude_unset=True)
    if changes.get("slot_no") is not None:
        check_slot_in_range(changes["slot_no"])
    new_rack = changes.get("rack_no", gpu.rack_no)
    new_slot = changes.get("slot_no", gpu.slot_no)
    new_active = changes.get("is_active")
    if new_active is None:
        new_active = gpu.is_active

    if (new_rack is None) != (new_slot is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="rack_no and slot_no must be set together",
        )
    if new_active:
        ensure_slot_free(db, new_rack, new_slot, exclude_gpu_id=gpu.id)
    for field, value in changes.items():
        if value is None and field not in ("rack_no", "slot_no"):
            continue
        setattr(gpu, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That rack and slot is already taken",
        )
    db.refresh(gpu)
    notify_datacenter(gpu.id, "gpu_listed")
    return gpu


@router.post("/{gpu_id}/availability",status_code=status.HTTP_201_CREATED,response_model=AvailabilityOut,)
def create_availability(
    gpu_id: int,
    window_in: AvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    gpu = get_owned_gpu(gpu_id, db, current_user)

    if window_in.end_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Availability window must end in the future",
        )

    overlap = db.scalar(
        select(AvailabilityWindow.id)
        .where(
            AvailabilityWindow.gpu_id == gpu.id,
            AvailabilityWindow.start_at < window_in.end_at,
            AvailabilityWindow.end_at > window_in.start_at,
        )
        .limit(1)
    )
    if overlap is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Overlaps an existing availability window",
        )

    window = AvailabilityWindow(
        gpu_id=gpu.id,
        start_at=window_in.start_at,
        end_at=window_in.end_at,
    )
    db.add(window)
    db.commit()
    db.refresh(window)
    notify_datacenter(gpu.id, "gpu_listed")
    return window


@router.get("/{gpu_id}/availability", response_model=list[AvailabilityOut])
def list_availability(gpu_id: int, db: Session = Depends(get_db)):
    gpu = db.get(GPU, gpu_id)
    if gpu is None or not gpu.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GPU not found")

    query = (
        select(AvailabilityWindow)
        .where(
            AvailabilityWindow.gpu_id == gpu_id,
            AvailabilityWindow.end_at > datetime.now(timezone.utc),
        )
        .order_by(AvailabilityWindow.start_at)
    )
    return db.scalars(query).all()


@router.delete("/{gpu_id}/availability/{window_id}",status_code=status.HTTP_204_NO_CONTENT,)
def delete_availability(
    gpu_id: int,
    window_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    gpu = get_owned_gpu(gpu_id, db, current_user)

    window = db.get(AvailabilityWindow, window_id)
    if window is None or window.gpu_id != gpu.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Window not found")

    db.delete(window)
    db.commit()
    notify_datacenter(gpu.id, "gpu_listed")
    return Response(status_code=status.HTTP_204_NO_CONTENT)