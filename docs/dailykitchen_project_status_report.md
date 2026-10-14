# DailyKitchen — Comprehensive Project & Architecture Report

**Status:** 🟢 **FULLY LIVE IN PRODUCTION**  
**Deployment Date:** October 14, 2026  
**Platform Infrastructure:** Vercel (Web Frontend) & Render (FastAPI & PostgreSQL Backend)  

---

## 1. Executive Summary

**DailyKitchen** is a modern, high-performance quick-commerce and farm-to-table kitchen platform engineered for seamless fresh produce discovery, time-slotted scheduled deliveries, and real-time operations control. 

As of **October 14, 2026**, the entire system is fully built, tested, integrated, and deployed live across production cloud environments. The application provides an ultra-responsive, glassmorphic customer storefront on Vercel paired with an asynchronous, high-throughput backend API powered by FastAPI and PostgreSQL on Render.

---

## 2. Live Cloud Environments & Entry Points

| Surface | Live URL / Endpoint | Purpose | Tech Stack |
| :--- | :--- | :--- | :--- |
| **Customer Storefront** | `https://daily-kitchen-ku6l.vercel.app` | Public discovery, ordering, and cart workflows | Next.js 14, React, Tailwind / CSS Variables |
| **Admin Operations Panel** | `https://daily-kitchen-ku6l.vercel.app/admin` | Catalog, inventory, pricing, and orders | Next.js App Router, Protected Admin Routes |
| **Backend REST API** | `https://dailykitchen.onrender.com/api/v1` | Core business logic, DB queries, auth, uploads | FastAPI, SQLAlchemy 2.0 Async, PostgreSQL |
| **API Documentation** | `https://dailykitchen.onrender.com/api/v1/docs` | Interactive OpenAPI / Swagger UI | OpenAPI 3.0 |

---

## 3. Core Architectural Workflows

```mermaid
graph TD
    subgraph Customer Experience
        A[User visits Storefront] --> B[Cinematic Hero & Produce Catalog]
        B --> C[Add to Cart & Select Delivery Slot]
        C --> D[Phone OTP / Password Authentication]
        D --> E[Checkout & Order Placement]
        E --> F[Order Status Tracking]
    end

    subgraph Admin Operations
        G[Admin Authenticates at /admin/login] --> H[Admin Operations Dashboard]
        H --> I[Category & Item Management]
        H --> J[Direct Image Uploads from Device]
        H --> K[Inline Quick Price Editor]
        H --> L[Order Processing & Dispatch]
    end

    subgraph Backend & Data Tier
        M[FastAPI Async Engine] --> N[(PostgreSQL on Render)]
        M --> O[Local & Cloud Media Storage /uploads]
        M --> P[Alembic & Auto-Lifespan Migrations]
    end

    Customer Experience <--> M
    Admin Operations <--> M
```

---

## 4. End-to-End Customer Workflow

### 4.1. Landing & Visual Discovery
* **Glassmorphic Navigation Bar:** Transparent, fluid header with sticky blur effects, brand emblem, search launcher, delivery zone indicator, and live cart counter.
* **Cinematic Hero Showcase:** Premium animated hero section featuring floating badges (100% Organic, 2-Hour Express Delivery, Direct from Farm), micro-interactions, and instant category quick-links.
* **Category Carousel & Filters:** High-speed filtering by produce categories (e.g., Farm Fresh Greens, Root Vegetables, Daily Staples, Exotic Herbs) with live pricing indicators.

### 4.2. Catalog & Item Exploration
* **Authoritative Selling Prices:** Each produce item displays real-time price per unit/weight (e.g., ₹45 / 500g) alongside Maximum Retail Price (MRP) and calculated discount savings.
* **Dynamic Inventory Stock Counters:** Real-time stock availability preventing checkout of exhausted inventory.
* **Organic Badges & Nutrition Metrics:** Rich product metadata, culinary tips, and origin farm details.

### 4.3. Cart & Slot Allocation
* **Sliding Cart Drawer & Full Cart Page:** Responsive cart showing order summary, item breakdown, taxes, and applied savings.
* **Delivery Zone & Pincode Verification:** Customer selects or verifies their neighborhood/pincode to confirm serviceability.
* **Time-Slotted Delivery Engine:** Morning (6:00 AM – 8:00 AM), Midday, or Evening delivery slots with capacity validation.

