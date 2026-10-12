# DailyKitchen — Product Scope & Requirements

**Product Name:** DailyKitchen  
**Tagline / Brand Message:** *Fresh Food. Happy Homes.*  
**Date:** October 12, 2026  
**Status:** Approved for Phase 1 Baseline  

---

## 1. Product Overview & Vision
DailyKitchen is an on-demand fresh grocery delivery platform designed for Indian households. The platform guarantees freshness, transparent weight-based pricing, hyper-local delivery slots (Instant Express & Scheduled delivery), and a clean, accessible experience across mobile and web.

---

## 2. Platform Targets & Deliverables

| Platform | Target Audience | Primary Technologies | Distribution / Hosting |
| :--- | :--- | :--- | :--- |
| **Mobile App (Android & iOS)** | Daily grocery shoppers, instant order tracking | React Native, Expo, TypeScript, Expo Router | Google Play Store, Apple App Store, Expo EAS |
| **Customer Web Application** | Desktop, laptop, tablet, & mobile web shoppers | Next.js (App Router), TypeScript, Tailwind CSS | Vercel / Edge CDN |
| **Shared Backend API** | Unified business logic, cart, pricing, inventory | FastAPI (Python), Pydantic v2, SQLAlchemy 2 | Containerized cloud host (Fly.io / Render / AWS) |
| **Shared Database & Auth** | Authoritative data store & identity provider | PostgreSQL (production), SQLite (local dev), JWT/OTP | Managed Cloud DB (Supabase / Neon / RDS) |
| **Shared Frontend Packages** | Shared schemas, type definitions, contracts | TypeScript, Zod, NPM Workspaces | Internal Monorepo Packages |

---

## 3. Core Customer Journey

```
[Authentication / Guest Landing]
       ↓
[Location Selection / Pincode Check]
       ↓
[Browse Categories & Fresh Deals / Search]
       ↓
[Product Listing Page (PLP) & Filtering]
       ↓
[Product Details Page (PDP) & Weight Variants (250g, 500g, 1kg)]
       ↓
[Cart Addition & Real-Time Subtotal Calculation]
       ↓
[Delivery Slot Selection (Instant Express vs. Scheduled)]
       ↓
[Delivery Address Selection / Addition]
       ↓
[Order Review & Checkout Summary]
       ↓
[Payment Processing (UPI, Cards, Net Banking, COD)]
       ↓
[Order Confirmation & Live Order Tracking]
```

---

## 4. Key Functional Requirements

### 4.1 Authentication & Profile
- Password and OTP-based login options.
- Mobile number verification with +91 country code defaults for the Indian market.
- Email verification and forgot/reset password workflows.
- Secure session storage: HttpOnly Secure cookies for Web; Expo SecureStore for Mobile.
- Rate limiting for OTP issuance (max 5 requests per 10 minutes, 60s cooldown).

### 4.2 Location & Serviceability
- Pincode and GPS-assisted address capture.
- Serviceability verification against delivery zones.
- Support for multiple saved addresses tagged as "Home", "Work", or "Other".

### 4.3 Catalog & Pricing
- Hierarchical category structure (e.g., Greens, Daily Vegetables, Fresh Fruits, Exotics).
- Variant-level pricing (e.g., 250g, 500g, 1kg) with authoritative backend calculation.
- Stock availability and freshness assurance badges.

### 4.4 Cart & Checkout
- Persistent cart synchronized across user sessions.
- Dynamic delivery fee computation (e.g., Free delivery above ₹99 threshold).
- Packaging fee and taxes computation.
- Express vs. Scheduled delivery slot options (morning/evening windows).

### 4.5 Payment & Order Lifecycle
- Multi-channel payments: UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, and Cash on Delivery (COD).
- Webhook-verified payment transitions (Pending → Success → Order Placed).
- Order status history tracking (Placed → Packed → Out for Delivery → Delivered).
