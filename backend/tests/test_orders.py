from datetime import date
from decimal import Decimal
import secrets
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from backend.app.core.security import create_access_token
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.catalog import Inventory, InventoryReservation, ProductVariant
from backend.app.models.delivery import DeliverySlot
from backend.app.models.order import Order
from backend.app.models.cart import Cart
from backend.app.models.user import Address, User


async def setup_customer_address(client: AsyncClient, headers: dict) -> str:
    """Helper to create a saved delivery address for test customer."""
    addr_payload = {
        "full_name": "Sita Sharma",
        "phone": "+919876543210",
        "house_flat": "Flat 302, Green Meadows",
        "street_area": "12th Main, 4th Block, Koramangala",
        "landmark": "Near BDA Complex",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560034",
        "address_type": "home",
        "is_default": True,
    }
    resp = await client.post("/api/v1/users/me/addresses", headers=headers, json=addr_payload)
    assert resp.status_code == 201
    return resp.json()["data"]["id"]


async def get_test_slot_id(client: AsyncClient) -> str:
    """Helper to get an available delivery slot ID."""
    today_str = date.today().isoformat()
    resp = await client.get(f"/api/v1/delivery/slots?date={today_str}")
    assert resp.status_code == 200
    slots = resp.json()
    assert len(slots) >= 1
    return slots[0]["id"]


@pytest.mark.asyncio
async def test_happy_path_checkout(client: AsyncClient, customer_auth):
    """Happy-path checkout creates OrderRead with correct totals, address snapshot, and line item snapshot."""
    headers, user = customer_auth
    address_id = await setup_customer_address(client, headers)
    slot_id = await get_test_slot_id(client)

    # Add item to cart
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 2},
    )

    # Checkout
    order_payload = {
        "address_id": address_id,
        "slot_id": slot_id,
        "payment_method": "upi",
        "notes": "Ring doorbell twice",
    }
    resp = await client.post("/api/v1/orders", headers=headers, json=order_payload)
    assert resp.status_code == 201
    order = resp.json()

    assert order["status"] in ("placed", "pending")
    assert order["payment_status"] == "pending"
    assert order["order_number"].startswith("DK-")
    assert order["user_id"] == user.id
    assert order["slot_id"] == slot_id

    # Check snapshots
    assert order["address_snapshot"] is not None
    assert order["address_snapshot"]["pincode"] == "560034"
    assert order["address_snapshot"]["house_flat"] == "Flat 302, Green Meadows"

    assert len(order["items"]) == 1
    assert order["items"][0]["variant_id"] == variant.id
    assert order["items"][0]["quantity"] == 2
    assert Decimal(str(order["items"][0]["unit_price"])) == Decimal(str(variant.price))

    # Verify totals check constraint (total = subtotal + packaging + delivery)
    subtotal = Decimal(str(order["subtotal"]))
    packaging = Decimal(str(order["packaging_fee"]))
    delivery = Decimal(str(order["delivery_fee"]))
    total = Decimal(str(order["total_amount"]))
    assert total == subtotal + packaging + delivery


@pytest.mark.asyncio
async def test_checkout_with_empty_cart_returns_400(client: AsyncClient, customer_auth):
    """Checkout with an empty shopping cart returns 400 Bad Request."""
    headers, user = customer_auth
    address_id = await setup_customer_address(client, headers)
    slot_id = await get_test_slot_id(client)

    # Empty cart
    await client.delete("/api/v1/cart", headers=headers)

    resp = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"address_id": address_id, "slot_id": slot_id, "payment_method": "cod"},
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_checkout_with_out_of_stock_returns_422(client: AsyncClient, customer_auth):
    """Checkout when variant inventory is insufficient returns 422 Unprocessable Content."""
    headers, user = customer_auth
    address_id = await setup_customer_address(client, headers)
    slot_id = await get_test_slot_id(client)

    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    # Add item
    await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 1},
    )

    # Deplete inventory behind the scenes
    async with AsyncSessionLocal() as session:
        inv = (
            await session.execute(
                select(Inventory).where(Inventory.variant_id == variant.id)
            )
        ).scalar_one()
        orig_stock = inv.stock_quantity
        inv.stock_quantity = inv.reserved_quantity
        await session.commit()

    try:
        resp = await client.post(
            "/api/v1/orders",
            headers=headers,
            json={"address_id": address_id, "slot_id": slot_id, "payment_method": "upi"},
        )
        assert resp.status_code == 422
        assert "insufficient stock" in resp.json()["detail"].lower()
    finally:
        # Restore stock
        async with AsyncSessionLocal() as session:
            inv = (
                await session.execute(
                    select(Inventory).where(Inventory.variant_id == variant.id)
                )
            ).scalar_one()
            inv.stock_quantity = orig_stock
            await session.commit()


