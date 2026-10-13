from decimal import Decimal
import hashlib
import hmac
import json
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.models.order import Order, Payment, OrderStatusHistory
from backend.app.schemas.order import PaymentIntentCreate, RefundRequest


class PaymentService:
    @staticmethod
    def verify_webhook_signature(raw_body: bytes, signature: Optional[str]) -> bool:
        """Verify HMAC-SHA256 signature against raw payload bytes."""
        if not signature:
            return False
        # Strip potential prefixes like "sha256="
        clean_sig = signature.replace("sha256=", "").strip()
        expected = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, clean_sig)

    @classmethod
    async def create_payment_intent(
        cls,
        session: AsyncSession,
        user_id: str,
        payload: PaymentIntentCreate,
    ) -> Payment:
        """Idempotent payment creation."""
        # 1. Idempotency check: look up existing payment with this idempotency key
        stmt = select(Payment).where(Payment.idempotency_key == payload.idempotency_key)
        res = await session.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing

        # 2. Check Order existence and ownership
        order_stmt = select(Order).where(Order.id == payload.order_id)
        order_res = await session.execute(order_stmt)
        order = order_res.scalar_one_or_none()
        if not order or order.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{payload.order_id}' not found",
            )

        # 3. Create payment record
        payment = Payment(
            order_id=order.id,
            idempotency_key=payload.idempotency_key,
            provider=payload.provider,
            amount=order.total_amount,
            currency="INR",
            status="pending",
        )
        session.add(payment)
        await session.commit()
        await session.refresh(payment)
        return payment

    @classmethod
    async def process_webhook(
        cls,
        session: AsyncSession,
        raw_body: bytes,
        signature: Optional[str],
    ) -> dict:
        """Process gateway webhook with strict signature validation."""
        if not cls.verify_webhook_signature(raw_body, signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

        try:
            data = json.loads(raw_body.decode("utf-8"))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed webhook JSON payload",
            )

        # Extract identifiers
        payment_id = data.get("payment_id")
        idempotency_key = data.get("idempotency_key")
        transaction_id = data.get("transaction_id", f"txn_{idempotency_key or 'mock'}")
        event_status = data.get("status", "captured")  # 'captured', 'failed', etc.

        payment = None
        if payment_id:
            payment = (
                await session.execute(select(Payment).where(Payment.id == payment_id))
            ).scalar_one_or_none()
        elif idempotency_key:
            payment = (
                await session.execute(
                    select(Payment).where(Payment.idempotency_key == idempotency_key)
                )
            ).scalar_one_or_none()

        if payment:
            payment.status = event_status
            payment.transaction_id = transaction_id
            payment.gateway_payload = raw_body.decode("utf-8", errors="ignore")

            # Update corresponding order status
            order = (
                await session.execute(select(Order).where(Order.id == payment.order_id))
            ).scalar_one_or_none()
            if order:
                order.payment_status = event_status
                if event_status == "captured" and order.status in ("placed", "pending"):
                    prev = order.status
                    order.status = "confirmed"
                    history = OrderStatusHistory(
                        order_id=order.id,
                        from_status=prev,
                        to_status="confirmed",
                        comment="Payment captured via webhook",
                    )
                    session.add(history)

            await session.commit()

        return {"received": True}

    @classmethod
    async def process_refund(
        cls,
        session: AsyncSession,
        payment_id: str,
        payload: RefundRequest,
    ) -> Payment:
        """Process admin-initiated refund against a payment record."""
        stmt = select(Payment).where(Payment.id == payment_id)
        res = await session.execute(stmt)
        payment = res.scalar_one_or_none()
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payment record '{payment_id}' not found",
            )

        new_refunded_total = payment.refunded_amount + payload.refund_amount
        if new_refunded_total > payment.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Refund amount exceeds remaining captured payment amount. Max allowed: {payment.amount - payment.refunded_amount}",
            )

        payment.refund_id = payload.refund_id
        payment.refunded_amount = new_refunded_total
        if payment.refunded_amount == payment.amount:
            payment.status = "refunded"

        await session.commit()
        await session.refresh(payment)
        return payment
