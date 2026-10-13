# DailyKitchen Phase 7: Backoffice Admin Dashboard & Operations Console Implementation Plan

**Document Version:** 1.0.0  
**Status:** PROPOSED & READY FOR APPROVAL  
**Author:** DailyKitchen Engineering Agent  
**Target Workspaces:** `apps/web` (Next.js 14 App Router), `@dailykitchen/contracts`, `@dailykitchen/tokens`  
**API Surface:** FastAPI Admin Router (`/api/v1/admin/*`, `/api/v1/orders`)  

---

## 1. Executive Summary & Goals

Phase 7 delivers the **Backoffice Admin Dashboard & Operations Console** for DailyKitchen. While Phases 5 and 6 delivered customer-facing web and native mobile shopping experiences, Phase 7 equips DailyKitchen warehouse managers, inventory controllers, and dispatch teams with the operational tools required to manage the fresh grocery lifecycle.

The admin console connects directly to the authenticated admin backend endpoints implemented in Phase 4 (`/api/v1/admin/catalog`, `/api/v1/admin/delivery`, `/api/v1/admin/orders`):
1. **Fulfillment Pipeline:** Real-time queue of customer orders with validated, server-authoritative status transitions (`placed` → `confirmed` → `dispatched` → `delivered` / `cancelled`).
2. **Live Stock & Inventory Control:** Real-time visibility into available vs. reserved inventory per variant, delta adjustments (`+` / `-`), and low-stock alerts.
3. **Produce & Variant Catalog Management:** Category hierarchy, produce listings, weight variant configuration (250g, 500g, 1kg), price/MRP controls, and freshness tags.
4. **Delivery Zones & Slot Capacity Scheduler:** Serviceable postal code management, daily morning harvest slot generation, order capacity limits, and emergency freeze toggles.
5. **Strict Role-Based Access Control (RBAC):** Gated strictly to `role: "admin"`, verified both in server-side Next.js route handlers/middleware and backend FastAPI dependencies.

---

## 2. Architecture & Security Controls

### 2.1 Role-Based Access Control (RBAC) & Authentication
- **Backend Authorization:** All `/api/v1/admin/*` endpoints strictly require `Depends(get_current_active_admin)`, which checks `user.role == "admin"` and `user.is_active is True`. Non-admin users receive HTTP 403 Forbidden.
- **Frontend Session Security:** Next.js BFF route handlers proxy admin requests while forwarding the customer/admin session token. Next.js server components verify the user's role before rendering admin shells; non-admin users are redirected to `/admin/login`.
- **Zero In-Browser Master Credentials:** Administrative operations use standard rotating bearer tokens issued during admin login, preserved via HttpOnly cookies.

### 2.2 Authoritative Business Invariants
- **Atomic Stock Invariant:** Inventory stock quantity can never be reduced below the active reserved quantity (`stock_quantity >= reserved_quantity`). Violations return HTTP 422.
- **Authoritative Status Transitions:** Order statuses must strictly follow the backend state machine:
  - `placed` ➔ `confirmed` (Locks produce for morning harvest)
  - `confirmed` ➔ `dispatched` (Assigned to rider)
  - `dispatched` ➔ `delivered` (Consumes reserved inventory atomically)
  - `placed` / `confirmed` ➔ `cancelled` (Releases reserved inventory atomically)
- **Seed Protection:** The `/api/v1/admin/seed` endpoint is strictly disabled outside of `development` and `test` environments.

---

## 3. Screen Structure & Information Architecture

The Admin Console will be implemented within `apps/web/app/admin/` using Next.js 14 App Router, reusing the shared design tokens from `@dailykitchen/tokens` and contracts from `@dailykitchen/contracts`:

```
apps/web/app/admin/
├── layout.tsx                  # Admin Shell: Sidebar, Top Navigation, Admin Profile, RBAC Guard
├── login/
│   └── page.tsx                # Dedicated Admin Login (Phone/Password or Admin OTP)
├── page.tsx                    # Executive Overview: KPI metrics, revenue, active queue summary
├── orders/
│   ├── page.tsx                # Live Order Fulfillment Queue (Status filter tabs, search, actions)
│   └── [id]/
│       └── page.tsx            # Order Inspection Drawer: Customer snapshot, line items, status log
├── inventory/
│   └── page.tsx                # Inventory & Stock Control: Variant grid, delta adjustments, stock alerts
├── catalog/
│   ├── page.tsx                # Produce & Category Browser: Status, prices, tags
│   ├── categories/
│   │   └── page.tsx            # Category Management: Add/edit categories, display order
│   └── products/
│       ├── new/
│       │   └── page.tsx        # New Produce & Variant Creation Wizard
│       └── [id]/
│           └── page.tsx        # Product & Variant Editor
└── delivery/
    ├── page.tsx                # Delivery Slots & Capacity Scheduler: Bulk generation, capacity gauges
    └── zones/
        └── page.tsx            # Delivery Zones & Pincode Serviceability Editor
```

---

## 4. Sequential Implementation Roadmap

### 7.1 Admin API Client, BFF Proxies & RBAC Middleware
- Add typed admin client methods in `apps/web/src/lib/api-client.ts`:
  - `admin.catalog.createCategory`, `updateCategory`
  - `admin.catalog.createProduct`, `updateProduct`, `addVariant`, `updateVariant`
  - `admin.catalog.adjustInventory`
  - `admin.delivery.createZone`, `bulkCreateSlots`
  - `admin.orders.updateStatus`
- Implement Next.js BFF proxy routes in `apps/web/app/api/admin/*` ensuring HttpOnly cookie token propagation and error envelope unwrapping.
- Implement server-side layout authentication guard: verify session user role is `admin`, redirecting unauthorized users.

### 7.2 Admin Navigation Shell & Visual Identity
- Create `apps/web/app/admin/layout.tsx`:
  - Collapsible administrative sidebar with clean iconography (`LayoutDashboard`, `ShoppingBag`, `Boxes`, `CalendarClock`, `MapPin`, `LogOut`).
  - DailyKitchen brand header with "Operations Console" pill badge.
  - Active admin profile pill with logout action.
- Build clean, accessible admin UI components:
  - Metric summary cards with variance indicators.
  - Interactive data tables with sorting, pagination, and status pills.
  - Action confirmation dialogs for destructive or irreversible actions.

### 7.3 Operational Overview & KPI Dashboard (`/admin`)
- Real-time KPI summary cards:
  - **Today's Orders:** Total placed, confirmed, dispatched, delivered.
  - **Today's Revenue:** Authoritative gross order total.
  - **Low Stock Warnings:** Number of variants below low-stock threshold (10 units).
  - **Slot Saturation:** Capacity utilization percentage for current day morning/evening slots.
- Live Orders Quick Table: Newest 10 orders requiring fulfillment action.

### 7.4 Live Order Fulfillment Console (`/admin/orders`)
- Tabbed status filter bar: `All`, `Placed` (Needs Packing), `Confirmed` (Ready to Dispatch), `Dispatched` (In Transit), `Delivered`, `Cancelled`.
- Order fulfillment rows displaying:
  - Order ID & DK number format (`DK-YYYYMMDD-XXXXXXXX`).
  - Delivery slot window (e.g., `06:00 - 08:00 AM`).
  - Delivery address snapshot (Recipient name, phone, area, PIN code).
  - Item count and authoritative order total (including ₹10 packaging fee).
- One-click status transition buttons with server-authoritative validations:
  - `Confirm Order` (transitions `placed` ➔ `confirmed`).
  - `Dispatch Order` (transitions `confirmed` ➔ `dispatched`).
  - `Mark Delivered` (transitions `dispatched` ➔ `delivered`).
  - `Cancel Order` with mandatory reason note (releases reserved inventory).

### 7.5 Inventory & Stock Control Grid (`/admin/inventory`)
- Unified inventory table:
  - Produce item and weight variant (e.g., `Palak (Spinach) - 250g`).
  - Available stock quantity vs. reserved quantity.
  - Net available for sale (`stock - reserved`).
  - Stock health badge: `In Stock`, `Low Stock` (≤ 10), `Stock Exhausted` (0).
- Inline Delta Stock Adjustment modal:
  - Quick buttons (`+10`, `+25`, `+50`, `-10`, custom delta).
  - Pre-validation: client prevents submitting deltas that would reduce stock below reserved quantity.
  - Calls `PUT /api/v1/admin/catalog/variants/{id}/inventory` and refreshes table.

### 7.6 Produce, Categories & Variant Catalog Management (`/admin/catalog`)
- Category Management:
  - View, create, and update categories (`name`, `slug`, `display_order`, `image_url`).
- Product & Variant Creator:
  - Create produce items linked to categories.
  - Configure weight variants with selling price and MRP (e.g., ₹35 selling vs. ₹42 MRP).
  - Toggle `is_fresh_today` and `is_popular` flags.

### 7.7 Delivery Zones, Pincodes & Slot Capacity Scheduler (`/admin/delivery`)
- Zone & Postal Code Management:
  - View active zones (e.g., Koramangala `560034`).
  - Add new delivery zone with postal code and express delivery toggle.
- Bulk Delivery Slot Generator:
  - Schedule delivery windows for upcoming harvest dates (Tomorrow / Next 3 Days).
  - Configure start time, end time, and maximum order capacity.
  - View real-time slot occupancy progress bar (`current_orders / max_orders`).

### 7.8 Regression Testing, RBAC Verification & Phase 7 Audit
- Automated E2E test suite in `apps/web/tests/admin-journey.test.js`:
  - 1. Admin login and RBAC rejection of standard customer credentials (HTTP 403).
  - 2. Category and product creation with variant pricing.
  - 3. Stock delta adjustment and reserved inventory barrier enforcement.
  - 4. Bulk slot scheduling and capacity checks.
  - 5. Full order fulfillment flow: transition customer order `placed` ➔ `confirmed` ➔ `dispatched` ➔ `delivered`.
  - 6. Cancellation flow with automated inventory release check.
- Verification across monorepo:
  - `npm run typecheck` across all 6 workspaces.
  - `npm test` across monorepo.
  - `pytest backend/tests` regression check (85/85 tests).
  - Next.js production build (`npm run build -w apps/web`).
- Record complete evidence in `docs/audits/phase-7-verification.md`.

---

## 5. Acceptance Criteria

| Area | Acceptance Criteria |
| :--- | :--- |
| **RBAC Security** | Customers attempting to access `/admin/*` or `/api/v1/admin/*` are strictly blocked with 403 Forbidden. Only users with `role: "admin"` can perform operations. |
| **Inventory Safety** | Inventory adjustment cannot reduce stock below active reservations. Submitting an invalid negative delta returns HTTP 422. |
| **Authoritative Status Transitions** | Status updates follow the authoritative state machine. Moving to `delivered` consumes reserved stock; moving to `cancelled` releases reserved stock. |
| **Delivery Capacity** | Bulk slots can be created for zones. Saturation gauges accurately reflect booked customer orders. |
| **Type & Test Integrity** | Zero TypeScript compiler errors across all 6 workspaces; all backend pytest and frontend test suites pass 100%. |
| **Production Build** | `npm run build -w apps/web` compiles successfully without runtime or bundling errors. |

---

## 6. Implementation Readiness Confirmation

All required backend endpoints for Phase 7 already exist in the verified backend and pass unit/integration tests. Phase 7 can begin immediately upon user approval.
