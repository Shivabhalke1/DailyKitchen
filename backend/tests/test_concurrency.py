from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.app.models import (
    Base,
    DeliveryZone,
    DeliverySlot,
    ProductVariant,
    Product,
    Category,
    Inventory,
    InventoryReservation,
)


async def get_test_session_maker():
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    session_maker = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return test_engine, session_maker


@pytest.mark.asyncio
async def test_atomic_delivery_slot_booking_capacity():
    """
    Verify atomic update prevents slot overbooking when capacity is reached.
    UPDATE delivery_slots SET current_orders = current_orders + 1
    WHERE id = :slot_id AND current_orders < max_orders;
    """
    engine, session_maker = await get_test_session_maker()
    try:
        async with session_maker() as session:
            zone = DeliveryZone(name="Indiranagar", pincode="560038")
            slot = DeliverySlot(
                zone=zone,
                slot_type="scheduled",
                slot_date=date(2026, 10, 20),
                start_time=time(6, 0),
                end_time=time(9, 0),
                max_orders=2,  # Tight capacity limit of 2 orders
                current_orders=0,
            )
            session.add_all([zone, slot])
            await session.commit()
            slot_id = slot.id

        # Simulate 3 sequential or concurrent booking attempts
        booking_results = []
        for _ in range(3):
            async with session_maker() as session:
                stmt = (
                    update(DeliverySlot)
                    .where(DeliverySlot.id == slot_id)
                    .where(DeliverySlot.current_orders < DeliverySlot.max_orders)
                    .values(current_orders=DeliverySlot.current_orders + 1)
                )
                result = await session.execute(stmt)
                await session.commit()
                booking_results.append(result.rowcount > 0)

        # First 2 bookings succeed, 3rd is rejected due to capacity limit
        assert booking_results == [True, True, False]

        # Verify final count is exactly 2
        async with session_maker() as session:
            res = await session.execute(select(DeliverySlot).where(DeliverySlot.id == slot_id))
            saved_slot = res.scalar_one()
            assert saved_slot.current_orders == 2
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_inventory_reservation_hold_and_release():
    """
    Verify inventory hold lifecycle:
    1. Creating reservation increments reserved_quantity.
    2. Available stock = stock - reserved.
    3. Releasing reservation decrements reserved_quantity.
    """
    engine, session_maker = await get_test_session_maker()
    try:
        async with session_maker() as session:
            cat = Category(name="Veggies", slug="veggies", image_url="https://ex.com/v.jpg")
            prod = Product(category=cat, name="Potato", slug="potato", description="Fresh", image_url="https://ex.com/p.jpg")
            var = ProductVariant(product=prod, weight_label="1kg", weight_grams=1000, price=Decimal("30.00"), mrp=Decimal("40.00"))
            inv = Inventory(variant=var, stock_quantity=10, reserved_quantity=0, low_stock_threshold=2)
            session.add_all([cat, prod, var, inv])
            await session.commit()
            var_id = var.id
            inv_id = inv.id

        # 1. Hold 3 units
        async with session_maker() as session:
            now = datetime.now(timezone.utc)
            res = InventoryReservation(
                variant_id=var_id,
                quantity=3,
                status="active",
                expires_at=now + timedelta(minutes=15),
            )
            session.add(res)
            await session.execute(
                update(Inventory)
                .where(Inventory.id == inv_id)
                .values(reserved_quantity=Inventory.reserved_quantity + 3)
            )
            await session.commit()
            res_id = res.id

        # Verify reserved is 3, available is 7
        async with session_maker() as session:
            inv_row = (await session.execute(select(Inventory).where(Inventory.id == inv_id))).scalar_one()
            assert inv_row.stock_quantity == 10
            assert inv_row.reserved_quantity == 3
            assert inv_row.stock_quantity - inv_row.reserved_quantity == 7

        # 2. Release reservation (e.g. timeout or cancellation)
        async with session_maker() as session:
            res_row = (await session.execute(select(InventoryReservation).where(InventoryReservation.id == res_id))).scalar_one()
            assert res_row.status == "active"
            res_row.status = "released"
            await session.execute(
                update(Inventory)
                .where(Inventory.id == inv_id)
                .values(reserved_quantity=Inventory.reserved_quantity - res_row.quantity)
            )
            await session.commit()

        # Verify reserved is back to 0, available is 10
        async with session_maker() as session:
            inv_row = (await session.execute(select(Inventory).where(Inventory.id == inv_id))).scalar_one()
            assert inv_row.reserved_quantity == 0
            assert inv_row.stock_quantity - inv_row.reserved_quantity == 10
    finally:
        await engine.dispose()
