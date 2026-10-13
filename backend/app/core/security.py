import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Optional
from datetime import datetime, timezone, timedelta

from backend.app.core.config import settings


def to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensures datetime is timezone-aware UTC, converting naive timestamps safely."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_customer_code() -> str:
    """
    Generates a permanent customer identification code.
    Format: DKC-XXXXXXXX (8 uppercase hex characters, 32-bit entropy).
    """
    return f"DKC-{secrets.token_hex(4).upper()}"


# --- OTP Cryptography ---

def hash_otp(phone: str, otp_code: str, secret: Optional[str] = None) -> str:
    """
    Computes a keyed HMAC-SHA256 hash for phone OTP challenges.
    Plaintext OTPs are never stored in the database or logs.
    """
    secret_key = (secret or settings.OTP_SECRET).encode("utf-8")
    payload = f"{phone}:{otp_code}".encode("utf-8")
    return hmac.new(secret_key, payload, hashlib.sha256).hexdigest()


def verify_otp_hash(phone: str, otp_code: str, stored_hash: str, secret: Optional[str] = None) -> bool:
    """
    Verifies an OTP code against a stored HMAC-SHA256 hash using constant-time comparison.
    """
    computed = hash_otp(phone, otp_code, secret)
    return hmac.compare_digest(computed, stored_hash)


# --- Password Cryptography (OWASP 2023+ Compliant PBKDF2) ---

PBKDF2_ITERATIONS = 600_000
SALT_BYTES = 32


def hash_password(password: str) -> str:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with 600,000 iterations and a 32-byte salt.
    Format: pbkdf2_sha256$600000$<salt_hex>$<hash_hex>
    """
    salt = secrets.token_bytes(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifies a password against the PBKDF2-HMAC-SHA256 hash using constant-time comparison.
    """
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_hash = parts[3]

        derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(derived.hex(), expected_hash)
    except Exception:
        return False


# --- Token Hashing for Persistent Refresh Sessions ---

def hash_token(token: str) -> str:
    """
    Computes SHA-256 hash of a raw token for persistent session lookup and rotation.
    Raw tokens are never stored plaintext in the database.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# --- Standard Library Pinned HS256 JWT Implementation ---

def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    padding = len(data) % 4
    if padding:
        data += "=" * (4 - padding)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_token(
    claims: Dict[str, Any],
    expires_delta: timedelta,
    token_type: str,
    secret_key: Optional[str] = None,
) -> str:
    """
    Creates a signed HS256 JWT with strict claim verification headers.
    """
    now = int(time.time())
    exp = now + int(expires_delta.total_seconds())

    header = {"alg": settings.JWT_ALGORITHM, "typ": "JWT"}
    payload = {
        **claims,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "type": token_type,
        "iat": now,
        "exp": exp,
    }

    header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    key = (secret_key or settings.JWT_SECRET_KEY).encode("utf-8")
    signature = hmac.new(key, signing_input, hashlib.sha256).digest()
    signature_b64 = _b64_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_token(
    token: str,
    expected_type: Optional[str] = None,
    secret_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Decodes and strictly validates an HS256 JWT token.
    Raises ValueError on tampering, algorithm mismatch, expiry, or invalid claims.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT token format.")

        header_b64, payload_b64, signature_b64 = parts
        header = json.loads(_b64_decode(header_b64).decode("utf-8"))

        # Pinned algorithm check
        if header.get("alg") != settings.JWT_ALGORITHM or header.get("typ") != "JWT":
            raise ValueError(f"Unsupported token algorithm: {header.get('alg')}")

        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        key = (secret_key or settings.JWT_SECRET_KEY).encode("utf-8")
        expected_sig = hmac.new(key, signing_input, hashlib.sha256).digest()
        provided_sig = _b64_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, provided_sig):
            raise ValueError("Token signature verification failed.")

        payload = json.loads(_b64_decode(payload_b64).decode("utf-8"))

        # Expiry check
        now = int(time.time())
        if payload.get("exp", 0) < now:
            raise ValueError("Token has expired.")

        # Issuer and Audience check
        if payload.get("iss") != settings.JWT_ISSUER:
            raise ValueError("Invalid token issuer.")
        if payload.get("aud") != settings.JWT_AUDIENCE:
            raise ValueError("Invalid token audience.")

        # Type check
        if expected_type and payload.get("type") != expected_type:
            raise ValueError(f"Invalid token type. Expected {expected_type}, got {payload.get('type')}")

        return payload
    except Exception as e:
        raise ValueError(f"JWT validation error: {str(e)}") from e


def create_access_token(user_id: str, phone: str, role: str) -> str:
    """Creates a 15-minute access token."""
    claims = {
        "sub": user_id,
        "phone": phone,
        "role": role,
    }
    return create_token(
        claims=claims,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(user_id: str, family_id: str) -> str:
    """Creates a 7-day refresh token bound to a session family."""
    claims = {
        "sub": user_id,
        "family_id": family_id,
        "jti": secrets.token_hex(16),
    }
    return create_token(
        claims=claims,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )
