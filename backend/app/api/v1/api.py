from fastapi import APIRouter
from backend.app.api.v1.endpoints import (
    auth,
    cart,
    catalog,
    delivery,
    health,
    orders,
    payments,
    users,
)
from backend.app.api.v1.endpoints.admin import admin_router

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health & System"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Session"])
api_router.include_router(users.router, prefix="/users", tags=["Customer & Address Book"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["Catalog & Produce"])
api_router.include_router(cart.router, prefix="/cart", tags=["Shopping Cart"])
api_router.include_router(delivery.router, prefix="/delivery", tags=["Delivery & Logistics"])
api_router.include_router(orders.router, prefix="/orders", tags=["Order Lifecycle"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments & Refunds"])
api_router.include_router(admin_router, prefix="/admin", tags=["Backoffice Admin"])
