# Phase 4 — Catalog, Cart, Delivery & Order Management Backend

**Product Name:** DailyKitchen
**Document:** Phase 4 Detailed Implementation Plan
**Depends On:** Phase 3 Complete & Verified (`docs/audits/phase-3-verification.md`)
**Date:** October 12, 2026
**Status:** Implementation Ready

---

## 1. Objectives & Executive Summary

Phase 4 activates the **business logic layer** of DailyKitchen by exposing the data models built in Phase 2 as fully functional, authenticated REST APIs. By the end of this phase:

1. **Catalog API** — Public browsing of categories, products, variants and real-time stock availability.
2. **Cart API** — Authenticated shopping cart with item management, pricing computation (subtotal, packaging fee, delivery fee) and inventory availability checks.
3. **Delivery API** — Zone pincode lookup, available slot listing with capacity status, and slot availability checking.
4. **Order API** — Authenticated checkout with immutable address/item snapshots, slot booking, inventory reservation, and order lifecycle management (place → confirm → dispatch → deliver → complete/cancel).
5. **Payment API** — Mock payment intent, webhook stub for payment gateway callbacks, refund workflow, and idempotency enforcement.
6. **Admin API** — Inventory adjustment, product & category management, order status transitions, and catalog seeding endpoint (admin-only, guarded by `get_current_active_admin` dependency).
7. **Contract Sync** — Re-export OpenAPI schema and regenerate `@dailykitchen/contracts` TypeScript types.
8. **Test Suite** — Automated Pytest suite for all Phase 4 endpoints (≥ 30 new tests).
9. **Verification Audit** — `docs/audits/phase-4-verification.md` with test run evidence.

> **Git Governance:** Do NOT commit, push, or rewrite Git history at any point during Phase 4.

---

## 2. What is Already Built (Do Not Re-Implement)

| Artifact | Location | Status |
| :--- | :--- | :--- |
| `Category`, `Product`, `ProductVariant`, `Inventory`, `InventoryReservation` models | `backend/app/models/catalog.py` | **Done (Phase 2)** |
| `Cart`, `CartItem` models | `backend/app/models/cart.py` | **Done (Phase 2)** |
| `DeliveryZone`, `DeliverySlot` models | `backend/app/models/delivery.py` | **Done (Phase 2)** |
| `Order`, `OrderAddress`, `OrderItem`, `Payment`, `OrderStatusHistory` models | `backend/app/models/order.py` | **Done (Phase 2)** |
| `CategoryRead`, `ProductRead`, `ProductVariantRead`, `InventoryRead` schemas | `backend/app/schemas/catalog.py` | **Done (Phase 2)** |
| `CartRead`, `CartItemRead`, `CartItemCreate`, `CartItemUpdate` schemas | `backend/app/schemas/cart.py` | **Done (Phase 2)** |
| `DeliveryZoneRead`, `DeliverySlotRead` schemas | `backend/app/schemas/delivery.py` | **Done (Phase 2)** |
| `OrderCreate`, `OrderRead`, `OrderItemRead`, `OrderAddressRead`, `PaymentRead`, `PaymentIntentCreate` schemas | `backend/app/schemas/order.py` | **Done (Phase 2)** |
| `get_current_user`, `get_current_active_admin`, `get_optional_user` dependencies | `backend/app/api/deps.py` | **Done (Phase 3)** |
| Seed data (4 categories, 9 products, 13 variants, 20 delivery slots) | `backend/app/db/seed.py` | **Done (Phase 2)** |
| `PACKAGING_FEE`, `STANDARD_DELIVERY_FEE`, `FREE_DELIVERY_THRESHOLD` config constants | `backend/app/core/config.py` | **Done (Phase 2)** |

---

## 3. New Files to Create in Phase 4

