import asyncio
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import AsyncSessionLocal
from backend.app.models import (
    Category,
    Product,
    ProductVariant,
    Inventory,
    DeliveryZone,
    DeliverySlot,
    User,
    Profile,
)
from backend.app.core.security import hash_password


SEED_CATALOG = [
    {
        "category": {
            "name": "Daily Vegetables",
            "slug": "daily-vegetables",
            "description": "Essential daily cooking staples sourced fresh every morning.",
            "image_url": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
            "display_order": 1,
        },
        "products": [
            {
                "name": "Tomato Hybrid",
                "slug": "tomato-hybrid",
                "description": "Firm, tangy red tomatoes suitable for curries and daily cooking.",
                "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": True,
                "variants": [
                    {
                        "weight_label": "500g",
                        "weight_grams": 500,
                        "price": Decimal("24.00"),
                        "mrp": Decimal("30.00"),
                        "stock": 100,
                    },
                    {
                        "weight_label": "1kg",
                        "weight_grams": 1000,
                        "price": Decimal("45.00"),
                        "mrp": Decimal("55.00"),
                        "stock": 150,
                    },
                ],
            },
            {
                "name": "Red Onion",
                "slug": "red-onion",
                "description": "Pungent and crisp red onions sourced directly from Maharashtra farms.",
                "image_url": "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": True,
                "variants": [
                    {
                        "weight_label": "1kg",
                        "weight_grams": 1000,
                        "price": Decimal("38.00"),
                        "mrp": Decimal("48.00"),
                        "stock": 200,
                    },
                    {
                        "weight_label": "2kg",
                        "weight_grams": 2000,
                        "price": Decimal("72.00"),
                        "mrp": Decimal("90.00"),
                        "stock": 100,
                    },
                ],
            },
            {
                "name": "Baby Potato",
                "slug": "baby-potato",
                "description": "Small, tender potatoes ideal for dum aloo and roasting.",
                "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": False,
                "variants": [
                    {
                        "weight_label": "1kg",
                        "weight_grams": 1000,
                        "price": Decimal("35.00"),
                        "mrp": Decimal("42.00"),
                        "stock": 80,
                    },
                ],
            },
        ],
    },
    {
        "category": {
            "name": "Fresh Fruits",
            "slug": "fresh-fruits",
            "description": "Seasonal, ripe and nutritious fruits for healthy everyday snacking.",
            "image_url": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&auto=format&fit=crop&q=80",
            "display_order": 2,
        },
        "products": [
            {
                "name": "Robusta Banana",
                "slug": "robusta-banana",
                "description": "Naturally ripened, energy-rich robusta bananas.",
                "image_url": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": True,
                "variants": [
                    {
                        "weight_label": "500g",
                        "weight_grams": 500,
                        "price": Decimal("28.00"),
                        "mrp": Decimal("35.00"),
                        "stock": 90,
                    },
                    {
                        "weight_label": "1kg",
                        "weight_grams": 1000,
                        "price": Decimal("52.00"),
                        "mrp": Decimal("65.00"),
                        "stock": 120,
                    },
                ],
            },
            {
                "name": "Shimla Apple",
                "slug": "shimla-apple",
                "description": "Sweet and crisp mountain apples from Himachal Pradesh.",
                "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": True,
                "variants": [
                    {
                        "weight_label": "500g",
                        "weight_grams": 500,
                        "price": Decimal("85.00"),
                        "mrp": Decimal("105.00"),
                        "stock": 60,
                    },
                    {
                        "weight_label": "1kg",
                        "weight_grams": 1000,
                        "price": Decimal("160.00"),
                        "mrp": Decimal("195.00"),
                        "stock": 80,
                    },
                ],
            },
            {
                "name": "Alphonso Mango",
                "slug": "alphonso-mango",
                "description": "Naturally sweetened Ratnagiri Alphonso table mangoes.",
                "image_url": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": True,
                "variants": [
                    {
                        "weight_label": "1kg",
                        "weight_grams": 1000,
                        "price": Decimal("350.00"),
                        "mrp": Decimal("420.00"),
                        "stock": 50,
                    },
                ],
            },
        ],
    },
    {
        "category": {
            "name": "Greens & Herbs",
            "slug": "greens-and-herbs",
            "description": "Hydrated, crisp leafy greens and aromatic culinary herbs.",
            "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80",
            "display_order": 3,
        },
        "products": [
            {
                "name": "Palak (Spinach)",
                "slug": "palak-spinach",
                "description": "Tender spinach leaves harvested fresh early morning.",
                "image_url": "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": True,
                "variants": [
                    {
                        "weight_label": "1 bunch (250g)",
                        "weight_grams": 250,
                        "price": Decimal("18.00"),
                        "mrp": Decimal("25.00"),
                        "stock": 70,
                    },
                ],
            },
            {
                "name": "Coriander Leaves",
                "slug": "coriander-leaves",
                "description": "Fragrant fresh green coriander for garnishing and chutneys.",
                "image_url": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": True,
                "variants": [
                    {
                        "weight_label": "1 bunch (100g)",
                        "weight_grams": 100,
                        "price": Decimal("12.00"),
                        "mrp": Decimal("15.00"),
                        "stock": 100,
                    },
                ],
            },
        ],
    },
    {
        "category": {
            "name": "Exotics & Salads",
            "slug": "exotics-and-salads",
            "description": "Carefully handled premium exotics and specialty produce.",
            "image_url": "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=600&auto=format&fit=crop&q=80",
            "display_order": 4,
        },
        "products": [
            {
                "name": "Hass Avocado",
                "slug": "hass-avocado",
                "description": "Creamy, nutrient-dense imported Hass avocado.",
                "image_url": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": False,
                "variants": [
                    {
                        "weight_label": "1 piece (~200g)",
                        "weight_grams": 200,
                        "price": Decimal("99.00"),
                        "mrp": Decimal("130.00"),
                        "stock": 40,
                    },
                ],
            },
            {
                "name": "Broccoli",
                "slug": "broccoli",
                "description": "Firm green florets packed with fiber and micronutrients.",
                "image_url": "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&auto=format&fit=crop&q=80",
                "is_fresh_today": True,
                "is_popular": False,
                "variants": [
                    {
                        "weight_label": "1 piece (~350g)",
                        "weight_grams": 350,
                        "price": Decimal("55.00"),
                        "mrp": Decimal("75.00"),
                        "stock": 50,
                    },
                ],
            },
        ],
    },
]

