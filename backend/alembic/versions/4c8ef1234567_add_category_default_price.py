"""add_category_default_price

Revision ID: 4c8ef1234567
Revises: 3b7dfb0631ab
Create Date: 2026-10-14 11:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c8ef1234567'
down_revision: Union[str, Sequence[str], None] = '3b7dfb0631ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.add_column('categories', sa.Column('default_price', sa.Numeric(precision=10, scale=2), nullable=True))
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column('categories', 'default_price')
    except Exception:
        pass