```text
backend/app/
├── services/
│   ├── catalog_service.py       # Query helpers: products by category, slug, search, availability
│   ├── cart_service.py          # Cart load, add/update/remove item, subtotal computation, clear
│   ├── delivery_service.py      # Zone pincode lookup, slot listing, availability check
│   ├── order_service.py         # Checkout pipeline: snapshot, slot booking, inventory hold, order creation
│   └── payment_service.py       # Payment intent, webhook verification, refund workflow
│
├── api/v1/endpoints/
│   ├── catalog.py               # GET /catalog/categories, GET /catalog/products, etc.
│   ├── cart.py                  # GET/POST/PATCH/DELETE /cart/...
│   ├── delivery.py              # GET /delivery/zones, GET /delivery/slots
│   ├── orders.py                # POST/GET /orders/...
│   ├── payments.py              # POST /payments/intent, POST /payments/webhook
│   └── admin/
│       ├── __init__.py
│       ├── catalog_admin.py     # Admin-only product/category/inventory management
│       └── orders_admin.py      # Admin order status transitions
│
├── schemas/
│   ├── catalog.py               # Extend: pagination, search, admin write schemas
│   ├── cart.py                  # Extend: CartPricingSummary, CartReadWithPricing
│   ├── delivery.py              # Extend: ZoneCheckResponse
│   └── order.py                 # Extend: OrderStatusUpdate, RefundRequest, PaginatedOrderRead
│
└── api/v1/api.py                # Mount all new routers

backend/tests/
├── test_catalog.py
├── test_cart.py
├── test_delivery.py
├── test_orders.py
└── test_payments.py

docs/audits/
└── phase-4-verification.md
```

---

## 4. API Endpoints Specification

### 4.1 Catalog API (`/api/v1/catalog/`)

| Method | Path | Auth | Response | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/catalog/categories` | Public | `List[CategoryRead]` | All active categories ordered by `display_order`. |
| `GET` | `/catalog/categories/{slug}` | Public | `CategoryWithProductCount` | Single category by slug with active product count. |
| `GET` | `/catalog/products` | Public | `PaginatedProductRead` | Filtered + paginated. Query params: `?category=`, `?popular=`, `?fresh=`, `?q=`, `?page=`, `?page_size=` |
| `GET` | `/catalog/products/featured` | Public | `List[ProductRead]` | Popular + fresh-today products (max 8). **Register before `/{slug}` route.** |
| `GET` | `/catalog/products/{slug}` | Public | `ProductRead` | Single product with active variants + live inventory. |
| `GET` | `/catalog/variants/{variant_id}/availability` | Public | `InventoryRead` | Real-time stock and reservation status. |

### 4.2 Cart API (`/api/v1/cart/`)

| Method | Path | Auth | Request | Response | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `GET` | `/cart` | Bearer | — | `CartReadWithPricing` | Customer cart with items, variant details, and computed pricing. |
| `POST` | `/cart/items` | Bearer | `CartItemCreate` | `CartReadWithPricing` | Add variant (upsert). Validates `is_available` and available stock. |
| `PATCH` | `/cart/items/{item_id}` | Bearer | `CartItemUpdate` | `CartReadWithPricing` | Update quantity. Validates stock. Returns 404 if not owned by current user. |
| `DELETE` | `/cart/items/{item_id}` | Bearer | — | `CartReadWithPricing` | Remove line item. Returns 404 if not owned. |
| `DELETE` | `/cart` | Bearer | — | `{ message: str }` | Clear all items (soft-clear: keeps cart entity). |

**Pricing rules (authoritative — config.py):**
- `subtotal` = Σ(variant.price × quantity)
- `delivery_fee` = `0.00` if `subtotal >= FREE_DELIVERY_THRESHOLD (₹99)` else `STANDARD_DELIVERY_FEE (₹40)`
- `packaging_fee` = `PACKAGING_FEE (₹10)` always
- `total` = `subtotal + delivery_fee + packaging_fee`

### 4.3 Delivery API (`/api/v1/delivery/`)

| Method | Path | Auth | Response | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/delivery/zones/check` | Public | `ZoneCheckResponse` | Query param `?pincode=`. Checks 6-digit pincode serviceability. |
| `GET` | `/delivery/zones` | Public | `List[DeliveryZoneRead]` | All active delivery zones. |
| `GET` | `/delivery/slots` | Public | `List[DeliverySlotRead]` | Available slots. Query: `?zone_id=`, `?date=`, `?slot_type=`. Excludes full slots. |

### 4.4 Orders API (`/api/v1/orders/`)

| Method | Path | Auth | Request | Response | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `POST` | `/orders` | Bearer | `OrderCreate` | `OrderRead` | Full 11-step transactional checkout (see Section 5). |
| `GET` | `/orders` | Bearer | — | `PaginatedOrderRead` | Customer's own orders, newest first. Query: `?status=`, `?page=`, `?page_size=` |
| `GET` | `/orders/{order_id}` | Bearer | — | `OrderRead` | Single order with snapshots. Ownership verified. |
| `POST` | `/orders/{order_id}/cancel` | Bearer | `OrderCancelRequest` | `OrderRead` | Cancel pending/confirmed order. 409 if dispatched/delivered. |

