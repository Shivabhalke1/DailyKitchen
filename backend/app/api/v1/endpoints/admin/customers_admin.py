from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_active_admin, get_db
from backend.app.schemas.admin import (
    AdminCustomerDetail,
    AdminCustomerListResponse,
    AdminCustomerDeleteResponse,
)
from backend.app.schemas.common import ApiResponse
from backend.app.services.admin_service import AdminService

router = APIRouter()


@router.get(
    "",
    response_model=ApiResponse[AdminCustomerListResponse],
    status_code=status.HTTP_200_OK,
    summary="Admin: List customer directory with lifetime stats",
)
async def list_customers(
    q: Optional[str] = Query(None, description="Search query matching customer_code, phone, email, or full name"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_active_admin),
):
    """
    Retrieves searchable, paginated customer accounts for backoffice directory.
    Includes permanent Customer ID (DKC-XXXXXXXX), order counts, and lifetime spend.
    """
    items, total = await AdminService.list_customers(
        session=db,
        search=q,
        page=page,
        page_size=limit,
    )
    return ApiResponse(
        success=True,
        data=AdminCustomerListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
        ),
    )


@router.get(
    "/{customer_id}",
    response_model=ApiResponse[AdminCustomerDetail],
    status_code=status.HTTP_200_OK,
    summary="Admin: Get customer profile and historical order details",
)
async def get_customer_detail(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_active_admin),
):
    """
    Retrieves deep customer details including lifetime spend, delivery addresses,
    and immutable snapshot-based order history.
    """
    data = await AdminService.get_customer_detail(
        session=db,
        customer_id=customer_id,
    )
    return ApiResponse(
        success=True,
        data=AdminCustomerDetail(**data),
    )


@router.delete(
    "/{customer_id}",
    response_model=ApiResponse[AdminCustomerDeleteResponse],
    status_code=status.HTTP_200_OK,
    summary="Admin: Delete or deactivate customer account",
)
async def delete_customer(
    customer_id: str,
    hard_delete: bool = Query(False, description="Whether to permanently purge customer and all order data"),
    db: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_active_admin),
):
    """
    Deletes or deactivates a customer account.
    - If customer has historical orders and hard_delete is False, deactivates account and revokes sessions to preserve legal financial compliance.
    - If customer has no orders, or if hard_delete is True, permanently purges the user from the database.
    """
    action, message = await AdminService.delete_customer(
        session=db,
        customer_id=customer_id,
        hard_delete=hard_delete,
    )
    return ApiResponse(
        success=True,
        data=AdminCustomerDeleteResponse(
            success=True,
            customer_id=customer_id,
            action=action,
            message=message,
        ),
    )
