# Phase 1 — Architecture & Foundation Implementation Plan

**Product Name:** DailyKitchen  
**Document:** Phase 1 Detailed Implementation Plan  
**Target:** Monorepo scaffolding, Shared packages, Backend baseline, Web & Mobile foundations, Design tokens, and CI/Verification standards.  
**Date:** October 12, 2026  
**Status:** Implementation Ready  

---

## 1. Objectives & Executive Summary

Phase 1 establishes the concrete, production-grade foundation for DailyKitchen across all four pillars:
1. **Monorepo & Shared Core:** Setup npm workspaces linking `@dailykitchen/contracts`, `@dailykitchen/validation`, and `@dailykitchen/shared-utils`.
2. **Backend Engine:** Scaffolding the FastAPI modular monolith with Pydantic v2 settings, CORS configuration, SQLite/PostgreSQL database connectivity, and an automated `/api/v1/health` test suite.
3. **Web Application:** Scaffolding Next.js (App Router) with Tailwind CSS, custom DailyKitchen green-led design tokens, responsive layouts, and reusable UI primitives (`Button`, `Input`, `Card`, `Badge`).
4. **Mobile Application:** Scaffolding Expo React Native with TypeScript, Expo Router, shared design tokens, and matching mobile UI primitives.
5. **Quality & Tooling:** Unified `.gitignore`, TypeScript base configurations, and verification scripts.

---

## 2. Directory Layout to Establish in Phase 1

```text
DailyKitchen/
├── .gitignore
├── README.md
├── package.json                   # Root monorepo workspace configuration
├── tsconfig.base.json             # Shared TypeScript compiler options
│
├── packages/
│   ├── contracts/                 # @dailykitchen/contracts
│   │   ├── src/
│   │   │   ├── auth.ts            # Auth request/response interfaces
│   │   │   ├── catalog.ts         # Category, Product, Variant interfaces
│   │   │   ├── cart.ts            # Cart, CartItem, Pricing interfaces
│   │   │   ├── order.ts           # Order, OrderStatus, Delivery interfaces
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── validation/                # @dailykitchen/validation
│   │   ├── src/
│   │   │   ├── auth.schema.ts     # Zod schemas for login, register, OTP
│   │   │   ├── address.schema.ts  # Zod schemas for address entry
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared-utils/              # @dailykitchen/shared-utils
│       ├── src/
│       │   ├── currency.ts        # formatINR (e.g., ₹249.00)
│       │   ├── weight.ts          # formatWeight (250g, 500g, 1kg)
│       │   ├── pricing.ts         # Cart fee, packaging, free delivery calculations
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI app initialization & routing
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py          # Environment settings (pydantic-settings)
│   │   │   └── security.py        # Token utilities & hashing stubs
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py         # SQLAlchemy engine & session maker
│   │   │   └── base.py            # Declarative base
│   │   └── api/
│   │       ├── __init__.py
│   │       └── v1/
│   │           ├── __init__.py
│   │           ├── api.py         # Root v1 router
│   │           └── endpoints/
│   │               ├── __init__.py
│   │               └── health.py  # Health check endpoint
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_health.py         # Pytest health check test
│   ├── requirements.txt           # Python dependencies
│   └── .env.example
│
├── apps/
│   ├── web/                       # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout with navbar & footer
│   │   │   ├── page.tsx           # Home landing foundation
│   │   │   └── globals.css        # Tailwind directives & CSS tokens
│   │   ├── src/
│   │   │   ├── components/ui/     # Button, Input, Card, Badge
│   │   │   └── theme/             # Web theme tokens & colors
│   │   ├── tailwind.config.ts
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── mobile/                    # Expo React Native App
│       ├── app/
│       │   ├── _layout.tsx        # Expo Router root Stack layout
│       │   └── index.tsx          # Initial entry screen
│       ├── src/
│       │   ├── components/ui/     # Button, Input, Card, Badge (RN)
│       │   └── theme/             # Mobile colors, typography, spacing tokens
│       ├── app.json
│       ├── package.json
│       └── tsconfig.json
│
└── docs/
    └── plans/
        └── phase-1-implementation-plan.md
```

