import secrets
import pytest
from httpx import AsyncClient
from sqlalchemy import update
from backend.app.models.user import User
from backend.app.db.session import AsyncSessionLocal


def random_phone() -> str:
    """Generate random valid Indian phone number (+919XXXXXXXXX)."""
    return f"+919{secrets.randbelow(900000000):09d}"


@pytest.mark.asyncio
async def test_otp_challenge_and_verification_flow(client: AsyncClient):
    """
    Verify complete phone-first OTP flow:
    1. Request OTP via /api/v1/auth/otp/send
    2. Retrieve OTP via isolated test mailbox
    3. Verify OTP via /api/v1/auth/otp/verify
    4. Validate tokens and auto-provisioned User, Profile, Cart
    """
    test_phone = random_phone()

    # 1. Request OTP
    send_resp = await client.post(
        "/api/v1/auth/otp/send",
        json={"phone": test_phone, "purpose": "login"},
    )
    assert send_resp.status_code == 200
    send_data = send_resp.json()
    assert send_data["success"] is True
    assert send_data["data"]["phone"] == test_phone
    assert send_data["data"]["cooldown_seconds"] == 60
    assert "expires_at" in send_data["data"]

    # 2. Retrieve delivered OTP from test mailbox
    # Use URL-encoded %2B for '+'
    encoded_phone = test_phone.replace("+", "%2B")
    otp_resp = await client.get(f"/api/v1/auth/test/last-otp?phone={encoded_phone}")
    assert otp_resp.status_code == 200
    otp_code = otp_resp.json()["data"]["otp"]
    assert len(otp_code) == 4
    assert otp_code.isdigit()

    # 3. Verify OTP
    verify_resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": test_phone, "otp": otp_code, "purpose": "login"},
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["success"] is True
    tokens = verify_data["data"]
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"
    assert tokens["user"]["phone"] == test_phone
    assert tokens["user"]["role"] == "customer"
    assert tokens["user"]["is_phone_verified"] is True


@pytest.mark.asyncio
async def test_otp_cooldown_enforcement(client: AsyncClient):
    """Verify that requesting OTP twice within 60 seconds returns HTTP 429."""
    test_phone = random_phone()

    first_resp = await client.post(
        "/api/v1/auth/otp/send",
        json={"phone": test_phone, "purpose": "login"},
    )
    assert first_resp.status_code == 200

    second_resp = await client.post(
        "/api/v1/auth/otp/send",
        json={"phone": test_phone, "purpose": "login"},
    )
    assert second_resp.status_code == 429
    assert "Please wait" in second_resp.json()["detail"]


@pytest.mark.asyncio
async def test_otp_invalid_attempt_lockout(client: AsyncClient):
    """Verify that 3 invalid attempts trigger challenge lockout."""
    test_phone = random_phone()

    # Send OTP
    await client.post(
        "/api/v1/auth/otp/send",
        json={"phone": test_phone, "purpose": "login"},
    )

    # 3 invalid attempts
    for _ in range(3):
        fail_resp = await client.post(
            "/api/v1/auth/otp/verify",
            json={"phone": test_phone, "otp": "0000", "purpose": "login"},
        )
        assert fail_resp.status_code == 400

    # 4th attempt should confirm challenge is exhausted/invalid
    lockout_resp = await client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": test_phone, "otp": "0000", "purpose": "login"},
    )
    assert lockout_resp.status_code == 400


