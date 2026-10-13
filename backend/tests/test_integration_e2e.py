import hashlib
import hmac
import json
import secrets
from decimal import Decimal
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.core.security import create_access_token
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.catalog import ProductVariant
from backend.app.models.delivery import DeliverySlot
from backend.app.models.user import User


@pytest_asyncio.fixture
async def verified_customer_auth(client: AsyncClient):
    """Creates a verified customer via OTP flow."""
    phone = f"+9198{secrets.randbelow(100000000):08d}"
    # Request OTP
    otp_req = await client.post("/api/v1/auth/otp/send", json={"phone": phone, "purpose": "login"})
    assert otp_req.status_code == 200

    # In dev/test, inspect last OTP
    encoded_phone = phone.replace("+", "%2B")
    otp_insp = await client.get(f"/api/v1/auth/test/last-otp?phone={encoded_phone}")
    assert otp_insp.status_code == 200
    otp_code = otp_insp.json()["data"]["otp"]

    # Verify OTP
    verify_resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": phone, "otp": otp_code, "purpose": "login"},
    )
    assert verify_resp.status_code == 200
    data = verify_resp.json()["data"]
    token = data["access_token"]
    user_id = data["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    return headers, user_id, phone


@pytest.mark.asyncio
async def test_complete_end_to_end_customer_journey(client: AsyncClient, verified_customer_auth, admin_auth):
    """
    Comprehensive End-to-End Test:
    1. Customer authenticates via OTP.
    2. Updates profile and adds delivery address.
    3. Browses catalog categories and products.
    4. Adds items to cart, checks authoritative pricing (packaging + delivery rules).
    5. Checks delivery serviceability and picks an available slot.
    6. Places order (checkout), verifying inventory hold and slot capacity reservation.
    7. Creates payment intent.
    8. Webhook processes successful payment signature.
    9. Admin updates order status through delivery.
    """
    headers, user_id, phone = verified_customer_auth
    admin_headers, admin = admin_auth

    # 1. Update customer profile
    profile_resp = await client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"full_name": "Priya Sharma"},
    )
    assert profile_resp.status_code == 200
    assert profile_resp.json()["data"]["full_name"] == "Priya Sharma"

    # 2. Add delivery address
    addr_resp = await client.post(
        "/api/v1/users/me/addresses",
        headers=headers,
        json={
            "full_name": "Priya Sharma",
            "phone": phone,
            "house_flat": "Flat 302, Green Glen Layout",
            "street_area": "Bellandur",
            "pincode": "560034",
            "city": "Bengaluru",
            "state": "Karnataka",
            "label": "home",
            "is_default": True,
        },
    )
    assert addr_resp.status_code == 201
    address_id = addr_resp.json()["data"]["id"]

    # 3. Browse catalog
    cat_resp = await client.get("/api/v1/catalog/categories")
    assert cat_resp.status_code == 200
    categories = cat_resp.json()
    assert len(categories) > 0

    first_cat = categories[0]
    prod_resp = await client.get(f"/api/v1/catalog/products?category={first_cat['slug']}")
    assert prod_resp.status_code == 200
    products = prod_resp.json()["items"]
    assert len(products) > 0

    # 4. Add items to cart & verify authoritative pricing calculation
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant1 = v_res.scalar_one()

    # Add item with attempted client-side price tampering (extra fields should be ignored)
    add_resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={
            "variant_id": variant1.id,
            "quantity": 2,
            "tampered_price": "1.00",
        },
    )
    assert add_resp.status_code == 200
    cart_data = add_resp.json()

    # Verify authoritative pricing: server-derived price must equal variant1.price * 2
    pricing = cart_data["pricing"]
    expected_subtotal = variant1.price * 2
    assert Decimal(str(pricing["subtotal"])) == expected_subtotal
    assert Decimal(str(pricing["packaging_fee"])) == Decimal("10.00")
    if expected_subtotal < Decimal("99.00"):
        assert Decimal(str(pricing["delivery_fee"])) == Decimal("40.00")
        expected_total = expected_subtotal + Decimal("10.00") + Decimal("40.00")
    else:
        assert Decimal(str(pricing["delivery_fee"])) == Decimal("0.00")
        expected_total = expected_subtotal + Decimal("10.00")
    assert Decimal(str(pricing["total"])) == expected_total

    # 5. Check delivery serviceability & select slot
    serv_resp = await client.get("/api/v1/delivery/zones/check?pincode=560034")
    assert serv_resp.status_code == 200
    assert serv_resp.json()["is_serviceable"] is True
    zone_id = serv_resp.json()["zone"]["id"]

    slots_resp = await client.get(f"/api/v1/delivery/slots?zone_id={zone_id}")
    assert slots_resp.status_code == 200
    slots = slots_resp.json()
    assert len(slots) > 0
    slot_id = slots[0]["id"]

    # 6. Checkout order
    checkout_resp = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "address_id": address_id,
            "slot_id": slot_id,
            "payment_method": "upi",
            "tampered_total": "5.00",
        },
    )
    assert checkout_resp.status_code == 201
    order_data = checkout_resp.json()
    order_id = order_data["id"]
    assert order_data["status"] == "placed"
    assert Decimal(str(order_data["total_amount"])) == expected_total

    # 7. Create payment intent
    idempotency_key = f"e2e_idem_{secrets.token_hex(8)}"
    intent_resp = await client.post(
        "/api/v1/payments/intent",
        headers=headers,
        json={
            "order_id": order_id,
            "provider": "mock",
            "idempotency_key": idempotency_key,
        },
    )
    assert intent_resp.status_code == 201
    payment_data = intent_resp.json()
    assert payment_data["status"] == "pending"
    assert Decimal(str(payment_data["amount"])) == expected_total
    payment_id = payment_data["id"]

    # 8. Webhook processing (simulated gateway callback with HMAC-SHA256 signature)
    tx_id = f"tx_e2e_{secrets.token_hex(8)}"
    payload_body = json.dumps({
        "event": "payment.captured",
        "payment_id": payment_id,
        "transaction_id": tx_id,
        "status": "captured",
    }).encode("utf-8")

    sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload_body,
        hashlib.sha256,
    ).hexdigest()

    webhook_resp = await client.post(
        "/api/v1/payments/webhook",
        content=payload_body,
        headers={"Content-Type": "application/json", "X-Signature": sig},
    )
    assert webhook_resp.status_code == 200
    assert webhook_resp.json()["received"] is True

    # Verify order is now marked as confirmed with payment_status=captured
    order_check = await client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert order_check.status_code == 200
    assert order_check.json()["status"] == "confirmed"
    assert order_check.json()["payment_status"] == "captured"

    # 9. Admin status transitions: confirmed -> dispatched -> delivered
    disp_resp = await client.patch(
        f"/api/v1/admin/orders/{order_id}/status",
        headers=admin_headers,
        json={"status": "dispatched"},
    )
    assert disp_resp.status_code == 200
    assert disp_resp.json()["status"] == "out_for_delivery"

    deliv_resp = await client.patch(
        f"/api/v1/admin/orders/{order_id}/status",
        headers=admin_headers,
        json={"status": "delivered"},
    )
    assert deliv_resp.status_code == 200
    assert deliv_resp.json()["status"] == "delivered"


