# DailyKitchen Phase 6: Customer Mobile Experience (Expo / React Native) Implementation Plan

**Document Version:** 1.0.0  
**Status:** IMPLEMENTATION READY  
**Author:** Antigravity Autonomous Pair Programmer  
**Target:** `apps/mobile` (Expo Router 3 / React Native 0.74) & `@dailykitchen/*`

---

## 1. Executive Summary & Goals

Phase 6 delivers the **complete Customer Mobile Experience** for DailyKitchen built with Expo 51 and React Native 0.74, wired directly to the verified FastAPI backend on port 8000. 

Building upon the verified foundation from Phases 1–5, the mobile app replicates the full customer journey with native mobile ergonomic polish:
1. **Hardware-Backed Session Security:** Secure persistent credentials via `expo-secure-store` / encrypted storage without exposing tokens to untrusted JavaScript. Access tokens reside strictly in memory.
2. **Authoritative Backend Contracts:** 100% aligned with verified OpenAPI routes (`/api/v1/auth/refresh`, `/api/v1/delivery/zones/check`, `/api/v1/cart`, `/api/v1/orders`).
3. **Native Produce Discovery & Catalog:** Instant category filtering, produce cards with live stock badges, weight variant selector sheets, and search filtering.
4. **Authoritative Pricing & Recoverable Cart:** Live breakdown enforcing the locked invariants: ₹10 fixed packaging fee, ₹40 delivery fee below ₹99 merchandise subtotal, free delivery at or above ₹99.
5. **Mobile Checkout & Live Tracking:** Multi-address selector with inline creation, delivery slot selector, order placement, and 4-stage delivery tracking stepper.

---

## 2. Architecture & Security Safeguards

### 2.1 Mobile Network & Host Configuration
- Physical devices using Expo Go or Android emulator require access to the host machine's FastAPI backend.
- Centralize `EXPO_PUBLIC_API_URL` with dynamic LAN fallback:
  - Default: `http://localhost:8000/api/v1` (for iOS simulator / web).
  - Android Emulator: `http://10.0.2.2:8000/api/v1`.
  - Expo Go LAN: Configurable via environment variable or Expo constants host IP.

### 2.2 Secure Token Storage & Single-Flight Refresh
- **Persistent Refresh Token:** Stored securely using `expo-secure-store` (iOS Keychain / Android KeyStore) under key `dk_mobile_refresh_token`.
- **In-Memory Access Token:** Kept in memory module state. Never persisted in plain unencrypted AsyncStorage.
- **Mutex Refresh Lock:** Single-flight refresh coordinator (`refreshAuthSession()`) prevents concurrent 401 race conditions.

### 2.3 Strict Business Invariants
- Packaging fee is strictly **₹10.00**.
- Delivery fee is strictly **₹40.00** for subtotal < ₹99.00; **₹0.00** for subtotal ≥ ₹99.00.
- No client-side payment confirmation or fake webhooks.

---

## 3. Screen Structure & Navigation Layout

The mobile application utilizes `expo-router` file-based navigation with a bottom tab layout:

```
apps/mobile/
├── app/
│   ├── _layout.tsx                     # Root Stack + Global Providers (Auth, Location, Cart)
│   ├── (tabs)/                         # Main App Tabs
│   │   ├── _layout.tsx                 # Bottom Tab Navigator (Home, Categories, Orders, Profile)
│   │   ├── index.tsx                   # Home: Banner, Serviceability Header, Category Carousels, Featured Produce
│   │   ├── categories.tsx             # Full Category Browser with Produce Lists
│   │   ├── orders.tsx                 # Customer Order History List
│   │   └── profile.tsx                # Customer Profile, Addresses & Logout
│   ├── product/
│   │   └── [id].tsx                   # Produce Detail Sheet with Variant Picker
│   ├── cart.tsx                        # Full Screen Cart with Pricing Summary & Stepper
│   ├── checkout.tsx                    # Checkout: Address Picker, Slot Radio, Payment Choice
│   └── orders/
│       └── [id].tsx                    # Order Confirmation & Live Tracking Stepper
```

---

## 4. Implementation Steps (Phased Execution)

### Step 6.1: Mobile API Client & Secure Storage
- Create `apps/mobile/src/lib/api-client.ts`:
  - Port verified client patterns from Phase 5 to React Native.
  - Integrate token management using `expo-secure-store` (or secure polyfill for web/emulator preview).
  - Implement single-flight refresh lock.
  - Implement error handling with `ApiError` class.

### Step 6.2: State Management & Providers Layer
- **`AuthContext.tsx` (`apps/mobile/src/context/AuthContext.tsx`):**
  - Bootstrap session from secure store on mount.
  - `requestOtp(phone)`: initiates OTP challenge with 60s cooldown.
  - `verifyOtp(phone, otp)`: verifies 4-digit code and stores refresh token securely.
  - `logout()`: clears secure storage and revokes backend session.