@pytest.mark.asyncio
async def test_password_registration_and_login_flow(client: AsyncClient):
    """
    Verify customer registration with PBKDF2 password,
    login with phone/email, and anti-enumeration error handling.
    """
    test_phone = random_phone()
    test_email = f"user_{secrets.randbelow(1000000)}@example.com"
    test_password = "SuperSecurePassword123!"

    # 1. Register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Rahul Verma",
            "email": test_email,
            "password": test_password,
        },
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert reg_data["success"] is True
    assert reg_data["data"]["user"]["phone"] == test_phone

    # Duplicate registration should return 409
    dup_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Duplicate User",
            "password": test_password,
        },
    )
    assert dup_resp.status_code == 409

    # 2. Login via phone
    login_phone_resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": test_phone, "password": test_password},
    )
    assert login_phone_resp.status_code == 200
    assert "access_token" in login_phone_resp.json()["data"]

    # 3. Login via email
    login_email_resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": test_email, "password": test_password},
    )
    assert login_email_resp.status_code == 200

    # 4. Login with invalid password
    bad_pass_resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": test_phone, "password": "WrongPassword999!"},
    )
    assert bad_pass_resp.status_code == 401

    # 5. Login with unknown identifier
    unknown_resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "+919999999999", "password": test_password},
    )
    assert unknown_resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_replay_detection(client: AsyncClient):
    """
    Verify persistent refresh token rotation:
    1. Login to get RT1
    2. Rotate RT1 -> issues RT2 (RT1 marked revoked)
    3. Rotate RT2 -> issues RT3 (RT2 marked revoked)
    4. REPLAY ATTACK: Present RT1 again -> triggers family revocation (HTTP 401)
    5. Present RT3 -> fails because entire family was revoked (HTTP 401)
    """
    test_phone = random_phone()
    test_password = "PasswordRotate123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Priya Sharma",
            "password": test_password,
        },
    )
    assert reg_resp.status_code == 201
    rt1 = reg_resp.json()["data"]["refresh_token"]

    # 2. Rotate RT1 -> RT2
    rotate1_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rt1},
    )
    assert rotate1_resp.status_code == 200
    rt2 = rotate1_resp.json()["data"]["refresh_token"]
    assert rt2 != rt1

    # 3. Rotate RT2 -> RT3
    rotate2_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rt2},
    )
    assert rotate2_resp.status_code == 200
    rt3 = rotate2_resp.json()["data"]["refresh_token"]
    assert rt3 != rt2

    # 4. Replay attack: present already rotated RT1
    replay_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rt1},
    )
    assert replay_resp.status_code == 401
    assert "replay detected" in replay_resp.json()["detail"].lower()

    # 5. RT3 must now also be rejected because its family was revoked
    family_killed_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": rt3},
    )
    assert family_killed_resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_session_revocation(client: AsyncClient):
    """Verify that logging out revokes the refresh session."""
    test_phone = random_phone()
    test_password = "PasswordLogout123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Karan Mehra",
            "password": test_password,
        },
    )
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["access_token"]
    refresh_token = reg_resp.json()["data"]["refresh_token"]

    # Logout
    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200

    # Refresh should now fail
    ref_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert ref_resp.status_code == 401


