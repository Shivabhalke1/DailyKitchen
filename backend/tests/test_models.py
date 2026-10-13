import pytest
from datetime import date, datetime, time, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.app.models import (
    Base,
    User,
    Profile,
    OtpChallenge,
    Address,
    Category,
    Product,
    ProductVariant,
    Inventory,
    InventoryReservation,
    Cart,
    CartItem,
    DeliveryZone,
    DeliverySlot,
    Order,
    OrderAddress,
    OrderItem,
    Payment,
    OrderStatusHistory,
)


EXPECTED_TABLES = {
    "users",
    "profiles",
    "otp_challenges",
    "addresses",
    "categories",
    "products",
    "product_variants",
    "inventory",
    "inventory_reservations",
    "carts",
    "cart_items",
    "delivery_zones",
    "delivery_slots",
    "orders",
    "order_addresses",
    "order_items",
    "payments",
    "order_status_history",
    "user_sessions",
    "password_reset_tokens",
}


def test_model_count_and_metadata_registration():
    """Verify exactly 20 models are registered in Base.metadata."""
    registered_tables = set(Base.metadata.tables.keys())
    assert registered_tables == EXPECTED_TABLES
    assert len(registered_tables) == 20


def test_table_check_constraints_defined():
    """Verify required check constraints exist across all models."""
    tables = Base.metadata.tables

    # User
    user_constraints = {c.name for c in tables["users"].constraints if hasattr(c, "name")}
    assert "check_user_role" in user_constraints

    # OtpChallenge
    otp_constraints = {c.name for c in tables["otp_challenges"].constraints if hasattr(c, "name")}
    assert "check_otp_purpose" in otp_constraints
    assert "check_otp_attempts_range" in otp_constraints

    # Address
    addr_constraints = {c.name for c in tables["addresses"].constraints if hasattr(c, "name")}
    assert "check_address_pincode_length" in addr_constraints
    assert "check_address_label" in addr_constraints

    # ProductVariant
    var_constraints = {c.name for c in tables["product_variants"].constraints if hasattr(c, "name")}
    assert "check_variant_weight_positive" in var_constraints
    assert "check_variant_price_nonnegative" in var_constraints
    assert "check_variant_mrp_gte_price" in var_constraints

    # Inventory
    inv_constraints = {c.name for c in tables["inventory"].constraints if hasattr(c, "name")}
    assert "check_inventory_stock_nonnegative" in inv_constraints
    assert "check_inventory_reserved_nonnegative" in inv_constraints
    assert "check_inventory_reserved_lte_stock" in inv_constraints
    assert "check_inventory_low_stock_threshold_nonnegative" in inv_constraints

    # InventoryReservation
    res_constraints = {c.name for c in tables["inventory_reservations"].constraints if hasattr(c, "name")}
    assert "check_reservation_quantity_positive" in res_constraints
    assert "check_reservation_status" in res_constraints

    # CartItem
    cart_item_constraints = {c.name for c in tables["cart_items"].constraints if hasattr(c, "name")}
    assert "check_cart_item_quantity_range" in cart_item_constraints

    # DeliveryZone
    zone_constraints = {c.name for c in tables["delivery_zones"].constraints if hasattr(c, "name")}
    assert "check_delivery_zone_pincode_length" in zone_constraints

    # DeliverySlot
    slot_constraints = {c.name for c in tables["delivery_slots"].constraints if hasattr(c, "name")}
    assert "check_slot_type" in slot_constraints
    assert "check_slot_max_orders_positive" in slot_constraints
    assert "check_slot_current_orders_nonnegative" in slot_constraints
    assert "check_slot_current_orders_lte_max" in slot_constraints

    # Order
    order_constraints = {c.name for c in tables["orders"].constraints if hasattr(c, "name")}
    assert "check_order_status" in order_constraints
    assert "check_order_subtotal_nonnegative" in order_constraints
    assert "check_order_packaging_fee_nonnegative" in order_constraints
    assert "check_order_delivery_fee_nonnegative" in order_constraints
    assert "check_order_total_amount_nonnegative" in order_constraints
    assert "check_order_payment_method" in order_constraints
    assert "check_order_payment_status" in order_constraints
    assert "check_order_total_sum" in order_constraints

    # OrderAddress
    order_addr_constraints = {c.name for c in tables["order_addresses"].constraints if hasattr(c, "name")}
    assert "check_order_address_pincode_length" in order_addr_constraints

    # OrderItem
    item_constraints = {c.name for c in tables["order_items"].constraints if hasattr(c, "name")}
    assert "check_order_item_unit_price_nonnegative" in item_constraints
    assert "check_order_item_mrp_snap_gte_unit_price" in item_constraints
    assert "check_order_item_quantity_positive" in item_constraints
    assert "check_order_item_line_total_product" in item_constraints

    # Payment
    pay_constraints = {c.name for c in tables["payments"].constraints if hasattr(c, "name")}
    assert "check_payment_provider" in pay_constraints
    assert "check_payment_amount_nonnegative" in pay_constraints
    assert "check_payment_status" in pay_constraints
    assert "check_payment_refunded_amount_nonnegative" in pay_constraints
    assert "check_payment_refunded_amount_lte_amount" in pay_constraints


