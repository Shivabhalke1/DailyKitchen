from backend.app.models.base import Base, TimestampMixin, generate_uuid
from backend.app.models.user import User, Profile, Address, OtpChallenge, PasswordResetToken
from backend.app.models.session import UserSession
from backend.app.models.catalog import (
    Category,
    Product,
    ProductVariant,
    Inventory,
    InventoryReservation,
    UploadedImage,
)
from backend.app.models.cart import Cart, CartItem
from backend.app.models.delivery import DeliveryZone, DeliverySlot
from backend.app.models.order import (
    Order,
    OrderAddress,
    OrderItem,
    Payment,
    OrderStatusHistory,
)

__all__ = [
    # Base utilities
    "Base",
    "TimestampMixin",
    "generate_uuid",
    # 1. Identity & Auth (6 models)
    "User",
    "Profile",
    "Address",
    "OtpChallenge",
    "UserSession",
    "PasswordResetToken",
    # 2. Catalog & Inventory (6 models)
    "Category",
    "Product",
    "ProductVariant",
    "Inventory",
    "InventoryReservation",
    "UploadedImage",
    # 3. Shopping Cart (2 models)
    "Cart",
    "CartItem",
    # 4. Delivery & Logistics (2 models)
    "DeliveryZone",
    "DeliverySlot",
    # 5. Orders, Payments & Audits (5 models)
    "Order",
    "OrderAddress",
    "OrderItem",
    "Payment",
    "OrderStatusHistory",
]
