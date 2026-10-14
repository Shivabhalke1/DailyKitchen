from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field


class InventoryRead(BaseModel):
    """Inventory availability metrics for a product variant."""

    model_config = ConfigDict(from_attributes=True)

    stock_quantity: int
    reserved_quantity: int

    @computed_field
    def available_quantity(self) -> int:
        return max(0, self.stock_quantity - self.reserved_quantity)

    @computed_field
    def is_in_stock(self) -> bool:
        return self.available_quantity > 0


class ProductVariantRead(BaseModel):
    """Product variant specification and pricing."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    weight_label: str
    weight_grams: int
    price: Decimal
    mrp: Decimal
    is_available: bool
    display_order: int
    inventory: Optional[InventoryRead] = None

    @computed_field
    def discount_amount(self) -> Decimal:
        return max(Decimal("0.00"), self.mrp - self.price)


class ProductRead(BaseModel):
    """Catalog product details with variants."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    category_id: str
    name: str
    slug: str
    description: str
    image_url: str
    is_fresh_today: bool
    is_popular: bool
    is_active: bool
    variants: List[ProductVariantRead] = []


class CategoryRead(BaseModel):
    """Produce category."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: Optional[str] = None
    image_url: str
    display_order: int
    is_active: bool
    default_price: Optional[Decimal] = None


class CategoryWithProductCount(CategoryRead):
    """Category with active product count."""

    product_count: int = 0


class PaginatedProductRead(BaseModel):
    """Paginated product list response."""

    items: List[ProductRead]
    total: int
    page: int
    page_size: int
    has_next: bool


class CategoryCreate(BaseModel):
    """Admin payload to create category."""

    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    image_url: str = Field(..., max_length=500)
    display_order: int = 0
    is_active: bool = True
    default_price: Optional[Decimal] = None


class CategoryUpdate(BaseModel):
    """Admin payload to update category."""

    name: Optional[str] = Field(None, max_length=100)
    slug: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    default_price: Optional[Decimal] = None


class ProductCreate(BaseModel):
    """Admin payload to create product."""

    category_id: str
    name: str = Field(..., min_length=1, max_length=150)
    slug: str = Field(..., min_length=1, max_length=180)
    description: str
    image_url: str = Field(..., max_length=500)
    is_fresh_today: bool = True
    is_popular: bool = False
    is_active: bool = True


class ProductUpdate(BaseModel):
    """Admin payload to update product."""

    category_id: Optional[str] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_fresh_today: Optional[bool] = None
    is_popular: Optional[bool] = None
    is_active: Optional[bool] = None


class ProductPricingUpdate(BaseModel):
    """Admin payload to quickly set an item's selling price and MRP."""

    price: Decimal = Field(..., ge=0)
    mrp: Optional[Decimal] = Field(None, ge=0)
    variant_id: Optional[str] = None


class VariantCreate(BaseModel):
    """Admin payload to create variant."""

    weight_label: str = Field(..., min_length=1, max_length=50)
    weight_grams: int = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    mrp: Decimal = Field(..., ge=0)
    display_order: int = 0


class VariantUpdate(BaseModel):
    """Admin payload to update variant."""

    weight_label: Optional[str] = Field(None, min_length=1, max_length=50)
    weight_grams: Optional[int] = Field(None, gt=0)
    price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    is_available: Optional[bool] = None
    display_order: Optional[int] = None

    display_order: Optional[int] = None


class InventoryAdjust(BaseModel):
    """Admin payload to adjust variant inventory stock delta."""

    delta: int  # positive = restock, negative = manual deduction
    reason: str = Field(..., min_length=1, max_length=200)
