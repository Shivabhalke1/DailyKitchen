# DailyKitchen Website Architecture, System Flow & Technical Manual

> **Document Version:** 1.0.0  
> **Target Audience:** Engineering, Product, System Administrators, QA  
> **Last Verified:** October 2026  
> **Location:** `docs/WEBSITE_ARCHITECTURE_AND_SYSTEM_MANUAL.md`

---

## 1. Executive Summary & Architecture Overview

**DailyKitchen** is a production-grade, hyper-local fresh grocery delivery platform designed for urban Indian households. The platform is engineered as a **Modular Monolith** with a high-performance **FastAPI (Python)** backend and a responsive **Next.js 14 (App Router / TypeScript)** frontend that serves two major user spaces:
1. **Customer Storefront:** Fast, mobile-responsive consumer web store for catalog discovery, pincode serviceability checks, discrete 4-digit OTP authentication, cart management, delivery slot reservation, and order tracking.
2. **Backoffice Operations & Admin Console (`/admin`):** Operations workspace for catalog managers, inventory controllers, dispatch managers, and customer support representatives.

### High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT WORKSPACES                                       │
│                                                                                        │
│   [ Customer Storefront (Web) ]                 [ Operations Admin Console (/admin) ]  │
│   Next.js 14 App Router, React 18,              Secure RBAC Console, Tailwind CSS,     │
│   Tailwind CSS, @dailykitchen/tokens            Live Order Queue, Stock Ledger         │
└──────────────────────────┬─────────────────────────────────┬───────────────────────────┘
                           │                                 │
                           ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                 NEXT.JS BACKEND-FOR-FRONTEND (BFF) PROXY LAYER                         │
│                                                                                        │
│   • /api/auth/session         (Silent Session Check & HttpOnly Cookie Token Rotation)  │
│   • /api/admin/[...slug]      (RBAC Guard & Header-Injected Backend Proxy)             │
│   • In-Memory Access Token    (Zero persistent exposure in localStorage / sessionStorage│
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼ (REST JSON /api/v1)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CORE BACKEND API ENGINE (FastAPI)                               │
│                                                                                        │
│   • Dependency Injection (Auth, Session, Permissions, Database Session)               │
│   • Domain Services: Auth, OTP, Catalog, Cart, Pricing, Delivery, Orders, Admin       │
│   • Atomic State Machines: Orders (Placed -> Confirmed -> Dispatched -> Delivered)     │
│   • Server-Authoritative Pricing & Slot Capacity Invariants                            │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼ (SQLAlchemy 2.0 Async / aiosqlite / asyncpg)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                         PERSISTENCE & STORAGE TIER                                     │
│                                                                                        │
│   • Primary Relational Database: SQLite (./dailykitchen.db) / PostgreSQL (Prod)        │
│   • Schema Migrations: Alembic Revision Scripts                                        │
│   • Session Storage: Database-backed User Sessions with Revocation & Replay Detection  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Technology Stack

| Layer | Technology | Version | Purpose & Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router) | `14.2.23` | Server-side rendering (SSR), static generation for policy pages, dynamic streaming, and edge-friendly Route Handlers. |
| **Frontend UI Library** | React | `18.3.1` | Component-driven UI with Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`) and custom Contexts. |
| **Language (Web)** | TypeScript | `^5.4.5` | End-to-end type safety shared with contracts (`strict: true`). |
| **Styling & Design System** | Tailwind CSS + Custom Tokens | `^3.4.1` | Utility-first styling governed by `@dailykitchen/tokens` (forest greens, neutral creams, zero arbitrary magic values). |
| **Iconography** | Lucide React | `^0.441.0` | Accessible, tree-shakeable SVG icon components. |
| **Backend Framework** | FastAPI | `0.115.0+` | Asynchronous Python ASGI framework for ultra-low latency API endpoints and OpenAPI 3.1 generation. |
| **Language (Backend)** | Python | `3.14+` | Modern typed Python with typing protocols, Pydantic data schemas, and async coroutines. |
| **Database ORM** | SQLAlchemy | `2.0.35+` | Async ORM (`AsyncSession`, declarative base) supporting complex joins, subqueries, and table locks. |
| **Database Drivers** | `aiosqlite` / `asyncpg` | Latest | Non-blocking database I/O for SQLite (local dev) and PostgreSQL (production). |
| **Database Migrations**| Alembic | `1.13.2+` | Version-controlled schema migrations with deterministic up/down migrations. |
| **Authentication & Tokens**| PyJWT + Passlib | `2.9.0+` | Short-lived HS256 JWT access tokens (15m) and rotating refresh tokens (7d) stored in HttpOnly cookies. |
| **Password Hashing** | Argon2 / PBKDF2-SHA256 | Latest | Cryptographically resilient salted password hashing for admin and credentialed accounts. |
| **Validation Layer** | Pydantic v2 & Zod | `^3.23.0` | Server-side Pydantic models paired with client-side Zod validation schemas for forms. |
| **Shared Monorepo Monolith**| npm Workspaces | Node 20+ | Multi-package workspace orchestrating `@dailykitchen/contracts`, `@dailykitchen/shared-utils`, `@dailykitchen/tokens`, `@dailykitchen/validation`, `apps/web`, and `apps/mobile`. |

---

## 3. Data Storage, Sessions & State Architecture

### 3.1 Physical Database Storage
* **Local Development Environment:**  
  Data is stored in a zero-configuration SQLite database file located at the workspace root:  
  `./dailykitchen.db`  
  *Connection string:* `sqlite+aiosqlite:///./dailykitchen.db`  
  *Test Database:* `./test_dailykitchen.db` (used exclusively during isolated Pytest executions).