---

## 3. Step-by-Step Task Breakdown

### Task 1.1: Root Monorepo Configuration
- Create `.gitignore` covering `node_modules`, `.next`, `.expo`, `__pycache__`, `*.pyc`, `*.db`, `.env`, and build artifacts.
- Create root `package.json` with npm workspaces configured:
  ```json
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
  ```
- Add top-level scripts:
  - `npm run build`: builds shared packages and web app
  - `npm run typecheck`: runs TypeScript type-checking across all workspaces
  - `npm run dev:web`: starts Next.js dev server
  - `npm run dev:mobile`: starts Expo development server
  - `npm run dev:backend`: starts FastAPI uvicorn server
- Create `tsconfig.base.json` with strict type checking, ES2022 target, and path mapping for `@dailykitchen/*`.

### Task 1.2: Shared Packages Setup
1. **`packages/contracts`**:
   - Define TypeScript interfaces:
     - `User`, `AuthTokenResponse`, `LoginRequest`, `RegisterRequest`, `OTPRequest`, `OTPVerifyRequest`
     - `Category`, `Product`, `ProductVariant` (with weight, price, originalPrice, stock)
     - `CartItem`, `CartSummary`, `DeliverySlot`, `Address`, `OrderSummary`
     - `ApiResponse<T>` envelope
2. **`packages/validation`**:
   - Install `zod`
   - Define and export:
     - `loginSchema` (validates 10-digit Indian mobile or valid email + password)
     - `registerSchema` (fullName, 10-digit mobile with +91, email, password matching confirmPassword)
     - `otpSchema` (4-digit numeric string)
     - `addressSchema` (pincode 6 digits, house/flat, street, landmark, city, state)
3. **`packages/shared-utils`**:
   - `formatINR(amount: number): string` -> `₹199`
   - `formatWeight(grams: number): string` -> `250g`, `500g`, `1kg`
   - `calculateCartTotals(...)` -> calculates subtotal, packaging fee (₹10), delivery fee (₹40 or ₹0 if subtotal ≥ ₹99), and final total.

### Task 1.3: Backend Foundation (`backend/`)
- Create `backend/requirements.txt`:
  - `fastapi>=0.110.0`
  - `uvicorn[standard]>=0.28.0`
  - `pydantic>=2.6.0`
  - `pydantic-settings>=2.2.0`
  - `sqlalchemy>=2.0.28`
  - `aiosqlite>=0.20.0`
  - `pytest>=8.1.0`
  - `httpx>=0.27.0`
- Create `backend/app/core/config.py`:
  - Pydantic `Settings` class reading from environment variables
  - `PROJECT_NAME="DailyKitchen API"`
  - `API_V1_STR="/api/v1"`
  - `DATABASE_URL="sqlite+aiosqlite:///./dailykitchen.db"`
  - `CORS_ORIGINS=["http://localhost:3000", "http://localhost:8081"]`
  - `SECRET_KEY="dailykitchen-development-secret-key-change-in-production"`
- Create `backend/app/db/session.py` with async engine and `get_db` dependency.
- Create `backend/app/api/v1/endpoints/health.py`:
  - `GET /api/v1/health` returning `{ "status": "healthy", "service": "DailyKitchen API", "version": "1.0.0" }`
- Create `backend/app/main.py` assembling the FastAPI app, adding CORS middleware, and mounting `/api/v1`.
- Add test `backend/tests/test_health.py` and verify with Pytest.

### Task 1.4: Web Application Foundation (`apps/web/`)
- Setup Next.js with TypeScript and Tailwind CSS.
- Configure `tailwind.config.ts` with DailyKitchen design tokens:
  - Primary Green: `emerald-700` (`#15803d`), Primary Light: `emerald-50` (`#ecfdf5`), Emerald Accent: `#10b981`
  - Secondary: Warm Amber (`#f59e0b`)
  - Background: Pure White and Off-White Slate (`#f8fafc`)
  - Text: Slate 900 (`#0f172a`), Muted: Slate 500 (`#64748b`)
