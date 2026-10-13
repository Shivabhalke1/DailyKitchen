from typing import Optional
from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import (
    get_current_active_admin,
    get_current_user,
    get_db,
)
from backend.app.models.user import User
from backend.app.schemas.order import PaymentIntentCreate, PaymentRead, RefundRequest
from backend.app.services.payment_service import PaymentService

router = APIRouter()


@router.post("/intent", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
async def create_payment_intent(
    payload: PaymentIntentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create or retrieve an idempotent payment intent for an order.
    Calling with the same idempotency key returns the existing payment record.
    """
    payment = await PaymentService.create_payment_intent(
        session=db,
        user_id=current_user.id,
        payload=payload,
    )
    return PaymentRead.model_validate(payment)


@router.post("/webhook", response_model=dict)
async def payment_webhook(
    request: Request,
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Handle payment gateway callback.
    Enforces HMAC-SHA256 signature verification over raw body bytes.
    """
    signature = x_signature or x_webhook_signature
    raw_body = await request.body()
    return await PaymentService.process_webhook(
        session=db,
        raw_body=raw_body,
        signature=signature,
    )


@router.post("/{payment_id}/refund", response_model=PaymentRead)
async def process_refund(
    payment_id: str,
    payload: RefundRequest,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only endpoint to issue a refund against a payment transaction.
    """
    payment = await PaymentService.process_refund(
        session=db,
        payment_id=payment_id,
        payload=payload,
    )
    return PaymentRead.model_validate(payment)
