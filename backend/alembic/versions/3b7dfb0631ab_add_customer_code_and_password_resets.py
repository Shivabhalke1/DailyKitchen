"""add_customer_code_and_password_resets

Revision ID: 3b7dfb0631ab
Revises: 62b62cd03f30
Create Date: 2026-10-13 14:08:45.299800

"""
import secrets
from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b7dfb0631ab'
down_revision: Union[str, Sequence[str], None] = '62b62cd03f30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema and backfill unique customer IDs."""
    # Handle offline SQL generation mode (e.g. alembic upgrade --sql)
    if context.is_offline_mode():
        op.add_column('users', sa.Column('customer_code', sa.String(length=20), nullable=True))
        op.create_index(op.f('ix_users_customer_code'), 'users', ['customer_code'], unique=True)

        op.create_table(
            'password_reset_tokens',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_used', sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_password_reset_tokens_user_id'), 'password_reset_tokens', ['user_id'], unique=False)
        op.create_index(op.f('ix_password_reset_tokens_token_hash'), 'password_reset_tokens', ['token_hash'], unique=True)
        op.create_index('ix_password_reset_tokens_user_used_exp', 'password_reset_tokens', ['user_id', 'is_used', 'expires_at'], unique=False)
        return

    # Online mode: inspect database engine to ensure safe, idempotent modification
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Add customer_code column (if not already present)
    user_columns = [col['name'] for col in insp.get_columns('users')]
    if 'customer_code' not in user_columns:
        op.add_column('users', sa.Column('customer_code', sa.String(length=20), nullable=True))

    # 2. Collision-safe backfill for all existing users
    users_table = sa.table(
        'users',
        sa.column('id', sa.String),
        sa.column('customer_code', sa.String),
    )

    # Collect existing codes in memory to prevent collision during generation
    existing_codes_result = bind.execute(
        sa.select(users_table.c.customer_code).where(users_table.c.customer_code.is_not(None))
    ).fetchall()
    allocated_codes = {row[0] for row in existing_codes_result if row[0]}

    # Query users that need a customer code
    users_to_backfill = bind.execute(
        sa.select(users_table.c.id).where(
            sa.or_(users_table.c.customer_code.is_(None), users_table.c.customer_code == '')
        )
    ).fetchall()

    for row in users_to_backfill:
        user_id = row[0]
        # Generate unique code DKC-XXXXXXXX (8 uppercase hex chars)
        while True:
            candidate_code = f"DKC-{secrets.token_hex(4).upper()}"
            if candidate_code not in allocated_codes:
                allocated_codes.add(candidate_code)
                break

        bind.execute(
            users_table.update().where(users_table.c.id == user_id).values(customer_code=candidate_code)
        )

    # Re-inspect to see updated indexes
    insp = sa.inspect(bind)
    user_indexes = [idx['name'] for idx in insp.get_indexes('users')]
    if 'ix_users_customer_code' not in user_indexes:
        op.create_index(op.f('ix_users_customer_code'), 'users', ['customer_code'], unique=True)

    # 4. Create password_reset_tokens table (if not already present)
    if not insp.has_table('password_reset_tokens'):
        op.create_table(
            'password_reset_tokens',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_used', sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_password_reset_tokens_user_id'), 'password_reset_tokens', ['user_id'], unique=False)
        op.create_index(op.f('ix_password_reset_tokens_token_hash'), 'password_reset_tokens', ['token_hash'], unique=True)
        op.create_index('ix_password_reset_tokens_user_used_exp', 'password_reset_tokens', ['user_id', 'is_used', 'expires_at'], unique=False)
    else:
        # Table exists, ensure indexes exist
        token_indexes = [idx['name'] for idx in insp.get_indexes('password_reset_tokens')]
        if 'ix_password_reset_tokens_user_id' not in token_indexes:
            op.create_index(op.f('ix_password_reset_tokens_user_id'), 'password_reset_tokens', ['user_id'], unique=False)
        if 'ix_password_reset_tokens_token_hash' not in token_indexes:
            op.create_index(op.f('ix_password_reset_tokens_token_hash'), 'password_reset_tokens', ['token_hash'], unique=True)
        if 'ix_password_reset_tokens_user_used_exp' not in token_indexes:
            op.create_index('ix_password_reset_tokens_user_used_exp', 'password_reset_tokens', ['user_id', 'is_used', 'expires_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Handle offline SQL generation mode
    if context.is_offline_mode():
        op.drop_index('ix_password_reset_tokens_user_used_exp', table_name='password_reset_tokens')
        op.drop_index(op.f('ix_password_reset_tokens_token_hash'), table_name='password_reset_tokens')
        op.drop_index(op.f('ix_password_reset_tokens_user_id'), table_name='password_reset_tokens')
        op.drop_table('password_reset_tokens')
        op.drop_index(op.f('ix_users_customer_code'), table_name='users')
        op.drop_column('users', 'customer_code')
        return

    # Online mode
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Drop password_reset_tokens table and indexes if present
    if insp.has_table('password_reset_tokens'):
        token_indexes = [idx['name'] for idx in insp.get_indexes('password_reset_tokens')]
        if 'ix_password_reset_tokens_user_used_exp' in token_indexes:
            op.drop_index('ix_password_reset_tokens_user_used_exp', table_name='password_reset_tokens')
        if 'ix_password_reset_tokens_token_hash' in token_indexes:
            op.drop_index(op.f('ix_password_reset_tokens_token_hash'), table_name='password_reset_tokens')
        if 'ix_password_reset_tokens_user_id' in token_indexes:
            op.drop_index(op.f('ix_password_reset_tokens_user_id'), table_name='password_reset_tokens')
        op.drop_table('password_reset_tokens')

    # 2. Drop unique index and customer_code column from users if present
    user_columns = [col['name'] for col in insp.get_columns('users')]
    if 'customer_code' in user_columns:
        user_indexes = [idx['name'] for idx in insp.get_indexes('users')]
        if 'ix_users_customer_code' in user_indexes:
            op.drop_index(op.f('ix_users_customer_code'), table_name='users')
        op.drop_column('users', 'customer_code')