* **Production Environment:**  
  Configured via the environment variable `DATABASE_URL` pointing to PostgreSQL:  
  `postgresql+asyncpg://user:password@hostname:5432/dailykitchen`

### 3.2 Client-Side Storage & Token Architecture
DailyKitchen strictly forbids storing raw authentication tokens in unencrypted `localStorage` or `sessionStorage` due to Cross-Site Scripting (XSS) risks.
* **Refresh Token (`dk_refresh_token`):**  
  Stored exclusively in an **`HttpOnly`**, **`SameSite=Strict`**, **`Secure`** browser cookie with a 7-day expiration. JavaScript cannot read this cookie.
* **Access Token:**  
  Stored **in-memory only** inside private module variable `inMemoryAccessToken` in `apps/web/src/lib/api-client.ts`. It expires in 15 minutes.
* **Token Rotation & Replay Detection:**  
  Each time a new access token is requested via `/api/v1/auth/refresh`, the previous refresh token is marked as revoked and a new refresh token is issued. If a revoked refresh token is presented again, the backend triggers replay detection and revokes the user's entire session hierarchy.
* **Single-Flight Refresh Mutex:**  
  If multiple API requests fail simultaneously with HTTP 401, a mutex lock ensures only a single HTTP `/auth/refresh` request is initiated; other waiting requests queue and use the resultant token once resolved.
* **Local Preferences:**  
  Only non-sensitive user preferences are persisted in browser `localStorage`:
  * `dk_pincode`: Selected 6-digit postal code (e.g., `"560034"`).
  * `dk_zone_name`: Resolved delivery zone name (e.g., `"Koramangala & HSR"`).

---

## 4. Complete Database Schema & Entity Relationships

The database comprises 13 core tables, fully defined under `backend/app/models/` and managed via Alembic migrations.

```
                  ┌───────────────┐
                  │     users     │
                  └───────┬───────┘
                          │ 1:N
         ┌────────────────┼────────────────┬───────────────┐
         │ 1:N            │ 1:N            │ 1:N           │ 1:1
         ▼                ▼                ▼               ▼
┌────────────────┐ ┌─────────────┐ ┌──────────────┐ ┌─────────────┐
│  user_sessions │ │  addresses  │ │    orders    │ │    carts    │
└────────────────┘ └─────────────┘ └──────┬───────┘ └──────┬──────┘
                                          │ 1:N            │ 1:N
                                          ▼                ▼
                                   ┌──────────────┐ ┌─────────────┐
                                   │ order_items  │ │ cart_items  │
                                   └──────────────┘ └──────┬──────┘
                                                           │ N:1
┌─────────────────┐       ┌──────────────┐                 │
│ delivery_zones  │       │  categories  │                 │
└────────┬────────┘       └───────┬──────┘                 │
         │ 1:N                    │ 1:N                    │
         ▼                        ▼                        │
┌─────────────────┐       ┌──────────────┐                 │
│ delivery_slots  │       │   products   │                 │
└─────────────────┘       └───────┬──────┘                 │
                                  │ 1:N                    │
                                  ▼                        │
                          ┌────────────────┐               │
                          │product_variants│◄──────────────┘
                          └────────────────┘
```

### 4.1 Schema Tables Description

#### 1. `users`
Represents customer and administrator accounts.
* `id` (`VARCHAR(36)`, PK): UUIDv4 string identifier.
* `phone` (`VARCHAR(15)`, Unique, Indexed): 10-digit mobile number prefixed with `+91`.
* `email` (`VARCHAR(255)`, Nullable, Unique, Indexed): Case-insensitive email address.
* `full_name` (`VARCHAR(100)`, Nullable): Display name of the user.
* `role` (`VARCHAR(20)`, Default `'customer'`): Role-based access control enum (`'customer'`, `'admin'`).
* `hashed_password` (`VARCHAR(255)`, Nullable): Argon2/PBKDF2 salted hash (used for admin logins).
* `customer_code` (`VARCHAR(20)`, Unique, Nullable): Human-readable identifier (e.g., `DK-CUST-84920`).
* `is_active` (`BOOLEAN`, Default `true`): Deactivation flag for fraud or administrative suspensions.
* `is_verified` (`BOOLEAN`, Default `false`): Phone number verification status.
* `created_at`, `updated_at` (`DATETIME`): UTC timestamps.

