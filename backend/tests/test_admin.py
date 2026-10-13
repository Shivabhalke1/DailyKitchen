import pytest
import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal
from httpx import AsyncClient
from sqlalchemy import select

from backend.app.core.security import hash_password, create_access_token
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.user import User, Profile
from backend.app.models.catalog import Category, Product, ProductVariant, Inventory
from backend.app.models.delivery import DeliveryZone, DeliverySlot


@pytest.mark.asyncio
async def test_rbac_rejection_for_customer(client: AsyncClient, customer_auth):
    headers, _ = customer_auth
    # Customer attempting to access admin endpoints must be rejected with 403 Forbidden
    res = await client.get("/api/v1/admin/dashboard/metrics", headers=headers)
    assert res.status_code == 403
    assert "Administrator access is required" in res.json()["detail"]


@pytest.mark.asyncio
async def test_rbac_rejection_for_inactive_admin(client: AsyncClient):
    uid = uuid.uuid4().hex[:6]
    phone = f"+9198{uid[:8]}"
    async with AsyncSessionLocal() as session:
        inactive = User(
            phone=phone,
            hashed_password=hash_password("Admin@123456"),
            role="admin",
            is_active=False,
        )
        session.add(inactive)
        await session.commit()
        await session.refresh(inactive)

    # Inactive admin cannot authenticate
    res = await client.post(
        "/api/v1/auth/login",
        json={"identifier": phone, "password": "Admin@123456"},
    )
    assert res.status_code == 403
    assert "deactivated" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_admin_dashboard_metrics(client: AsyncClient, admin_auth):
    headers, _ = admin_auth
    res = await client.get("/api/v1/admin/dashboard/metrics", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "date" in data
    assert "total_orders_today" in data
    assert "orders_by_status" in data
    assert "revenue_today" in data
    assert "low_stock_variants_count" in data
    assert "slot_utilization_percent" in data


@pytest.mark.asyncio
async def test_admin_orders_list_and_detail(client: AsyncClient, admin_auth):
    headers, _ = admin_auth
    res = await client.get("/api/v1/admin/orders?page=1&page_size=10", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data


@pytest.mark.asyncio
async def test_admin_delivery_slots_management(client: AsyncClient, admin_auth):
    headers, _ = admin_auth
    uid = uuid.uuid4().hex[:4]
    async with AsyncSessionLocal() as session:
        # Create test zone and slot with unique pincode
        zone = DeliveryZone(name=f"Admin Zone {uid}", pincode=f"56{uid}", is_express_available=True)
        session.add(zone)
        await session.flush()

        slot = DeliverySlot(
            zone_id=zone.id,
            slot_type="scheduled",
            slot_date=date.today(),
            start_time=time(6, 0),
            end_time=time(8, 0),
            max_orders=20,
            current_orders=5,
            is_active=True,
        )
        session.add(slot)
        await session.commit()
        slot_id = slot.id
        zone_id = zone.id

    # List slots as admin
    list_res = await client.get(
        f"/api/v1/admin/delivery/slots?zone_id={zone_id}",
        headers=headers,
    )
    assert list_res.status_code == 200
    slots = list_res.json()
    assert len(slots) >= 1

    # Update slot: decrease max_orders below current_orders (5) must fail with 422
    fail_update = await client.patch(
        f"/api/v1/admin/delivery/slots/{slot_id}",
        headers=headers,
        json={"max_orders": 3},
    )
    assert fail_update.status_code == 422

    # Update slot: toggle is_active to False (emergency freeze)
    freeze_res = await client.patch(
        f"/api/v1/admin/delivery/slots/{slot_id}",
        headers=headers,
        json={"is_active": False},
    )
    assert freeze_res.status_code == 200
    assert freeze_res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_inventory_delta_reserved_barrier(client: AsyncClient, admin_auth):
    headers, _ = admin_auth
    uid = uuid.uuid4().hex[:6]
    async with AsyncSessionLocal() as session:
        cat = Category(
            name=f"Cat {uid}",
            slug=f"cat-{uid}",
            display_order=1,
            image_url=f"https://images.dailykitchen.com/{uid}.jpg",
        )
        session.add(cat)
        await session.flush()

        prod = Product(
            category_id=cat.id,
            name=f"Produce {uid}",
            slug=f"produce-{uid}",
            description="Crisp organic produce direct from the farm.",
            image_url=f"https://images.dailykitchen.com/prod-{uid}.jpg",
        )
        session.add(prod)
        await session.flush()

        variant = ProductVariant(
            product_id=prod.id,
            weight_label="500g",
            weight_grams=500,
            price=Decimal("30.00"),
            mrp=Decimal("35.00"),
        )
        session.add(variant)
        await session.flush()

        inv = Inventory(
            variant_id=variant.id,
            stock_quantity=20,
            reserved_quantity=15,
            low_stock_threshold=10,
        )
        session.add(inv)
        await session.commit()
        variant_id = variant.id

    # Attempt to reduce stock by 10 (20 - 10 = 10, which is below reserved_quantity 15) -> 422
    res = await client.put(
        f"/api/v1/admin/catalog/variants/{variant_id}/inventory",
        headers=headers,
        json={"delta": -10, "reason": "Adjustment"},
    )
    assert res.status_code == 422
    assert "reserved quantity" in res.json()["detail"].lower()

    # Valid adjustment: add 30 stock (20 + 30 = 50)
    valid_res = await client.put(
        f"/api/v1/admin/catalog/variants/{variant_id}/inventory",
        headers=headers,
        json={"delta": 30, "reason": "Fresh morning restock"},
    )
    assert valid_res.status_code == 200
    assert valid_res.json()["stock_quantity"] == 50


@pytest.mark.asyncio
async def test_admin_customers_directory_and_detail(client: AsyncClient, admin_auth, customer_auth):
    """
    Verify Admin Customer Directory:
    1. Lists customers with Customer ID (DKC-XXXXXXXX), order counts, lifetime spend
    2. Filters by search query matching phone, customer_code, or name
    3. Fetches deep customer detail including immutable order history snapshots
    """
    admin_headers, _ = admin_auth
    _, customer_user = customer_auth

    # 1. List customers
    list_res = await client.get("/api/v1/admin/customers?page=1&limit=20", headers=admin_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()["data"]
    assert "items" in list_data
    assert list_data["total"] >= 1
    items = list_data["items"]
    # Check customer fields
    first_cust = next((c for c in items if c["id"] == customer_user.id), None)
    assert first_cust is not None
    assert first_cust["phone"] == customer_user.phone
    assert first_cust["customer_code"] is not None
    assert first_cust["customer_code"].startswith("DKC-")
    assert "total_orders" in first_cust
    assert "total_spend" in first_cust

    # 2. Search by customer_code
    search_code = first_cust["customer_code"]
    search_res = await client.get(f"/api/v1/admin/customers?q={search_code}", headers=admin_headers)
    assert search_res.status_code == 200
    search_items = search_res.json()["data"]["items"]
    assert any(c["customer_code"] == search_code for c in search_items)

    # 3. Get customer detail
    detail_res = await client.get(f"/api/v1/admin/customers/{customer_user.id}", headers=admin_headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()["data"]
    assert detail["id"] == customer_user.id
    assert detail["customer_code"] == search_code
    assert "orders" in detail
    assert "addresses" in detail

    # 4. Delete customer without orders -> hard deleted
    del_res = await client.delete(f"/api/v1/admin/customers/{customer_user.id}", headers=admin_headers)
    assert del_res.status_code == 200
    del_data = del_res.json()["data"]
    assert del_data["success"] is True
    assert del_data["action"] == "deleted"

    # Verify user no longer exists
    get_again = await client.get(f"/api/v1/admin/customers/{customer_user.id}", headers=admin_headers)
    assert get_again.status_code == 404


@pytest.mark.asyncio
async def test_admin_cannot_delete_admin(client: AsyncClient, admin_auth):
    headers, admin_user = admin_auth
    # Attempting to delete an administrator must be rejected
    res = await client.delete(f"/api/v1/admin/customers/{admin_user.id}", headers=headers)
    assert res.status_code == 403
    assert "cannot be deleted" in res.json()["detail"]


@pytest.mark.asyncio
async def test_customer_cannot_delete_customer(client: AsyncClient, customer_auth):
    headers, customer_user = customer_auth
    res = await client.delete(f"/api/v1/admin/customers/{customer_user.id}", headers=headers)
    assert res.status_code == 403

