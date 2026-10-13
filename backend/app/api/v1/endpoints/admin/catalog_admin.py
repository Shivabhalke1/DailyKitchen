from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.deps import get_db
from backend.app.models.catalog import Category, Inventory, Product, ProductVariant
from backend.app.models.order import OrderItem
from backend.app.schemas.catalog import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    InventoryAdjust,
    InventoryRead,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProductVariantRead,
    VariantCreate,
    VariantUpdate,
)

router = APIRouter()


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: create a new produce category."""
    existing = await db.execute(
        select(Category).where(
            (Category.slug == payload.slug) | (Category.name == payload.name)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category with this name or slug already exists",
        )

    cat = Category(
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        image_url=payload.image_url,
        display_order=payload.display_order,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryRead.model_validate(cat)


@router.patch("/categories/{category_id}", response_model=CategoryRead)
@router.put("/categories/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: update category details."""
    cat = (
        await db.execute(select(Category).where(Category.id == category_id))
    ).scalar_one_or_none()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cat, field, value)

    await db.commit()
    await db.refresh(cat)
    return CategoryRead.model_validate(cat)


@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: create a new produce item."""
    # Check category exists
    cat = (
        await db.execute(select(Category).where(Category.id == payload.category_id))
    ).scalar_one_or_none()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{payload.category_id}' not found",
        )

    existing = (
        await db.execute(select(Product).where(Product.slug == payload.slug))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with slug '{payload.slug}' already exists",
        )

    product = Product(
        category_id=payload.category_id,
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        image_url=payload.image_url,
        is_fresh_today=payload.is_fresh_today,
        is_popular=payload.is_popular,
    )
    db.add(product)
    await db.commit()

    # Reload with variants
    res = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(selectinload(Product.variants))
    )
    return ProductRead.model_validate(res.scalar_one())


@router.patch("/products/{product_id}", response_model=ProductRead)
@router.put("/products/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: update product attributes."""
    product = (
        await db.execute(
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.variants).selectinload(ProductVariant.inventory)
            )
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{product_id}' not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.post(
    "/products/{product_id}/variants",
    response_model=ProductVariantRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_product_variant(
    product_id: str,
    payload: VariantCreate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: add a new variant to a product with initial zero-inventory record."""
    product = (
        await db.execute(select(Product).where(Product.id == product_id))
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{product_id}' not found",
        )

    variant = ProductVariant(
        product_id=product_id,
        weight_label=payload.weight_label,
        weight_grams=payload.weight_grams,
        price=payload.price,
        mrp=payload.mrp,
        display_order=payload.display_order,
    )
    db.add(variant)
    await db.flush()

    inventory = Inventory(
        variant_id=variant.id,
        stock_quantity=0,
        reserved_quantity=0,
        low_stock_threshold=10,
    )
    db.add(inventory)
    await db.commit()

    res = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.id == variant.id)
        .options(selectinload(ProductVariant.inventory))
    )
    return ProductVariantRead.model_validate(res.scalar_one())


@router.patch("/variants/{variant_id}", response_model=ProductVariantRead)
@router.put("/variants/{variant_id}", response_model=ProductVariantRead)
async def update_variant(
    variant_id: str,
    payload: VariantUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: update variant pricing, availability or order."""
    variant = (
        await db.execute(
            select(ProductVariant)
            .where(ProductVariant.id == variant_id)
            .options(selectinload(ProductVariant.inventory))
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Variant '{variant_id}' not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(variant, field, value)

    await db.commit()
    await db.refresh(variant)
    return ProductVariantRead.model_validate(variant)


@router.put("/variants/{variant_id}/inventory", response_model=InventoryRead)
async def adjust_inventory(
    variant_id: str,
    payload: InventoryAdjust,
    db: AsyncSession = Depends(get_db),
):
    """Admin: adjust inventory stock via delta (positive or negative)."""
    inv = (
        await db.execute(
            select(Inventory).where(Inventory.variant_id == variant_id)
        )
    ).scalar_one_or_none()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory for variant '{variant_id}' not found",
        )

    new_stock = inv.stock_quantity + payload.delta
    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot reduce stock below 0. Current: {inv.stock_quantity}, Delta: {payload.delta}",
        )
    if new_stock < inv.reserved_quantity:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot reduce stock below active reserved quantity ({inv.reserved_quantity})",
        )

    inv.stock_quantity = new_stock
    await db.commit()
    await db.refresh(inv)
    return InventoryRead.model_validate(inv)


