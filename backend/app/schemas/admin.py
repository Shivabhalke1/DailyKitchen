from datetime import date as DateType, datetime
from decimal import Decimal
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.order import OrderRead
from backend.app.schemas.user import AddressRead


class DashboardMetricsRead(BaseModel):
    """Authoritative executive metrics for daily operations."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    report_date: DateType = Field(..., alias="date", description="Target reporting date (YYYY-MM-DD)")
    total_orders_today: int = Field(..., ge=0, description="Total customer orders placed on target date")
    orders_by_status: Dict[str, int] = Field(
        ...,
        description="Count of orders categorized by lifecycle status (placed, confirmed, out_for_delivery, delivered, cancelled)",
    )
    revenue_today: Decimal = Field(
        ...,
        ge=0,
        description="Gross order revenue for target date, strictly excluding cancelled orders",
    )
    low_stock_variants_count: int = Field(
        ...,
        ge=0,
        description="Number of produce variants with stock quantity at or below low-stock threshold",
    )
    out_of_stock_variants_count: int = Field(
        ...,
        ge=0,
        description="Number of produce variants with zero remaining sellable inventory",
    )
    active_slots_count: int = Field(
        ...,
        ge=0,
        description="Total active delivery slot windows scheduled for target date",
    )
    slot_capacity_total: int = Field(
        ...,
        ge=0,
        description="Total maximum customer order capacity across all slots for target date",
    )
    slot_capacity_booked: int = Field(
        ...,
        ge=0,
        description="Total customer orders booked into slots for target date",
    )
    slot_utilization_percent: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Overall delivery slot saturation percentage",
    )
    recent_orders: List[OrderRead] = Field(
        default_factory=list,
        description="Newest orders requiring operational fulfillment",
    )


class SlotUpdate(BaseModel):
    """Admin payload to update delivery slot capacity or toggle active status."""

    is_active: Optional[bool] = Field(None, description="Toggle whether slot is available for customer booking")
    max_orders: Optional[int] = Field(None, gt=0, description="Update maximum order limit for this slot window")


class AdminCustomerListItem(BaseModel):
    """Customer overview item in admin directory."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_code: Optional[str] = None
    phone: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    total_orders: int = Field(..., ge=0, description="Total non-cancelled orders placed by customer")
    total_spend: Decimal = Field(..., ge=0, description="Total spend from delivered, non-refunded orders")
    created_at: datetime


class AdminCustomerListResponse(BaseModel):
    """Paginated list of customer accounts for backoffice directory."""

    items: List[AdminCustomerListItem]
    total: int
    page: int
    limit: int


class AdminCustomerDetail(BaseModel):
    """Deep customer details and immutable historical orders inspection."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_code: Optional[str] = None
    phone: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    total_orders: int
    total_spend: Decimal
    orders: List[OrderRead] = Field(default_factory=list, description="Historical customer orders containing immutable snapshot items and addresses")
    addresses: List[AddressRead] = Field(default_factory=list, description="Saved customer delivery addresses")


class AdminCustomerDeleteResponse(BaseModel):
    """Result of customer deletion or deactivation by admin."""

    success: bool = True
    customer_id: str
    action: str = Field(..., description="'deleted' if purged completely, or 'deactivated' if historical financial orders are preserved")
    message: str

