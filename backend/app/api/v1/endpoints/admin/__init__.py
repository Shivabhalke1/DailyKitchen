from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_admin, get_db
from backend.app.api.v1.endpoints.admin.catalog_admin import router as catalog_admin_router
from backend.app.api.v1.endpoints.admin.customers_admin import router as customers_admin_router
from backend.app.api.v1.endpoints.admin.dashboard_admin import router as dashboard_admin_router
from backend.app.api.v1.endpoints.admin.delivery_admin import router as delivery_admin_router
from backend.app.api.v1.endpoints.admin.orders_admin import router as orders_admin_router
from backend.app.core.config import settings
from backend.app.db.seed import seed_database
from backend.app.models.user import User

admin_router = APIRouter(
    dependencies=[Depends(get_current_active_admin)],
)

admin_router.include_router(
    dashboard_admin_router,
    prefix="/dashboard",
    tags=["Admin - Dashboard"],
)
admin_router.include_router(
    catalog_admin_router,
    prefix="/catalog",
    tags=["Admin - Catalog"],
)
admin_router.include_router(
    customers_admin_router,
    prefix="/customers",
    tags=["Admin - Customers"],
)
admin_router.include_router(
    delivery_admin_router,
    prefix="/delivery",
    tags=["Admin - Delivery"],
)
admin_router.include_router(
    orders_admin_router,
    prefix="/orders",
    tags=["Admin - Orders"],
)


@admin_router.post("/seed", response_model=dict)
async def seed_data(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Seed catalog categories, produce, variants, and delivery slots.
    Strictly forbidden (403) in staging or production.
    """
    if settings.ENVIRONMENT not in ("development", "test"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seeding is only allowed in development or test environment",
        )

    await seed_database(db)
    return {"message": "Database seeded successfully"}