- **`LocationContext.tsx` (`apps/mobile/src/context/LocationContext.tsx`):**
  - Persists customer PIN and zone metadata.
  - Validates PIN against `/api/v1/delivery/zones/check?pincode=...`.
- **`CartContext.tsx` (`apps/mobile/src/context/CartContext.tsx`):**
  - Authoritative pricing breakdown, item count, and line items.
  - Optimistic add/remove/update with rollback on failure.

### Step 6.3: Mobile Modals & Core Componentry
- **`AuthModal.tsx` (`apps/mobile/src/components/modals/AuthModal.tsx`):**
  - Bottom sheet modal for phone number entry.
  - Discrete 4-digit numeric OTP input with auto-advance.
  - Test helper button (`Use Test OTP: 1234`) displayed only in `__DEV__`.
- **`LocationModal.tsx` (`apps/mobile/src/components/modals/LocationModal.tsx`):**
  - 6-digit Indian PIN checker with instant serviceability confirmation.
- **`ProductCard.tsx` (`apps/mobile/src/components/catalog/ProductCard.tsx`):**
  - Produce image, fresh badge, weight variant dropdown/sheet, and stepper/add button.
- **`FloatingCartBar.tsx` (`apps/mobile/src/components/cart/FloatingCartBar.tsx`):**
  - Sticky bottom floating bar showing item count, total price, and "View Cart" CTA.

### Step 6.4: Catalog & Product Discovery (Home & Categories)
- **Home Screen (`app/(tabs)/index.tsx`):**
  - Location badge in header showing current serviceable area (`Koramangala - 560034`).
  - Search bar with live filtering.
  - Category horizontal chips.
  - Pricing policy highlight card.
  - Fresh produce product list with instant add-to-cart.
- **Categories Screen (`app/(tabs)/categories.tsx`):**
  - Side-by-side or tabbed category produce viewer (Leafy Greens, Vegetables, Fruits).

### Step 6.5: Cart Screen & Authoritative Pricing (`app/cart.tsx`)
- Line items listing with produce snapshot, variant weight, and unit price.
- Quantity adjustment stepper (bounded between 1 and 20).
- Authoritative Pricing Card:
  - Merchandise Subtotal.
  - Fixed Packaging Fee (₹10.00).
  - Delivery Fee (₹40.00 or ₹0.00 if ≥ ₹99.00).
  - Free delivery progress indicator bar.
- Proceed to Checkout CTA.

### Step 6.6: Checkout Screen (`app/checkout.tsx`)
- **Step 1: Delivery Address Selection:**
  - Radio list of customer's saved addresses.
  - "+ Add New Address" sheet modal validating 6-digit PIN and `label: 'home'`.
- **Step 2: Delivery Slot Picker:**
  - Date & slot selector queried from `/api/v1/delivery/slots`.
- **Step 3: Payment Method:**
  - Cash on Delivery (`cod`) and UPI options.
- **Step 4: Atomic Order Placement:**
  - Calls `POST /api/v1/orders`.
  - On success, clears cart state and navigates to `/orders/[id]`.

### Step 6.7: Order Tracking & History Screens
- **Order Tracking (`app/orders/[id].tsx`):**
  - Header with order number (`DK-...`) and order date.
  - 4-Stage visual stepper:
    1. *Order Placed*
    2. *Harvested & Packed*
    3. *Out for Delivery*
    4. *Delivered*
  - Delivery slot and destination address summary cards.
  - Immutable line items list (`product_name_snap`, `weight_label_snap`, `line_total`).
- **Order History (`app/(tabs)/orders.tsx`):**
  - List of past orders with status badges and quick tracking link.

### Step 6.8: Verification, Testing & Monorepo Validation
- Add mobile unit test suite in `apps/mobile/tests/mobile-client.test.js`.
- Run full typecheck: `npm run typecheck` across all 6 packages (must exit with 0 errors).
- Verify Expo Metro bundler compilation on port 8081 without bundling warnings.
- Run automated end-to-end integration test validating mobile client calls to FastAPI backend.
- Record verification audit in `docs/audits/phase-6-verification.md`.

---

## 5. Acceptance Criteria Checklist

- [ ] Mobile app runs on Expo Metro bundler (port 8081) with zero runtime bundling crashes.
- [ ] No tokens stored in plain unencrypted storage; refresh token in secure storage; access token in memory.
- [ ] OTP login with 4-digit discrete inputs and 60-second cooldown enforcement.
- [ ] Location checker confirms serviceability for `560034` against live backend.
- [ ] Produce catalog loads dynamically with real categories and variants.
- [ ] Cart reflects authoritative server pricing with fixed ₹10 packaging fee and ₹99 free delivery threshold.
- [ ] Optimistic cart mutations recover gracefully on error.
- [ ] Checkout successfully places order via `POST /api/v1/orders` and navigates to tracking screen.
- [ ] `npm run typecheck` passes with **0 errors** across all 6 monorepo workspaces.
- [ ] Backend test suite (85/85 tests) remains 100% passing.