#### 2. `user_sessions`
Manages authenticated device sessions and token rotation.
* `id` (`VARCHAR(36)`, PK): UUIDv4.
* `user_id` (`VARCHAR(36)`, FK `users.id`, Indexed): Owning user account.
* `refresh_token_hash` (`VARCHAR(64)`, Indexed): SHA-256 hash of the issued refresh token.
* `user_agent` (`VARCHAR(500)`, Nullable): Client browser user-agent header.
* `ip_address` (`VARCHAR(45)`, Nullable): Client IP address for geo-anomaly detection.
* `expires_at` (`DATETIME`): Strict 7-day expiration date.
* `is_revoked` (`BOOLEAN`, Default `false`): Explicit invalidation flag upon logout or replay.
* `created_at` (`DATETIME`): Creation timestamp.

#### 3. `addresses`
Customer delivery addresses.
* `id` (`VARCHAR(36)`, PK): UUIDv4.
* `user_id` (`VARCHAR(36)`, FK `users.id`, Indexed): Owning user.
* `full_name` (`VARCHAR(100)`): Recipient's name.
* `phone` (`VARCHAR(15)`): Delivery contact phone number.
* `house_flat` (`VARCHAR(100)`): Flat, house number, building name.
* `street_area` (`VARCHAR(255)`): Street, locality, cross road.
* `landmark` (`VARCHAR(100)`, Nullable): Nearby landmark for courier navigation.
* `pincode` (`VARCHAR(6)`, Indexed): 6-digit Indian postal code.
* `city` (`VARCHAR(50)`, Default `'Bengaluru'`): Delivery city.
* `state` (`VARCHAR(50)`, Default `'Karnataka'`): State.
* `label` (`VARCHAR(20)`, Default `'home'`): `'home'`, `'work'`, or `'other'`.
* `is_default` (`BOOLEAN`, Default `false`): Indicates default address.
* `is_active` (`BOOLEAN`, Default `true`): Soft delete flag.

#### 4. `categories`
Produce category classifications.
* `id` (`VARCHAR(36)`, PK): UUIDv4.
* `name` (`VARCHAR(100)`): E.g., "Fresh Vegetables", "Leafy Greens", "Farm Fruits".
* `slug` (`VARCHAR(100)`, Unique, Indexed): URL-friendly unique identifier (e.g., `leafy-greens`).
* `description` (`TEXT`, Nullable): Category narrative.
* `image_url` (`VARCHAR(500)`, Nullable): Banner or category icon image.
* `sort_order` (`INTEGER`, Default `0`): UI display priority.
* `is_active` (`BOOLEAN`, Default `true`): Visibility toggle.

#### 5. `products`
Individual farm produce items.
* `id` (`VARCHAR(36)`, PK): UUIDv4.
* `category_id` (`VARCHAR(36)`, FK `categories.id`, Indexed): Parent category.
* `name` (`VARCHAR(150)`): Product name (e.g., "Hydroponic Spinach", "Robusta Banana").
* `slug` (`VARCHAR(150)`, Unique, Indexed): Product URL slug.
* `description` (`TEXT`, Nullable): Culinary notes and nutritional information.
* `image_url` (`VARCHAR(500)`, Nullable): High-resolution product photo.
* `storage_tips` (`TEXT`, Nullable): Freshness advice (e.g., "Refrigerate in perforated bag").
* `harvest_info` (`TEXT`, Nullable): Harvest location and freshness declaration.
* `is_morning_fresh` (`BOOLEAN`, Default `false`): Flag for 6 AM harvest items.
* `is_active` (`BOOLEAN`, Default `true`): Active listing flag.

#### 6. `product_variants`
Weight options, pricing, and live inventory balances.
* `id` (`VARCHAR(36)`, PK): UUIDv4.
* `product_id` (`VARCHAR(36)`, FK `products.id`, Indexed): Parent product.
* `weight_value` (`NUMERIC(8, 2)`): E.g., `250.00`, `500.00`, `1.00`.
* `weight_unit` (`VARCHAR(10)`): E.g., `'g'`, `'kg'`, `'bunch'`, `'piece'`.
* `price` (`NUMERIC(10, 2)`): Selling price in INR (e.g., `45.00`).
* `mrp` (`NUMERIC(10, 2)`): Maximum Retail Price in INR (e.g., `60.00`).
* `stock_quantity` (`INTEGER`, Default `0`): Physical stock in warehouse.
* `reserved_quantity` (`INTEGER`, Default `0`): Stock locked in pending orders.
* `sku` (`VARCHAR(50)`, Unique, Nullable): Stock Keeping Unit string.
* `is_active` (`BOOLEAN`, Default `true`): Variant availability.
* **Critical Database Invariant:** Enforced rule: $\text{stock\_quantity} \ge \text{reserved\_quantity}$. Available sellable stock is calculated as:
  $$\text{Available Stock} = \text{stock\_quantity} - \text{reserved\_quantity}$$

