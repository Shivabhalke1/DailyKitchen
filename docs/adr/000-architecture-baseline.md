# ADR 000 — Architecture Baseline & System Design

**Date:** October 12, 2026  
**Status:** Accepted  
**Deciders:** Senior Software Architect, Lead Engineers  

---

## 1. Context & Problem Statement
DailyKitchen requires a unified platform serving both mobile (Android/iOS) and responsive web customers, driven by a single backend API and shared business logic. We must establish an architecture baseline that supports:
1. Fast iteration across frontends without duplicated validation logic.
2. Robust, authoritative pricing, cart, and inventory rules in the backend.
3. Indian-market localized features (INR currency, +91 phone numbers, 4-digit OTP, UPI payment integration).
4. Zero-dependency friction for local development on developer machines while supporting production cloud deployment.

---

## 2. Decision

### 2.1 Monorepo Architecture
We adopt a monorepo structure utilizing **npm workspaces**:
- `apps/mobile`: Expo (React Native) with TypeScript and Expo Router.
- `apps/web`: Next.js 14+ (App Router) with React, TypeScript, and Tailwind CSS.
- `packages/contracts`: TypeScript type definitions matching backend API contracts.
- `packages/validation`: Zod validation schemas reused by both frontend applications.
- `packages/shared-utils`: Shared formatting (e.g., currency formatting for `₹`, weight displays `250g/500g/1kg`, date-time helpers).
- `backend/`: FastAPI backend service organized as a modular monolith.

### 2.2 Backend & Data Access
- **Framework:** FastAPI with Python 3.
- **Data Modeling:** Pydantic v2 for request/response serialization and schema enforcement.
- **ORM & Storage:** SQLAlchemy 2.0 with async engine support.
  - *Local Dev:* SQLite database file (`dailykitchen.db`) for instant local startup without external daemon requirements.
  - *Staging & Production:* PostgreSQL with connection pooling and Alembic migrations.
- **API Versioning:** All endpoints anchored at `/api/v1/`.

### 2.3 Authentication & Security
- **Dual Flow:** Password login AND 4-digit OTP login via phone number (+91 default).
- **Session Tokens:**
  - Standard JSON Web Tokens (JWT) access tokens (15-minute expiration).
  - Refresh tokens (7-day sliding expiration).
  - Web: Tokens handled via secure HttpOnly cookies where applicable.
  - Mobile: Tokens stored securely in Expo `SecureStore`.
- **Security Guardrails:** Passwords hashed with `bcrypt`. OTPs are never stored in plaintext and never leaked in API responses.

### 2.4 External Services & Configuration
- External providers (SMS/OTP gateway, Payment gateway, Email delivery) are abstracted behind dependency-injected service interfaces.
- Development mode uses mock adapters (e.g., mock OTP generator returning standard test codes in logs) so the entire suite runs offline.

---

## 3. System Architecture Diagram

```mermaid
graph TD
    subgraph Client Applications
        Mobile["Customer Mobile App<br/>(Expo React Native)"]
        Web["Customer Website<br/>(Next.js App Router)"]
    end

    subgraph Monorepo Shared Code
        Contracts["packages/contracts<br/>(TS Types)"]
        Validation["packages/validation<br/>(Zod Schemas)"]
        Utils["packages/shared-utils<br/>(Formatters)"]
    end

    Mobile -.-> Contracts
    Mobile -.-> Validation
    Mobile -.-> Utils
    Web -.-> Contracts
    Web -.-> Validation
    Web -.-> Utils

    subgraph Backend Core [backend/app - FastAPI]
        API["API Routers (/api/v1/)<br/>auth, catalog, cart, orders, payments"]
        AuthLayer["Authentication & Security<br/>(JWT, Bcrypt, Rate Limiting)"]
        Services["Business Service Layer<br/>(Cart, Pricing, Inventory, Delivery)"]
        Repo["Data Access / Repositories<br/>(SQLAlchemy 2.0)"]
    end

    Mobile -->|"HTTPS / JSON"| API
    Web -->|"HTTPS / JSON"| API
    API --> AuthLayer
    API --> Services
    Services --> Repo

    subgraph Data Stores
        DB[("Database<br/>SQLite (Dev) / PostgreSQL (Prod)")]
        Cache[("Cache & Rate Limit<br/>In-Memory (Dev) / Redis (Prod)")]
    end

    Repo --> DB
    AuthLayer --> Cache

    subgraph External Integrations (Service Adapters)
        SMS["SMS / OTP Provider<br/>(Mock Dev / Twilio / MSG91)"]
        Pay["Payment Gateway<br/>(Mock Dev / Razorpay / Cashfree)"]
    end

    Services --> SMS
    Services --> Pay
```

---

## 4. Consequences
- **Positive:** Maximum code reuse for validation rules and data types across Web and Mobile.
- **Positive:** Zero developer roadblocks: any developer can clone the repo and run both frontends and backend locally without needing PostgreSQL or Docker running initially.
- **Positive:** Strict backend authoritativeness prevents client-side price tampering or inventory desynchronization.
- **Trade-off:** Maintaining parity between Pydantic Python schemas and Zod TypeScript schemas is required, mitigated through well-defined contracts in `packages/contracts`.