@pytest.mark.asyncio
async def test_checkout_with_fully_booked_slot_returns_409(client: AsyncClient, customer_auth):
    """Checkout against a fully booked delivery slot returns 409 Conflict."""
    headers, user = customer_auth
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

    # Max out slot current_orders
    async with AsyncSessionLocal() as session:
        slot = (
            await session.execute(
                select(DeliverySlot).where(DeliverySlot.id == slot_id)
            )
        ).scalar_one()
        orig_current = slot.current_orders
        slot.current_orders = slot.max_orders
        await session.commit()

    try:
        resp = await client.post(
            "/api/v1/orders",
            headers=headers,
            json={"address_id": address_id, "slot_id": slot_id, "payment_method": "upi"},
        )
        assert resp.status_code == 409
    finally:
        async with AsyncSessionLocal() as session:
            slot = (
                await session.execute(
                    select(DeliverySlot).where(DeliverySlot.id == slot_id)
                )
            ).scalar_one()
            slot.current_orders = orig_current
            await session.commit()


@pytest.mark.asyncio
async def test_checkout_increments_inventory_reservation(client: AsyncClient, customer_auth):
    """After checkout, inventory.reserved_quantity increments by purchased item quantity."""
    headers, user = customer_auth
    address_id = await setup_customer_address(client, headers)
    slot_id = await get_test_slot_id(client)

    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()
        inv_before = (
            await session.execute(
                select(Inventory).where(Inventory.variant_id == variant.id)
            )
        ).scalar_one()
        reserved_before = inv_before.reserved_quantity

    await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 3},
    )

    resp = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"address_id": address_id, "slot_id": slot_id, "payment_method": "card"},
    )
    assert resp.status_code == 201

    async with AsyncSessionLocal() as session:
        inv_after = (
            await session.execute(
                select(Inventory).where(Inventory.variant_id == variant.id)
            )
        ).scalar_one()
        assert inv_after.reserved_quantity == reserved_before + 3


@pytest.mark.asyncio
async def test_cancel_pending_order_releases_inventory(client: AsyncClient, customer_auth):
    """Cancelling a pending order releases the inventory reservation and decrements reserved_quantity."""
    headers, user = customer_auth
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
        json={"variant_id": variant.id, "quantity": 2},
    )
    order_resp = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"address_id": address_id, "slot_id": slot_id, "payment_method": "upi"},
    )
    order_id = order_resp.json()["id"]

    # Cancel order
    cancel_resp = await client.post(
        f"/api/v1/orders/{order_id}/cancel",
        headers=headers,
        json={"reason": "Customer changed mind"},
    )
    assert cancel_resp.status_code == 200
    cancelled_order = cancel_resp.json()
    assert cancelled_order["status"] == "cancelled"

    # Verify reservations released
    async with AsyncSessionLocal() as session:
        res_list = list(
            (
                await session.execute(
                    select(InventoryReservation).where(
                        InventoryReservation.order_id == order_id
                    )
                )
            ).scalars().all()
        )
        assert len(res_list) >= 1
        for r in res_list:
            assert r.status == "released"


