import pytest
from httpx import AsyncClient
from sqlalchemy import select
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.catalog import Category, Product, ProductVariant


@pytest.mark.asyncio
async def test_list_categories_ordered(client: AsyncClient):
    """List categories returns ordered active list."""
    resp = await client.get("/api/v1/catalog/categories")
    assert resp.status_code == 200
    categories = resp.json()
    assert len(categories) >= 4
    # Check ordering by display_order
    display_orders = [c["display_order"] for c in categories]
    assert display_orders == sorted(display_orders)


@pytest.mark.asyncio
async def test_get_category_by_slug_with_product_count(client: AsyncClient):
    """Get category by slug returns active product count; unknown slug returns 404."""
    resp = await client.get("/api/v1/catalog/categories/daily-vegetables")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "daily-vegetables"
    assert data["product_count"] >= 1

    not_found = await client.get("/api/v1/catalog/categories/non-existent-category-slug")
    assert not_found.status_code == 404


@pytest.mark.asyncio
async def test_list_products_popular_filter(client: AsyncClient):
    """List products with ?popular=true filter returns only popular items."""
    resp = await client.get("/api/v1/catalog/products?popular=true")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] > 0
    for product in data["items"]:
        assert product["is_popular"] is True


@pytest.mark.asyncio
async def test_list_products_search(client: AsyncClient):
    """List products with text search ?q=tomato."""
    resp = await client.get("/api/v1/catalog/products?q=tomato")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    found = any("tomato" in p["name"].lower() for p in data["items"])
    assert found is True


@pytest.mark.asyncio
async def test_get_product_by_slug_includes_variants_and_inventory(client: AsyncClient):
    """Get product by slug includes variants with computed fields and inventory."""
    resp = await client.get("/api/v1/catalog/products/tomato-hybrid")
    assert resp.status_code == 200
    data = resp.json()
    assert data["slug"] == "tomato-hybrid"
    assert len(data["variants"]) >= 1

    variant = data["variants"][0]
    assert "price" in variant
    assert "mrp" in variant
    assert "discount_amount" in variant
    assert "inventory" in variant
    assert variant["inventory"]["available_quantity"] >= 0


@pytest.mark.asyncio
async def test_featured_products_max_limit(client: AsyncClient):
    """GET /products/featured returns <= 8 products and is distinct from slug routing."""
    resp = await client.get("/api/v1/catalog/products/featured?limit=8")
    assert resp.status_code == 200
    products = resp.json()
    assert isinstance(products, list)
    assert len(products) <= 8
    assert len(products) > 0
    for p in products:
        assert p["is_popular"] is True or p["is_fresh_today"] is True


@pytest.mark.asyncio
async def test_variant_availability(client: AsyncClient):
    """GET /variants/{id}/availability returns live stock metrics."""
    # Find a valid variant id
    async with AsyncSessionLocal() as session:
        v_res = await session.execute(select(ProductVariant).limit(1))
        variant = v_res.scalar_one()
        variant_id = variant.id

    resp = await client.get(f"/api/v1/catalog/variants/{variant_id}/availability")
    assert resp.status_code == 200
    data = resp.json()
    assert "stock_quantity" in data
    assert "reserved_quantity" in data
    assert "available_quantity" in data
    assert data["available_quantity"] == data["stock_quantity"] - data["reserved_quantity"]


@pytest.mark.asyncio
async def test_inactive_products_and_categories_excluded(client: AsyncClient):
    """Inactive products and categories are not returned in public API."""
    import secrets
    uid = secrets.token_hex(4)
    cat_slug = f"hidden-cat-{uid}"
    prod_slug = f"hidden-prod-{uid}"

    async with AsyncSessionLocal() as session:
        # Create inactive category
        inactive_cat = Category(
            name=f"Hidden Cat {uid}",
            slug=cat_slug,
            image_url="http://test.com/hidden.jpg",
            is_active=False,
        )
        session.add(inactive_cat)
        await session.flush()

        inactive_prod = Product(
            category_id=inactive_cat.id,
            name=f"Hidden Prod {uid}",
            slug=prod_slug,
            description="Hidden",
            image_url="http://test.com/hidden.jpg",
            is_active=False,
        )
        session.add(inactive_prod)
        await session.commit()

    try:
        # Public category list should not include hidden category
        cat_resp = await client.get("/api/v1/catalog/categories")
        cat_slugs = [c["slug"] for c in cat_resp.json()]
        assert cat_slug not in cat_slugs

        # Category by slug should return 404
        cat_slug_resp = await client.get(f"/api/v1/catalog/categories/{cat_slug}")
        assert cat_slug_resp.status_code == 404

        # Product by slug should return 404
        prod_slug_resp = await client.get(f"/api/v1/catalog/products/{prod_slug}")
        assert prod_slug_resp.status_code == 404
    finally:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import delete
            await session.execute(delete(Product).where(Product.slug == prod_slug))
            await session.execute(delete(Category).where(Category.slug == cat_slug))
            await session.commit()


@pytest.mark.asyncio
async def test_admin_delete_product_and_category(client: AsyncClient, admin_auth):
    """Admin can delete products and categories successfully."""
    headers, _ = admin_auth
    import secrets
    uid = secrets.token_hex(4)

    # 1. Create a category
    cat_resp = await client.post(
        "/api/v1/admin/catalog/categories",
        json={
            "name": f"Test Deletable Cat {uid}",
            "slug": f"test-del-cat-{uid}",
            "description": "To be deleted",
            "image_url": "https://example.com/del.jpg",
            "display_order": 99,
        },
        headers=headers,
    )
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    # 2. Create a product in that category
    prod_resp = await client.post(
        "/api/v1/admin/catalog/products",
        json={
            "category_id": cat_id,
            "name": f"Test Deletable Produce {uid}",
            "slug": f"test-del-prod-{uid}",
            "description": "To be deleted produce",
            "image_url": "https://example.com/del-prod.jpg",
            "is_fresh_today": True,
            "is_popular": False,
        },
        headers=headers,
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    # 3. Delete the product
    del_prod_resp = await client.delete(
        f"/api/v1/admin/catalog/products/{prod_id}",
        headers=headers,
    )
    assert del_prod_resp.status_code == 200
    assert del_prod_resp.json()["success"] is True

    # 4. Verify product is gone
    get_prod = await client.get(f"/api/v1/catalog/products/test-del-prod-{uid}")
    assert get_prod.status_code == 404

    # 5. Delete the category
    del_cat_resp = await client.delete(
        f"/api/v1/admin/catalog/categories/{cat_id}",
        headers=headers,
    )
    assert del_cat_resp.status_code == 200
    assert del_cat_resp.json()["success"] is True

    # 6. Verify category is gone
    get_cat = await client.get(f"/api/v1/catalog/categories/test-del-cat-{uid}")
    assert get_cat.status_code == 404
