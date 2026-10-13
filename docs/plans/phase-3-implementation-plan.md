# Phase 3 — Authentication Backend & Identity Implementation Plan (Revised)

**Product Name:** DailyKitchen  
**Document:** Phase 3 Detailed Implementation Plan (Revision 2 — Post-Review Hardening)  
**Target:** Phone-First OTP Authentication, Keyed HMAC-SHA256 Verification, Persistent Refresh Sessions with Replay Detection, Password Fallback, Profile & Address Management Endpoints, Rate Limiting & Cooldown Safety.  
**Date:** October 12, 2026  
**Status:** Approved for Implementation  

---

## 1. Objectives & Executive Summary

Phase 3 establishes the complete, production-grade authentication, identity, and session security foundation for **DailyKitchen**. This revised plan incorporates all mandatory security requirements:

### Key Enforcements & Architectural Decisions:
1. **Persistent Refresh Sessions (`user_sessions`) with Replay Detection:**
   - Stateless JWTs are insufficient for secure refresh token rotation. We introduce a persistent `user_sessions` model.
   - Tokens belong to a cryptographic session family (`family_id`).
   - When a refresh token is used, it is rotated atomically. If a previously used refresh token is presented again (replay attack), the **entire session family is immediately revoked**, preventing token theft exploitation.
   - Supports explicit session revocation on logout (`POST /api/v1/auth/logout`) and global session termination.
2. **Zero Plaintext OTP Logging & Controlled Dev Delivery:**
   - Plaintext OTPs are **never written to application logs or database records**, even in development.
   - In development/testing, OTP delivery is routed through a controlled in-memory delivery fixture (`TestDeliveryProvider` / `/api/v1/auth/test/last-otp`), completely segregated from production log sinks.
   - Fixed test code `1234` is strictly restricted to `ENVIRONMENT in ('development', 'test')` and fails immediately if deployed to staging or production.
3. **Hardened JWT Validation & Cryptographic Separation:**
   - Dedicated `JWT_SECRET_KEY` separate from `OTP_SECRET`.
   - Startup validation enforces high-entropy secrets (minimum 32 random characters). Hardcoded fallbacks are blocked in non-development modes.
   - Pinned signing algorithm: `HS256`.
   - Strict claim verification: `exp` (expiry), `iat` (issued at), `sub` (user UUID), `type` (`"access"` vs `"refresh"`), `iss` (`"dailykitchen"`), and `aud` (`"dailykitchen-client"`).
4. **Anti-Enumeration, Rate Limiting & Concurrency Safety:**
   - Response parity: OTP send and password login endpoints return identical message structures to prevent account enumeration.
   - Rate limiting: Maximum 5 OTP requests per phone number and per IP in a sliding 10-minute window, plus the locked 60-second resend cooldown.
   - Concurrency safety: Atomic database row updates for OTP verification prevent race conditions on the 3-attempt limit.
5. **Modern Password Hashing Standard:**
   - Password hashing utilizes **PBKDF2-HMAC-SHA256 with 600,000 iterations** (OWASP 2023+ standard) and a 32-byte cryptographic salt.
6. **Full Address Book CRUD & Ownership Enforcement:**
   - Added missing address update endpoint: `PATCH /api/v1/users/me/addresses/{id}`.
   - Strict tenant isolation: every address query and mutation verifies `address.user_id == current_user.id`.
7. **Strict Git Governance:**
   - Zero commits, zero pushes, zero history rewrites during development.

---

## 2. Database Schema Additions for Phase 3

To support persistent refresh sessions and token rotation replay detection, Phase 3 introduces model 19:

### Model 19: `user_sessions` (`UserSession`)
- `id`: UUID PK (`String(36)`)
- `user_id`: UUID FK (`users.id`, `ondelete="CASCADE"`), indexed, not null.
- `refresh_token_hash`: `String(64)`, unique, indexed, not null (SHA-256 hash of issued refresh token).
- `family_id`: `String(36)`, indexed, not null (UUID tracking the token rotation lineage).
- `is_revoked`: `Boolean`, default `False`, not null.
- `expires_at`: `DateTime(timezone=True)`, not null (7-day sliding window).
- `user_agent`: `String(255)`, nullable.
- `ip_address`: `String(45)`, nullable.
- `created_at`: `DateTime(timezone=True)`, not null.
- `updated_at`: `DateTime(timezone=True)`, not null.
- Indexes: `(user_id, is_revoked, expires_at)`, `(family_id, is_revoked)`.

