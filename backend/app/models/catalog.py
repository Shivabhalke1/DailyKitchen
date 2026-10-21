from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from backend.app.models.cart import Cart, CartItem
    from backend.app.models.order import Order


class Category(Base, TimestampMixin):
    """Produce category model (e.g. Daily Vegetables, Fresh Fruits, Greens & Herbs)."""

    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(
        String(120),
        unique=True,
        index=True,
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    image_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    default_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    # Relationships
    products: Mapped[List["Product"]] = relationship(
        "Product",
        back_populates="category",
    )


class Product(Base, TimestampMixin):
    """Core produce item model."""

    __tablename__ = "products"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    category_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(150),
        index=True,
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(
        String(180),
        unique=True,
        index=True,
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    image_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    is_fresh_today: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_popular: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    category: Mapped["Category"] = relationship(
        "Category",
        back_populates="products",
    )
    variants: Mapped[List["ProductVariant"]] = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
    )


class ProductVariant(Base, TimestampMixin):
    """Specific weight pack or unit sizing for a product with authoritative pricing."""

    __tablename__ = "product_variants"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    product_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    weight_label: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    weight_grams: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    mrp: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    is_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "weight_grams > 0",
            name="check_variant_weight_positive",
        ),
        CheckConstraint(
            "price >= 0",
            name="check_variant_price_nonnegative",
        ),
        CheckConstraint(
            "mrp >= price",
            name="check_variant_mrp_gte_price",
        ),
    )

    # Relationships
    product: Mapped["Product"] = relationship(
        "Product",
        back_populates="variants",
    )
    inventory: Mapped[Optional["Inventory"]] = relationship(
        "Inventory",
        back_populates="variant",
        uselist=False,
        cascade="all, delete-orphan",
    )
    reservations: Mapped[List["InventoryReservation"]] = relationship(
        "InventoryReservation",
        back_populates="variant",
        cascade="all, delete-orphan",
    )
    cart_items: Mapped[List["CartItem"]] = relationship(
        "CartItem",
        back_populates="variant",
        cascade="all, delete-orphan",
    )

    @property
    def product_name(self) -> Optional[str]:
        return self.product.name if self.product else None

    @property
    def product_image_url(self) -> Optional[str]:
        return self.product.image_url if self.product else None


class Inventory(Base, TimestampMixin):
    """Real-time physical stock and active reservation counters per variant."""

    __tablename__ = "inventory"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    variant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    stock_quantity: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    reserved_quantity: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    low_stock_threshold: Mapped[int] = mapped_column(
        Integer,
        default=10,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "stock_quantity >= 0",
            name="check_inventory_stock_nonnegative",
        ),
        CheckConstraint(
            "reserved_quantity >= 0",
            name="check_inventory_reserved_nonnegative",
        ),
        CheckConstraint(
            "reserved_quantity <= stock_quantity",
            name="check_inventory_reserved_lte_stock",
        ),
        CheckConstraint(
            "low_stock_threshold >= 0",
            name="check_inventory_low_stock_threshold_nonnegative",
        ),
    )

    # Relationship
    variant: Mapped["ProductVariant"] = relationship(
        "ProductVariant",
        back_populates="inventory",
    )


class InventoryReservation(Base, TimestampMixin):
    """
    Temporary inventory hold during checkout.
    Guarantees stock cannot be oversold across concurrent checkout sessions.
    """

    __tablename__ = "inventory_reservations"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    variant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    cart_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("carts.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    order_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="active",
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="check_reservation_quantity_positive",
        ),
        CheckConstraint(
            "status IN ('active', 'consumed', 'released', 'expired')",
            name="check_reservation_status",
        ),
        Index(
            "ix_inv_res_variant_status_expires",
            "variant_id",
            "status",
            "expires_at",
        ),
    )

    # Relationships
    variant: Mapped["ProductVariant"] = relationship(
        "ProductVariant",
        back_populates="reservations",
    )
    cart: Mapped[Optional["Cart"]] = relationship(
        "Cart",
        back_populates="reservations",
    )
    order: Mapped[Optional["Order"]] = relationship(
        "Order",
        back_populates="reservations",
    )


class UploadedImage(Base, TimestampMixin):
    """Persistent storage for uploaded images across ephemeral cloud restarts."""

    __tablename__ = "uploaded_images"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    data: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False,
    )
    size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

