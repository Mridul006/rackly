from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import WalletTransaction


def get_balance(db: Session, user_id: int) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(WalletTransaction.amount), 0))
        .where(WalletTransaction.user_id == user_id)
    )
    return Decimal(total).quantize(Decimal("0.01"))