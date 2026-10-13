import asyncio
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import os
import sys

# Ensure repository root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select, delete, text
from backend.app.db.session import AsyncSessionLocal
from backend.app.models import (
    Category,
    Product,
    ProductVariant,
    Inventory,
    InventoryReservation,
    DeliveryZone,
    DeliverySlot,
    User,
    Profile,
    Cart,
    CartItem,
    Order,
    OrderAddress,
    OrderItem,
    Payment,
    OrderStatusHistory,
)
from backend.app.core.security import hash_password
from backend.app.db.seed import SEED_CATALOG, SEED_ZONES


async def purge_and_reseed():
    print("Purging all dummy and mock data from database...")
    async with AsyncSessionLocal() as session:
        # Delete dummy orders, order items, deliveries, payments
        await session.execute(delete(OrderStatusHistory))
        await session.execute(delete(Payment))
        await session.execute(delete(OrderItem))
        await session.execute(delete(OrderAddress))
        await session.execute(delete(Order))

        # Delete carts and reservations
        await session.execute(delete(CartItem))
        await session.execute(delete(Cart))
        await session.execute(delete(InventoryReservation))

        # Delete all inventories, variants, products, categories
        await session.execute(delete(Inventory))
        await session.execute(delete(ProductVariant))
        await session.execute(delete(Product))
        await session.execute(delete(Category))

        # Delete all delivery slots and zones
        await session.execute(delete(DeliverySlot))
        await session.execute(delete(DeliveryZone))

        # Delete dummy test users (keep only admin +919999999999)
        users = (await session.execute(select(User).where(User.phone != "+919999999999"))).scalars().all()
        for u in users:
            await session.execute(delete(Profile).where(Profile.user_id == u.id))
            await session.delete(u)

        await session.commit()
        print("Database purged cleanly. Reseeding authentic catalog...")

        # 1. Seed Categories & Products
        for cat_data in SEED_CATALOG:
            category = Category(
                name=cat_data["category"]["name"],
                slug=cat_data["category"]["slug"],
                description=cat_data["category"]["description"],
                image_url=cat_data["category"]["image_url"],
                display_order=cat_data["category"]["display_order"],
            )
            session.add(category)
            await session.flush()

            for prod_data in cat_data["products"]:
                product = Product(
                    category_id=category.id,
                    name=prod_data["name"],
                    slug=prod_data["slug"],
                    description=prod_data["description"],
                    image_url=prod_data["image_url"],
                    is_fresh_today=prod_data["is_fresh_today"],
                    is_popular=prod_data["is_popular"],
                )
                session.add(product)
                await session.flush()

                for var_idx, var_data in enumerate(prod_data["variants"]):
                    variant = ProductVariant(
                        product_id=product.id,
                        weight_label=var_data["weight_label"],
                        weight_grams=var_data["weight_grams"],
                        price=var_data["price"],
                        mrp=var_data["mrp"],
                        display_order=var_idx,
                    )
                    session.add(variant)
                    await session.flush()

                    inventory = Inventory(
                        variant_id=variant.id,
                        stock_quantity=var_data["stock"],
                        reserved_quantity=0,
                        low_stock_threshold=10,
                    )
                    session.add(inventory)

        # 2. Seed Delivery Zones & Slots
        today = date.today()
        for zone_data in SEED_ZONES:
            zone = DeliveryZone(
                name=zone_data["name"],
                pincode=zone_data["pincode"],
                is_express_available=zone_data["is_express_available"],
            )
            session.add(zone)
            await session.flush()

            for day_offset in range(3):
                slot_date = today + timedelta(days=day_offset)

                morning_slot = DeliverySlot(
                    zone_id=zone.id,
                    slot_type="scheduled",
                    slot_date=slot_date,
                    start_time=time(6, 0),
                    end_time=time(9, 0),
                    max_orders=40,
                    current_orders=0,
                )
                evening_slot = DeliverySlot(
                    zone_id=zone.id,
                    slot_type="scheduled",
                    slot_date=slot_date,
                    start_time=time(17, 0),
                    end_time=time(20, 0),
                    max_orders=40,
                    current_orders=0,
                )
                session.add_all([morning_slot, evening_slot])

                if zone.is_express_available and day_offset == 0:
                    express_slot = DeliverySlot(
                        zone_id=zone.id,
                        slot_type="instant_express",
                        slot_date=slot_date,
                        start_time=time(8, 0),
                        end_time=time(21, 0),
                        max_orders=100,
                        current_orders=0,
                    )
                    session.add(express_slot)

        # 3. Ensure Admin Account
        admin_phone = "+919999999999"
        admin_stmt = select(User).where(User.phone == admin_phone)
        existing_admin = (await session.execute(admin_stmt)).scalar_one_or_none()
        if not existing_admin:
            admin_user = User(
                phone=admin_phone,
                email="admin@dailykitchen.com",
                hashed_password=hash_password("Admin@123456"),
                is_phone_verified=True,
                is_email_verified=True,
                role="admin",
                is_active=True,
            )
            session.add(admin_user)
            await session.flush()
            admin_profile = Profile(
                user_id=admin_user.id,
                full_name="Operations Administrator",
            )
            session.add(admin_profile)
            print(f"Provisioned clean admin account: {admin_phone}")

        await session.commit()
        print("Database purge and authentic reseed completed successfully!")


if __name__ == "__main__":
    asyncio.run(purge_and_reseed())
