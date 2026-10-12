# DailyKitchen — Open Questions Resolution & Conventions

**Date:** October 12, 2026  
**Phase:** Phase 0 (Product Scope & Discovery)  

---

## 1. Resolution of Key Architecture Questions

### Question 1: Existing Codebase vs. Greenfield Monorepo?
- **Finding:** Inspection of `/Users/shivabhakle/Documents/DailyKitchen` verified that the directory was newly created and empty.
- **Resolution:** No legacy framework or conflicting conventions exist. We directly initialize the clean, production-ready Monorepo structure using standard npm workspaces with `apps/mobile`, `apps/web`, `packages/*`, and `backend/`.

### Question 2: Database Strategy for Local Development vs. Production?
- **Finding:** Neither PostgreSQL server nor Docker daemon is active on the local machine.
- **Resolution:** SQLAlchemy 2.0 with async SQLite (`sqlite+aiosqlite:///dailykitchen.db`) will be used as the default local development database. The database connection string is parameterized via environment variables (`DATABASE_URL`), allowing zero-code-change switching to PostgreSQL (`postgresql+asyncpg://...`) in staging and production.

### Question 3: What is the OTP format and handling?
- **Finding:** DailyKitchen project requirements specify a 4-digit OTP interface optimized for Indian mobile users (+91).
- **Resolution:**
  - Length: 4 digits.
  - Expiry: 5 minutes.
  - Resend cooldown: 60 seconds.
  - Rate limiting: Maximum 5 requests per phone number within a 10-minute window.
  - Development mode: Logs OTP clearly to server terminal or defaults to `1234` when `ENVIRONMENT=development`.

### Question 4: Free Delivery Threshold and Fees?
- **Resolution:**
  - Standard Delivery Charge: ₹40.
  - Free Delivery Threshold: Orders with cart subtotal ≥ ₹99 receive free delivery.
  - Packaging Fee: ₹10 flat fee for eco-friendly fresh produce packaging.
  - Instant Express Delivery: Optional ₹25 surcharge when available in customer's pincode.

### Question 5: Shared Code Boundaries?
- **Resolution:**
  - Shared logic across web and mobile is restricted to:
    - `@dailykitchen/contracts`: TypeScript types & interfaces for all API endpoints.
    - `@dailykitchen/validation`: Zod schemas for forms (login, registration, OTP, address, checkout).
    - `@dailykitchen/shared-utils`: Pure business calculations, currency formatters (`₹`), weight formatters (`250g`, `500g`, `1kg`).
  - React Native UI components and Next.js Web UI components remain separate to preserve optimal platform-specific ergonomics (e.g. React Native `View`/`Text`/`Pressable` vs. Next.js HTML5/Tailwind DOM).

---

## 2. Commit & Handover Criteria to Phase 1
Phase 0 discovery is officially complete with all findings and decisions documented. We are ready to proceed with Phase 1: Architecture and Foundation.
