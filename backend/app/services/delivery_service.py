from datetime import date
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.delivery import DeliverySlot, DeliveryZone
from backend.app.schemas.delivery import DeliveryZoneRead, ZoneCheckResponse


class DeliveryService:
    @staticmethod
    async def check_pincode(session: AsyncSession, pincode: str) -> ZoneCheckResponse:
        """Check if a 6-digit Indian pincode is serviceable."""
        stmt = select(DeliveryZone).where(
            DeliveryZone.pincode == pincode,
            DeliveryZone.is_active.is_(True),
        )
        result = await session.execute(stmt)
        zone = result.scalar_one_or_none()

        if zone:
            return ZoneCheckResponse(
                pincode=pincode,
                is_serviceable=True,
                zone=DeliveryZoneRead.model_validate(zone),
                message="Delivery is available in your area",
            )
        return ZoneCheckResponse(
            pincode=pincode,
            is_serviceable=False,
            zone=None,
            message="Sorry, we do not currently deliver to this pincode",
        )

    @staticmethod
    async def list_zones(session: AsyncSession) -> List[DeliveryZone]:
        """Fetch all active delivery zones."""
        stmt = (
            select(DeliveryZone)
            .where(DeliveryZone.is_active.is_(True))
            .order_by(DeliveryZone.name.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def list_available_slots(
        session: AsyncSession,
        zone_id: Optional[str] = None,
        slot_date: Optional[date] = None,
        slot_type: Optional[str] = None,
    ) -> List[DeliverySlot]:
        """Fetch active delivery slots with remaining capacity."""
        stmt = select(DeliverySlot).where(
            DeliverySlot.is_active.is_(True),
            DeliverySlot.current_orders < DeliverySlot.max_orders,
        )

        if zone_id:
            stmt = stmt.where(DeliverySlot.zone_id == zone_id)
        if slot_date:
            stmt = stmt.where(DeliverySlot.slot_date == slot_date)
        else:
            stmt = stmt.where(DeliverySlot.slot_date >= date.today())
        if slot_type:
            stmt = stmt.where(DeliverySlot.slot_type == slot_type)

        stmt = stmt.order_by(
            DeliverySlot.slot_date.asc(), DeliverySlot.start_time.asc()
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