### 4.5 Payments API (`/api/v1/payments/`)

| Method | Path | Auth | Request | Response | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `POST` | `/payments/intent` | Bearer | `PaymentIntentCreate` | `PaymentRead` | Idempotent payment record creation (pending state). |
| `POST` | `/payments/webhook` | Signature | Raw body | `{ received: bool }` | HMAC-SHA256 verified gateway callback. Updates payment + order status. |
| `POST` | `/payments/{payment_id}/refund` | Admin | `RefundRequest` | `PaymentRead` | Admin refund. `refund_amount <= payment.amount`. |

### 4.6 Admin API (`/api/v1/admin/`) — all require `get_current_active_admin`

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/admin/catalog/categories` | Create category. |
| `PATCH` | `/admin/catalog/categories/{id}` | Update category. |
| `POST` | `/admin/catalog/products` | Create product. |
| `PATCH` | `/admin/catalog/products/{id}` | Update product. |
| `POST` | `/admin/catalog/products/{id}/variants` | Add variant to product. |
| `PATCH` | `/admin/catalog/variants/{id}` | Update variant pricing/availability. |
| `PUT` | `/admin/catalog/variants/{id}/inventory` | Adjust stock via delta (not overwrite). |
| `POST` | `/admin/delivery/zones` | Create delivery zone. |
| `POST` | `/admin/delivery/slots` | Bulk-create slots for zone+date. |
| `PATCH` | `/admin/orders/{order_id}/status` | Transition order status (admin-only). |
| `POST` | `/admin/seed` | Re-seed catalog+slots. Dev/test only — 403 in production. |

---

## 5. Checkout Pipeline (Order Creation — Transactional)

All 11 steps execute inside a **single** `async with session.begin()` block. Any exception triggers a full rollback.

```
Step 1: Validate Input
  ├── Address belongs to current_user                      → 404 if not owned
  ├── Delivery slot exists and is_active = True            → 404 if missing
  └── Slot capacity: current_orders < max_orders           → 409 if full

Step 2: Validate Cart
  ├── Cart has ≥ 1 item                                    → 400 if empty
  └── All variants: is_available = True                    → 422 if any unavailable

Step 3: Stock Check per Variant (SELECT ... WITH FOR UPDATE)
  └── For each CartItem:
        available = stock_quantity - reserved_quantity
        available >= item.quantity                         → 422 listing short items

Step 4: Compute Order Totals
  ├── subtotal = Σ(variant.price × item.quantity)
  ├── delivery_fee = 0 if subtotal >= FREE_DELIVERY_THRESHOLD else STANDARD_DELIVERY_FEE
  ├── packaging_fee = PACKAGING_FEE
  └── total_amount = subtotal + delivery_fee + packaging_fee

Step 5: Create Immutable Snapshots
  ├── OrderAddress: deep copy of Address fields
  └── OrderItem per CartItem:
        product_name_snap = variant.product.name
        weight_label_snap = variant.weight_label
        unit_price        = variant.price  (locked at checkout time)
        mrp_snap          = variant.mrp
        line_total        = unit_price × quantity

Step 6: Create Order Record
  └── Order(status="pending", payment_status="pending", order_number=<generated>)

Step 7: Reserve Inventory per Variant
  ├── INSERT InventoryReservation(variant_id, cart_id, order_id, quantity, status="active", expires_at=now+30min)
  └── UPDATE inventory SET reserved_quantity += cart_item.quantity

Step 8: Book Delivery Slot (conditional, concurrency-safe)
  └── UPDATE delivery_slots SET current_orders += 1
        WHERE id = slot_id AND current_orders < max_orders
      → If 0 rows affected → 409 (slot filled concurrently)

Step 9: Deactivate Cart
  └── UPDATE carts SET is_active = False WHERE id = cart.id

Step 10: Record Status History
  └── INSERT OrderStatusHistory(order_id, from_status=None, to_status="pending", note="Order placed")

Step 11: Commit and Return OrderRead
```

---

## 6. Schema Extensions Needed

### `backend/app/schemas/catalog.py` additions

```python
class CategoryWithProductCount(CategoryRead):
    product_count: int