- Implement Core UI Primitives in `apps/web/src/components/ui/`:
  - `Button`: Primary, Secondary, Outline, Ghost, Sizes (sm, md, lg), loading spinner state.
  - `Input`: Label, Error message, left/right icon slots, focus rings.
  - `Card`: Border, shadow, rounded padding.
  - `Badge`: Variants for "Fresh Today", "Discount", "Express Delivery".
- Implement Global Navigation Shell:
  - Header with Logo, Delivery Location selector, Search bar preview, Cart icon badge.
  - Footer with Brand message ("Fresh Food. Happy Homes."), quick links, and copyright.

### Task 1.5: Mobile Application Foundation (`apps/mobile/`)
- Setup Expo React Native project with TypeScript and Expo Router.
- Setup `src/theme/`:
  - `colors.ts`: Harmonious green palette matching the web tokens.
  - `spacing.ts`: 4pt/8pt grid (4, 8, 12, 16, 24, 32).
  - `typography.ts`: Title, Headline, Body, Caption sizes and weights.
- Implement Mobile UI Primitives in `apps/mobile/src/components/ui/`:
  - `Button`: Touchable with press states, loading spinner, and rounded corners.
  - `Input`: TextInput with label, secureTextEntry toggle support, and error state.
  - `Card`: Elevated view with subtle shadow and border.
  - `Badge`: Pill badge with matching colors.
- Setup `app/_layout.tsx` (Expo Router Stack) and initial `app/index.tsx` screen rendering the branding and welcome screen.

---

## 4. Developer Coordination & Ownership

| Developer | Assigned Scope in Phase 1 | Owned Files |
| :--- | :--- | :--- |
| **Developer 1 (Architect / Lead)** | Monorepo configuration, shared packages (`contracts`, `validation`, `shared-utils`), root scripts, Git branching model | `package.json`, `.gitignore`, `tsconfig.base.json`, `packages/*` |
| **Developer 2 (Backend)** | FastAPI application scaffolding, configuration, database session, health endpoint, pytest test suite | `backend/app/*`, `backend/requirements.txt`, `backend/tests/*` |
| **Developer 3 (Web)** | Next.js App Router scaffolding, Tailwind theme tokens, Web UI primitives (`Button`, `Input`, `Card`, `Badge`), Navbar & Footer shell | `apps/web/*` |
| **Developer 4 (Mobile)** | Expo React Native scaffolding, Expo Router layout, Mobile design tokens, Mobile UI primitives | `apps/mobile/*` |

---

## 5. Verification & Testing Checklist

1. **Monorepo Linkage:**
   - [ ] Run `npm run typecheck` across root workspaces; verify clean compilation with 0 errors.
   - [ ] Verify that `apps/web` and `apps/mobile` can import `@dailykitchen/contracts`, `@dailykitchen/validation`, and `@dailykitchen/shared-utils`.
2. **Backend Health Check:**
   - [ ] Python virtual environment created and dependencies installed.
   - [ ] Run Pytest: `pytest backend/tests/test_health.py` passes with HTTP 200 and `{ status: "healthy" }`.
   - [ ] Start uvicorn server and verify `/api/v1/health` and `/docs` (OpenAPI Swagger UI) respond cleanly.
3. **Web Application Build:**
   - [ ] Run Next.js build or dev server: verify no build or CSS errors.
   - [ ] Verify UI primitives render cleanly with responsive styling.
4. **Mobile Application Verification:**
   - [ ] Verify Expo TypeScript compilation and configuration file validity.
   - [ ] Verify UI primitives export without React Native type errors.

---

## 6. Definition of Done (DoD) for Phase 1

- [ ] All four workspaces (`backend/`, `packages/`, `apps/web/`, `apps/mobile/`) are structured and active.
- [ ] Shared packages compile and export types, schemas, and formatting functions.
- [ ] FastAPI backend boots and passes automated health check tests.
- [ ] Web and Mobile share identical brand design tokens and UI component interfaces.
- [ ] No secrets committed; `.gitignore` strictly protects `.env`, virtual environments, and build caches.
- [ ] Phase 1 git commit created on `main`.
