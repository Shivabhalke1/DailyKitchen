import os
import uuid
from io import BytesIO
from PIL import Image
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
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
    ProductPricingUpdate,
    ProductRead,
    ProductUpdate,
    ProductVariantRead,
    VariantCreate,
    VariantUpdate,
)

router = APIRouter()

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_IMAGE_MIMETYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/upload-image")
async def upload_catalog_image(
    file: UploadFile = File(...),
):
    """
    Admin: upload an image file from the device/file picker for categories or produce items.
    Validates file type, size, and image integrity, then stores in /uploads/catalog/.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided in upload payload.",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported formats: JPEG, PNG, WebP, GIF.",
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_IMAGE_MIMETYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content-type '{file.content_type}'. Must be a valid image.",
        )

    # Read content and enforce max size
    contents = await file.read()
    if len(contents) > MAX_IMAGE_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 5MB (size: {len(contents) / (1024 * 1024):.1f}MB).",
        )

    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    # Verify image integrity with PIL
    try:
        image = Image.open(BytesIO(contents))
        image.verify()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or invalid image file: {str(e)}",
        )

    # Generate safe unique filename
    safe_name = f"{uuid.uuid4().hex}{ext}"
    target_dir = os.path.join(os.getcwd(), "uploads", "catalog")
    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, safe_name)

    # Write file to disk
    with open(target_path, "wb") as f:
        f.write(contents)

    relative_url = f"/uploads/catalog/{safe_name}"
    return {
        "success": True,
        "image_url": relative_url,
        "filename": safe_name,
        "original_filename": file.filename,
        "size_bytes": len(contents),
        "content_type": file.content_type or f"image/{ext.lstrip('.')}",
    }


@router.get("/categories", response_model=list[CategoryRead])
async def list_admin_categories(
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all categories (both active and inactive)."""
    res = await db.execute(select(Category).order_by(Category.display_order, Category.name))
    return [CategoryRead.model_validate(c) for c in res.scalars().all()]


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Admin: create a new produce category with optional default category price."""
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
        is_active=payload.is_active,
        default_price=payload.default_price,
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
    """Admin: update category details including optional default category price."""
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


@router.get("/products", response_model=list[ProductRead])
async def list_admin_products(
    db: AsyncSession = Depends(get_db),
):
    """Admin: list all produce items (both active and inactive) with variants."""
    res = await db.execute(
        select(Product)
        .options(selectinload(Product.variants).selectinload(ProductVariant.inventory))
        .order_by(Product.name)
    )
    return [ProductRead.model_validate(p) for p in res.scalars().all()]


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
        is_active=payload.is_active,
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

    # Validate category assignment if changing
    if "category_id" in update_data and update_data["category_id"] != product.category_id:
        target_cat = (
            await db.execute(select(Category).where(Category.id == update_data["category_id"]))
        ).scalar_one_or_none()
        if not target_cat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category '{update_data['category_id']}' not found",
            )

    # Validate unique slug if changing
    if "slug" in update_data and update_data["slug"] != product.slug:
        slug_existing = (
            await db.execute(
                select(Product).where(Product.slug == update_data["slug"], Product.id != product_id)
            )
        ).scalar_one_or_none()
        if slug_existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product with slug '{update_data['slug']}' already exists",
            )

    for field, value in update_data.items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.put("/products/{product_id}/pricing", response_model=ProductRead)
async def update_product_pricing(
    product_id: str,
    payload: ProductPricingUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: set or update individual selling price and MRP for an item.
    The updated price takes effect immediately across customer website, cart, and checkout.
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

    # Find target variant
    target_variant = None
    if payload.variant_id:
        target_variant = next((v for v in product.variants if v.id == payload.variant_id), None)
    elif product.variants:
        target_variant = sorted(product.variants, key=lambda v: v.display_order)[0]

    mrp = payload.mrp if (payload.mrp is not None and payload.mrp >= payload.price) else payload.price

    if target_variant:
        target_variant.price = payload.price
        target_variant.mrp = mrp
    else:
        new_variant = ProductVariant(
            product_id=product.id,
            weight_label="Standard Pack",
            weight_grams=500,
            price=payload.price,
            mrp=mrp,
            is_available=True,
            display_order=0,
        )
        db.add(new_variant)
        product.variants.append(new_variant)
        await db.flush()
        inv = Inventory(
            variant_id=new_variant.id,
            stock_quantity=50,
            reserved_quantity=0,
            low_stock_threshold=10,
        )
        db.add(inv)

    await db.commit()
    await db.refresh(product)

    # Reload with variants
    res = await db.execute(
        select(Product)
        .where(Product.id == product.id)
        .options(
            selectinload(Product.variants).selectinload(ProductVariant.inventory)
        )
    )
    return ProductRead.model_validate(res.scalar_one())



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