class PaginatedProductRead(BaseModel):
    items: List[ProductRead]
    total: int
    page: int
    page_size: int
    has_next: bool

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    image_url: str = Field(..., max_length=500)
    display_order: int = 0

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class ProductCreate(BaseModel):
    category_id: str
    name: str = Field(..., min_length=1, max_length=150)
    slug: str = Field(..., min_length=1, max_length=180)
    description: str
    image_url: str = Field(..., max_length=500)
    is_fresh_today: bool = True
    is_popular: bool = False

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_fresh_today: Optional[bool] = None
    is_popular: Optional[bool] = None
    is_active: Optional[bool] = None

class VariantCreate(BaseModel):
    weight_label: str = Field(..., min_length=1, max_length=50)
    weight_grams: int = Field(..., gt=0)
    price: Decimal = Field(..., ge=0)
    mrp: Decimal = Field(..., ge=0)
    display_order: int = 0

class VariantUpdate(BaseModel):
    price: Optional[Decimal] = None
    mrp: Optional[Decimal] = None
    is_available: Optional[bool] = None
    display_order: Optional[int] = None

class InventoryAdjust(BaseModel):
    delta: int   # positive = restock, negative = manual deduction
    reason: str = Field(..., min_length=1, max_length=200)
```

### `backend/app/schemas/cart.py` additions

```python
class CartPricingSummary(BaseModel):
    subtotal: Decimal
    delivery_fee: Decimal
    packaging_fee: Decimal
    total: Decimal
    is_free_delivery: bool

class CartReadWithPricing(CartRead):
    pricing: CartPricingSummary
```

### `backend/app/schemas/delivery.py` additions

```python
class ZoneCheckResponse(BaseModel):
    pincode: str
    is_serviceable: bool
    zone: Optional[DeliveryZoneRead] = None
    message: str
```

### `backend/app/schemas/order.py` additions

```python
class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(confirmed|dispatched|delivered|cancelled)$")
    note: Optional[str] = Field(None, max_length=500)

class OrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

class RefundRequest(BaseModel):
    refund_amount: Decimal = Field(..., gt=0)
    refund_id: str = Field(..., min_length=1, max_length=200)
    reason: str = Field(..., min_length=1, max_length=500)

class PaginatedOrderRead(BaseModel):
    items: List[OrderRead]
    total: int
    page: int
    page_size: int
    has_next: bool