SEED_ZONES = [
    {
        "name": "Koramangala Service Zone",
        "pincode": "560034",
        "is_express_available": True,
    },
    {
        "name": "Indiranagar Service Zone",
        "pincode": "560038",
        "is_express_available": True,
    },
    {
        "name": "Whitefield Service Zone",
        "pincode": "560066",
        "is_express_available": False,
    },
]


async def seed_database(session: AsyncSession) -> None:
    """Populates the database with genuine produce catalog and delivery slots."""
    # Check if catalog is already seeded
    existing_cat = await session.execute(select(Category).limit(1))
    if existing_cat.scalar_one_or_none() is not None:
        print("Database catalog already seeded. Skipping duplicate seeding.")
        return

    print("Seeding authentic DailyKitchen produce catalog...")
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

    print("Seeding delivery zones and delivery slots...")
    today = date.today()
    for zone_data in SEED_ZONES:
        zone = DeliveryZone(
            name=zone_data["name"],
            pincode=zone_data["pincode"],
            is_express_available=zone_data["is_express_available"],
        )
        session.add(zone)
        await session.flush()

        # Seed slots for today and next 2 days
        for day_offset in range(3):
            slot_date = today + timedelta(days=day_offset)

            # Morning Slot
            morning_slot = DeliverySlot(
                zone_id=zone.id,
                slot_type="scheduled",
                slot_date=slot_date,
                start_time=time(6, 0),
                end_time=time(9, 0),
                max_orders=40,
                current_orders=0,
            )
            # Evening Slot
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

            # Instant slot if express available
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

    # Seed default development/test admin user if not present
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
        admin_profile = Profile(
            user=admin_user,
            full_name="Operations Administrator",
        )
        session.add_all([admin_user, admin_profile])
        print(f"Seeded admin account: {admin_phone}")

    await session.commit()
    print("Database seeding completed successfully!")


async def run_seed():
    async with AsyncSessionLocal() as session:
        await seed_database(session)


if __name__ == "__main__":
    asyncio.run(run_seed())