#### 7. `carts` & `cart_items`
Customer shopping basket (supports both logged-in users and anonymous sessions).
* `carts.user_id` (`VARCHAR(36)`, FK `users.id`, Nullable, Indexed)
* `carts.session_id` (`VARCHAR(100)`, Nullable, Indexed): Anonymous session fallback.
* `cart_items.cart_id` (`VARCHAR(36)`, FK `carts.id`, Indexed)
* `cart_items.variant_id` (`VARCHAR(36)`, FK `product_variants.id`, Indexed)
* `cart_items.quantity` (`INTEGER`, Min `1`): Number of units requested.

#### 8. `orders` & `order_items`
Authoritative orders ledger.
* `orders.id` (`VARCHAR(36)`, PK): UUIDv4.
* `orders.order_number` (`VARCHAR(30)`, Unique, Indexed): Formatted order ID (e.g., `DK-20261013-8472`).
* `orders.user_id` (`VARCHAR(36)`, FK `users.id`, Indexed)
* `orders.address_id` (`VARCHAR(36)`, FK `addresses.id`)
* `orders.slot_id` (`VARCHAR(36)`, FK `delivery_slots.id`)
* `orders.status` (`VARCHAR(30)`, Indexed): State machine status:
  * `placed` → `confirmed` → `out_for_delivery` → `delivered`
  * Alternative terminal state: `cancelled`
* `orders.subtotal` (`NUMERIC(10, 2)`): Item totals.
* `orders.packaging_fee` (`NUMERIC(10, 2)`, Fixed `₹10.00`): Farm-grade hygiene fee.
* `orders.delivery_fee` (`NUMERIC(10, 2)`): Delivery fee (`₹0` if subtotal $\ge ₹99$, otherwise `₹40`).
* `orders.total_amount` (`NUMERIC(10, 2)`): Total payable INR.
* `orders.payment_method` (`VARCHAR(20)`): `'cod'`, `'upi'`, `'card'`.
* `orders.payment_status` (`VARCHAR(20)`): `'pending'`, `'paid'`, `'failed'`, `'refunded'`.
* `orders.cancellation_reason` (`TEXT`, Nullable): Compulsory reason required on cancellation.

#### 9. `delivery_zones` & `delivery_slots`
Territory serviceability and delivery capacity scheduler.
* `delivery_zones.pincodes` (`TEXT` / `JSON`): List of covered 6-digit Bengaluru pincodes (e.g., `["560034", "560095", "560102"]`).
* `delivery_zones.is_express_available` (`BOOLEAN`): 30-minute delivery toggle.
* `delivery_slots.slot_type`: `'express'` (30 mins) or `'scheduled'` (morning 6-9 AM / evening 4-7 PM).
* `delivery_slots.max_orders`: Maximum order threshold per slot.
* `delivery_slots.booked_orders`: Active booked counter.
* `delivery_slots.is_active`: Operational freeze switch.

---

## 5. End-to-End Website Flow & User Journeys

### 5.1 Customer Storefront Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Web as Next.js Web Shell
    participant BFF as Next.js BFF (/api/auth)
    participant API as FastAPI Backend (/api/v1)
    participant DB as Relational Database

    Customer->>Web: 1. Opens website (/)
    Web->>API: GET /catalog/categories & /catalog/products
    API->>DB: Query active categories and product variants
    DB-->>API: Return produce records
    API-->>Web: Render live catalog and hero banner

    Customer->>Web: 2. Enters Pincode (e.g. 560034)
    Web->>API: GET /delivery/zones/check?pincode=560034
    API-->>Web: Serviceable (Zone: Koramangala & HSR)
    Web->>Customer: Display green confirmation badge

    Customer->>Web: 3. Selects weight variant & clicks "Add"
    Web->>API: POST /cart/items (variant_id, qty=1)
    API->>DB: Check variant sellable stock
    API-->>Web: Updated cart with authoritative fees

    Customer->>Web: 4. Clicks "Login" / "Proceed to Checkout"
    Web->>Customer: Opens 4-Digit OTP Modal
    Customer->>Web: Submits Phone +91 9876543210
    Web->>API: POST /auth/otp/send
    API-->>Customer: Sends 4-Digit OTP (Dev test OTP: 1234)

    Customer->>Web: Enters "1234"
    Web->>API: POST /auth/otp/verify
    API->>DB: Record user, create session, generate JWT pair
    API-->>BFF: Set-Cookie: dk_refresh_token (HttpOnly)
    BFF-->>Web: Returns in-memory access_token & User Profile

    Customer->>Web: 5. Navigates to /checkout
    Web->>API: GET /users/me/addresses & /delivery/slots
    API-->>Web: Saved addresses and available delivery slots

    Customer->>Web: 6. Selects Slot & Payment Method (COD/UPI)
    Customer->>Web: Clicks "Place Order"
    Web->>API: POST /orders (address_id, slot_id, payment_method)
    API->>DB: Atomic Transaction:
    Note over API,DB: 1. Verify stock >= reserved<br/>2. Increment reserved_quantity<br/>3. Increment booked_orders on slot<br/>4. Clear user cart<br/>5. Insert Order & OrderItems
    API-->>Web: 201 Created (order_number: DK-20261013-8472)

    Web->>Customer: Redirects to /orders/DK-20261013-8472 (Live Tracking)