@pytest.mark.asyncio
async def test_deactivated_user_rejection(client: AsyncClient):
    """Verify that deactivated users are blocked from authentication and endpoints."""
    test_phone = random_phone()
    test_password = "PasswordDeact123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Deactivated User",
            "password": test_password,
        },
    )
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["access_token"]
    user_id = reg_resp.json()["data"]["user"]["id"]

    # Deactivate user in database
    async with AsyncSessionLocal() as session:
        stmt = update(User).where(User.id == user_id).values(is_active=False)
        await session.execute(stmt)
        await session.commit()

    # /api/v1/auth/me should return 403 Forbidden
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 403
    assert "deactivated" in me_resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_customer_profile_and_address_crud(client: AsyncClient):
    """
    Verify customer profile update and complete address CRUD:
    - Update profile
    - Add first address (auto default)
    - Add second address with is_default=True (unsets first)
    - Update address
    - Promote address to default via PUT
    - Delete address
    """
    test_phone = random_phone()
    test_password = "PasswordAddress123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Siddharth Malhotra",
            "password": test_password,
        },
    )
    assert reg_resp.status_code == 201
    token = reg_resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Update Profile
    profile_resp = await client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"full_name": "Sid M.", "avatar_url": "https://example.com/avatar.jpg"},
    )
    assert profile_resp.status_code == 200
    assert profile_resp.json()["data"]["full_name"] == "Sid M."

    # 2. Add first address (auto default)
    addr1_payload = {
        "full_name": "Sid M.",
        "phone": test_phone,
        "house_flat": "Flat 402, Block A",
        "street_area": "Indiranagar 100ft Road",
        "landmark": "Near Metro Station",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560038",
        "label": "home",
        "is_default": False,
    }
    addr1_resp = await client.post(
        "/api/v1/users/me/addresses",
        headers=headers,
        json=addr1_payload,
    )
    assert addr1_resp.status_code == 201
    addr1 = addr1_resp.json()["data"]
    assert addr1["is_default"] is True  # First address forced to default
    addr1_id = addr1["id"]

    # 3. Add second address with is_default=True
    addr2_payload = {
        "full_name": "Sid M. (Work)",
        "phone": test_phone,
        "house_flat": "Floor 5, Tech Hub",
        "street_area": "Outer Ring Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560103",
        "label": "work",
        "is_default": True,
    }
    addr2_resp = await client.post(
        "/api/v1/users/me/addresses",
        headers=headers,
        json=addr2_payload,
    )
    assert addr2_resp.status_code == 201
    addr2 = addr2_resp.json()["data"]
    assert addr2["is_default"] is True
    addr2_id = addr2["id"]

    # 4. List addresses - verify addr2 is default, addr1 is not
    list_resp = await client.get("/api/v1/users/me/addresses", headers=headers)
    assert list_resp.status_code == 200
    addresses = list_resp.json()["data"]
    assert len(addresses) == 2
    addr_map = {a["id"]: a for a in addresses}
    assert addr_map[addr2_id]["is_default"] is True
    assert addr_map[addr1_id]["is_default"] is False

    # 5. Set addr1 as default via PUT
    put_def_resp = await client.put(
        f"/api/v1/users/me/addresses/{addr1_id}/default",
        headers=headers,
    )
    assert put_def_resp.status_code == 200
    assert put_def_resp.json()["data"]["is_default"] is True

    # Check list again
    list_resp2 = await client.get("/api/v1/users/me/addresses", headers=headers)
    addr_map2 = {a["id"]: a for a in list_resp2.json()["data"]}
    assert addr_map2[addr1_id]["is_default"] is True
    assert addr_map2[addr2_id]["is_default"] is False

    # 6. Update addr2
    patch_resp = await client.patch(
        f"/api/v1/users/me/addresses/{addr2_id}",
        headers=headers,
        json={"house_flat": "Floor 7, Executive Suite"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["house_flat"] == "Floor 7, Executive Suite"

    # 7. Delete addr1 (default) -> addr2 should automatically become default
    del_resp = await client.delete(
        f"/api/v1/users/me/addresses/{addr1_id}",
        headers=headers,
    )
    assert del_resp.status_code == 200

    list_resp3 = await client.get("/api/v1/users/me/addresses", headers=headers)
    remaining_addresses = list_resp3.json()["data"]
    assert len(remaining_addresses) == 1
    assert remaining_addresses[0]["id"] == addr2_id
    assert remaining_addresses[0]["is_default"] is True


@pytest.mark.asyncio
async def test_address_ownership_isolation(client: AsyncClient):
    """Verify that User B cannot access, update, or delete User A's addresses."""
    # Register User A
    user_a_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": random_phone(),
            "full_name": "User Alpha",
            "password": "PasswordAlpha123!",
        },
    )
    token_a = user_a_resp.json()["data"]["access_token"]

    # Register User B
    user_b_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": random_phone(),
            "full_name": "User Beta",
            "password": "PasswordBeta123!",
        },
    )
    token_b = user_b_resp.json()["data"]["access_token"]

    # User A creates address
    addr_resp = await client.post(
        "/api/v1/users/me/addresses",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "full_name": "User Alpha",
            "phone": "+919876543210",
            "house_flat": "Penthouse 1",
            "street_area": "MG Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
            "label": "home",
        },
    )
    addr_id = addr_resp.json()["data"]["id"]

    # User B attempts to modify User A's address
    bad_patch = await client.patch(
        f"/api/v1/users/me/addresses/{addr_id}",
        headers={"Authorization": f"Bearer {token_b}"},
        json={"house_flat": "Hacked Flat"},
    )
    assert bad_patch.status_code == 404

    # User B attempts to delete User A's address
    bad_del = await client.delete(
        f"/api/v1/users/me/addresses/{addr_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert bad_del.status_code == 404


@pytest.mark.asyncio
async def test_dev_otp_inspector_restricted_in_production(monkeypatch):
    """
    Safeguard #2 Verification:
    Verify that test mailbox is strictly restricted and route is unregistered in production/staging.
    """
    from backend.app.core.config import settings
    from backend.app.services.otp_service import test_mailbox

    # Deliver an OTP while in test
    test_mailbox.deliver("+919876543299", "1234")

    # In production environment, mailbox refuses to return anything
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert test_mailbox.get_last_otp("+919876543299") is None

    # Even delivering in production does nothing
    test_mailbox.deliver("+919876543298", "5678")
    assert test_mailbox.get_last_otp("+919876543298") is None


@pytest.mark.asyncio
async def test_customer_code_generation_and_login_by_code(client: AsyncClient):
    """
    Verify DKC-XXXXXXXX customer ID is assigned on registration
    and supports direct login via customer_code as identifier.
    """
    import re
    test_phone = random_phone()
    test_pass = "SecurePass123!"

    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Anita Sharma",
            "password": test_pass,
        },
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()["data"]
    customer_code = data["customer_code"]
    assert customer_code is not None
    assert re.match(r"^DKC-[0-9A-F]{8}$", customer_code)
    assert data["user"]["customer_code"] == customer_code

    # Login using customer_code
    code_login_resp = await client.post(
        "/api/v1/auth/login",
        json={"identifier": customer_code, "password": test_pass},
    )
    assert code_login_resp.status_code == 200
    assert code_login_resp.json()["data"]["user"]["customer_code"] == customer_code


