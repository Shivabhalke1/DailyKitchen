# DailyKitchen 🥦🥕🍎
> *Fresh Food. Happy Homes.*

DailyKitchen is a modern fresh grocery delivery platform designed for Indian households. It encompasses:
1. **Customer Mobile Application** (Android & iOS) built with React Native and Expo.
2. **Customer Web Application** (Responsive Desktop, Tablet, & Mobile) built with Next.js (App Router) and Tailwind CSS.
3. **Shared Backend API** built with FastAPI, Pydantic, and SQLAlchemy.
4. **Monorepo Shared Packages** for TypeScript contracts, Zod validations, and utility functions.

---

## 📁 Repository Structure

```text
DailyKitchen/
├── apps/
│   ├── mobile/         # React Native (Expo) customer mobile application
│   └── web/            # Next.js 14 (App Router) responsive customer web app
├── backend/
│   ├── app/            # FastAPI Modular Monolith (/api/v1/)
│   └── tests/          # Pytest backend test suites
├── packages/
│   ├── contracts/      # Shared API contracts & TypeScript interfaces
│   ├── validation/     # Shared Zod validation schemas
│   └── shared-utils/   # Formatters (INR ₹, weights, dates) & calculations
├── docs/
│   ├── adr/            # Architecture Decision Records
│   └── discovery/      # Phase 0 Product Scope & Discovery documents
└── README.md
```

---

## 📚 Architecture & Discovery Documentation
- [01 - Product Scope & Requirements](file:///Users/shivabhakle/Documents/DailyKitchen/docs/discovery/01-product-scope.md)
- [02 - Repository Audit & Environment Discovery](file:///Users/shivabhakle/Documents/DailyKitchen/docs/discovery/02-repository-audit.md)
- [ADR 000 - Architecture Baseline](file:///Users/shivabhakle/Documents/DailyKitchen/docs/adr/000-architecture-baseline.md)
- [03 - Feature Checklist & Journey Matrix](file:///Users/shivabhakle/Documents/DailyKitchen/docs/discovery/03-feature-checklist.md)
- [04 - Risk & Dependency Register](file:///Users/shivabhakle/Documents/DailyKitchen/docs/discovery/04-risk-dependency-register.md)
- [05 - Open Questions Resolution](file:///Users/shivabhakle/Documents/DailyKitchen/docs/discovery/05-open-questions-resolution.md)

---

## 🚦 Phase Roadmap
- **Phase 0:** Product Scope & Discovery ✅ (Completed)
- **Phase 1:** Architecture and Foundation (In Progress)
- **Phase 2:** Database and API Contracts
- **Phase 3:** Authentication Backend and Identity
- **Phase 4:** Day 2: Authentication Frontends (Mobile & Web)
- **Phase 5:** Home, Location, Search, and Categories
- **Phase 6:** Product Listing and Product Details
- **Phase 7:** Cart and Delivery Selection
- **Phase 8:** Address and Checkout
- **Phase 9:** Payment and Order Confirmation
- **Phase 10:** Backend Integration and Data Consistency
- **Phase 11:** QA, Security, and Accessibility
- **Phase 12:** Deployment and Production Readiness
