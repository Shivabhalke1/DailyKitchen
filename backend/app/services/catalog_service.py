from typing import List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.catalog import Category, Inventory, Product, ProductVariant
from backend.app.schemas.catalog import CategoryWithProductCount


class CatalogService:
    @staticmethod
    async def get_active_categories(session: AsyncSession) -> List[Category]:
        """Fetch all active categories ordered by display_order ascending."""
        stmt = (
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.display_order.asc(), Category.name.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_category_by_slug(
        session: AsyncSession, slug: str
    ) -> Optional[CategoryWithProductCount]:
        """Fetch a single active category by slug along with its active product count."""
        stmt = select(Category).where(
            Category.slug == slug,
            Category.is_active.is_(True),
        )
        result = await session.execute(stmt)
        category = result.scalar_one_or_none()
        if not category:
            return None

        # Count active products
        count_stmt = select(func.count(Product.id)).where(
            Product.category_id == category.id,
            Product.is_active.is_(True),
        )
        count_res = await session.execute(count_stmt)
        product_count = count_res.scalar_one() or 0

        return CategoryWithProductCount(
            id=category.id,
            name=category.name,
            slug=category.slug,
            description=category.description,
            image_url=category.image_url,
            display_order=category.display_order,
            is_active=category.is_active,
            product_count=product_count,
        )

    @staticmethod
    async def list_products(
        session: AsyncSession,
        category: Optional[str] = None,
        popular: Optional[bool] = None,
        fresh: Optional[bool] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Product], int, bool]:
        """Paginated list of active products with optional filters."""
        base_query = (
            select(Product)
            .where(Product.is_active.is_(True))
            .options(
                selectinload(Product.variants).selectinload(ProductVariant.inventory)
            )
        )

        filters = []
        if category:
            # Match category slug or id
            cat_subquery = select(Category.id).where(
                or_(Category.slug == category, Category.id == category)
            )
            filters.append(Product.category_id.in_(cat_subquery))

        if popular is not None:
            filters.append(Product.is_popular.is_(popular))

        if fresh is not None:
            filters.append(Product.is_fresh_today.is_(fresh))

        if search and search.strip():
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Product.name.ilike(term),
                    Product.description.ilike(term),
                )
            )

        if filters:
            base_query = base_query.where(*filters)

        # Count total
        count_stmt = select(func.count(Product.id)).where(Product.is_active.is_(True))
        if filters:
            count_stmt = count_stmt.where(*filters)
        count_res = await session.execute(count_stmt)
        total = count_res.scalar_one() or 0

        # Pagination
        offset = max(0, (page - 1) * page_size)
        paginated_query = (
            base_query.order_by(Product.name.asc())
            .offset(offset)
            .limit(page_size)
        )

        result = await session.execute(paginated_query)
        items = list(result.scalars().all())

        has_next = (offset + len(items)) < total
        return items, total, has_next

    @staticmethod
    async def get_featured_products(
        session: AsyncSession, limit: int = 8
    ) -> List[Product]:
        """Fetch featured products (is_popular or is_fresh_today) up to limit."""
        stmt = (
            select(Product)
            .where(
                Product.is_active.is_(True),
                or_(Product.is_popular.is_(True), Product.is_fresh_today.is_(True)),
            )
            .options(
                selectinload(Product.variants).selectinload(ProductVariant.inventory)
            )
            .order_by(Product.is_popular.desc(), Product.is_fresh_today.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_product_by_slug(
        session: AsyncSession, slug: str
    ) -> Optional[Product]:
        """Fetch active product by slug with variants and inventory."""
        stmt = (
            select(Product)
            .where(
                Product.slug == slug,
                Product.is_active.is_(True),
            )
            .options(
                selectinload(Product.variants).selectinload(ProductVariant.inventory)
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_variant_availability(
        session: AsyncSession, variant_id: str
    ) -> Optional[Inventory]:
        """Fetch inventory availability for a variant."""
        # Ensure variant is active
        var_stmt = select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.is_available.is_(True),
        )
        var_res = await session.execute(var_stmt)
        variant = var_res.scalar_one_or_none()
        if not variant:
            return None

        inv_stmt = select(Inventory).where(Inventory.variant_id == variant_id)
        inv_res = await session.execute(inv_stmt)
        return inv_res.scalar_one_or_none()