### 4.4. Authentication & Account Management
* **Dual Auth Modes:** Fast passwordless Phone OTP verification with 60-second cooldown guards, plus traditional password-based authentication.
* **Customer Code Generation:** Automatic assignment of permanent IDs (e.g., `DKC-XXXXX`).
* **Address Book:** Multi-address support (Home, Work, Other) with landmark instructions for riders.

### 4.5. Checkout & Tracking
* **Order Placement Pipeline:** Cryptographic order locking, stock reservation, and payment status verification.
* **Live Order Lifecycle:** Visual step progression (`Confirmed` &rarr; `In Preparation` &rarr; `Packed` &rarr; `Out for Delivery` &rarr; `Delivered`).

---

## 5. End-to-End Admin Workflow

### 5.1. Authentication & Security Gate
* **Role-Based Access Control (RBAC):** Strict JWT verification requiring `role: "admin"`. Unauthorized users attempting access are redirected.
* **Token Refresh Interception:** Seamless in-memory access token rotation backed by secure session cookies.

### 5.2. Admin Catalog & Pricing Control
* **Category Management:**
  * Create, update, toggle active/inactive status, and configure display order.
  * **Category Baseline Pricing (`default_price`):** Ability to configure a baseline price per category that can serve as a reference or default for newly added items.
* **Individual Item Pricing Controls:**
  * Independent price configuration for every single produce item (e.g., Potato, Tomato, Ginger) regardless of category.
  * Adjusting a category does **not** override custom item pricing.
  * **Inline Quick Price Editor:** Editable price inputs directly inside the produce table for one-click saving with instant visual feedback.

### 5.3. Native Device Image Upload Pipeline
* **Direct File Picker:** Admins upload images directly from their laptop, phone, or tablet via a native OS file dialog.
* **Client-Side Live Preview:** Instant image thumbnail rendered in the UI prior to submission.
* **Server-Side Validation:**
  * Enforces allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).
  * Enforces maximum file size limit (&le;5MB).
  * Pillow validation verifying image headers and preventing corrupt uploads.
  * Generates unique UUID filenames stored in `uploads/catalog/`.
* **Dynamic Production Proxying:** Next.js rewrite engine seamlessly routes `/uploads/:path*` requests on Vercel to Render's backend static storage without CORS blocks or broken image links.

### 5.4. Order Dispatch & Fulfillment
* **Operations Feed:** Real-time view of orders requiring kitchen assembly.
* **Status Controls:** One-click transitions from received to dispatched.

---

## 6. Technical Specifications & Architecture

### Backend Stack
* **Language & Framework:** Python 3.14+, FastAPI 0.110+
* **Database & ORM:** PostgreSQL (Production on Render) / SQLite (Local dev), SQLAlchemy 2.0 Async, aiosqlite, asyncpg
* **Schema & Migrations:** Alembic with automated startup lifecycle self-healing migrations
* **Media Handling:** Python-multipart, Pillow (PIL)
* **API Standards:** OpenAPI 3.0 specification, strict Pydantic v2 schemas

### Frontend Stack
* **Framework:** Next.js 14 (App Router)
* **State & Data Fetching:** Strongly typed API Client with automatic token refresh mutex
* **Styling & Design System:** Custom Glassmorphic design system, CSS Variables, Tailwind CSS
* **Build Validation:** Zero TypeScript compilation errors (`tsc --noEmit` clean)

### Security & CORS Topology
* **CORS Middleware:** Dynamic origin regex matching (`^https:\/\/.*\.vercel\.app$`), custom domains, and local environments (`localhost:3000`).
* **Fallback Headers on 500s:** Exception middleware attaches CORS headers to server errors to prevent browser opaque network drops.
* **Asset Privacy:** Runtime uploads excluded from git tracking via `.gitignore` while keeping `.gitkeep` anchors intact.

---

## 7. Verification & Production Checklist

- [x] **Storefront Accessibility:** Public routes live and rendering on Vercel.
- [x] **Admin Route Security:** `/admin/catalog` and `/admin/login` protected and operational.
- [x] **PostgreSQL Database:** All tables and columns (`categories.default_price`, etc.) synchronized.
- [x] **Image Uploads & Rewrites:** Device image picker uploads and renders on live domain.
- [x] **Inline Pricing Updates:** Real-time price updates immediately reflected across customer views.
- [x] **Automated Tests:** Backend test suite passing (`pytest backend/tests/test_catalog.py`).
- [x] **Version Control:** All code committed and pushed to `origin main` (Latest commit: `4eb4c01`).
