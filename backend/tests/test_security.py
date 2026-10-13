import pytest
from datetime import timedelta
from backend.app.core.security import (
    hash_otp,
    verify_otp_hash,
    hash_password,
    verify_password,
    hash_token,
    create_token,
    decode_token,
    create_access_token,
    create_refresh_token,
)


def test_otp_hmac_hashing_and_verification():
    phone = "+919876543210"
    otp = "4829"

    otp_hash = hash_otp(phone, otp)
    assert len(otp_hash) == 64
    assert verify_otp_hash(phone, otp, otp_hash) is True
    assert verify_otp_hash(phone, "0000", otp_hash) is False
    assert verify_otp_hash("+919999999999", otp, otp_hash) is False


def test_pbkdf2_password_hashing():
    raw_pass = "SecurePass123!"
    hashed = hash_password(raw_pass)

    assert hashed.startswith("pbkdf2_sha256$600000$")
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPass", hashed) is False
    assert verify_password("", hashed) is False


def test_token_hashing():
    tok = "some_random_refresh_token_string"
    h1 = hash_token(tok)
    h2 = hash_token(tok)
    assert h1 == h2
    assert len(h1) == 64


def test_jwt_access_token_creation_and_validation():
    user_id = "user-uuid-123"
    token = create_access_token(user_id=user_id, phone="+919876543210", role="customer")
    claims = decode_token(token, expected_type="access")

    assert claims["sub"] == user_id
    assert claims["phone"] == "+919876543210"
    assert claims["role"] == "customer"
    assert claims["type"] == "access"
    assert claims["iss"] == "dailykitchen"
    assert claims["aud"] == "dailykitchen-client"


def test_jwt_refresh_token_creation_and_validation():
    user_id = "user-uuid-123"
    family_id = "family-uuid-456"
    token = create_refresh_token(user_id=user_id, family_id=family_id)
    claims = decode_token(token, expected_type="refresh")

    assert claims["sub"] == user_id
    assert claims["family_id"] == family_id
    assert claims["type"] == "refresh"


def test_jwt_rejection_on_type_mismatch():
    token = create_access_token(user_id="u1", phone="+919876543210", role="customer")
    with pytest.raises(ValueError, match="Invalid token type"):
        decode_token(token, expected_type="refresh")


def test_jwt_rejection_on_tampering():
    token = create_access_token(user_id="u1", phone="+919876543210", role="customer")
    tampered = token[:-4] + "abcd"
    with pytest.raises(ValueError, match="signature verification failed"):
        decode_token(tampered)


def test_jwt_rejection_on_expiry():
    token = create_token(
        claims={"sub": "u1"},
        expires_delta=timedelta(seconds=-10),  # expired 10 seconds ago
        token_type="access",
    )
    with pytest.raises(ValueError, match="Token has expired"):
        decode_token(token)
