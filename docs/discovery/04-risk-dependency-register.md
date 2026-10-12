# DailyKitchen — Risk & Dependency Register

**Date:** October 12, 2026  
**Phase:** Phase 0 (Product Scope & Discovery)  

---

## 1. Risk Register

| Risk ID | Description | Severity | Probability | Mitigation Strategy | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Price/Inventory calculation discrepancy between client and backend | High | Medium | **Backend authoritative rule:** Client calculations are solely for immediate UX feedback; the backend recomputes all subtotals, packaging charges, delivery fees, and discounts before issuing payment intents and creating orders. | Backend Lead |
| **RSK-02** | OTP SMS delivery latency or third-party provider failure | Medium | Medium | Provide mock OTP generation during development/testing; implement fallback to Email verification; enforce exponential backoff and rate limits to prevent provider exhaustion. | Auth Lead |
| **RSK-03** | Local developer environment discrepancies (Node vs Python, OS variations) | Medium | Low | Monorepo architecture with clean package boundaries; SQLite fallback allows instantaneous backend boots without requiring external Postgres/Docker setup. | Architect |
| **RSK-04** | Payment state mismatch (User drops off after paying or network drops) | High | Medium | Implement idempotent payment webhooks with cryptographic signature verification; store pending transaction logs before redirection. | Payment Lead |
| **RSK-05** | Form validation discrepancies between Web and Mobile | Low | Medium | Single source of truth via `@dailykitchen/validation` package containing shared Zod schemas consumed by React Hook Form on both platforms. | Frontend Lead |

---

## 2. External Service Dependencies

| Dependency | Purpose | Development Mode | Production Mode |
| :--- | :--- | :--- | :--- |
| **SMS / OTP Service** | 4-digit OTP delivery for phone logins | Mock In-Memory Provider (Logs OTP to console / fixed test OTP `1234`) | Twilio / MSG91 API |
| **Payment Gateway** | UPI, Net Banking, Card processing | Mock Checkout / Test Gateway | Razorpay / Cashfree / Stripe |
| **Database** | Primary storage for products, orders, users | SQLite local (`dailykitchen.db`) | PostgreSQL (Managed Instance) |
| **Maps / Geocoding** | Pincode / Address resolution | Pre-seeded Pincode lookup table | Google Maps Platform / OpenStreetMap |
| **File / Media Storage**| Product images, banners | Local static asset serving | AWS S3 / Cloudflare R2 |
