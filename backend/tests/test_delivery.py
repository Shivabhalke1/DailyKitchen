from datetime import date
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.delivery import DeliverySlot, DeliveryZone


@pytest.mark.asyncio
async def test_seeded_pincode_serviceable(client: AsyncClient):
    """Querying a seeded pincode (e.g. 560034) returns is_serviceable=True with zone info."""
    resp = await client.get("/api/v1/delivery/zones/check?pincode=560034")
    assert resp.status_code == 200
    data = resp.json()
    assert data["pincode"] == "560034"
    assert data["is_serviceable"] is True
    assert data["zone"] is not None
    assert "Koramangala" in data["zone"]["name"]


@pytest.mark.asyncio
async def test_unknown_pincode_not_serviceable(client: AsyncClient):
    """Querying an unserved 6-digit pincode returns is_serviceable=False."""
    resp = await client.get("/api/v1/delivery/zones/check?pincode=110001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["pincode"] == "110001"
    assert data["is_serviceable"] is False
    assert data["zone"] is None


@pytest.mark.asyncio
async def test_list_delivery_zones(client: AsyncClient):
    """GET /delivery/zones returns all active delivery zones."""
    resp = await client.get("/api/v1/delivery/zones")
    assert resp.status_code == 200
    zones = resp.json()
    assert len(zones) >= 3
    pincodes = [z["pincode"] for z in zones]
    assert "560034" in pincodes
    assert "560038" in pincodes
    assert "560066" in pincodes


@pytest.mark.asyncio
async def test_list_available_slots_excludes_full(client: AsyncClient):
    """GET /delivery/slots returns active slots with remaining capacity, excluding full slots."""
    today_str = date.today().isoformat()
    resp = await client.get(f"/api/v1/delivery/slots?date={today_str}")
    assert resp.status_code == 200
    slots = resp.json()
    assert len(slots) >= 1
    for s in slots:
        assert s["current_orders"] < s["max_orders"]
        assert s["is_available"] is True

    # Mark a slot full and verify it disappears from available slots
    slot_id = slots[0]["id"]
    async with AsyncSessionLocal() as session:
        slot = (
            await session.execute(
                select(DeliverySlot).where(DeliverySlot.id == slot_id)
            )
        ).scalar_one()
        original_current = slot.current_orders
        slot.current_orders = slot.max_orders
        await session.commit()

    try:
        resp_after = await client.get(f"/api/v1/delivery/slots?date={today_str}")
        assert resp_after.status_code == 200
        slot_ids_after = [s["id"] for s in resp_after.json()]
        assert slot_id not in slot_ids_after
    finally:
        # Revert
        async with AsyncSessionLocal() as session:
            slot = (
                await session.execute(
                    select(DeliverySlot).where(DeliverySlot.id == slot_id)
                )
            ).scalar_one()
            slot.current_orders = original_current
            await session.commit()