*Note: This addition is implemented cleanly via an Alembic migration (`phase3_user_sessions`) preserving the Phase 2 baseline.*

---

## 3. API Endpoints Specification

All endpoints are mounted under `/api/v1/` and return the uniform response envelope:
`ApiResponse[T] = { success: bool, data: Optional[T], error: Optional[ApiError] }`

### 3.1 Authentication & Session Management (`/api/v1/auth/`)

| Method | Path | Auth | Request Body | Response Payload | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/otp/send` | Public | `OtpSendRequest` | `OtpSendResponse` | Initiates OTP challenge. Enforces 60s cooldown & 5 req/10m limit. |
| `POST` | `/api/v1/auth/otp/verify` | Public | `OtpVerifyRequest` | `AuthTokenResponse` | Verifies OTP, initializes account if new, creates `user_sessions` row, issues tokens. |
| `POST` | `/api/v1/auth/register` | Public | `RegisterRequest` | `AuthTokenResponse` | Phone/email registration with password; creates user and session. |
| `POST` | `/api/v1/auth/login` | Public | `LoginRequest` | `AuthTokenResponse` | Password login fallback (accepts phone or email). |
| `POST` | `/api/v1/auth/refresh` | Public | `RefreshTokenRequest` | `AuthTokenResponse` | Rotates refresh token atomically; revokes family if reused. |
| `POST` | `/api/v1/auth/logout` | Bearer | `RefreshTokenRequest` | `{ message: str }` | Revokes the current refresh session. |
| `GET` | `/api/v1/auth/me` | Bearer | None | `UserRead` | Retrieves current authenticated customer and profile. |
| `GET` | `/api/v1/auth/test/last-otp` | Dev/Test | None (Dev Only) | `{ phone: str, otp: str }` | Test delivery inspector (returns 404 in staging/prod). |

### 3.2 Customer Profile & Address Book (`/api/v1/users/`)

| Method | Path | Auth | Request Body | Response Payload | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `PATCH` | `/api/v1/users/me/profile` | Bearer | `ProfileUpdate` | `ProfileRead` | Updates customer full name and avatar URL. |
| `GET` | `/api/v1/users/me/addresses` | Bearer | None | `List[AddressRead]` | Lists all saved customer delivery addresses. |
| `POST` | `/api/v1/users/me/addresses` | Bearer | `AddressCreate` | `AddressRead` | Adds a new delivery address; handles atomic default switching. |
| `PATCH` | `/api/v1/users/me/addresses/{id}`| Bearer | `AddressUpdate` | `AddressRead` | Updates an existing address; strictly verifies customer ownership. |
| `PUT` | `/api/v1/users/me/addresses/{id}/default` | Bearer | None | `AddressRead` | Atomically designates address as default; unsets prior default. |
| `DELETE`| `/api/v1/users/me/addresses/{id}` | Bearer | None | `{ message: str }` | Deletes a delivery address after ownership verification. |

---

## 4. Cryptography, Rate Limiting & Session Architecture

### 4.1 Keyed HMAC-SHA256 OTP Algorithm
```python
def hash_otp(phone: str, otp_code: str, secret: str) -> str:
    """Computes a keyed HMAC-SHA256 hash using the dedicated OTP_SECRET."""
    payload = f"{phone}:{otp_code}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

def verify_otp_hash(phone: str, otp_code: str, stored_hash: str, secret: str) -> bool:
    """Constant-time comparison preventing timing attacks."""
    computed = hash_otp(phone, otp_code, secret)
    return hmac.compare_digest(computed, stored_hash)
```

### 4.2 Refresh Token Rotation with Replay Detection
```text
Client presents Refresh Token (RT_1)
        │
        ▼
Lookup SHA-256 hash in user_sessions
        │
   ┌────┴────────────────────────┐
   │ Found & Not Revoked         │ Found but Already Revoked / Rotated
   ▼                             ▼
