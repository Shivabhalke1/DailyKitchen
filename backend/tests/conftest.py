import os

# Set DATABASE_URL for tests before any backend modules are imported
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_dailykitchen.db"

import secrets
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, update

from backend.app.core.security import create_access_token
from backend.app.db.base import Base
from backend.app.db.seed import seed_database
from backend.app.db.session import AsyncSessionLocal, engine
from backend.app.main import app
from backend.app.models.cart import Cart
from backend.app.models.catalog import Category, Inventory
from backend.app.models.delivery import DeliverySlot
from backend.app.models.user import Profile, User


@pytest_asyncio.fixture(autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE categories ADD COLUMN default_price NUMERIC(10, 2)"))
        except Exception:
            pass
    async with AsyncSessionLocal() as session:
        # Check if catalog seeded
        cat = await session.execute(select(Category).limit(1))
        if cat.scalar_one_or_none() is None:
            await seed_database(session)
        else:
            # Ensure fresh stock and slot capacity for deterministic, repeatable test runs
            await session.execute(update(Inventory).values(reserved_quantity=0))
            await session.execute(update(DeliverySlot).values(current_orders=0))
            await session.commit()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def customer_auth(client: AsyncClient):
    """Create a verified customer user with cart and return (headers, user)."""
    phone = f"+919{secrets.randbelow(900000000):09d}"
    async with AsyncSessionLocal() as session:
        user = User(
            phone=phone,
            role="customer",
            customer_code=f"DKC-{secrets.token_hex(4).upper()}",
            is_active=True,
            is_phone_verified=True,
        )
        session.add(user)
        await session.flush()

        profile = Profile(user_id=user.id, full_name="Customer")
        cart = Cart(user_id=user.id, is_active=True)
        session.add_all([profile, cart])
        await session.commit()
        await session.refresh(user)

    token = create_access_token(user_id=user.id, phone=user.phone, role="customer")
    headers = {"Authorization": f"Bearer {token}"}
    return headers, user


@pytest_asyncio.fixture
async def admin_auth(client: AsyncClient):
    """Create an active admin user and return (headers, admin_user)."""
    phone = f"+919{secrets.randbelow(900000000):09d}"
    async with AsyncSessionLocal() as session:
        admin = User(
            phone=phone,
            role="admin",
            is_active=True,
            is_phone_verified=True,
        )
        session.add(admin)
        await session.flush()

        profile = Profile(user_id=admin.id, full_name="Operations Administrator")
        session.add(profile)
        await session.commit()
        await session.refresh(admin)

    token = create_access_token(user_id=admin.id, phone=admin.phone, role="admin")
    headers = {"Authorization": f"Bearer {token}"}
    return headers, admin
