from datetime import date, time
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field


class DeliveryZoneRead(BaseModel):
    """Supported delivery zone."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    pincode: str
    is_express_available: bool
    is_active: bool


class DeliverySlotRead(BaseModel):
    """Scheduled delivery slot window with capacity status."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    zone_id: str
    slot_type: str
    slot_date: date
    start_time: time
    end_time: time
    timezone: str
    max_orders: int
    current_orders: int
    is_active: bool = True

    @computed_field
    def is_available(self) -> bool:
        return self.is_active and (self.current_orders < self.max_orders)


class ZoneCheckResponse(BaseModel):
    """Pincode serviceability lookup response."""

    pincode: str
    is_serviceable: bool
    zone: Optional[DeliveryZoneRead] = None
    message: str


class ZoneCreate(BaseModel):
    """Admin payload to create delivery zone."""

    name: str = Field(..., min_length=1, max_length=100)
    pincode: str = Field(..., pattern=r"^[1-9][0-9]{5}$")
    is_express_available: bool = False


class SlotCreateItem(BaseModel):
    """Slot item for bulk creation."""

    slot_type: str = Field("scheduled", pattern="^(standard|express|scheduled|instant_express)$")
    start_time: time
    end_time: time
    max_orders: int = Field(50, gt=0)


class BulkSlotCreate(BaseModel):
    """Admin payload to bulk-create delivery slots for zone and date."""

    zone_id: str
    slot_date: date
    slots: List[SlotCreateItem]
