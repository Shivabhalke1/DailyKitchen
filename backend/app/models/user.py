from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.models.base import Base, TimestampMixin, generate_uuid

if TYPE_CHECKING:
    from backend.app.models.cart import Cart
    from backend.app.models.order import Order


class User(Base, TimestampMixin):
    """User account model supporting phone-first OTP authentication and role management."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    phone: Mapped[str] = mapped_column(
        String(15),
        unique=True,
        index=True,
        nullable=False,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    is_phone_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        default="customer",
        nullable=False,
    )
    customer_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('customer', 'admin', 'delivery_partner')",
            name="check_user_role",
        ),
        Index(
            "ix_users_email_lower",
            func.lower(email),
            unique=True,
            postgresql_where=text("email IS NOT NULL"),
            sqlite_where=text("email IS NOT NULL"),
        ),
    )

    # Relationships
    profile: Mapped[Optional["Profile"]] = relationship(
        "Profile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    addresses: Mapped[List["Address"]] = relationship(
        "Address",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    cart: Mapped[Optional["Cart"]] = relationship(
        "Cart",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    orders: Mapped[List["Order"]] = relationship(
        "Order",
        back_populates="user",
    )
    password_reset_tokens: Mapped[List["PasswordResetToken"]] = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Profile(Base, TimestampMixin):
    """User profile containing presentation and biographical data."""

    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )

    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="profile",
    )


class OtpChallenge(Base, TimestampMixin):
    """
    OTP challenge persistence tracking secure verification lifecycles.
    Stores keyed HMAC-SHA256 hashes (never plaintext), resend cooldowns,
    and single-use consumption state.
    """

    __tablename__ = "otp_challenges"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    phone: Mapped[str] = mapped_column(
        String(15),
        index=True,
        nullable=False,
    )
    otp_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    purpose: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    resend_available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    is_consumed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "purpose IN ('login', 'register', 'verify_phone')",
            name="check_otp_purpose",
        ),
        CheckConstraint(
            "attempts >= 0 AND attempts <= 3",
            name="check_otp_attempts_range",
        ),
        Index(
            "ix_otp_phone_consumed_expires",
            "phone",
            "is_consumed",
            "expires_at",
        ),
    )


class Address(Base, TimestampMixin):
    """
    Customer address book records.
    Historical orders do not bind mutably to this table; they store
    immutable deep copies in order_addresses.
    """

    __tablename__ = "addresses"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
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
        index=True,
        nullable=False,
    )
    label: Mapped[str] = mapped_column(
        String(20),
        default="home",
        nullable=False,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "length(pincode) = 6",
            name="check_address_pincode_length",
        ),
        CheckConstraint(
            "label IN ('home', 'work', 'other')",
            name="check_address_label",
        ),
        Index(
            "uq_user_default_address",
            "user_id",
            unique=True,
            postgresql_where=text("is_default = true"),
            sqlite_where=text("is_default = 1"),
        ),
    )

    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="addresses",
    )


class PasswordResetToken(Base, TimestampMixin):
    """
    Password reset token model tracking single-use lifecycle and SHA-256 token hashes.
    Plaintext tokens are never stored.
    """

    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    is_used: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_password_reset_tokens_user_used_exp", "user_id", "is_used", "expires_at"),
    )

    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="password_reset_tokens",
    )