@router.post("/variants/{variant_id}/inventory/zero", response_model=InventoryRead)
async def zero_inventory(
    variant_id: str,
    reason: str = Query("Inventory zeroed out by admin", description="Audit reason"),
    db: AsyncSession = Depends(get_db),
):
    """Admin: instantly zero out sellable inventory (setting physical stock equal to active reservations)."""
    inv = (
        await db.execute(select(Inventory).where(Inventory.variant_id == variant_id))
    ).scalar_one_or_none()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory for variant '{variant_id}' not found",
        )

    # Set physical stock to match active reservations, making available stock 0
    inv.stock_quantity = inv.reserved_quantity
    await db.commit()
    await db.refresh(inv)
    return InventoryRead.model_validate(inv)


@router.delete("/variants/{variant_id}")
async def delete_variant(
    variant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: delete or deactivate a variant and its inventory record.
    If historical customer order items exist, deactivates and zeroes stock to protect order history.
    If no historical orders exist, permanently removes variant and inventory.
    """
    variant = (
        await db.execute(
            select(ProductVariant)
            .where(ProductVariant.id == variant_id)
            .options(selectinload(ProductVariant.inventory))
        )
    ).scalar_one_or_none()
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Variant '{variant_id}' not found",
        )

    # Check for active reservations
    if variant.inventory and variant.inventory.reserved_quantity > 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot delete variant with {variant.inventory.reserved_quantity} active in-flight customer order reservations.",
        )

    # Check for historical order items referencing this variant
    order_items_count = (
        await db.execute(
            select(func.count(OrderItem.id)).where(OrderItem.variant_id == variant_id)
        )
    ).scalar() or 0

    if order_items_count > 0:
        # Cannot hard delete due to foreign key RESTRICT; soft-delete/deactivate
        variant.is_available = False
        if variant.inventory:
            variant.inventory.stock_quantity = 0
        await db.commit()
        return {
            "success": True,
            "message": f"Variant deactivated and inventory zeroed out ({order_items_count} historical orders preserved).",
            "action": "deactivated",
        }

    # No historical orders: delete completely
    await db.delete(variant)
    await db.commit()
    return {
        "success": True,
        "message": "Variant and inventory record permanently removed.",
        "action": "deleted",
    }


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: delete or deactivate a product and all associated variants.
    If historical customer order items exist, deactivates product and variants.
    If no historical orders exist, permanently removes product and variants.
    """
    product = (
        await db.execute(
            select(Product)
            .where(Product.id == product_id)
            .options(
                selectinload(Product.variants).selectinload(ProductVariant.inventory)
            )
        )
    ).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{product_id}' not found",
        )

    # Check for active reservations
    for v in product.variants:
        if v.inventory and v.inventory.reserved_quantity > 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Cannot delete product while variant '{v.weight_label}' has active reservations.",
            )

    variant_ids = [v.id for v in product.variants]
    order_items_count = 0
    if variant_ids:
        order_items_count = (
            await db.execute(
                select(func.count(OrderItem.id)).where(OrderItem.variant_id.in_(variant_ids))
            )
        ).scalar() or 0

    if order_items_count > 0:
        product.is_active = False
        for v in product.variants:
            v.is_available = False
            if v.inventory:
                v.inventory.stock_quantity = 0
        await db.commit()
        return {
            "success": True,
            "message": f"Product '{product.name}' deactivated and stock zeroed out ({order_items_count} historical orders preserved).",
            "action": "deactivated",
        }

    await db.delete(product)
    await db.commit()
    return {
        "success": True,
        "message": f"Product '{product.name}' permanently deleted.",
        "action": "deleted",
    }


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: delete or deactivate a category and all associated products.
    """
    cat = (
        await db.execute(
            select(Category)
            .where(Category.id == category_id)
            .options(
                selectinload(Category.products)
                .selectinload(Product.variants)
                .selectinload(ProductVariant.inventory)
            )
        )
    ).scalar_one_or_none()
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{category_id}' not found",
        )

    all_variants = [v for p in cat.products for v in p.variants]
    for v in all_variants:
        if v.inventory and v.inventory.reserved_quantity > 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Cannot delete category while variant '{v.weight_label}' has active reservations.",
            )

    variant_ids = [v.id for v in all_variants]
    order_items_count = 0
    if variant_ids:
        order_items_count = (
            await db.execute(
                select(func.count(OrderItem.id)).where(OrderItem.variant_id.in_(variant_ids))
            )
        ).scalar() or 0

    if order_items_count > 0:
        cat.is_active = False
        for p in cat.products:
            p.is_active = False
            for v in p.variants:
                v.is_available = False
                if v.inventory:
                    v.inventory.stock_quantity = 0
        await db.commit()
        return {
            "success": True,
            "message": f"Category '{cat.name}' deactivated ({order_items_count} historical orders preserved).",
            "action": "deactivated",
        }

    for p in cat.products:
        await db.delete(p)
    await db.delete(cat)
    await db.commit()
    return {
        "success": True,
        "message": f"Category '{cat.name}' permanently deleted.",
        "action": "deleted",
    }

