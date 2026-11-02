"""add wallet amount sign check

Revision ID: 90809d40bc1e
Revises: 0a89472b5bce
Create Date: 2026-11-03 02:37:09.566398

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '90809d40bc1e'
down_revision: Union[str, Sequence[str], None] = '0a89472b5bce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint(
        "ck_wallet_transactions_amount_sign",
        "wallet_transactions",
        "(type IN ('deposit', 'refund', 'provider_payout') AND amount > 0) "
        "OR (type = 'booking_charge' AND amount < 0)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "ck_wallet_transactions_amount_sign",
        "wallet_transactions",
        type_="check",
    )