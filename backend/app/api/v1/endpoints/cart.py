from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.user import User
from backend.app.schemas.cart import (
    CartItemCreate,
    CartItemUpdate,
    CartReadWithPricing,
)
from backend.app.services.cart_service import CartService

router = APIRouter()


@router.get("", response_model=CartReadWithPricing)
async def get_cart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve the authenticated customer's shopping cart with computed pricing."""
    cart = await CartService.get_or_create_cart(db, current_user.id)
    return await CartService.get_cart_response(db, cart)


@router.post("/items", response_model=CartReadWithPricing)
async def add_cart_item(
    payload: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a variant to the cart or increment quantity if already present."""
    cart = await CartService.get_or_create_cart(db, current_user.id)
    return await CartService.add_item(
        session=db,
        cart=cart,
        variant_id=payload.variant_id,
        quantity=payload.quantity,
    )


@router.patch("/items/{item_id}", response_model=CartReadWithPricing)
async def update_cart_item(
    item_id: str,
    payload: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update quantity of an existing line item in the customer's cart."""
    cart = await CartService.get_or_create_cart(db, current_user.id)
    return await CartService.update_item(
        session=db,
        cart=cart,
        item_id=item_id,
        quantity=payload.quantity,
    )


@router.delete("/items/{item_id}", response_model=CartReadWithPricing)
async def remove_cart_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a line item from the customer's cart."""
    cart = await CartService.get_or_create_cart(db, current_user.id)
    return await CartService.remove_item(
        session=db,
        cart=cart,
        item_id=item_id,
    )


@router.delete("", response_model=dict)
async def clear_cart(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all items from the customer's cart, keeping the cart entity."""
    cart = await CartService.get_or_create_cart(db, current_user.id)
    return await CartService.clear_cart(db, cart)