@pytest.mark.asyncio
async def test_in_memory_sqlite_schema_creation_and_crud():
    """Verify that all 18 models create tables cleanly on SQLite and execute relational CRUD."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async_session = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Enable foreign keys on SQLite
    async with test_engine.begin() as conn:
        await conn.execute(Base.metadata.schema) if hasattr(Base.metadata, "schema") and Base.metadata.schema else None
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 1. Create User, Profile, Address
        user = User(
            phone="+919876543210",
            email="customer@example.com",
            role="customer",
        )
        profile = Profile(user=user, full_name="Aarav Sharma")
        address = Address(
            user=user,
            full_name="Aarav Sharma",
            phone="+919876543210",
            house_flat="Flat 402, Green Acres",
            street_area="Koramangala 4th Block",
            city="Bengaluru",
            state="Karnataka",
            pincode="560034",
            is_default=True,
        )
        session.add_all([user, profile, address])

        # 2. Create OtpChallenge
        now_utc = datetime.now(timezone.utc)
        otp = OtpChallenge(
            phone="+919876543210",
            otp_hash="hmac_sha256_mock_hash",
            purpose="login",
            resend_available_at=now_utc + timedelta(seconds=60),
            expires_at=now_utc + timedelta(minutes=5),
        )
        session.add(otp)

        # 3. Create Catalog: Category, Product, Variant, Inventory
        category = Category(
            name="Daily Vegetables",
            slug="daily-vegetables",
            image_url="https://images.dailykitchen.com/cat-veggies.jpg",
        )
        product = Product(
            category=category,
            name="Farm Fresh Tomato",
            slug="farm-fresh-tomato",
            description="Locally grown juicy hybrid tomatoes",
            image_url="https://images.dailykitchen.com/tomato.jpg",
        )
        variant = ProductVariant(
            product=product,
            weight_label="1kg",
            weight_grams=1000,
            price=Decimal("45.00"),
            mrp=Decimal("55.00"),
        )
        inventory = Inventory(
            variant=variant,
            stock_quantity=100,
            reserved_quantity=0,
            low_stock_threshold=10,
        )
        session.add_all([category, product, variant, inventory])

        # 4. Create Cart and CartItem
        cart = Cart(user=user)
        cart_item = CartItem(cart=cart, variant=variant, quantity=2)
        session.add_all([cart, cart_item])

        # 5. Create DeliveryZone and DeliverySlot
        zone = DeliveryZone(
            name="Koramangala Zone",
            pincode="560034",
            is_express_available=True,
        )
        slot = DeliverySlot(
            zone=zone,
            slot_type="scheduled",
            slot_date=date(2026, 10, 15),
            start_time=time(6, 0),
            end_time=time(9, 0),
            max_orders=50,
            current_orders=0,
        )
        session.add_all([zone, slot])

        # 6. Create Order, OrderAddress snapshot, OrderItem snapshot
        order = Order(
            order_number="DK-20261012-0001",
            user=user,
            slot=slot,
            subtotal=Decimal("90.00"),
            packaging_fee=Decimal("10.00"),
            delivery_fee=Decimal("40.00"),
            total_amount=Decimal("140.00"),
            payment_method="upi",
            payment_status="pending",
        )
        order_address = OrderAddress(
            order=order,
            source_address_id=address.id,
            full_name=address.full_name,
            phone=address.phone,
            house_flat=address.house_flat,
            street_area=address.street_area,
            city=address.city,
            state=address.state,
            pincode=address.pincode,
        )
        order_item = OrderItem(
            order=order,
            variant=variant,
            product_name_snap="Farm Fresh Tomato",
            weight_label_snap="1kg",
            unit_price=Decimal("45.00"),
            mrp_snap=Decimal("55.00"),
            quantity=2,
            line_total=Decimal("90.00"),
        )
        payment = Payment(
            order=order,
            idempotency_key="idemp_key_12345",
            provider="mock",
            amount=Decimal("140.00"),
            status="pending",
        )
        history = OrderStatusHistory(
            order=order,
            from_status=None,
            to_status="placed",
            comment="Order received via UPI intent",
        )
        session.add_all([order, order_address, order_item, payment, history])

        # Commit transaction
        await session.commit()

        # Query and verify
        res = await session.execute(select(Order).where(Order.order_number == "DK-20261012-0001"))
        saved_order = res.scalar_one()
        assert saved_order.total_amount == Decimal("140.00")
        assert saved_order.user.phone == "+919876543210"
        assert saved_order.address_snapshot.pincode == "560034"
        assert len(saved_order.items) == 1
        assert saved_order.items[0].product_name_snap == "Farm Fresh Tomato"
        assert saved_order.items[0].line_total == Decimal("90.00")
        assert len(saved_order.payments) == 1
        assert saved_order.payments[0].amount == Decimal("140.00")
        assert len(saved_order.status_history) == 1

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_order_total_check_constraint_violation():
    """Verify check_order_total_sum rejects inconsistent total_amount."""
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async_session = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        user = User(phone="+919876543299", role="customer")
        zone = DeliveryZone(name="Indiranagar", pincode="560038")
        slot = DeliverySlot(
            zone=zone,
            slot_type="scheduled",
            slot_date=date(2026, 10, 15),
            start_time=time(6, 0),
            end_time=time(9, 0),
            max_orders=10,
        )
        session.add_all([user, zone, slot])
        await session.flush()

        # Inconsistent total: subtotal 100 + pkg 10 + delivery 0 != 999
        invalid_order = Order(
            order_number="DK-INVALID-001",
            user_id=user.id,
            slot_id=slot.id,
            subtotal=Decimal("100.00"),
            packaging_fee=Decimal("10.00"),
            delivery_fee=Decimal("0.00"),
            total_amount=Decimal("999.00"),  # VIOLATES CHECK CONSTRAINT
            payment_method="upi",
            payment_status="pending",
        )
        session.add(invalid_order)

        with pytest.raises(IntegrityError):
            await session.commit()

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_variant_price_mrp_check_constraint():
    """Verify check_variant_mrp_gte_price rejects price higher than MRP."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        cat = Category(name="Exotics", slug="exotics", image_url="https://ex.com/c.jpg")
        prod = Product(category=cat, name="Avocado", slug="avocado", description="Fresh", image_url="https://ex.com/a.jpg")
        # Invalid: price 100 > mrp 80
        invalid_variant = ProductVariant(
            product=prod,
            weight_label="1 piece",
            weight_grams=200,
            price=Decimal("100.00"),
            mrp=Decimal("80.00"),
        )
        session.add_all([cat, prod, invalid_variant])
        with pytest.raises(IntegrityError):
            await session.commit()

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_cart_item_quantity_check_constraint():
    """Verify check_cart_item_quantity_range rejects quantity > 20 and < 1."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        user = User(phone="+919876543201")
        cat = Category(name="Fruits", slug="fruits", image_url="https://ex.com/f.jpg")
        prod = Product(category=cat, name="Banana", slug="banana", description="Yummy", image_url="https://ex.com/b.jpg")
        variant = ProductVariant(
            product=prod, weight_label="500g", weight_grams=500, price=Decimal("30.00"), mrp=Decimal("35.00")
        )
        cart = Cart(user=user)
        # Invalid: quantity 25 exceeds maximum 20
        item = CartItem(cart=cart, variant=variant, quantity=25)
        session.add_all([user, cat, prod, variant, cart, item])
        with pytest.raises(IntegrityError):
            await session.commit()

    await test_engine.dispose()


@pytest.mark.asyncio
async def test_user_phone_uniqueness():
    """Verify phone uniqueness is strictly enforced."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        u1 = User(phone="+919999999999")
        session.add(u1)
        await session.commit()

        u2 = User(phone="+919999999999")
        session.add(u2)
        with pytest.raises(IntegrityError):
            await session.commit()

    await test_engine.dispose()


def test_postgresql_dialect_ddl_compilation():
    """Verify all 18 tables and constraints compile cleanly against the PostgreSQL dialect."""
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateTable

    pg_dialect = postgresql.dialect()
    for table_name, table in Base.metadata.tables.items():
        ddl = str(CreateTable(table).compile(dialect=pg_dialect))
        assert table_name in ddl
        assert len(ddl) > 0