```

---

## 7. Service Layer Responsibilities

### `catalog_service.py`
| Method | Purpose |
| :--- | :--- |
| `get_active_categories(db)` | All active categories ordered by `display_order`. |
| `get_category_by_slug(db, slug)` | Category + active product count. 404 if missing. |
| `list_products(db, ...)` | Paginated, filtered, eager-loaded product list. |
| `get_product_by_slug(db, slug)` | Product + active variants + inventory. 404 if missing. |
| `get_featured_products(db, limit=8)` | `is_popular OR is_fresh_today`, max 8. |
| `get_variant_availability(db, variant_id)` | Live inventory read. 404 if missing. |

### `cart_service.py`
| Method | Purpose |
| :--- | :--- |
| `get_or_create_cart(db, user_id)` | Load active cart or create one. |
| `add_item(db, cart, variant_id, quantity)` | Upsert item. Validate availability + stock. |
| `update_item(db, cart, item_id, quantity)` | Update quantity. Validate stock. Ownership check. |
| `remove_item(db, cart, item_id)` | Delete item. Ownership check. 404 if not owned. |
| `clear_cart(db, cart)` | Delete all cart items. |
| `compute_pricing(cart)` | Return `CartPricingSummary` from config constants. |

### `delivery_service.py`
| Method | Purpose |
| :--- | :--- |
| `check_pincode(db, pincode)` | Return `ZoneCheckResponse`. |
| `list_zones(db)` | All active zones. |
| `list_available_slots(db, zone_id?, date?, slot_type?)` | Non-full active slots. |

### `order_service.py`
| Method | Purpose |
| :--- | :--- |
| `place_order(db, user, address_id, slot_id, payment_method, notes)` | Full 11-step checkout. |
| `list_orders(db, user_id, status?, page, page_size)` | Customer order history. |
| `get_order(db, user_id, order_id)` | Single order with ownership check. |
| `cancel_order(db, user_id, order_id, reason)` | Customer cancel (pending/confirmed only). |
| `admin_update_status(db, order_id, new_status, note)` | Admin lifecycle transition with matrix check. |
| `_release_inventory(db, order_id)` | Internal: mark reservations released, decrement reserved_quantity. |

### `payment_service.py`
| Method | Purpose |
| :--- | :--- |
| `create_payment_intent(db, order_id, provider, idempotency_key)` | Idempotent payment creation. |
| `process_webhook(db, raw_body, signature_header)` | Verify HMAC-SHA256, update payment + order. |
| `process_refund(db, payment_id, amount, refund_id, reason)` | Update refund fields. Guard: amount <= payment.amount. |

---

## 8. Implementation Steps

### Step 4.1 — Schema Extensions
Extend the four schema files with all types listed in Section 6.
Re-export all new types from `backend/app/schemas/__init__.py`.

### Step 4.2 — Catalog Service & Router
Implement `catalog_service.py` and `endpoints/catalog.py`. Mount under `/catalog` in `api.py`.

### Step 4.3 — Cart Service & Router
Implement `cart_service.py` and `endpoints/cart.py`. Mount under `/cart` in `api.py`.

### Step 4.4 — Delivery Service & Router
Implement `delivery_service.py` and `endpoints/delivery.py`. Mount under `/delivery` in `api.py`.

### Step 4.5 — Order Service & Router
Implement `order_service.py` (11-step checkout in single `async with session.begin()` block) and `endpoints/orders.py`. Mount under `/orders` in `api.py`.

### Step 4.6 — Payment Service & Router
Implement `payment_service.py` and `endpoints/payments.py`. Mount under `/payments` in `api.py`.

### Step 4.7 — Admin API
Create `endpoints/admin/` package with `__init__.py`, `catalog_admin.py`, `orders_admin.py`. All routes use `Depends(get_current_active_admin)`. Mount under `/admin` in `api.py`.

### Step 4.8 — OpenAPI & TypeScript Contract Sync
```bash
PYTHONPATH=. ./backend/.venv/bin/python backend/app/scripts/export_openapi.py
npm run generate --workspace=@dailykitchen/contracts
npm run build --workspace=@dailykitchen/contracts
npm run typecheck    # must pass with 0 errors
```

### Step 4.9 — Automated Pytest Suite (≥ 30 new tests)

**`test_catalog.py`** (≥ 8 tests):
- List categories returns ordered active list.
- Get category by slug: 404 for unknown/inactive slug.
- List products with `?popular=true` filter.
- List products with text search `?q=tomato`.
- Get product by slug includes variants + inventory.
- `GET /products/featured` returns ≤ 8 products.
- `GET /variants/{id}/availability` returns live stock.
- Inactive products/categories excluded from public responses.

**`test_cart.py`** (≥ 9 tests):
- GET cart for new user returns empty cart with zero pricing.
- Add item returns correct subtotal.
- Add same item twice increments quantity (upsert).
- Add unavailable variant returns 422.
- Update quantity recomputes pricing.
- Subtotal ≥ ₹99 → `delivery_fee = 0`.
- Subtotal < ₹99 → `delivery_fee = 40`.
- Remove item reduces line count.
- Clear cart removes all items; cart entity is retained.
- Accessing another user's cart item returns 404.

**`test_delivery.py`** (≥ 4 tests):
- Seeded pincode → `is_serviceable = True` with zone details.
- Unknown pincode → `is_serviceable = False`.
- List zones returns all active zones.
- List slots for zone+date returns only non-full slots.

**`test_orders.py`** (≥ 9 tests):
- Happy-path checkout creates `OrderRead` with correct totals and snapshots.
- Checkout with empty cart → 400.
- Checkout with out-of-stock variant → 422.
- Checkout with fully booked slot → 409.
- After checkout, `inventory.reserved_quantity` increments by purchased amount.
- Cancel pending order → `InventoryReservation.status = "released"`.
- Cancel dispatched order → 409.
- Listing orders returns only the current user's orders.
- Fetching another user's order → 404.

**`test_payments.py`** (≥ 4 tests):
- Create payment intent → `status = "pending"`.
- Same `idempotency_key` second call → returns identical record.
- Valid webhook → payment `paid`, order `payment_status = paid`.
- Invalid webhook signature → 401.

### Step 4.10 — Verification Audit
```bash
# From backend/
PYTHONPATH=.. .venv/bin/pytest tests/ -v --tb=short    # all ≥ 76 tests must pass
npm run typecheck                                         # 0 errors
```
Create `docs/audits/phase-4-verification.md` with full terminal output.

---

## 9. Business Logic Invariants

| Invariant | Enforcement |
| :--- | :--- |
| Cart item quantity: 1–20 | DB check constraint + Pydantic `Field(ge=1, le=20)` |
| Variant `price >= 0`, `mrp >= price` | DB check constraints on `product_variants` |
| `reserved_quantity <= stock_quantity` | DB check constraint + `SELECT ... FOR UPDATE` in checkout |
| `current_orders <= max_orders` | Conditional `UPDATE ... WHERE current_orders < max_orders` |
| `total_amount = subtotal + delivery + packaging` | DB check constraint `check_order_total_sum` |
| `refunded_amount <= amount` | DB check constraint + service-layer guard |
| No backward order status transitions | Explicit allowed-transitions map in `order_service` |
| Admin routes restricted | `Depends(get_current_active_admin)` on every admin route |
| Ownership returns 404 not 403 | Consistent across all user-specific endpoints |

---

## 10. Order Status Transition Matrix

```
ALLOWED TRANSITIONS:
  pending    → confirmed   (Admin only)
  pending    → cancelled   (Admin or Customer)
  confirmed  → dispatched  (Admin only)
  confirmed  → cancelled   (Admin or Customer)
  dispatched → delivered   (Admin only)

