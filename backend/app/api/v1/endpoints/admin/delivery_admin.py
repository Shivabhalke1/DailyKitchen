from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_db
from backend.app.models.delivery import DeliverySlot, DeliveryZone
from backend.app.schemas.admin import SlotUpdate
from backend.app.schemas.delivery import (
    BulkSlotCreate,
    DeliverySlotRead,
    DeliveryZoneRead,
    ZoneCreate,
)
from backend.app.services.admin_service import AdminService

router = APIRouter()


@router.post("/zones", response_model=DeliveryZoneRead, status_code=status.HTTP_201_CREATED)
async def create_delivery_zone(
    payload: ZoneCreate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: create a new serviceable delivery zone."""
    existing = (
        await db.execute(
            select(DeliveryZone).where(DeliveryZone.pincode == payload.pincode)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Delivery zone with pincode '{payload.pincode}' already exists",
        )

    zone = DeliveryZone(
        name=payload.name,
        pincode=payload.pincode,
        is_express_available=payload.is_express_available,
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    return DeliveryZoneRead.model_validate(zone)


@router.post("/slots", response_model=List[DeliverySlotRead], status_code=status.HTTP_201_CREATED)
async def bulk_create_slots(
    payload: BulkSlotCreate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: bulk create delivery slots for a zone on a specific date."""
    zone = (
        await db.execute(select(DeliveryZone).where(DeliveryZone.id == payload.zone_id))
    ).scalar_one_or_none()
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone '{payload.zone_id}' not found",
        )

    created_slots = []
    for item in payload.slots:
        # Database check constraint requires: slot_type IN ('instant_express', 'scheduled')
        if item.slot_type in ("express", "instant_express"):
            db_slot_type = "instant_express"
        else:
            db_slot_type = "scheduled"

        # Check if slot already exists for this exact window to ensure idempotency
        stmt = select(DeliverySlot).where(
            DeliverySlot.zone_id == payload.zone_id,
            DeliverySlot.slot_date == payload.slot_date,
            DeliverySlot.slot_type == db_slot_type,
            DeliverySlot.start_time == item.start_time,
            DeliverySlot.end_time == item.end_time,
        )
        existing_slot = (await db.execute(stmt)).scalar_one_or_none()

        if existing_slot:
            existing_slot.max_orders = item.max_orders
            existing_slot.is_active = True
            created_slots.append(existing_slot)
        else:
            slot = DeliverySlot(
                zone_id=payload.zone_id,
                slot_type=db_slot_type,
                slot_date=payload.slot_date,
                start_time=item.start_time,
                end_time=item.end_time,
                max_orders=item.max_orders,
                current_orders=0,
            )
            db.add(slot)
            created_slots.append(slot)

    await db.commit()
    for s in created_slots:
        await db.refresh(s)

    return [DeliverySlotRead.model_validate(s) for s in created_slots]


@router.get("/slots", response_model=List[DeliverySlotRead])
async def list_admin_slots(
    zone_id: Optional[str] = Query(None, description="Delivery zone filter"),
    slot_date: Optional[date] = Query(None, alias="date", description="Slot date filter (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: List delivery slots across all capacity and active states.
    Allows viewing full and inactive slots for operational scheduling.
    """
    slots = await AdminService.list_all_slots(
        session=db,
        zone_id=zone_id,
        slot_date=slot_date,
    )
    return [DeliverySlotRead.model_validate(s) for s in slots]


@router.patch("/slots/{slot_id}", response_model=DeliverySlotRead)
async def update_slot(
    slot_id: str,
    payload: SlotUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Update delivery slot active state or adjust maximum order capacity.
    """
    slot = await AdminService.update_slot(session=db, slot_id=slot_id, payload=payload)
    return DeliverySlotRead.model_validate(slot)