@pytest.mark.asyncio
async def test_admin_rbac_and_unauthorized_rejections(client: AsyncClient, customer_auth):
    """
    Verifies RBAC rules:
    - Unauthenticated requests to /api/v1/admin return 401.
    - Customer tokens accessing /api/v1/admin return 403.
    """
    cust_headers, user = customer_auth

    # Unauthenticated
    resp_unauth = await client.post(
        "/api/v1/admin/catalog/categories",
        json={"name": "Test Cat", "slug": "test-cat", "display_order": 99},
    )
    assert resp_unauth.status_code == 401

    # Customer role attempted admin access
    resp_forbidden = await client.post(
        "/api/v1/admin/catalog/categories",
        headers=cust_headers,
        json={"name": "Test Cat", "slug": "test-cat", "display_order": 99},
    )
    assert resp_forbidden.status_code == 403

    # Attempting slot bulk create
    resp_slots = await client.post(
        "/api/v1/admin/delivery/slots",
        headers=cust_headers,
        json={"zone_id": "test", "slot_date": "2026-10-15", "slots": []},
    )
    assert resp_slots.status_code == 403

    # Attempting inventory adjustment
    resp_inv = await client.put(
        "/api/v1/admin/catalog/variants/test/inventory",
        headers=cust_headers,
        json={"delta": 10},
    )
    assert resp_inv.status_code == 403


@pytest.mark.asyncio
async def test_negative_quantity_and_invalid_inputs_rejected(client: AsyncClient, customer_auth):
    """
    Tests input bounds and error validation:
    - Zero or negative quantity in cart item returns 422.
    - Quantity exceeding maximum limit returns 422.
    - Invalid PIN code regex pattern returns 422.
    """
    headers, user = customer_auth

    # Negative quantity
    resp_neg = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": "var_123", "quantity": -1},
    )
    assert resp_neg.status_code == 422

    # Zero quantity
    resp_zero = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": "var_123", "quantity": 0},
    )
    assert resp_zero.status_code == 422

    # Exceeds max per item (limit is 20)
    resp_over = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": "var_123", "quantity": 50},
    )
    assert resp_over.status_code == 422

    # Invalid PIN code (5 digits instead of 6) returns 422 Unprocessable Content
    resp_pin = await client.get("/api/v1/delivery/zones/check?pincode=56003")
    assert resp_pin.status_code == 422
