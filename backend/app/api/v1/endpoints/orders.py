from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.user import User
from backend.app.schemas.order import (
    OrderCancelRequest,
    OrderCreate,
    OrderRead,
    PaginatedOrderRead,
)
from backend.app.services.order_service import OrderService

router = APIRouter()


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def checkout_order(
    payload: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Execute 11-step transactional checkout pipeline:
    validates address, capacity, cart, stock, takes snapshots, reserves inventory,
    books delivery slot atomically, deactivates cart, and creates order.
    """
    order = await OrderService.place_order(
        session=db,
        user=current_user,
        payload=payload,
    )
    return OrderRead.model_validate(order)


@router.get("", response_model=PaginatedOrderRead)
async def list_orders(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by order status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve customer's historical orders, ordered newest first."""
    items, total, has_next = await OrderService.list_orders(
        session=db,
        user_id=current_user.id,
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
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single order by ID with address snapshot, items, and payment history."""
    order = await OrderService.get_order(
        session=db,
        user_id=current_user.id,
        order_id=order_id,
    )
    return OrderRead.model_validate(order)


@router.post("/{order_id}/cancel", response_model=OrderRead)
async def cancel_order(
    order_id: str,
    payload: OrderCancelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an active order (pending or confirmed). Releases inventory holds and slot capacity."""
    order = await OrderService.cancel_order(
        session=db,
        user_id=current_user.id,
        order_id=order_id,
        reason=payload.reason,
    )
    return OrderRead.model_validate(order)