```

---

### 5.2 Backoffice Operations & Admin Console Flow (`/admin`)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Dispatch / Warehouse Manager
    participant Console as Web Admin (/admin)
    participant BFFAdmin as Next.js BFF (/api/admin/[...slug])
    participant Backend as FastAPI Backend (/api/v1/admin)
    participant DB as Database

    Admin->>Console: 1. Navigates to /admin/login
    Admin->>Console: Submits admin credentials
    Console->>Backend: POST /api/v1/auth/login
    Backend-->>BFFAdmin: Sets HttpOnly admin session cookie
    BFFAdmin-->>Console: Auth confirmed (role == 'admin')

    Admin->>Console: 2. Views Dashboard (/admin)
    Console->>BFFAdmin: GET /api/admin/dashboard/metrics
    BFFAdmin->>Backend: Injects Bearer token + validates role == 'admin'
    Backend->>DB: Query gross revenue, active orders, low stock
    DB-->>Backend: Calculated metrics
    Backend-->>Console: Render KPIs and pipeline distribution

    Admin->>Console: 3. Views Orders Queue (/admin/orders)
    Console->>BFFAdmin: GET /api/admin/orders?status=placed
    Backend-->>Console: List of orders waiting for fulfillment

    Admin->>Console: 4. Clicks "Confirm Harvest & Pack"
    Console->>BFFAdmin: PATCH /api/admin/orders/{id}/status { status: "confirmed" }
    Backend->>DB: Transition status: placed -> confirmed

    Admin->>Console: 5. Clicks "Dispatch for Delivery"
    Console->>BFFAdmin: PATCH /api/admin/orders/{id}/status { status: "out_for_delivery" }
    Backend->>DB: Transition status: confirmed -> out_for_delivery

    Admin->>Console: 6. Clicks "Mark Order Delivered"
    Console->>BFFAdmin: PATCH /api/admin/orders/{id}/status { status: "delivered" }
    Backend->>DB: Atomic Fulfillment Transaction:
    Note over Backend,DB: 1. Decrement actual stock_quantity<br/>2. Decrement reserved_quantity<br/>3. Set payment_status = 'paid'<br/>4. Set status = 'delivered'
    Backend-->>Console: Status updated. Customer live tracking updates!
```

---

## 6. Detailed Functionality & Component Reference

### 6.1 Frontend Applications (`apps/web`)

#### 1. `apps/web/src/context/AuthContext.tsx`
* **Purpose:** Manages the customer identity lifecycle, auto-login, and silent session refresh.
* **Core Functions:**
  * `checkSession()`: Performs an initial call to Next.js BFF (`GET /api/auth/session`) on page load. If an `HttpOnly` cookie exists, it automatically retrieves an in-memory access token and profile without user interaction.
  * `sendOtp(phone: string)`: Validates 10-digit mobile number, checks 60-second cooldown, and triggers `POST /api/v1/auth/otp/send`.
  * `verifyOtp(phone: string, otp: string)`: Submits 4-digit OTP. On HTTP 200, saves the access token in memory, updates user profile state, and establishes the `HttpOnly` refresh cookie.
  * `logout()`: Clears in-memory token, invokes `DELETE /api/auth/session` to clear cookies, and resets user state.

#### 2. `apps/web/src/context/LocationContext.tsx`
* **Purpose:** Manages delivery location, postal codes, and serviceability checks.
* **Core Functions:**
  * `checkServiceability(pincode: string)`: Dispatches query to `GET /api/v1/delivery/zones/check?pincode={pincode}`.
  * `setPincode(pincode: string)`: Persists valid pincode into `localStorage` (`dk_pincode`) and sets zone context across catalog product cards.

#### 3. `apps/web/src/context/CartContext.tsx`
* **Purpose:** Provides synchronized shopping cart state with optimistic UI updates and server pricing calculations.
* **Core Functions:**
  * `addItem(variantId, quantity)`: Optimistically adds item to state and dispatches `POST /api/v1/cart/items`. Automatically rolls back state if the server rejects due to stock exhaustion.
  * `updateQuantity(itemId, quantity)`: Updates quantity; triggers `DELETE /api/v1/cart/items/{id}` if quantity reaches 0.
  * `clearCart()`: Wipes local cart and calls `DELETE /api/v1/cart`.
  * **Fee Rule Invariant:** Automatically calculates fees using `@dailykitchen/shared-utils`:
    * Packaging fee: `₹10.00`
    * Delivery fee: `₹0.00` when Subtotal $\ge ₹99.00$, otherwise `₹40.00`.

#### 4. `apps/web/src/components/modals/AuthModal.tsx`
* **Purpose:** 4-digit discrete PIN input modal for OTP authentication.
* **Features:**
  * 4 discrete single-character input boxes with auto-focus advancing forward on keypress and retreating on backspace.
  * Paste handler allowing copy-paste of 4-digit codes.
  * 60-second countdown timer preventing OTP spamming.
  * Quick-fill button in development environments (`__DEV__` / `localhost`) that auto-fills test OTP `1234`.

