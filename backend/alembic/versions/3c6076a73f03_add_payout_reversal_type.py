"""add payout reversal type

Revision ID: 3c6076a73f03
Revises: 90809d40bc1e
Create Date: 2026-11-03 18:38:52.338833

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c6076a73f03'
down_revision: Union[str, Sequence[str], None] = '90809d40bc1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint("ck_wallet_transactions_type", "wallet_transactions", type_="check")
    op.drop_constraint("ck_wallet_transactions_amount_sign", "wallet_transactions", type_="check")
    op.create_check_constraint(
        "ck_wallet_transactions_type",
        "wallet_transactions",
        "type IN ('deposit', 'booking_charge', 'refund', 'provider_payout', 'payout_reversal')",
    )
    op.create_check_constraint(
        "ck_wallet_transactions_amount_sign",
        "wallet_transactions",
        "(type IN ('deposit', 'refund', 'provider_payout') AND amount > 0) "
        "OR (type IN ('booking_charge', 'payout_reversal') AND amount < 0)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_wallet_transactions_amount_sign", "wallet_transactions", type_="check")
    op.drop_constraint("ck_wallet_transactions_type", "wallet_transactions", type_="check")
    op.create_check_constraint(
        "ck_wallet_transactions_type",
        "wallet_transactions",
        "type IN ('deposit', 'booking_charge', 'refund', 'provider_payout')",
    )
    op.create_check_constraint(
        "ck_wallet_transactions_amount_sign",
        "wallet_transactions",
        "(type IN ('deposit', 'refund', 'provider_payout') AND amount > 0) "
        "OR (type = 'booking_charge' AND amount < 0)",
    )
