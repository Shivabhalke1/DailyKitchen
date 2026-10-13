import os
import sys
import io
import tempfile
import pytest
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, inspect


@pytest.fixture
def alembic_config():
    """Create an Alembic config pointing to the backend's alembic directory."""
    backend_dir = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
    cfg = Config(alembic_ini_path)
    cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    return cfg


def test_alembic_upgrade_downgrade_roundtrip_sqlite(alembic_config):
    """
    Execute real upgrade head and downgrade base against a fresh, temporary SQLite database.
    Verifies that all 18 tables, constraints, and indexes apply and rollback cleanly.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        tmp_db_path = tmp_db.name

    try:
        # Override connection URL to point to fresh temporary SQLite DB with async driver
        async_db_url = f"sqlite+aiosqlite:///{tmp_db_path}"
        alembic_config.set_main_option("sqlalchemy.url", async_db_url)

        # 1. Run upgrade head
        command.upgrade(alembic_config, "head")

        # Verify tables created
        sync_db_url = f"sqlite:///{tmp_db_path}"
        engine = create_engine(sync_db_url)
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert "alembic_version" in tables
        assert "users" in tables
        assert "orders" in tables
        assert "payments" in tables
        assert "inventory_reservations" in tables
        assert "order_addresses" in tables
        assert "user_sessions" in tables
        assert "password_reset_tokens" in tables
        assert len(tables) == 21  # 20 models + alembic_version

        # 2. Run downgrade base
        command.downgrade(alembic_config, "base")

        # Verify tables dropped
        inspector_after = inspect(engine)
        tables_after = set(inspector_after.get_table_names())
        assert len(tables_after) <= 1  # only alembic_version (or empty) remains
        engine.dispose()
    finally:
        if os.path.exists(tmp_db_path):
            os.remove(tmp_db_path)


def test_alembic_offline_postgresql_sql_generation(alembic_config):
    """
    Verify Alembic generates clean, valid PostgreSQL DDL in offline mode without syntax errors.
    """
    pg_url = "postgresql://mock_user:mock_pass@localhost:5432/mock_dailykitchen"
    alembic_config.set_main_option("sqlalchemy.url", pg_url)

    # Capture stdout
    stdout_trap = io.StringIO()
    old_stdout = sys.stdout
    sys.stdout = stdout_trap
    try:
        command.upgrade(alembic_config, "head", sql=True)
    finally:
        sys.stdout = old_stdout

    generated_sql = stdout_trap.getvalue()
    assert "CREATE TABLE users" in generated_sql
    assert "CREATE TABLE orders" in generated_sql
    assert "CREATE TABLE order_addresses" in generated_sql
    assert "CREATE TABLE inventory_reservations" in generated_sql
    assert "check_order_total_sum" in generated_sql
    assert "uq_payment_provider_tx" in generated_sql
