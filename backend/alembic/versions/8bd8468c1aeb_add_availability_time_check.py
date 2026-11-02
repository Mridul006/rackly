"""add availability time check

Revision ID: 8bd8468c1aeb
Revises: cc11c62f4949
Create Date: 2026-11-02 21:09:19.885814

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8bd8468c1aeb'
down_revision: Union[str, Sequence[str], None] = 'cc11c62f4949'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint(
        "ck_availability_windows_end_after_start",
        "availability_windows",
        "end_at > start_at",
    )

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "ck_availability_windows_end_after_start",
        "availability_windows",
        type_="check",
    )
