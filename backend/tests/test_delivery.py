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


@pytest.mark.asyncio
async def test_admin_create_and_delete_zone(client: AsyncClient, admin_auth):
    """Admin can create a new zone and delete it when unbooked."""
    headers, _ = admin_auth
    create_payload = {
        "name": "Test Delete Territory",
        "pincode": "560099",
        "is_express_available": True,
    }
    create_resp = await client.post("/api/v1/admin/delivery/zones", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    zone_data = create_resp.json()
    zone_id = zone_data["id"]

    try:
        # Delete the zone
        del_resp = await client.delete(f"/api/v1/admin/delivery/zones/{zone_id}", headers=headers)
        assert del_resp.status_code == 200
        assert del_resp.json()["success"] is True

        # Verify not found
        get_resp = await client.get("/api/v1/delivery/zones")
        assert zone_id not in [z["id"] for z in get_resp.json()]
    finally:
        # Clean up if still exists
        async with AsyncSessionLocal() as session:
            z = (await session.execute(select(DeliveryZone).where(DeliveryZone.id == zone_id))).scalar_one_or_none()
            if z:
                await session.delete(z)
                await session.commit()


@pytest.mark.asyncio
async def test_admin_create_and_delete_single_slot(client: AsyncClient, admin_auth):
    """Admin can create a single delivery slot and delete it if unbooked."""
    headers, _ = admin_auth
    # Find existing zone
    zones_resp = await client.get("/api/v1/delivery/zones")
    zone_id = zones_resp.json()[0]["id"]

    slot_payload = {
        "zone_id": zone_id,
        "slot_date": date.today().isoformat(),
        "slot_type": "scheduled",
        "start_time": "21:00:00",
        "end_time": "23:00:00",
        "max_orders": 15,
    }

    create_resp = await client.post("/api/v1/admin/delivery/slots/single", json=slot_payload, headers=headers)
    assert create_resp.status_code == 201
    slot = create_resp.json()
    slot_id = slot["id"]

    # Delete unbooked slot
    del_resp = await client.delete(f"/api/v1/admin/delivery/slots/{slot_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True
