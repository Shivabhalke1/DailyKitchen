from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.catalog import ProductVariantRead


class CartItemCreate(BaseModel):
    """Payload to add an item to the shopping cart."""

    variant_id: str
    quantity: int = Field(1, ge=1, le=20, description="Quantity must be between 1 and 20")


class CartItemUpdate(BaseModel):
    """Payload to update quantity of an existing cart item."""

    quantity: int = Field(..., ge=1, le=20, description="Updated quantity between 1 and 20")


class CartItemRead(BaseModel):
    """Line item within customer cart."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    cart_id: str
    variant_id: str
    quantity: int
    variant: Optional[ProductVariantRead] = None


class CartPricingSummary(BaseModel):
    """Pricing computation breakdown for shopping cart."""

    subtotal: Decimal
    delivery_fee: Decimal
    packaging_fee: Decimal
    total: Decimal
    is_free_delivery: bool


class CartRead(BaseModel):
    """Shopping cart entity with aggregated items."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
    guest_token_hash: Optional[str] = None
    is_active: bool
    items: List[CartItemRead] = []
    subtotal: Decimal = Decimal("0.00")
    item_count: int = 0


class CartReadWithPricing(CartRead):
    """Shopping cart with authoritative computed pricing."""

    pricing: CartPricingSummary
