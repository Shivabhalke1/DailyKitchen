from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from backend.app.models.catalog import InventoryReservation, ProductVariant
    from backend.app.models.delivery import DeliverySlot
    from backend.app.models.user import User


class Order(Base, TimestampMixin):
    """
    Authoritative customer order entity.
    Enforces backend pricing rules: ₹10 packaging fee and locked ₹99 free-delivery threshold.
    """

    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    order_number: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        index=True,
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    slot_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("delivery_slots.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
    )
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    packaging_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("10.00"),
        nullable=False,
    )
    delivery_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    payment_status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'placed', 'confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered', 'cancelled')",
            name="check_order_status",
        ),
        CheckConstraint(
            "subtotal >= 0",
            name="check_order_subtotal_nonnegative",
        ),
        CheckConstraint(
            "packaging_fee >= 0",
            name="check_order_packaging_fee_nonnegative",
        ),
        CheckConstraint(
            "delivery_fee >= 0",
            name="check_order_delivery_fee_nonnegative",
        ),
        CheckConstraint(
            "total_amount >= 0",
            name="check_order_total_amount_nonnegative",
        ),
        CheckConstraint(
            "payment_method IN ('upi', 'card', 'netbanking', 'cod')",
            name="check_order_payment_method",
        ),
        CheckConstraint(
            "payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')",
            name="check_order_payment_status",
        ),
        CheckConstraint(
            "total_amount = subtotal + packaging_fee + delivery_fee",
            name="check_order_total_sum",
        ),
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="orders",
    )
    slot: Mapped["DeliverySlot"] = relationship(
        "DeliverySlot",
        back_populates="orders",
    )
    address_snapshot: Mapped["OrderAddress"] = relationship(
        "OrderAddress",
        back_populates="order",
        uselist=False,
        cascade="all, delete-orphan",
    )
    items: Mapped[List["OrderItem"]] = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    payments: Mapped[List["Payment"]] = relationship(
        "Payment",
        back_populates="order",
    )
    status_history: Mapped[List["OrderStatusHistory"]] = relationship(
        "OrderStatusHistory",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    reservations: Mapped[List["InventoryReservation"]] = relationship(
        "InventoryReservation",
        back_populates="order",
    )


class OrderAddress(Base, TimestampMixin):
    """
    Immutable delivery address snapshot taken at order placement.
    Guarantees address changes in the customer address book never mutate historical orders.
    """

    __tablename__ = "order_addresses"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        unique=True,
        index=True,
        nullable=False,
    )
    source_address_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    phone: Mapped[str] = mapped_column(
        String(15),
        nullable=False,
    )
    house_flat: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    street_area: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    landmark: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    state: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    pincode: Mapped[str] = mapped_column(
        String(6),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "length(pincode) = 6",
            name="check_order_address_pincode_length",
        ),
    )

    # Relationship
    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="address_snapshot",
    )


class OrderItem(Base, TimestampMixin):
    """
    Immutable line item snapshot of purchased produce.
    Preserves item name, weight label, unit price, and mrp as of purchase time.
    """

    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    variant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("product_variants.id", ondelete="RESTRICT"),
        nullable=True,
    )
    product_name_snap: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    weight_label_snap: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    mrp_snap: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    line_total: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "unit_price >= 0",
            name="check_order_item_unit_price_nonnegative",
        ),
        CheckConstraint(
            "mrp_snap >= unit_price",
            name="check_order_item_mrp_snap_gte_unit_price",
        ),
        CheckConstraint(
            "quantity >= 1",
            name="check_order_item_quantity_positive",
        ),
        CheckConstraint(
            "line_total = unit_price * quantity",
            name="check_order_item_line_total_product",
        ),
    )

    # Relationships
    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="items",
    )
    variant: Mapped[Optional["ProductVariant"]] = relationship(
        "ProductVariant",
    )


class Payment(Base, TimestampMixin):
    """
    Financial transaction record.
    Foreign key ondelete="RESTRICT" guarantees payment history cannot be cascaded away.
    """

    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    transaction_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        index=True,
        nullable=True,
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(5),
        default="INR",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
    )
    refund_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        index=True,
        nullable=True,
    )
    refunded_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("0.00"),
        nullable=False,
    )
    gateway_payload: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "provider IN ('mock', 'razorpay', 'cashfree')",
            name="check_payment_provider",
        ),
        CheckConstraint(
            "amount >= 0",
            name="check_payment_amount_nonnegative",
        ),
        CheckConstraint(
            "status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')",
            name="check_payment_status",
        ),
        CheckConstraint(
            "refunded_amount >= 0",
            name="check_payment_refunded_amount_nonnegative",
        ),
        CheckConstraint(
            "refunded_amount <= amount",
            name="check_payment_refunded_amount_lte_amount",
        ),
        Index(
            "uq_payment_provider_tx",
            "provider",
            "transaction_id",
            unique=True,
            postgresql_where=text("transaction_id IS NOT NULL"),
            sqlite_where=text("transaction_id IS NOT NULL"),
        ),
    )

    # Relationship
    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="payments",
    )


class OrderStatusHistory(Base):
    """
    Append-only audit trail tracking lifecycle transitions for orders.
    Customer and admin operations append records without mutating past audit entries.
    """

    __tablename__ = "order_status_history"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    order_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("orders.id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    from_status: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
    )
    to_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    comment: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    changed_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    order: Mapped["Order"] = relationship(
        "Order",
        back_populates="status_history",
    )
    changed_by_user: Mapped[Optional["User"]] = relationship(
        "User",
    )
