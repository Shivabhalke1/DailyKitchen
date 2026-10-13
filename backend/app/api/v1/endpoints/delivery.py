from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_db
from backend.app.schemas.delivery import (
    DeliverySlotRead,
    DeliveryZoneRead,
    ZoneCheckResponse,
)
from backend.app.services.delivery_service import DeliveryService

router = APIRouter()


@router.get("/zones/check", response_model=ZoneCheckResponse)
async def check_pincode(
    pincode: str = Query(..., pattern=r"^[1-9][0-9]{5}$", description="6-digit Indian PIN code"),
    db: AsyncSession = Depends(get_db),
):
    """Check whether a delivery PIN code is serviceable."""
    return await DeliveryService.check_pincode(db, pincode)


@router.get("/zones", response_model=List[DeliveryZoneRead])
async def list_zones(
    db: AsyncSession = Depends(get_db),
):
    """List all currently active delivery zones."""
    zones = await DeliveryService.list_zones(db)
    return [DeliveryZoneRead.model_validate(z) for z in zones]


@router.get("/slots", response_model=List[DeliverySlotRead])
async def list_slots(
    zone_id: Optional[str] = Query(None, description="Delivery zone filter"),
    slot_date: Optional[date] = Query(None, alias="date", description="Slot date filter (YYYY-MM-DD)"),
    slot_type: Optional[str] = Query(None, description="Slot type filter (scheduled or instant_express)"),
    db: AsyncSession = Depends(get_db),
):
    """List available delivery slots that have remaining capacity."""
    slots = await DeliveryService.list_available_slots(
        session=db,
        zone_id=zone_id,
        slot_date=slot_date,
        slot_type=slot_type,
    )
    return [DeliverySlotRead.model_validate(s) for s in slots]
