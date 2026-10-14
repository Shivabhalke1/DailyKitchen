from datetime import datetime, timedelta, timezone
from decimal import Decimal
import secrets
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


def _clamp_zero(expr):
    """Cross-database floor at zero (ANSI SQL compatible with PostgreSQL and SQLite)."""
    return case((expr > 0, expr), else_=0)

from backend.app.core.config import settings
from backend.app.models.cart import Cart, CartItem
from backend.app.models.catalog import (
    Inventory,
    InventoryReservation,
    Product,
    ProductVariant,
)
from backend.app.models.delivery import DeliverySlot
from backend.app.models.order import (
    Order,
    OrderAddress,
    OrderItem,
    OrderStatusHistory,
)
from backend.app.models.user import Address, User
from backend.app.schemas.order import OrderCreate, OrderRead
from backend.app.services.pricing import calculate_order_pricing


class OrderService:
    ALLOWED_TRANSITIONS = {
        "placed": ["confirmed", "cancelled"],
        "pending": ["confirmed", "cancelled"],
        "confirmed": ["out_for_delivery", "dispatched", "cancelled"],
        "out_for_delivery": ["delivered"],
        "dispatched": ["delivered"],
    }

    @staticmethod
    def generate_order_number() -> str:
        """Generate human-readable unique order number: DK-YYYYMMDD-HEX."""
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        rand_str = secrets.token_hex(4).upper()
        return f"DK-{date_str}-{rand_str}"

    @classmethod
    async def place_order(
        cls,
        session: AsyncSession,
        user: User,
        payload: OrderCreate,
    ) -> Order:
        """
        Transactional 11-step checkout pipeline:
        Executes inside an atomic transaction block. Any exception triggers complete rollback.
        """
        # Step 1: Validate Input
        # Address ownership check
        addr_stmt = select(Address).where(
            Address.id == payload.address_id,
            Address.user_id == user.id,
        )
        addr_res = await session.execute(addr_stmt)
        address = addr_res.scalar_one_or_none()
        if not address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Address '{payload.address_id}' not found",
            )

        # Slot existence check
        slot_stmt = select(DeliverySlot).where(
            DeliverySlot.id == payload.slot_id,
            DeliverySlot.is_active.is_(True),
        )
        slot_res = await session.execute(slot_stmt)
        slot = slot_res.scalar_one_or_none()
        if not slot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Delivery slot '{payload.slot_id}' not found or inactive",
            )
        if slot.current_orders >= slot.max_orders:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Delivery slot is fully booked",
            )

        # Step 2: Validate Cart
        cart_stmt = (
            select(Cart)
            .where(Cart.user_id == user.id, Cart.is_active.is_(True))
            .options(
                selectinload(Cart.items)
                .selectinload(CartItem.variant)
                .selectinload(ProductVariant.product),
                selectinload(Cart.items)
                .selectinload(CartItem.variant)
                .selectinload(ProductVariant.inventory),
            )
        )
        cart_res = await session.execute(cart_stmt)
        cart = cart_res.scalar_one_or_none()
        if not cart or not cart.items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shopping cart is empty",
            )

        # Validate variant availability
        for item in cart.items:
            if not item.variant or not item.variant.is_available:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Variant '{item.variant_id}' is no longer available",
                )

        # Step 3: Stock Check per Variant (FOR UPDATE lock)
        for item in cart.items:
            inv_stmt = (
                select(Inventory)
                .where(Inventory.variant_id == item.variant_id)
                .with_for_update()
            )
            inv_res = await session.execute(inv_stmt)
            inventory = inv_res.scalar_one_or_none()
            if not inventory:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Inventory record for variant '{item.variant_id}' not found",
                )
            available = inventory.stock_quantity - inventory.reserved_quantity
            if available < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Insufficient stock for variant '{item.variant_id}'. Available: {available}, requested: {item.quantity}",
                )

        # Step 4: Compute Order Totals
        subtotal = sum(
            (Decimal(str(item.variant.price)) * item.quantity for item in cart.items),
            Decimal("0.00"),
        )
        pricing = calculate_order_pricing(float(subtotal))
        subtotal_dec = Decimal(str(pricing["subtotal"]))
        delivery_fee_dec = Decimal(str(pricing["delivery_fee"]))
        packaging_fee_dec = Decimal(str(pricing["packaging_fee"]))
        total_amount_dec = Decimal(str(pricing["total"]))

        # Step 6: Create Order Record
        order = Order(
            order_number=cls.generate_order_number(),
            user_id=user.id,
            slot_id=slot.id,
            status="placed",
            subtotal=subtotal_dec,
            packaging_fee=packaging_fee_dec,
            delivery_fee=delivery_fee_dec,
            total_amount=total_amount_dec,
            payment_method=payload.payment_method,
            payment_status="pending",
            notes=payload.notes,
        )
        session.add(order)
        await session.flush()  # Generates order.id

        # Step 5: Create Immutable Snapshots
        order_addr = OrderAddress(
            order_id=order.id,
            source_address_id=address.id,
            full_name=address.full_name,
            phone=address.phone,
            house_flat=address.house_flat,
            street_area=address.street_area,
            landmark=address.landmark,
            city=address.city,
            state=address.state,
            pincode=address.pincode,
        )
        session.add(order_addr)

        now_utc = datetime.now(timezone.utc)
        expires_at = now_utc + timedelta(minutes=30)

        for item in cart.items:
            unit_price = Decimal(str(item.variant.price))
            mrp_snap = Decimal(str(item.variant.mrp))
            line_total = unit_price * item.quantity

            order_item = OrderItem(
                order_id=order.id,
                variant_id=item.variant_id,
                product_name_snap=item.variant.product.name,
                weight_label_snap=item.variant.weight_label,
                unit_price=unit_price,
                mrp_snap=mrp_snap,
                quantity=item.quantity,
                line_total=line_total,
            )
            session.add(order_item)

            # Step 7: Reserve Inventory per Variant
            reservation = InventoryReservation(
                variant_id=item.variant_id,
                cart_id=cart.id,
                order_id=order.id,
                quantity=item.quantity,
                status="active",
                expires_at=expires_at,
            )
            session.add(reservation)

            # Increment reserved_quantity
            inv_update = (
                update(Inventory)
                .where(Inventory.variant_id == item.variant_id)
                .values(reserved_quantity=Inventory.reserved_quantity + item.quantity)
            )
            await session.execute(inv_update)

        # Step 8: Book Delivery Slot (conditional update for concurrency protection)
        slot_update = (
            update(DeliverySlot)
            .where(
                DeliverySlot.id == slot.id,
                DeliverySlot.current_orders < DeliverySlot.max_orders,
            )
            .values(current_orders=DeliverySlot.current_orders + 1)
        )
        slot_update_res = await session.execute(slot_update)
        if slot_update_res.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Delivery slot capacity was reached during checkout",
            )

        # Step 9: Deactivate Cart
        cart.is_active = False

        # Step 10: Record Status History
        history = OrderStatusHistory(
            order_id=order.id,
            from_status=None,
            to_status="placed",
            comment="Order placed",
            changed_by_user_id=user.id,
        )
        session.add(history)

        # Step 11: Commit and Return
        await session.commit()

        # Reload complete order with all relationships
        return await cls.get_order(session, user.id, order.id)

    @classmethod
    async def get_order(
        cls,
        session: AsyncSession,
        user_id: str,
        order_id: str,
    ) -> Order:
        """Fetch single order by ID with ownership verification (404 on mismatch)."""
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.address_snapshot),
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.status_history),
            )
        )
        res = await session.execute(stmt)
        order = res.scalar_one_or_none()
        if not order or order.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found",
            )
        return order

    @classmethod
    async def get_order_by_id(
        cls,
        session: AsyncSession,
        order_id: str,
    ) -> Optional[Order]:
        """Internal/Admin: Fetch order by ID without ownership restriction."""
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.address_snapshot),
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.status_history),
            )
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    @classmethod
    async def list_orders(
        cls,
        session: AsyncSession,
        user_id: str,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Order], int, bool]:
        """List current user's orders, newest first."""
        base_query = (
            select(Order)
            .where(Order.user_id == user_id)
            .options(
                selectinload(Order.address_snapshot),
                selectinload(Order.items),
                selectinload(Order.payments),
            )
        )
        if status_filter:
            base_query = base_query.where(Order.status == status_filter)

        count_stmt = select(func.count(Order.id)).where(Order.user_id == user_id)
        if status_filter:
            count_stmt = count_stmt.where(Order.status == status_filter)
        count_res = await session.execute(count_stmt)
        total = count_res.scalar_one() or 0

        offset = max(0, (page - 1) * page_size)
        paginated_query = (
            base_query.order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        res = await session.execute(paginated_query)
        items = list(res.scalars().all())
        has_next = (offset + len(items)) < total
        return items, total, has_next

    @classmethod
    async def _release_inventory(cls, session: AsyncSession, order_id: str) -> None:
        """Internal: Release inventory holds for an order."""
        res_stmt = select(InventoryReservation).where(
            InventoryReservation.order_id == order_id,
            InventoryReservation.status == "active",
        )
        res_list = list((await session.execute(res_stmt)).scalars().all())

        for reservation in res_list:
            reservation.status = "released"
            inv_update = (
                update(Inventory)
                .where(Inventory.variant_id == reservation.variant_id)
                .values(
                    reserved_quantity=_clamp_zero(
                        Inventory.reserved_quantity - reservation.quantity
                    )
                )
            )
            await session.execute(inv_update)

    @classmethod
    async def cancel_order(
        cls,
        session: AsyncSession,
        user_id: str,
        order_id: str,
        reason: str,
    ) -> Order:
        """Customer cancels pending or confirmed order."""
        order = await cls.get_order(session, user_id, order_id)

        if order.status not in ("placed", "pending", "confirmed"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel order with status '{order.status}'. Only placed, pending or confirmed orders can be cancelled.",
            )

        prev_status = order.status
        order.status = "cancelled"
        order.cancellation_reason = reason

        # Release inventory holds
        await cls._release_inventory(session, order.id)

        # Release delivery slot capacity
        slot_update = (
            update(DeliverySlot)
            .where(DeliverySlot.id == order.slot_id)
            .values(
                current_orders=_clamp_zero(DeliverySlot.current_orders - 1)
            )
        )
        await session.execute(slot_update)

        # Record audit history
        history = OrderStatusHistory(
            order_id=order.id,
            from_status=prev_status,
            to_status="cancelled",
            comment=f"Customer cancelled: {reason}",
            changed_by_user_id=user_id,
        )
        session.add(history)

        await session.commit()
        return await cls.get_order(session, user_id, order.id)

    @classmethod
    async def admin_update_status(
        cls,
        session: AsyncSession,
        order_id: str,
        new_status: str,
        note: Optional[str] = None,
        admin_user_id: Optional[str] = None,
    ) -> Order:
        """Admin transitions order status following strict lifecycle rules."""
        order = await cls.get_order_by_id(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found",
            )

        prev_status = order.status
        allowed = cls.ALLOWED_TRANSITIONS.get(prev_status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot transition order from '{prev_status}' to '{new_status}'. Allowed transitions: {allowed}",
            )

        order.status = "out_for_delivery" if new_status == "dispatched" else new_status
        if new_status == "cancelled":
            order.cancellation_reason = note or "Cancelled by admin"
            await cls._release_inventory(session, order.id)
            slot_update = (
                update(DeliverySlot)
                .where(DeliverySlot.id == order.slot_id)
                .values(
                    current_orders=_clamp_zero(DeliverySlot.current_orders - 1)
                )
            )
            await session.execute(slot_update)
        elif new_status == "delivered":
            # Consume reservations and reduce actual stock
            res_stmt = select(InventoryReservation).where(
                InventoryReservation.order_id == order.id,
                InventoryReservation.status == "active",
            )
            res_list = list((await session.execute(res_stmt)).scalars().all())
            for reservation in res_list:
                reservation.status = "consumed"
                inv_update = (
                    update(Inventory)
                    .where(Inventory.variant_id == reservation.variant_id)
                    .values(
                        stock_quantity=_clamp_zero(
                            Inventory.stock_quantity - reservation.quantity
                        ),
                        reserved_quantity=_clamp_zero(
                            Inventory.reserved_quantity - reservation.quantity
                        ),
                    )
                )
                await session.execute(inv_update)

        history = OrderStatusHistory(
            order_id=order.id,
            from_status=prev_status,
            to_status=new_status,
            comment=note or f"Status changed to {new_status}",
            changed_by_user_id=admin_user_id,
        )
        session.add(history)
        await session.commit()

        return await cls.get_order_by_id(session, order.id)
