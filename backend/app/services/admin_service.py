from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.catalog import Inventory, InventoryReservation, Product, ProductVariant
from backend.app.models.delivery import DeliverySlot, DeliveryZone
from backend.app.models.order import Order, Payment
from backend.app.models.session import UserSession
from backend.app.models.user import User, Profile, Address
from backend.app.schemas.admin import DashboardMetricsRead, SlotUpdate


class AdminService:
    """Service providing authoritative operations metrics and backoffice management workflows."""

    @classmethod
    async def get_dashboard_metrics(
        cls,
        session: AsyncSession,
        target_date: Optional[date] = None,
    ) -> DashboardMetricsRead:
        """
        Computes authoritative operational metrics for a specific target date.
        - Total orders and status breakdown
        - Authoritative revenue (strictly excluding cancelled orders)
        - Inventory stock exhaustion and low-stock alerts
        - Slot capacity saturation
        """
        report_date = target_date or datetime.now(timezone.utc).date()
        start_dt = datetime.combine(report_date, time.min).replace(tzinfo=timezone.utc)
        end_dt = datetime.combine(report_date, time.max).replace(tzinfo=timezone.utc)

        # 1. Orders for target date
        orders_stmt = (
            select(Order)
            .where(Order.created_at >= start_dt, Order.created_at <= end_dt)
        )
        orders_res = await session.execute(orders_stmt)
        orders_today = list(orders_res.scalars().all())

        total_orders_today = len(orders_today)

        # Status categorization
        status_counts = {
            "placed": 0,
            "confirmed": 0,
            "out_for_delivery": 0,
            "dispatched": 0,
            "delivered": 0,
            "cancelled": 0,
        }
        revenue_today = Decimal("0.00")

        for o in orders_today:
            norm_status = "out_for_delivery" if o.status == "dispatched" else o.status
            if norm_status in status_counts:
                status_counts[norm_status] += 1
            else:
                status_counts[norm_status] = 1

            # Revenue strictly excludes cancelled orders
            if o.status != "cancelled":
                revenue_today += Decimal(str(o.total_amount))

        # 2. Inventory Health
        inv_stmt = select(Inventory)
        inv_res = await session.execute(inv_stmt)
        all_inv = list(inv_res.scalars().all())

        low_stock_count = 0
        out_of_stock_count = 0

        for inv in all_inv:
            net_available = inv.stock_quantity - inv.reserved_quantity
            if net_available <= 0 or inv.stock_quantity == 0:
                out_of_stock_count += 1
            elif inv.stock_quantity <= inv.low_stock_threshold:
                low_stock_count += 1

        # 3. Slot Utilization for Target Date
        slots_stmt = select(DeliverySlot).where(DeliverySlot.slot_date == report_date)
        slots_res = await session.execute(slots_stmt)
        slots_today = list(slots_res.scalars().all())

        active_slots_count = sum(1 for s in slots_today if s.is_active)
        slot_capacity_total = sum(s.max_orders for s in slots_today if s.is_active)
        slot_capacity_booked = sum(s.current_orders for s in slots_today if s.is_active)

        slot_utilization_percent = (
            round((slot_capacity_booked / slot_capacity_total) * 100, 1)
            if slot_capacity_total > 0
            else 0.0
        )

        # 4. Recent Orders (newest 10 requiring attention)
        recent_stmt = (
            select(Order)
            .order_by(Order.created_at.desc())
            .limit(10)
            .options(
                selectinload(Order.address_snapshot),
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.status_history),
            )
        )
        recent_res = await session.execute(recent_stmt)
        recent_orders = list(recent_res.scalars().all())

        return DashboardMetricsRead(
            date=report_date,
            total_orders_today=total_orders_today,
            orders_by_status=status_counts,
            revenue_today=revenue_today,
            low_stock_variants_count=low_stock_count,
            out_of_stock_variants_count=out_of_stock_count,
            active_slots_count=active_slots_count,
            slot_capacity_total=slot_capacity_total,
            slot_capacity_booked=slot_capacity_booked,
            slot_utilization_percent=slot_utilization_percent,
            recent_orders=recent_orders,
        )

    @classmethod
    async def list_all_orders(
        cls,
        session: AsyncSession,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Order], int, bool]:
        """
        Admin: List orders across all customers with full snapshot details and pagination.
        """
        base_query = (
            select(Order)
            .options(
                selectinload(Order.address_snapshot),
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.status_history),
            )
        )

        if status_filter:
            if status_filter == "dispatched":
                base_query = base_query.where(Order.status.in_(["dispatched", "out_for_delivery"]))
            else:
                base_query = base_query.where(Order.status == status_filter)

        # Count total
        count_query = select(func.count()).select_from(base_query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        # Paginate
        offset = (page - 1) * page_size
        paginated_query = (
            base_query.order_by(Order.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        items = list((await session.execute(paginated_query)).scalars().all())
        has_next = (offset + len(items)) < total

        return items, total, has_next

    @classmethod
    async def get_admin_order(
        cls,
        session: AsyncSession,
        order_id: str,
    ) -> Order:
        """
        Admin: Fetch single order by ID with all snapshots, without ownership restriction.
        """
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
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found",
            )
        return order

    @classmethod
    async def list_all_slots(
        cls,
        session: AsyncSession,
        zone_id: Optional[str] = None,
        slot_date: Optional[date] = None,
    ) -> List[DeliverySlot]:
        """
        Admin: List delivery slots across all capacity and active states.
        """
        stmt = (
            select(DeliverySlot)
            .options(selectinload(DeliverySlot.zone))
            .order_by(DeliverySlot.slot_date.asc(), DeliverySlot.start_time.asc())
        )
        if zone_id:
            stmt = stmt.where(DeliverySlot.zone_id == zone_id)
        if slot_date:
            stmt = stmt.where(DeliverySlot.slot_date == slot_date)

        res = await session.execute(stmt)
        return list(res.scalars().all())

    @classmethod
    async def update_slot(
        cls,
        session: AsyncSession,
        slot_id: str,
        payload: SlotUpdate,
    ) -> DeliverySlot:
        """
        Admin: Update delivery slot active state or capacity.
        Ensures max_orders cannot be reduced below already-booked orders.
        """
        stmt = select(DeliverySlot).where(DeliverySlot.id == slot_id)
        res = await session.execute(stmt)
        slot = res.scalar_one_or_none()
        if not slot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Delivery slot '{slot_id}' not found",
            )

        if payload.max_orders is not None:
            if payload.max_orders < slot.current_orders:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Cannot reduce max_orders ({payload.max_orders}) below currently booked orders ({slot.current_orders})",
                )
            slot.max_orders = payload.max_orders

        if payload.is_active is not None:
            slot.is_active = payload.is_active

        await session.commit()
        await session.refresh(slot)
        return slot

    @classmethod
    async def list_customers(
        cls,
        session: AsyncSession,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[dict], int]:
        """
        Admin: List customer directory with lifetime statistics.
        Searchable by phone, email, full_name, or customer_code (DKC-XXXXXXXX).
        Financial metrics:
        - total_orders: status != 'cancelled'
        - total_spend: status == 'delivered' AND payment_status != 'refunded'
        """
        base_query = (
            select(User)
            .outerjoin(Profile, User.id == Profile.user_id)
            .where(User.role == "customer")
            .options(selectinload(User.profile))
        )

        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            code_search = search.strip().upper()
            base_query = base_query.where(
                (User.phone.ilike(s))
                | (User.email.ilike(s))
                | (User.customer_code.ilike(f"%{code_search}%"))
                | (Profile.full_name.ilike(s))
            )

        # Count total
        count_query = select(func.count()).select_from(base_query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        offset = (page - 1) * page_size
        paginated_query = (
            base_query.order_by(User.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        users = list((await session.execute(paginated_query)).scalars().all())

        items = []
        for u in users:
            # Query lifetime metrics for this customer
            orders_stmt = select(Order.status, Order.payment_status, Order.total_amount).where(Order.user_id == u.id)
            orders_res = (await session.execute(orders_stmt)).all()

            total_orders = sum(1 for o in orders_res if o[0] != "cancelled")
            total_spend = sum(
                Decimal(str(o[2])) for o in orders_res if o[0] == "delivered" and o[1] != "refunded"
            )

            items.append({
                "id": u.id,
                "customer_code": u.customer_code,
                "phone": u.phone,
                "email": u.email,
                "full_name": u.profile.full_name if u.profile else None,
                "is_active": u.is_active,
                "total_orders": total_orders,
                "total_spend": total_spend,
                "created_at": u.created_at,
            })

        return items, total

    @classmethod
    async def get_customer_detail(
        cls,
        session: AsyncSession,
        customer_id: str,
    ) -> dict:
        """
        Admin: Fetch single customer with lifetime metrics and historical orders with immutable snapshots.
        """
        stmt = (
            select(User)
            .where((User.id == customer_id) | (User.customer_code == customer_id.upper()))
            .options(
                selectinload(User.profile),
                selectinload(User.addresses),
            )
        )
        user = (await session.execute(stmt)).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer '{customer_id}' not found",
            )

        # Query all orders for customer with immutable snapshots
        orders_stmt = (
            select(Order)
            .where(Order.user_id == user.id)
            .order_by(Order.created_at.desc())
            .options(
                selectinload(Order.address_snapshot),
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.status_history),
            )
        )
        orders = list((await session.execute(orders_stmt)).scalars().all())

        total_orders = sum(1 for o in orders if o.status != "cancelled")
        total_spend = sum(
            Decimal(str(o.total_amount)) for o in orders if o.status == "delivered" and o.payment_status != "refunded"
        )

        return {
            "id": user.id,
            "customer_code": user.customer_code,
            "phone": user.phone,
            "email": user.email,
            "full_name": user.profile.full_name if user.profile else None,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "total_orders": total_orders,
            "total_spend": total_spend,
            "orders": orders,
            "addresses": user.addresses or [],
        }

    @classmethod
    async def delete_customer(
        cls,
        session: AsyncSession,
        customer_id: str,
        hard_delete: bool = False,
    ) -> Tuple[str, str]:
        """
        Deletes or deactivates a customer account.
        - Strictly prevents deleting administrators.
        - If hard_delete=False:
          - Validates in-flight orders ('placed', 'confirmed', 'packed', 'dispatched', 'out_for_delivery').
          - If historical orders exist: deactivates user (is_active=False) and revokes all active sessions.
          - If no orders exist: hard deletes the user and cascaded records.
        - If hard_delete=True (force purge):
          - Cleans up child payments, inventory reservations, orders, sessions, and permanently removes the user.
        """
        user_stmt = select(User).where(User.id == customer_id)
        user = (await session.execute(user_stmt)).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID '{customer_id}' was not found.",
            )

        if user.role != "customer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator and staff accounts cannot be deleted through customer management.",
            )

        orders_stmt = select(Order).where(Order.user_id == customer_id)
        orders = list((await session.execute(orders_stmt)).scalars().all())

        if hard_delete:
            # Force purge: remove reservations, payments, and orders first
            for order in orders:
                await session.execute(
                    delete(InventoryReservation).where(InventoryReservation.order_id == order.id)
                )
                await session.execute(
                    delete(Payment).where(Payment.order_id == order.id)
                )
                await session.delete(order)

            await session.execute(
                delete(UserSession).where(UserSession.user_id == customer_id)
            )
            await session.delete(user)
            await session.commit()
            return "deleted", f"Customer {user.customer_code or user.phone} and all associated data permanently deleted."

        # Non-hard delete
        in_flight = [o for o in orders if o.status in ("placed", "confirmed", "packed", "dispatched", "out_for_delivery")]
        if in_flight:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Cannot delete customer with {len(in_flight)} in-flight active order(s). Please complete or cancel orders first, or use force delete.",
            )

        if len(orders) > 0:
            # Preserve legal financial audit history, deactivate account
            user.is_active = False
            await session.execute(
                update(UserSession).where(UserSession.user_id == customer_id).values(is_revoked=True)
            )
            await session.commit()
            return "deactivated", f"Customer account {user.customer_code or user.phone} deactivated and sessions revoked ({len(orders)} historical orders preserved for audit)."

        # No orders exist: hard delete
        await session.execute(
            delete(UserSession).where(UserSession.user_id == customer_id)
        )
        await session.delete(user)
        await session.commit()
        return "deleted", f"Customer {user.customer_code or user.phone} permanently deleted from database."

