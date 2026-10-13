from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from backend.app.core.security import create_access_token
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.cart import Cart
from backend.app.models.catalog import ProductVariant
from backend.app.models.user import User


@pytest.mark.asyncio
async def test_get_cart_new_user_empty_with_zero_pricing(client: AsyncClient, customer_auth):
    """GET cart for new user returns empty cart with zero pricing."""
    headers, user = customer_auth
    resp = await client.get("/api/v1/cart", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["item_count"] == 0
    assert Decimal(str(data["pricing"]["subtotal"])) == Decimal("0.00")
    assert Decimal(str(data["pricing"]["delivery_fee"])) == Decimal("0.00")
    assert Decimal(str(data["pricing"]["packaging_fee"])) == Decimal("0.00")
    assert Decimal(str(data["pricing"]["total"])) == Decimal("0.00")
    assert data["pricing"]["is_free_delivery"] is False


@pytest.mark.asyncio
async def test_add_item_computes_subtotal(client: AsyncClient, customer_auth):
    """Adding an item computes correct subtotal and pricing."""
    headers, user = customer_auth
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 2},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["variant_id"] == variant.id
    assert data["items"][0]["quantity"] == 2
    expected_subtotal = Decimal(str(variant.price)) * 2
    assert Decimal(str(data["pricing"]["subtotal"])) == expected_subtotal


@pytest.mark.asyncio
async def test_add_same_item_twice_upserts_quantity(client: AsyncClient, customer_auth):
    """Adding the same variant twice increments quantity instead of duplicate line items."""
    headers, user = customer_auth
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    # First add: qty 1
    await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 1},
    )
    # Second add: qty 2
    resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 2},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["quantity"] == 3


@pytest.mark.asyncio
async def test_add_unavailable_variant_returns_422(client: AsyncClient, customer_auth):
    """Attempting to add unavailable variant returns 422."""
    headers, user = customer_auth
    resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": "non-existent-variant-id", "quantity": 1},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_item_quantity_recomputes_pricing(client: AsyncClient, customer_auth):
    """Updating line item quantity recomputes pricing."""
    headers, user = customer_auth
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    add_resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 1},
    )
    item_id = add_resp.json()["items"][0]["id"]

    update_resp = await client.patch(
        f"/api/v1/cart/items/{item_id}",
        headers=headers,
        json={"quantity": 3},
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["items"][0]["quantity"] == 3
    expected_subtotal = Decimal(str(variant.price)) * 3
    assert Decimal(str(data["pricing"]["subtotal"])) == expected_subtotal


@pytest.mark.asyncio
async def test_cart_subtotal_below_threshold_delivery_fee(client: AsyncClient, customer_auth):
    """Subtotal < ₹99 incurs ₹40 standard delivery fee."""
    headers, user = customer_auth
    # Add Avocado 1 piece (₹99 mrp, price ₹99? No, let's find a cheap variant like Banana 500g ₹28)
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(
                ProductVariant.is_available.is_(True),
                ProductVariant.price < Decimal("50.00"),
            ).limit(1)
        )
        variant = v_res.scalar_one()

    resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 1},
    )
    data = resp.json()
    assert Decimal(str(data["pricing"]["subtotal"])) < Decimal("99.00")
    assert Decimal(str(data["pricing"]["delivery_fee"])) == Decimal("40.00")
    assert Decimal(str(data["pricing"]["packaging_fee"])) == Decimal("10.00")
    assert data["pricing"]["is_free_delivery"] is False


@pytest.mark.asyncio
async def test_cart_subtotal_at_or_above_threshold_free_delivery(client: AsyncClient, customer_auth):
    """Subtotal >= ₹99 qualifies for free delivery (₹0 fee)."""
    headers, user = customer_auth
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    # Add enough quantity so subtotal >= 99
    quantity_needed = int(Decimal("99.00") / Decimal(str(variant.price))) + 1
    resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": quantity_needed},
    )
    data = resp.json()
    assert Decimal(str(data["pricing"]["subtotal"])) >= Decimal("99.00")
    assert Decimal(str(data["pricing"]["delivery_fee"])) == Decimal("0.00")
    assert Decimal(str(data["pricing"]["packaging_fee"])) == Decimal("10.00")
    assert data["pricing"]["is_free_delivery"] is True


@pytest.mark.asyncio
async def test_remove_cart_item(client: AsyncClient, customer_auth):
    """DELETE /cart/items/{id} removes the line item."""
    headers, user = customer_auth
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    add_resp = await client.post(
        "/api/v1/cart/items",
        headers=headers,
        json={"variant_id": variant.id, "quantity": 1},
    )
    item_id = add_resp.json()["items"][0]["id"]

    del_resp = await client.delete(f"/api/v1/cart/items/{item_id}", headers=headers)
    assert del_resp.status_code == 200
    data = del_resp.json()
    assert len(data["items"]) == 0
    assert data["item_count"] == 0


@pytest.mark.asyncio
async def test_clear_cart_retains_cart_entity(client: AsyncClient, customer_auth):
    """DELETE /cart clears all items while retaining the cart entity."""
    headers, user = customer_auth
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

    clear_resp = await client.delete("/api/v1/cart", headers=headers)
    assert clear_resp.status_code == 200
    assert "cleared" in clear_resp.json()["message"].lower()

    # Fetch cart again: still exists, 0 items
    cart_resp = await client.get("/api/v1/cart", headers=headers)
    assert cart_resp.status_code == 200
    assert len(cart_resp.json()["items"]) == 0


@pytest.mark.asyncio
async def test_accessing_another_user_cart_item_returns_404(client: AsyncClient, customer_auth):
    """Mutating or deleting another user's cart item returns 404 (ownership isolation)."""
    headers1, user1 = customer_auth

    # User 2
    import secrets
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

    # User 1 adds item
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(
            select(ProductVariant).where(ProductVariant.is_available.is_(True)).limit(1)
        )
        variant = v_res.scalar_one()

    add_resp = await client.post(
        "/api/v1/cart/items",
        headers=headers1,
        json={"variant_id": variant.id, "quantity": 1},
    )
    item_id_user1 = add_resp.json()["items"][0]["id"]

    # User 2 tries to PATCH user 1's item -> 404
    patch_resp = await client.patch(
        f"/api/v1/cart/items/{item_id_user1}",
        headers=headers2,
        json={"quantity": 5},
    )
    assert patch_resp.status_code == 404

    # User 2 tries to DELETE user 1's item -> 404
    delete_resp = await client.delete(
        f"/api/v1/cart/items/{item_id_user1}",
        headers=headers2,
    )
    assert delete_resp.status_code == 404
