from datetime import date, time
from typing import TYPE_CHECKING, List
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from backend.app.models.order import Order


class DeliveryZone(Base, TimestampMixin):
    """Geographic service zone defined by 6-digit Indian PIN code."""

    __tablename__ = "delivery_zones"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    pincode: Mapped[str] = mapped_column(
        String(6),
        unique=True,
        index=True,
        nullable=False,
    )
    is_express_available: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "length(pincode) = 6",
            name="check_delivery_zone_pincode_length",
        ),
    )

    # Relationships
    slots: Mapped[List["DeliverySlot"]] = relationship(
        "DeliverySlot",
        back_populates="zone",
        cascade="all, delete-orphan",
    )


class DeliverySlot(Base, TimestampMixin):
    """
    Structured delivery time window with capacity control.
    Supports atomic reservations preventing overbooking.
    """

    __tablename__ = "delivery_slots"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    zone_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("delivery_zones.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    slot_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    slot_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    start_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )
    end_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        default="Asia/Kolkata",
        nullable=False,
    )
    max_orders: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
    )
    current_orders: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "slot_type IN ('instant_express', 'scheduled')",
            name="check_slot_type",
        ),
        CheckConstraint(
            "max_orders > 0",
            name="check_slot_max_orders_positive",
        ),
        CheckConstraint(
            "current_orders >= 0",
            name="check_slot_current_orders_nonnegative",
        ),
        CheckConstraint(
            "current_orders <= max_orders",
            name="check_slot_current_orders_lte_max",
        ),
        UniqueConstraint(
            "zone_id",
            "slot_date",
            "slot_type",
            "start_time",
            "end_time",
            name="uq_delivery_slot_schedule",
        ),
    )

    # Relationships
    zone: Mapped["DeliveryZone"] = relationship(
        "DeliveryZone",
        back_populates="slots",
    )
    orders: Mapped[List["Order"]] = relationship(
        "Order",
        back_populates="slot",
    )