@pytest.mark.asyncio
async def test_cancel_dispatched_order_returns_409(client: AsyncClient, customer_auth):
    """Customer attempting to cancel a dispatched or delivered order returns 409 Conflict."""
    headers, user = customer_auth
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
    order_resp = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"address_id": address_id, "slot_id": slot_id, "payment_method": "upi"},
    )
    order_id = order_resp.json()["id"]

    # Manually transition order to dispatched
    async with AsyncSessionLocal() as session:
        order = (
            await session.execute(select(Order).where(Order.id == order_id))
        ).scalar_one()
        order.status = "out_for_delivery"
        await session.commit()

    resp = await client.post(
        f"/api/v1/orders/{order_id}/cancel",
        headers=headers,
        json={"reason": "Too late to cancel"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_orders_ownership_isolation(client: AsyncClient, customer_auth):
    """Listing orders returns only the current authenticated customer's orders."""
    headers1, user1 = customer_auth
    address_id1 = await setup_customer_address(client, headers1)
    slot_id = await get_test_slot_id(client)

    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    await client.post(
        "/api/v1/cart/items",
        headers=headers1,
        json={"variant_id": variant.id, "quantity": 1},
    )
    await client.post(
        "/api/v1/orders",
        headers=headers1,
        json={"address_id": address_id1, "slot_id": slot_id, "payment_method": "upi"},
    )

    # User 2
    phone2 = f"+919{secrets.randbelow(900000000):09d}"
    async with AsyncSessionLocal() as session:
        user2 = User(phone=phone2, role="customer", is_active=True, is_phone_verified=True)
        session.add(user2)
        await session.flush()
        cart2 = Cart(user_id=user2.id, is_active=True)
        session.add(cart2)
        await session.commit()
    token2 = create_access_token(user_id=user2.id, phone=user2.phone, role="customer")
    headers2 = {"Authorization": f"Bearer {token2}"}

    resp1 = await client.get("/api/v1/orders", headers=headers1)
    assert resp1.status_code == 200
    assert resp1.json()["total"] >= 1

    resp2 = await client.get("/api/v1/orders", headers=headers2)
    assert resp2.status_code == 200
    assert resp2.json()["total"] == 0


@pytest.mark.asyncio
async def test_fetch_another_user_order_returns_404(client: AsyncClient, customer_auth):
    """Fetching an order that belongs to another customer returns 404 (not 403)."""
    headers1, user1 = customer_auth
    address_id1 = await setup_customer_address(client, headers1)
    slot_id = await get_test_slot_id(client)

    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    await client.post(
        "/api/v1/cart/items",
        headers=headers1,
        json={"variant_id": variant.id, "quantity": 1},
    )
    order_resp = await client.post(
        "/api/v1/orders",
        headers=headers1,
        json={"address_id": address_id1, "slot_id": slot_id, "payment_method": "upi"},
    )
    order_id = order_resp.json()["id"]

    # User 2 tries to fetch user 1's order
    phone2 = f"+919{secrets.randbelow(900000000):09d}"
    async with AsyncSessionLocal() as session:
        user2 = User(phone=phone2, role="customer", is_active=True, is_phone_verified=True)
        session.add(user2)
        await session.commit()
        await session.refresh(user2)

    token2 = create_access_token(user_id=user2.id, phone=user2.phone, role="customer")
    headers2 = {"Authorization": f"Bearer {token2}"}

    resp = await client.get(f"/api/v1/orders/{order_id}", headers=headers2)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_order_status_lifecycle_and_transition_guard(
    client: AsyncClient, customer_auth, admin_auth
):
    """Admin transitions order through valid lifecycle; invalid/backward transitions return 409."""
    cust_headers, user = customer_auth
    admin_headers, admin = admin_auth
    address_id = await setup_customer_address(client, cust_headers)
    slot_id = await get_test_slot_id(client)

    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    await client.post(
        "/api/v1/cart/items",
        headers=cust_headers,
        json={"variant_id": variant.id, "quantity": 1},
    )
    order_resp = await client.post(
        "/api/v1/orders",
        headers=cust_headers,
        json={"address_id": address_id, "slot_id": slot_id, "payment_method": "upi"},
    )
    order_id = order_resp.json()["id"]

    # 1. Admin confirms order
    confirm_resp = await client.patch(
        f"/api/v1/admin/orders/{order_id}/status",
        headers=admin_headers,
        json={"status": "confirmed", "note": "Packed and ready"},
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "confirmed"

    # 2. Backward transition (confirmed -> pending) forbidden -> 409
    backward_resp = await client.patch(
        f"/api/v1/admin/orders/{order_id}/status",
        headers=admin_headers,
        json={"status": "pending"},
    )
    assert backward_resp.status_code == 422 or backward_resp.status_code == 409

    # 3. Non-admin customer forbidden from admin route -> 403
    cust_admin_resp = await client.patch(
        f"/api/v1/admin/orders/{order_id}/status",
        headers=cust_headers,
        json={"status": "dispatched"},
    )
    assert cust_admin_resp.status_code == 403
