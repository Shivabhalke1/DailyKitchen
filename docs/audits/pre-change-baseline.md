# DailyKitchen — Pre-Change Baseline Audit & Gap Analysis

**Date:** October 12, 2026  
**Auditor:** Principal Software Architect & Application Security Engineer  
**Document Path:** `docs/audits/pre-change-baseline.md`  
**Scope:** Initial state evaluation against Engineering, Security, Legal Compliance, Design System, and Launch Readiness criteria.  

---

## 1. Executive Summary & Current Repository State

The DailyKitchen repository currently contains Phase 0 discovery deliverables and the Phase 1 implementation plan:
- `README.md`
- `docs/adr/000-architecture-baseline.md`
- `docs/plans/phase-1-implementation-plan.md`
- `docs/discovery/01-product-scope.md`
- `docs/discovery/02-repository-audit.md`
- `docs/discovery/03-feature-checklist.md`
- `docs/discovery/04-risk-dependency-register.md`
- `docs/discovery/05-open-questions-resolution.md`

**Status:** Greenfield workspace with locked architecture. No legacy application code, no build artifacts, and no secrets exist in the directory. All development is ready to proceed cleanly according to locked architectural specifications.

---

## 2. Confirmed Architectural Baseline

| Layer | Confirmed Technology | Role & Boundary |
| :--- | :--- | :--- |
| **Monorepo** | npm workspaces (`apps/*`, `packages/*`) | Root workspace manager with unified TypeScript configuration |
| **Frontend Web** | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS | Responsive, accessible customer web portal (mobile, tablet, desktop) |
| **Frontend Mobile**| React Native, Expo, TypeScript, Expo Router | Customer mobile application for iOS and Android |
| **Backend API** | FastAPI, Python 3.14, Pydantic v2, SQLAlchemy 2.0 async | Authoritative modular monolith under `/api/v1/` |
| **Database** | SQLite + `aiosqlite` (Dev), PostgreSQL + `asyncpg` (Prod) | Relational storage with Alembic migrations |
| **Shared Core** | `@dailykitchen/contracts`, `@dailykitchen/validation`, `@dailykitchen/shared-utils`, `@dailykitchen/tokens` | Shared TS types, Zod schemas, formatters, and canonical design tokens |

---

## 3. Prioritized Gap Analysis Against Launch Readiness

We evaluated the current state against the 16 sections of the Master Engineering, Security, Legal Compliance & Launch-Readiness Prompt:

| Area | Current State | Target Launch Requirement | Severity / Priority |
| :--- | :--- | :--- | :--- |
| **Secrets & Source Control** | Clean, no secrets committed. Missing root `.gitignore`. | Strict `.gitignore` excluding `.env*`, `.venv`, `*.db`, caches, and build outputs before code is written. | **P1 (Immediate)** |
| **Canonical Design Tokens** | Planned separately in web/mobile. | Canonical shared token package (`@dailykitchen/tokens`) to guarantee zero theme drift. Strict ban on purple gradients, pill buttons, emoji icons. | **P2 (Architecture)** |
| **Legal & Regulatory (India)** | Documented in scope, no legal policy pages yet. | Public pages for Privacy Policy (DPDP Act aligned), Terms of Service, Cancellation/Refund Policy, Grievance Officer details (Consumer Protection E-Commerce Rules 2020). | **P2 (Compliance)** |
| **Pricing & Checkout Rules** | Rule defined: `subtotal >= 99`. | Clarify rule universally (`subtotal >= 99` gets free delivery, else ₹40; ₹10 packaging fee). Enforce backend-authoritative calculation. | **P1 (Integrity)** |
| **Security Controls** | Architected (JWT + 4-digit OTP, +91, rate-limiting, bcrypt/Argon2id). | Implemented on backend first with CORS allowlist, Pydantic request limits, and audit logs. | **P1 (Security)** |
| **Accessibility (WCAG 2.2 AA)** | Planned in UI primitives. | Semantic markup, visible focus rings, minimum 44px/48px touch targets, zero non-accessible color dependencies. | **P2 (Accessibility)** |
| **Automated Quality Gates** | Documented in Phase 1 plan. | Root scripts for `build`, `typecheck`, `test:backend`, `test:web`, `audit`. | **P2 (Quality)** |

---

## 4. Highest-Risk Confirmed Issues & Preventative Actions

1. **Risk: Secret Exposure via Untracked Configuration**
   - *Severity:* P1
   - *Evidence:* No root `.gitignore` is present yet.
   - *Action:* Create a comprehensive `.gitignore` immediately before creating any application directories, virtual environments, or environment template files.

2. **Risk: Frontend / Backend Calculation Divergence**
   - *Severity:* P1
   - *Evidence:* Checkout calculations could diverge if frontend and backend implement different rounding or fee rules.
   - *Action:* Codify single source of truth in `@dailykitchen/shared-utils` for client feedback, but enforce independent calculation in FastAPI service layer (`backend/app/services/pricing.py`).

3. **Risk: Design Drift & Prohibited Elements**
   - *Severity:* P2
   - *Evidence:* Without a canonical token package, web (Tailwind) and mobile (React Native StyleSheet) might drift in colors, radii, and typography.
   - *Action:* Create `packages/tokens` exporting CSS variables, Tailwind presets, and React Native style constants from a single definition.

---

## 5. Proposed Safe Implementation Sequence

To maintain architectural integrity and adhere to the strict phased methodology:

- **Step 1 (Root & Security Guards):**
  - Create root `.gitignore` (protecting all sensitive files).
  - Create root `package.json` (npm workspaces) and `tsconfig.base.json`.

- **Step 2 (Shared Core & Design Tokens):**
  - Scaffold `packages/tokens` (canonical green-led palette, spacing, radii, typography).
  - Scaffold `packages/contracts` (TypeScript interfaces for Auth, Catalog, Cart, Orders, Legal).
  - Scaffold `packages/validation` (Zod schemas for Auth, Address, Checkout).
  - Scaffold `packages/shared-utils` (INR currency `₹`, weight formatting, pricing rules).

- **Step 3 (Backend Foundation Hardening):**
  - Setup Python virtual environment & `requirements.txt`.
  - Implement FastAPI `/api/v1/` modular monolith structure with Pydantic v2 settings, CORS, async SQLite engine, and `/api/v1/health`.
  - Add automated Pytest test suite.

- **Step 4 (Frontend Foundations & UI Primitives):**
  - Setup Next.js 14 Web foundation consuming `@dailykitchen/tokens` and UI primitives (`Button`, `Input`, `Card`, `Badge`).
  - Setup Expo React Native Mobile foundation consuming `@dailykitchen/tokens` and mobile UI primitives.
  - Add legal policy page routes (`/privacy`, `/terms`, `/refund-policy`, `/contact`).

- **Step 5 (Verification & Quality Gates):**
  - Execute typecheck, test suites, and build verification.
  - Document results in Phase 1 verification log.