1. Mark RT_1 as is_revoked=True  1. REPLAY DETECTED!
2. Issue new RT_2 in same family 2. Revoke ALL sessions with matching family_id
3. Issue new 15-min Access Token 3. Return HTTP 401 Unauthorized
```

### 4.3 PBKDF2 Password Hashing Specification
- **Algorithm:** PBKDF2 with HMAC-SHA256
- **Iterations:** 600,000 (compliant with current OWASP recommendations)
- **Salt:** 32 cryptographically random bytes (`secrets.token_bytes(32)`)
- **Format:** `pbkdf2_sha256$600000$<salt_hex>$<hash_hex>`

---

## 5. Implementation Sequence & Plan Steps

```text
Step 3.1: Cryptography & Security Core
├── Update backend/app/core/config.py with dedicated JWT_SECRET_KEY, OTP_SECRET, and startup validation
└── Create backend/app/core/security.py:
    ├── hash_otp(), verify_otp_hash()
    ├── hash_password(), verify_password() (600,000 iter PBKDF2)
    └── create_access_token(), create_refresh_token(), decode_token()

Step 3.2: UserSession Model & Migration
├── Create backend/app/models/session.py (UserSession model)
├── Register in backend/app/models/__init__.py
└── Generate & run Alembic migration: add_user_sessions_table

Step 3.3: OTP Service Layer & Test Delivery Provider
├── backend/app/services/otp_service.py:
    ├── TestDeliveryProvider (in-memory fixture, zero log leakage)
    ├── request_otp() (cooldown, invalidation, rate limits, no account disclosure)
    └── verify_otp() (atomic attempt increment, expiry, constant-time compare)

Step 3.4: Authentication & Session Service
├── backend/app/services/auth_service.py:
    ├── authenticate_or_register_via_otp()
    ├── authenticate_via_password()
    ├── register_customer()
    ├── rotate_refresh_token() (family replay detection)
    └── revoke_session() (logout)

Step 3.5: FastAPI Security Dependencies
├── backend/app/api/deps.py:
    ├── get_current_user() (Bearer token decode, active check)
    ├── get_current_admin() (Role check: role == 'admin')
    └── get_optional_user() (Guest vs authenticated resolution)

Step 3.6: REST Routers Implementation
├── backend/app/schemas/ (add Session schemas, AddressUpdate)
├── backend/app/api/v1/endpoints/auth.py
├── backend/app/api/v1/endpoints/users.py (Profile & full Address CRUD)
└── backend/app/api/v1/api.py (Mount auth and users routers)

Step 3.7: TypeScript Contracts & OpenAPI Synchronization
├── Export OpenAPI specification to docs/contracts/openapi.json
├── Run openapi-typescript in packages/contracts
└── Verify npm run typecheck across monorepo

Step 3.8: Comprehensive Pytest Test Suite
├── backend/tests/test_auth.py:
    ├── OTP challenge, cooldown, 5-min expiry, attempt lockout
    ├── Zero plaintext logging verification
    ├── Refresh token rotation and replay family revocation
    ├── Deactivated user token rejection
    ├── Address CRUD ownership isolation and single-default atomicity
    └── Admin role restriction tests

Step 3.9: Audit & Verification Documentation
└── Record complete results in docs/audits/phase-3-verification.md
```

---

## 6. Acceptance Criteria & Definition of Done for Phase 3

1. **OTP Security:** 4-digit codes hashed with keyed HMAC-SHA256; 60s cooldown enforced with HTTP 429; strictly 5-minute expiry; max 3 attempts atomically enforced; older challenges invalidated upon resend; zero plaintext OTPs in logs.
2. **Session Rotation & Replay Detection:** Refresh tokens persist in `user_sessions`; rotation is atomic; presentation of a previously used token revokes the entire session family immediately.
3. **Password Security:** PBKDF2-HMAC-SHA256 with 600,000 iterations and 32-byte salt; constant-time verification.
4. **Address Management:** Complete CRUD (`GET`, `POST`, `PATCH`, `PUT /default`, `DELETE`) with strict ownership enforcement (`address.user_id == current_user.id`) and single-default address atomicity.
5. **Role-Based Controls:** Endpoints properly distinguish public, customer, and admin roles (`HTTP 401` on unauthenticated, `HTTP 403` on unauthorized).
6. **Contract Parity:** `packages/contracts` re-exports generated types from the updated OpenAPI schema with 0 type errors across the workspace.
7. **Automated Testing:** 100% of auth, session, and address test cases pass in Pytest with clean rollbacks.
8. **Audit Documentation:** Real execution commands, test outputs, and evidence documented in `docs/audits/phase-3-verification.md`.
9. **Git Governance:** Zero commits, zero pushes, zero history rewrites.