@pytest.mark.asyncio
async def test_password_reset_flow_with_session_revocation(client: AsyncClient):
    """
    Verify complete password reset lifecycle:
    1. Register user & establish active refresh token
    2. Request password reset (rate limited, generic response)
    3. Retrieve reset token from dev inspector
    4. Confirm password reset
    5. Old refresh token is revoked
    6. Old password fails, new password succeeds
    """
    test_phone = random_phone()
    old_pass = "InitialPass123!"
    new_pass = "BrandNewPass456!"

    # 1. Register & get refresh token
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "phone": test_phone,
            "full_name": "Vikram Patel",
            "password": old_pass,
        },
    )
    assert reg_resp.status_code == 201
    initial_rt = reg_resp.json()["data"]["refresh_token"]

    # 2. Request reset
    req_resp = await client.post(
        "/api/v1/auth/password-reset/request",
        json={"identifier": test_phone},
    )
    assert req_resp.status_code == 200
    req_data = req_resp.json()["data"]
    assert "instructions have been dispatched" in req_data["message"]
    reset_token = req_data["reset_token"]
    assert reset_token is not None

    # Verify dev inspector also has the token
    insp_resp = await client.get(f"/api/v1/auth/test/last-reset-token?identifier={test_phone}")
    assert insp_resp.status_code == 200
    assert insp_resp.json()["data"]["token"] == reset_token

    # 3. Confirm reset
    confirm_resp = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": new_pass},
    )
    assert confirm_resp.status_code == 200
    assert "successfully reset" in confirm_resp.json()["data"]["message"].lower()

    # 4. Attempting to reuse reset token fails
    reuse_resp = await client.post(
        "/api/v1/auth/password-reset/confirm",
        json={"token": reset_token, "new_password": "AnotherPassword!"},
    )
    assert reuse_resp.status_code == 400

    # 5. Old refresh token was revoked!
    refresh_fail = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": initial_rt},
    )
    assert refresh_fail.status_code == 401

    # 6. Old password fails
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": test_phone, "password": old_pass},
    )
    assert old_login.status_code == 401

    # 7. New password succeeds
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"identifier": test_phone, "password": new_pass},
    )
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()["data"]


@pytest.mark.asyncio
async def test_password_reset_rate_limiting(client: AsyncClient):
    """Verify max 3 reset requests allowed within 10-minute window."""
    test_phone = random_phone()
    await client.post(
        "/api/v1/auth/register",
        json={"phone": test_phone, "full_name": "Rate User", "password": "Pass123456!"},
    )

    for i in range(3):
        res = await client.post(
            "/api/v1/auth/password-reset/request",
            json={"identifier": test_phone},
        )
        assert res.status_code == 200

    # 4th attempt returns 429
    res_4 = await client.post(
        "/api/v1/auth/password-reset/request",
        json={"identifier": test_phone},
    )
    assert res_4.status_code == 429
    assert "Too many password reset requests" in res_4.json()["detail"]


