from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_admin, get_db
from backend.app.models.user import User
from backend.app.schemas.order import OrderRead, OrderStatusUpdate, PaginatedOrderRead
from backend.app.services.admin_service import AdminService
from backend.app.services.order_service import OrderService

router = APIRouter()


@router.get("", response_model=PaginatedOrderRead)
async def list_admin_orders(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by order status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Retrieve orders across all customers, ordered newest first.
    Includes address snapshots, line items, payments, and full lifecycle history.
    """
    items, total, has_next = await AdminService.list_all_orders(
        session=db,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )
    return PaginatedOrderRead(
        items=[OrderRead.model_validate(o) for o in items],
        total=total,
        page=page,
        page_size=page_size,
        has_next=has_next,
    )


@router.get("/{order_id}", response_model=OrderRead)
async def get_admin_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Retrieve complete order details without customer ownership restriction.
    """
    order = await AdminService.get_admin_order(session=db, order_id=order_id)
    return OrderRead.model_validate(order)


@router.patch("/{order_id}/status", response_model=OrderRead)
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: transition order status according to the authoritative status matrix.
    Releases inventory on cancellation, consumes inventory on delivery.
    """
    order = await OrderService.admin_update_status(
        session=db,
        order_id=order_id,
        new_status=payload.status,
        note=payload.note,
        admin_user_id=current_admin.id,
    )
    return OrderRead.model_validate(order)
