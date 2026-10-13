from decimal import Decimal
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.cart import Cart, CartItem
from backend.app.models.catalog import Inventory, ProductVariant
from backend.app.schemas.cart import (
    CartItemRead,
    CartPricingSummary,
    CartReadWithPricing,
)
from backend.app.schemas.catalog import ProductVariantRead
from backend.app.services.pricing import calculate_order_pricing


class CartService:
    @staticmethod
    async def get_or_create_cart(session: AsyncSession, user_id: str) -> Cart:
        """Fetch active cart for user or create one if none exists."""
        stmt = select(Cart).where(Cart.user_id == user_id, Cart.is_active.is_(True))
        result = await session.execute(stmt)
        cart = result.scalar_one_or_none()

        if not cart:
            cart = Cart(user_id=user_id, is_active=True)
            session.add(cart)
            await session.commit()
            result = await session.execute(stmt)
            cart = result.scalar_one()

        return cart

    @classmethod
    async def get_cart_response(
        cls, session: AsyncSession, cart: Cart
    ) -> CartReadWithPricing:
        """Fetch fresh items for cart and compute authoritative pricing."""
        items_stmt = (
            select(CartItem)
            .where(CartItem.cart_id == cart.id)
            .options(
                selectinload(CartItem.variant).selectinload(ProductVariant.inventory),
                selectinload(CartItem.variant).selectinload(ProductVariant.product),
            )
        )
        items_res = await session.execute(items_stmt)
        items = list(items_res.scalars().all())

        subtotal = sum(
            (
                Decimal(str(item.variant.price)) * item.quantity
                for item in items
                if item.variant
            ),
            Decimal("0.00"),
        )
        pricing_dict = calculate_order_pricing(float(subtotal))
        pricing = CartPricingSummary(
            subtotal=Decimal(str(pricing_dict["subtotal"])),
            delivery_fee=Decimal(str(pricing_dict["delivery_fee"])),
            packaging_fee=Decimal(str(pricing_dict["packaging_fee"])),
            total=Decimal(str(pricing_dict["total"])),
            is_free_delivery=pricing_dict["is_free_delivery_eligible"],
        )

        item_reads = []
        for item in items:
            variant_read = (
                ProductVariantRead.model_validate(item.variant)
                if item.variant
                else None
            )
            item_reads.append(
                CartItemRead(
                    id=item.id,
                    cart_id=item.cart_id,
                    variant_id=item.variant_id,
                    quantity=item.quantity,
                    variant=variant_read,
                )
            )

        item_count = sum(item.quantity for item in items)
        return CartReadWithPricing(
            id=cart.id,
            user_id=cart.user_id,
            guest_token_hash=cart.guest_token_hash,
            is_active=cart.is_active,
            items=item_reads,
            subtotal=pricing.subtotal,
            item_count=item_count,
            pricing=pricing,
        )

    @classmethod
    async def add_item(
        cls,
        session: AsyncSession,
        cart: Cart,
        variant_id: str,
        quantity: int,
    ) -> CartReadWithPricing:
        """Add item to cart or increment quantity if already present (upsert)."""
        # Validate variant and availability
        v_stmt = (
            select(ProductVariant)
            .where(ProductVariant.id == variant_id)
            .options(selectinload(ProductVariant.inventory))
        )
        v_res = await session.execute(v_stmt)
        variant = v_res.scalar_one_or_none()

        if not variant or not variant.is_available:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Variant '{variant_id}' is unavailable or does not exist",
            )

        inv = variant.inventory
        available_stock = (inv.stock_quantity - inv.reserved_quantity) if inv else 0

        # Check existing item
        item_stmt = select(CartItem).where(
            CartItem.cart_id == cart.id, CartItem.variant_id == variant_id
        )
        existing_item = (await session.execute(item_stmt)).scalar_one_or_none()

        if existing_item:
            target_quantity = existing_item.quantity + quantity
            if target_quantity > 20:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Item quantity cannot exceed 20",
                )
            if target_quantity > available_stock:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Insufficient stock for variant '{variant_id}'. Available: {available_stock}",
                )
            existing_item.quantity = target_quantity
        else:
            if quantity > available_stock:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Insufficient stock for variant '{variant_id}'. Available: {available_stock}",
                )
            new_item = CartItem(
                cart_id=cart.id,
                variant_id=variant_id,
                quantity=quantity,
            )
            session.add(new_item)

        await session.commit()
        return await cls.get_cart_response(session, cart)

    @classmethod
    async def update_item(
        cls,
        session: AsyncSession,
        cart: Cart,
        item_id: str,
        quantity: int,
    ) -> CartReadWithPricing:
        """Update quantity of an existing line item in user's cart."""
        item_stmt = (
            select(CartItem)
            .where(CartItem.id == item_id, CartItem.cart_id == cart.id)
            .options(
                selectinload(CartItem.variant).selectinload(ProductVariant.inventory)
            )
        )
        item = (await session.execute(item_stmt)).scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart item not found in current cart",
            )

        variant = item.variant
        if not variant or not variant.is_available:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Variant is no longer available",
            )

        inv = variant.inventory
        available_stock = (inv.stock_quantity - inv.reserved_quantity) if inv else 0
        if quantity > available_stock:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Insufficient stock. Available: {available_stock}",
            )

        item.quantity = quantity
        await session.commit()
        return await cls.get_cart_response(session, cart)

    @classmethod
    async def remove_item(
        cls,
        session: AsyncSession,
        cart: Cart,
        item_id: str,
    ) -> CartReadWithPricing:
        """Remove line item from user's cart."""
        item_stmt = select(CartItem).where(
            CartItem.id == item_id, CartItem.cart_id == cart.id
        )
        item = (await session.execute(item_stmt)).scalar_one_or_none()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cart item not found in current cart",
            )

        await session.delete(item)
        await session.commit()
        return await cls.get_cart_response(session, cart)

    @classmethod
    async def clear_cart(
        cls,
        session: AsyncSession,
        cart: Cart,
    ) -> dict:
        """Remove all items from the cart, retaining the cart entity."""
        await session.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
        await session.commit()
        return {"message": "Cart cleared successfully"}
