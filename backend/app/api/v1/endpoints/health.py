from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any

from backend.app.core.config import settings
from backend.app.db.session import get_db

router = APIRouter()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Automated liveness and readiness health check for DailyKitchen API.
    Verifies database connectivity and returns service status.
    """
    db_status = "unhealthy"
    try:
        result = await db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    is_overall_healthy = db_status == "healthy"

    return {
        "status": "healthy" if is_overall_healthy else "degraded",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "rules": {
            "free_delivery_threshold": settings.FREE_DELIVERY_THRESHOLD,
            "standard_delivery_fee": settings.STANDARD_DELIVERY_FEE,
            "packaging_fee": settings.PACKAGING_FEE,
            "rule": "subtotal >= 99 qualifies for free delivery",
        },
    }
