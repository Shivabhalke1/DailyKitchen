from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_db
from backend.app.schemas.admin import DashboardMetricsRead
from backend.app.services.admin_service import AdminService

router = APIRouter()


@router.get("/metrics", response_model=DashboardMetricsRead)
async def get_dashboard_metrics(
    target_date: Optional[date] = Query(None, alias="date", description="Target reporting date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Fetch authoritative executive operations metrics.
    Includes orders today, status breakdown, revenue excluding cancellations,
    inventory alerts, and delivery slot saturation.
    """
    return await AdminService.get_dashboard_metrics(session=db, target_date=target_date)
