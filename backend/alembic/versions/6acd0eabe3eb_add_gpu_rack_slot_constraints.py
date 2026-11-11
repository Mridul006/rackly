"""add gpu rack slot constraints

Revision ID: 6acd0eabe3eb
Revises: 3c6076a73f03
Create Date: 2026-11-11 22:29:25.547567

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6acd0eabe3eb'
down_revision: Union[str, Sequence[str], None] = '3c6076a73f03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_gpus_rack_slot_together",
        "gpus",
        "(rack_no IS NULL) = (slot_no IS NULL)",
    )
    op.create_index(
        "uq_gpus_active_rack_slot",
        "gpus",
        ["rack_no", "slot_no"],
        unique=True,
        postgresql_where=sa.text("is_active AND rack_no IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_gpus_active_rack_slot", table_name="gpus")
    op.drop_constraint("ck_gpus_rack_slot_together", "gpus", type_="check")
