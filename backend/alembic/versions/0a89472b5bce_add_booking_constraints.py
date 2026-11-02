"""add booking constraints

Revision ID: 0a89472b5bce
Revises: 8bd8468c1aeb
Create Date: 2026-11-02 23:45:59.055660

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a89472b5bce'
down_revision: Union[str, Sequence[str], None] = '8bd8468c1aeb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.create_check_constraint(
        "ck_bookings_end_after_start",
        "bookings",
        "end_at > start_at",
    )
    op.execute(
        """
        ALTER TABLE bookings
        ADD CONSTRAINT ex_bookings_no_overlap
        EXCLUDE USING gist (
            gpu_id WITH =,
            tstzrange(start_at, end_at) WITH &&
        )
        WHERE (status <> 'cancelled')
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE bookings DROP CONSTRAINT ex_bookings_no_overlap")
    op.drop_constraint("ck_bookings_end_after_start", "bookings", type_="check")
