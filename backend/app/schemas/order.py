from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class OrderItemRead(BaseModel):
    """Immutable line item snapshot from an order."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    variant_id: Optional[str] = None
    product_name_snap: str
    weight_label_snap: str
    unit_price: Decimal
    mrp_snap: Decimal
    quantity: int
    line_total: Decimal


class OrderAddressRead(BaseModel):
    """Immutable delivery address snapshot from an order."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    source_address_id: Optional[str] = None
    full_name: str
    phone: str
    house_flat: str
    street_area: str
    landmark: Optional[str] = None
    city: str
    state: str
    pincode: str


class PaymentRead(BaseModel):
    """Financial transaction details."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    transaction_id: Optional[str] = None
    provider: str
    amount: Decimal
    currency: str
    status: str
    refund_id: Optional[str] = None
    refunded_amount: Decimal


class OrderCreate(BaseModel):
    """Payload to initiate order placement."""

    address_id: str = Field(..., description="ID of customer's saved address to snapshot")
    slot_id: str = Field(..., description="ID of delivery slot to book")
    payment_method: str = Field(..., pattern="^(upi|card|netbanking|cod)$")
    notes: Optional[str] = None


class OrderRead(BaseModel):
    """Comprehensive order representation."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    user_id: str
    slot_id: str
    status: str
    subtotal: Decimal
    packaging_fee: Decimal
    delivery_fee: Decimal
    total_amount: Decimal
    payment_method: str
    payment_status: str
    notes: Optional[str] = None
    created_at: datetime
    address_snapshot: Optional[OrderAddressRead] = None
    items: List[OrderItemRead] = []
    payments: List[PaymentRead] = []


class PaymentIntentCreate(BaseModel):
    """Payload to create a payment intent."""

    order_id: str
    provider: str = Field("mock", pattern="^(mock|razorpay|cashfree)$")
    idempotency_key: str = Field(..., min_length=16, max_length=100)


class OrderStatusUpdate(BaseModel):
    """Payload for order status updates."""

    status: str = Field(..., pattern="^(confirmed|dispatched|out_for_delivery|delivered|cancelled)$")
    note: Optional[str] = Field(None, max_length=500)


class OrderCancelRequest(BaseModel):
    """Payload for customer or admin order cancellation."""

    reason: str = Field(..., min_length=1, max_length=500)


class RefundRequest(BaseModel):
    """Payload to issue a refund against a payment."""

    refund_amount: Decimal = Field(..., gt=0)
    refund_id: str = Field(..., min_length=1, max_length=200)
    reason: str = Field(..., min_length=1, max_length=500)


class PaginatedOrderRead(BaseModel):
    """Paginated list of orders."""

    items: List[OrderRead]
    total: int
    page: int
    page_size: int
    has_next: bool
