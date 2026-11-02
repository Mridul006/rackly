#this file contains all the routers related to the wallet of the users like deposits, transactions and balance

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, WalletTransaction
from ..schemas import DepositCreate, TransactionOut, WalletOut
from ..security import get_current_user, require_renter
from ..wallet import get_balance

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletOut)
def read_wallet(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WalletOut(balance=get_balance(db, current_user.id))



@router.post("/deposits", status_code=status.HTTP_201_CREATED, response_model=TransactionOut)
def create_deposit(
    deposit_in: DepositCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_renter),
):
    transaction = WalletTransaction(
        user_id=current_user.id,
        type="deposit",
        amount=deposit_in.amount,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction




@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(WalletTransaction)
        .where(WalletTransaction.user_id == current_user.id)
        .order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.scalars(query).all()