#### 5. `apps/web/src/components/catalog/ProductCard.tsx`
* **Purpose:** Product card rendering produce details, savings, weight variant picker, and stepper controls.
* **Features:**
  * Weight variant buttons (e.g., 250g, 500g, 1kg) dynamically updating unit price, MRP, and savings percentage.
  * Dynamic stock badge: Green "In Stock", Amber "Only 4 left", or Red "Out of Stock".
  * Integrated quantity stepper (+ / -) directly mutating cart state.

#### 6. `apps/web/app/checkout/page.tsx`
* **Purpose:** Authoritative checkout page orchestrating address selection, slot booking, and order placement.
* **Features:**
  * Address selector with inline creation form modal (validated with `@dailykitchen/validation`).
  * Live slot selector displaying delivery windows (Morning 6-9 AM, Evening 4-7 PM) with remaining capacity badges.
  * Payment method selector: UPI (Cashfree / Razorpay mock intent) or Cash on Delivery.
  * Order placement trigger: Calls `POST /api/v1/orders`. On success, automatically flushes cart state and redirects the customer to `/orders/{order_id}`.

#### 7. `apps/web/app/orders/[id]/page.tsx`
* **Purpose:** Real-time customer order tracking and receipt display.
* **Features:**
  * Visual timeline tracking 4 distinct states:
    1. **Order Placed:** Farm received harvest order.
    2. **Confirmed & Packed:** Produce sorted and packed in hygiene containers.
    3. **Out for Delivery:** Handed over to delivery executive.
    4. **Delivered:** Order delivered at doorstep.
  * Detailed cost breakdown (Subtotal, Packaging Fee, Delivery Fee, Total).
  * Direct contact support trigger button.

---

### 6.2 Backoffice Operations Consoles (`apps/web/app/admin/`)

#### 1. `apps/web/app/admin/layout.tsx` & `apps/web/app/admin/login/page.tsx`
* **RBAC Session Guard:** Client-side guard verifying `user.role === 'admin'`. Unauthorized visitors are immediately redirected to `/admin/login`.
* **Zero Pill Buttons / Clean Emerald Theme:** Implements clean operational dashboard styling without distractions.

#### 2. `apps/web/app/admin/page.tsx` (Executive Dashboard)
* **Live KPI Cards:** Gross Revenue Today (excluding cancellations), Total Orders Today, Low Stock Alert Count, Slot Utilization Ratio.
* **Order Pipeline:** Visual counts of orders in `placed`, `confirmed`, `out_for_delivery`, `delivered`, and `cancelled`.
* **Live Orders Queue:** Direct table view with instant links to inspect or fulfill orders.

#### 3. `apps/web/app/admin/orders/page.tsx` (Order Fulfillment Console)
* **Filters & Search:** Filter by status pill (`all`, `placed`, `confirmed`, `out_for_delivery`, `delivered`, `cancelled`) or search by Order Number / Customer Phone.
* **Order Detail Drawer:** Complete view of recipient address, produce items, and pricing breakdown.
* **State Machine Actions:**
  * `placed` → *🚜 Confirm Harvest & Pack*
  * `confirmed` → *🚚 Dispatch for Delivery*
  * `out_for_delivery` → *✅ Mark Order Delivered*
  * *🚫 Cancel Order:* Opens modal requiring mandatory operational reason before releasing reserved stock back to available inventory.

#### 4. `apps/web/app/admin/inventory/page.tsx` (Stock Ledger)
* **Inventory Matrix:** Lists all produce variants with Physical Stock, Reserved Quantity, and Available Stock.
* **Delta Adjustment Modal:** Enables stock adjustments (+ restock / - spoilage) with server-side validation ensuring `stock_quantity` never drops below `reserved_quantity`.

#### 5. `apps/web/app/admin/catalog/page.tsx` (Catalog Management)
* **Category Management:** Modal form to add or edit categories with auto-slug generation.
* **Produce & Variant Creation:** Modal to add produce items with harvest tags, storage tips, and weight variants (price, MRP, initial stock).

#### 6. `apps/web/app/admin/delivery/page.tsx` (Capacity Scheduler)
* **Zone Management:** Toggle express 30-min delivery capability across Bengaluru zones.
* **Capacity Scheduler:** View booked orders vs max orders per slot.
* **Emergency Freeze:** One-click toggle to freeze (`is_active: false`) slots during heavy rains or delivery fleet shortages.

#### 7. `apps/web/app/admin/customers/page.tsx` (Customer Directory)
* **Customer Directory:** View customer codes, phone numbers, emails, order counts, and registration dates.
* **Password Reset Tool:** Trigger password reset requests for customer or staff accounts.

---

### 6.3 Backend API Endpoints Reference (`FastAPI`)