TERMINAL STATES (no further transitions):
  delivered, cancelled

FORBIDDEN (always returns 409):
  Any backward transition (e.g., dispatched → confirmed)
  Any transition out of a terminal state
  Customer attempting to cancel a dispatched or delivered order
```

---

## 11. Security & Reliability Requirements

1. **Checkout Atomicity:** Single `async with session.begin()` block. No separate `await session.commit()` calls inside the pipeline. Exception at any step = full rollback.

2. **Inventory Locking:** `SELECT ... FOR UPDATE` on `Inventory` rows during checkout to prevent overselling under concurrent load.

3. **Slot Conditional Update:** `UPDATE ... WHERE current_orders < max_orders`. If 0 rows affected → 409 (slot was just filled by a concurrent request).

4. **Webhook Signature Verification:** Verify keyed HMAC-SHA256 against the raw request body **before** JSON parsing. Invalid signature → 401.

5. **Payment Idempotency:** `SELECT` on `idempotency_key` first. Found → return existing record. Not found → `INSERT`. Never allow two rows with the same key.

6. **Ownership Isolation:** `resource.user_id == current_user.id` everywhere. Returns 404 (not 403) to prevent resource existence leakage.

7. **Inventory Release on Cancel:** Mark all `InventoryReservation` rows `status = "released"` and decrement `inventory.reserved_quantity` in the same transaction.

8. **Admin Seed Guard:** `POST /admin/seed` must verify `settings.ENVIRONMENT in ("development", "test")`. Returns 403 in staging/production.

---

## 12. Acceptance Criteria for Phase 4 Completion

Phase 4 is **only complete** when all of the following are satisfied and evidenced:

- [ ] All 6 router groups mounted and returning correct HTTP status codes.
- [ ] Full happy-path checkout end-to-end verified by automated test.
- [ ] Inventory reservation increments atomically during checkout.
- [ ] Slot conditional update verified.
- [ ] Payment idempotency verified (second call returns identical record).
- [ ] Webhook signature validation returns 401 for unsigned requests.
- [ ] All admin routes return 403 for non-admin user tokens.
- [ ] All ≥ 76 Pytest tests pass (46 Phase 1–3 + ≥ 30 new).
- [ ] `npm run typecheck` passes with 0 errors across the monorepo.
- [ ] `docs/audits/phase-4-verification.md` created with full evidence.
- [ ] **No Git commits, no pushes, no history rewrites.**

---

## 13. What Phase 5 Will Cover (Not in Scope Here)

Phase 5 is the **Frontend Customer App** — the Next.js web application that consumes all Phase 4 APIs to deliver the complete customer experience: catalog browsing, cart management, delivery slot selection, checkout, and order tracking. Phase 5 begins only after all Phase 4 acceptance criteria are fully met and documented.
