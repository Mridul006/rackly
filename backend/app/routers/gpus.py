# this file contains the routers for the gpus endpoints

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import GPU, User
from ..schemas import GPUCreate, GPUOut, GPUUpdate
from ..security import require_provider


router = APIRouter(prefix="/gpus", tags=["gpus"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=GPUOut)
def create_gpu(
    gpu_in: GPUCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    gpu = GPU(**gpu_in.model_dump(), owner_id=current_user.id)
    db.add(gpu)
    db.commit()
    db.refresh(gpu)
    return gpu


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
def update_gpu(
    gpu_id: int,
    gpu_in: GPUUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_provider),
):
    gpu = db.get(GPU, gpu_id)
    if gpu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GPU not found")
    if gpu.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your GPU")

    changes = gpu_in.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if value is None and field not in ("rack_no", "slot_no"):
            continue
        setattr(gpu, field, value)

    db.commit()
    db.refresh(gpu)
    return gpu