| Route | Method | Auth / Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/health` | `GET` | Public | System liveness, database connectivity, and timestamp. |
| `/api/v1/auth/otp/send` | `POST` | Public | Initiates 4-digit OTP challenge to mobile number. |
| `/api/v1/auth/otp/verify` | `POST` | Public | Validates OTP, issues access token and refresh token. |
| `/api/v1/auth/refresh` | `POST` | Public | Rotates refresh token and issues new access token. |
| `/api/v1/auth/me` | `GET` | Authenticated | Retrieves current authenticated user profile. |
| `/api/v1/catalog/categories` | `GET` | Public | Returns active categories ordered by `sort_order`. |
| `/api/v1/catalog/products` | `GET` | Public | Returns paginated products with weight variants. |
| `/api/v1/catalog/products/{slug}`| `GET` | Public | Retrieves specific produce item details. |
| `/api/v1/delivery/zones/check` | `GET` | Public | Checks if a 6-digit pincode is serviceable. |
| `/api/v1/delivery/slots` | `GET` | Public | Lists available delivery slots for a date & zone. |
| `/api/v1/cart` | `GET` | Authenticated / Anon | Retrieves current shopping cart with calculated totals. |
| `/api/v1/cart/items` | `POST` | Authenticated / Anon | Adds item to cart (validates sellable stock). |
| `/api/v1/cart/items/{id}` | `PATCH` | Authenticated / Anon | Updates quantity of a cart item. |
| `/api/v1/cart/items/{id}` | `DELETE`| Authenticated / Anon | Removes item from cart. |
| `/api/v1/users/me/addresses` | `GET` | Authenticated | Lists saved addresses for current user. |
| `/api/v1/users/me/addresses` | `POST` | Authenticated | Creates a new delivery address. |
| `/api/v1/orders` | `POST` | Authenticated | Atomically places order, reserves stock & slot. |
| `/api/v1/orders` | `GET` | Authenticated | Lists past orders placed by the current user. |
| `/api/v1/orders/{id}` | `GET` | Authenticated | Retrieves order details & timeline. |
| `/api/v1/admin/dashboard/metrics`| `GET` | `admin` | Aggregates gross revenue, active orders, low stock. |
| `/api/v1/admin/orders` | `GET` | `admin` | Lists system-wide orders with status filtering. |
| `/api/v1/admin/orders/{id}/status`| `PATCH`| `admin` | Executes state machine transitions. |
| `/api/v1/admin/inventory/adjust` | `POST` | `admin` | Applies delta adjustments to physical inventory. |
| `/api/v1/admin/catalog/categories`| `POST` | `admin` | Creates new produce category. |
| `/api/v1/admin/catalog/products` | `POST` | `admin` | Creates new produce item with weight variants. |
| `/api/v1/admin/delivery/slots/{id}`| `PATCH`| `admin` | Toggles slot active state (freeze / unfreeze). |
| `/api/v1/admin/customers` | `GET` | `admin` | Lists customers with customer codes & stats. |

---

## 7. Business Invariants, Integrity Rules & Failure Safeguards

1. **Server-Authoritative Pricing:**  
   The client application never calculates the final order amount. The backend independently calculates unit prices, discounts, packaging fees (fixed ₹10), and delivery fees (free over ₹99, else ₹40) inside database transactions.
2. **Strict Inventory Invariant:**  
   At all times, $\text{stock\_quantity} \ge \text{reserved\_quantity}$.  
   If an administrator attempts an adjustment that would drop stock below currently reserved customer orders, the backend aborts with HTTP `422 Unprocessable Entity`.
3. **Atomic Stock Decrement on Delivery:**  
   When an order is marked `delivered`:
   * `stock_quantity` is decremented by the purchased quantity.
   * `reserved_quantity` is released by the purchased quantity.
4. **Automatic Stock Release on Cancellation:**  
   If an order is cancelled:
   * `reserved_quantity` is immediately decremented back to available stock.
   * Slot `booked_orders` counter is decremented.
   * A non-empty `cancellation_reason` is strictly enforced.
5. **Slot Overbooking Protection:**  
   Order placement checks: `booked_orders < max_orders`. If a slot fills up before the order transaction commits, the transaction rolls back with HTTP `409 Conflict`.
6. **Strict RBAC Enforcement:**  
   Storefront customer tokens attempting to call `/api/v1/admin/*` are rejected with HTTP `403 Forbidden` (`detail: "Administrator access is required"`).

---

## 8. Development & Deployment Operations Guide

### 8.1 Prerequisites
* Node.js `20.x` or later
* Python `3.11+` (Python `3.14` supported)
* npm `10.x` or later

### 8.2 Environment Variables Configuration

Create `backend/.env` (or copy from `backend/.env.example`):
```env
PROJECT_NAME="DailyKitchen API"
ENVIRONMENT="development"
DEBUG="True"
DATABASE_URL="sqlite+aiosqlite:///./dailykitchen.db"
SECRET_KEY="dailykitchen-dev-secret-key-replace-in-prod"
JWT_SECRET_KEY="dailykitchen-dev-jwt-secret-key-replace-in-prod"
OTP_SECRET="dailykitchen-dev-otp-secret-key-replace-in-prod"
CORS_ORIGINS=["http://localhost:3000","http://localhost:8081","http://127.0.0.1:3000","http://127.0.0.1:8081"]
```

Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL="http://127.0.0.1:8000/api/v1"
INTERNAL_BACKEND_URL="http://127.0.0.1:8000/api/v1"
```

### 8.3 Starting the Local Development Servers

#### Step 1: Start Backend API
```bash
# From workspace root
PYTHONPATH=. ./backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
*API Documentation will be live at:* `http://127.0.0.1:8000/docs`

#### Step 2: Seed Initial Catalog & Create Admin Account
```bash
# Seed fresh categories, produce, weight variants, and delivery zones
PYTHONPATH=. ./backend/.venv/bin/python backend/app/db/seed.py

# Create an administrative account
PYTHONPATH=. ./backend/.venv/bin/python backend/app/scripts/create_admin.py \
  --phone "+919999999999" \
  --email "admin@dailykitchen.in" \
  --password "AdminSecret123!" \
  --name "Lead Dispatcher"
```

#### Step 3: Start Web Storefront & Admin Portal
```bash
# From workspace root
npm --prefix apps/web run dev
```
* Customer Storefront: `http://localhost:3000`
* Backoffice Admin Console: `http://localhost:3000/admin` (Sign in with `+919999999999` and `AdminSecret123!`)

### 8.4 Verification & Test Execution

```bash
# 1. Run all 98 backend Pytest unit and integration suites:
PYTHONPATH=. ./backend/.venv/bin/pytest backend/tests

# 2. Compile Next.js production build:
npm --prefix apps/web run build

# 3. Run Web End-to-End Client & Admin Journey tests (requires servers running):
npm test
```

---

## 9. File & Directory Map Reference

```text
DailyKitchen/
├── apps/
│   ├── web/                                 # Customer Web Storefront & Backoffice Admin
│   │   ├── app/
│   │   │   ├── layout.tsx                   # Root HTML shell & AppProviders wrapper
│   │   │   ├── page.tsx                     # Storefront Home (Hero, Catalog, Steppers)
│   │   │   ├── checkout/page.tsx            # Multi-step checkout & slot reservation
│   │   │   ├── orders/page.tsx              # Customer order history list
│   │   │   ├── orders/[id]/page.tsx         # Live order tracking timeline & receipt
│   │   │   ├── admin/
│   │   │   │   ├── layout.tsx               # Admin shell & RBAC session guard
│   │   │   │   ├── login/page.tsx           # Admin credentials authentication
│   │   │   │   ├── page.tsx                 # Operations KPIs & Pipeline dashboard
│   │   │   │   ├── orders/page.tsx          # Order fulfillment & state machine console
│   │   │   │   ├── inventory/page.tsx       # Stock ledger & delta adjustment modal
│   │   │   │   ├── catalog/page.tsx         # Category & produce variant management
│   │   │   │   ├── delivery/page.tsx        # Zone toggles & slot capacity scheduler
│   │   │   │   └── customers/page.tsx       # Customer directory & password reset tool
│   │   │   ├── api/
│   │   │   │   ├── auth/session/route.ts    # Next.js BFF session & HttpOnly cookie handler
│   │   │   │   └── admin/[...slug]/route.ts # Next.js BFF RBAC proxy to FastAPI
│   │   │   ├── contact/page.tsx             # Contact & Help page
│   │   │   ├── terms/page.tsx               # Terms of Service
│   │   │   ├── privacy/page.tsx             # Privacy Policy
│   │   │   └── refund-policy/page.tsx       # Freshness & Refund Guarantee Policy
│   │   ├── src/
│   │   │   ├── components/                  # Modals (AuthModal, LocationModal), UI atoms
│   │   │   ├── context/                     # AuthContext, CartContext, LocationContext
│   │   │   └── lib/api-client.ts            # Typed API client with single-flight mutex
│   │   └── tailwind.config.ts               # Theme tokens configuration
│   └── mobile/                              # React Native / Expo Mobile Customer App
├── backend/
│   ├── alembic/                             # Alembic database schema migrations
│   ├── app/
│   │   ├── api/v1/                          # API endpoints (auth, catalog, cart, orders, admin)
│   │   ├── core/                            # Settings, security, JWT, and CORS configs
│   │   ├── db/                              # Async database session and seed handlers
│   │   ├── models/                          # SQLAlchemy ORM declarative models
│   │   ├── schemas/                         # Pydantic v2 validation contracts
│   │   └── services/                        # Domain logic (auth, otp, pricing, orders)
│   └── tests/                               # 98 Pytest test suites
├── packages/
│   ├── contracts/                           # TypeScript interfaces generated from OpenAPI
│   ├── shared-utils/                        # Pricing, currency (₹), and weight formatters
│   ├── tokens/                              # Forest green brand color & typography tokens
│   └── validation/                          # Shared Zod validation schemas
├── docs/                                    # System architecture, ADRs, and verification reports
├── dailykitchen.db                          # Primary SQLite database file
└── package.json                             # Root npm workspaces manifest
```
