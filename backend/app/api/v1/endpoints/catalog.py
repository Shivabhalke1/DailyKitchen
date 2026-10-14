from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_db
from backend.app.schemas.catalog import (
    CategoryRead,
    CategoryWithProductCount,
    InventoryRead,
    PaginatedProductRead,
    ProductRead,
)
from backend.app.services.catalog_service import CatalogService

router = APIRouter()


@router.get("/categories", response_model=List[CategoryRead])
async def list_categories(
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all active produce categories ordered by display order."""
    return await CatalogService.get_active_categories(db)


@router.get("/categories/{slug}", response_model=CategoryWithProductCount)
async def get_category(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a single category by slug with active product count."""
    category = await CatalogService.get_category_by_slug(db, slug)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category '{slug}' not found",
        )
    return category


@router.get("/products", response_model=PaginatedProductRead)
async def list_products(
    category: Optional[str] = Query(None, description="Category slug or ID filter"),
    popular: Optional[bool] = Query(None, description="Filter for popular produce"),
    fresh: Optional[bool] = Query(None, description="Filter for fresh-today produce"),
    q: Optional[str] = Query(None, description="Text search on product name or description"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=500, description="Page size"),
    db: AsyncSession = Depends(get_db),
):
    """List catalog products with pagination, filtering, and eager-loaded variants."""
    items, total, has_next = await CatalogService.list_products(
        session=db,
        category=category,
        popular=popular,
        fresh=fresh,
        search=q,
        page=page,
        page_size=page_size,
    )
    return PaginatedProductRead(
        items=[ProductRead.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        has_next=has_next,
    )


@router.get("/products/featured", response_model=List[ProductRead])
async def get_featured_products(
    limit: int = Query(8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve featured products (popular or fresh today). Must be declared before /{slug}."""
    products = await CatalogService.get_featured_products(db, limit=limit)
    return [ProductRead.model_validate(p) for p in products]


@router.get("/products/{slug}", response_model=ProductRead)
async def get_product(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve product by slug with all active variants and inventory."""
    product = await CatalogService.get_product_by_slug(db, slug)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product '{slug}' not found",
        )
    return ProductRead.model_validate(product)


@router.get("/variants/{variant_id}/availability", response_model=InventoryRead)
async def get_variant_availability(
    variant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check live inventory and reservation status for a variant."""
    inventory = await CatalogService.get_variant_availability(db, variant_id)
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Variant inventory for '{variant_id}' not found",
        )
    return InventoryRead.model_validate(inventory)
