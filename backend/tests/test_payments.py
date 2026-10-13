from decimal import Decimal
import hashlib
import hmac
import json
import secrets
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.catalog import ProductVariant
from backend.app.models.order import Order, Payment
from backend.tests.test_orders import get_test_slot_id, setup_customer_address


async def create_test_order(client: AsyncClient, headers: dict) -> dict:
    """Helper to place an order for payment tests."""
    address_id = await setup_customer_address(client, headers)
    slot_id = await get_test_slot_id(client)

    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 1},
    )

    resp = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"address_id": address_id, "slot_id": slot_id, "payment_method": "upi"},
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.asyncio
async def test_create_payment_intent_pending(client: AsyncClient, customer_auth):
    """POST /payments/intent creates a pending payment record."""
    headers, user = customer_auth
    order = await create_test_order(client, headers)
    idempotency_key = f"idem_key_{secrets.token_hex(16)}"

    resp = await client.post(
        "/api/v1/payments/intent",
        headers=headers,
        json={
            "order_id": order["id"],
            "provider": "mock",
            "idempotency_key": idempotency_key,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_id"] == order["id"]
    assert data["status"] == "pending"
    assert data["provider"] == "mock"
    assert Decimal(str(data["amount"])) == Decimal(str(order["total_amount"]))


@pytest.mark.asyncio
async def test_payment_intent_idempotency(client: AsyncClient, customer_auth):
    """Calling /payments/intent twice with identical idempotency_key returns identical record."""
    headers, user = customer_auth
    order = await create_test_order(client, headers)
    idempotency_key = f"idem_key_{secrets.token_hex(16)}"

    # First call
    resp1 = await client.post(
        "/api/v1/payments/intent",
        headers=headers,
        json={
            "order_id": order["id"],
            "provider": "mock",
            "idempotency_key": idempotency_key,
        },
    )
    assert resp1.status_code == 201
    data1 = resp1.json()

    # Second call with same idempotency_key
    resp2 = await client.post(
        "/api/v1/payments/intent",
        headers=headers,
        json={
            "order_id": order["id"],
            "provider": "mock",
            "idempotency_key": idempotency_key,
        },
    )
    assert resp2.status_code == 201
    data2 = resp2.json()

    assert data1["id"] == data2["id"]
    assert data1["order_id"] == data2["order_id"]


@pytest.mark.asyncio
async def test_webhook_signature_verification_success_and_failure(client: AsyncClient, customer_auth):
    """Webhook verifies HMAC-SHA256 signature; invalid signature returns 401, valid signature updates order and payment."""
    headers, user = customer_auth
    order = await create_test_order(client, headers)
    idempotency_key = f"idem_key_{secrets.token_hex(16)}"

    intent_resp = await client.post(
        "/api/v1/payments/intent",
        headers=headers,
        json={
            "order_id": order["id"],
            "provider": "mock",
            "idempotency_key": idempotency_key,
        },
    )
    payment_id = intent_resp.json()["id"]

    tx_id = f"tx_mock_{secrets.token_hex(8)}"
    payload_body = json.dumps({
        "event": "payment.captured",
        "payment_id": payment_id,
        "transaction_id": tx_id,
        "status": "captured",
    }).encode("utf-8")

    invalid_resp = await client.post(
        "/api/v1/payments/webhook",
        content=payload_body,
        headers={"Content-Type": "application/json", "X-Signature": "invalid-hmac-signature"},
    )
    assert invalid_resp.status_code == 401

    # 2. Test valid signature -> 200
    valid_sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload_body,
        hashlib.sha256,
    ).hexdigest()

    valid_resp = await client.post(
        "/api/v1/payments/webhook",
        content=payload_body,
        headers={"Content-Type": "application/json", "X-Signature": valid_sig},
    )
    assert valid_resp.status_code == 200
    assert valid_resp.json()["received"] is True

    # Verify payment and order statuses updated
    async with AsyncSessionLocal() as session:
        payment = (
            await session.execute(select(Payment).where(Payment.id == payment_id))
        ).scalar_one()
        assert payment.status == "captured"
        assert payment.transaction_id == tx_id

        updated_order = (
            await session.execute(select(Order).where(Order.id == order["id"]))
        ).scalar_one()
        assert updated_order.payment_status == "captured"
        assert updated_order.status == "confirmed"


@pytest.mark.asyncio
async def test_admin_refund_flow(client: AsyncClient, customer_auth, admin_auth):
    """Admin issues refund on payment; exceeding captured amount returns 400."""
    cust_headers, user = customer_auth
    admin_headers, admin = admin_auth
    order = await create_test_order(client, cust_headers)
    idempotency_key = f"idem_key_{secrets.token_hex(16)}"

    intent_resp = await client.post(
        "/api/v1/payments/intent",
        headers=cust_headers,
        json={
            "order_id": order["id"],
            "provider": "mock",
            "idempotency_key": idempotency_key,
        },
    )
    payment_id = intent_resp.json()["id"]

    # 1. Non-admin forbidden from refund -> 403
    cust_refund = await client.post(
        f"/api/v1/payments/{payment_id}/refund",
        headers=cust_headers,
        json={"refund_amount": 20.0, "refund_id": "ref_1", "reason": "Test refund"},
    )
    assert cust_refund.status_code == 403

    # 2. Admin partial refund
    admin_refund = await client.post(
        f"/api/v1/payments/{payment_id}/refund",
        headers=admin_headers,
        json={"refund_amount": 20.0, "refund_id": "ref_1", "reason": "Partial compensation"},
    )
    assert admin_refund.status_code == 200
    assert Decimal(str(admin_refund.json()["refunded_amount"])) == Decimal("20.00")

    # 3. Excessive refund exceeding total amount -> 400
    excessive_refund = await client.post(
        f"/api/v1/payments/{payment_id}/refund",
        headers=admin_headers,
        json={"refund_amount": 999999.0, "refund_id": "ref_excess", "reason": "Too much"},
    )
    assert excessive_refund.status_code == 400
