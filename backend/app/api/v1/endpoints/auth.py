from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.api.deps import get_current_user
from backend.app.models.user import User
from backend.app.schemas.common import ApiResponse
from backend.app.schemas.auth import (
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    AuthTokenResponse,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    PasswordResetConfirmRequest,
)
from backend.app.schemas.user import UserRead
from backend.app.services.otp_service import OtpService, test_mailbox
from backend.app.services.auth_service import AuthService, test_reset_mailbox

router = APIRouter()


@router.post(
    "/otp/send",
    response_model=ApiResponse[OtpSendResponse],
    status_code=status.HTTP_200_OK,
    summary="Send OTP verification challenge",
)
async def send_otp(
    payload: OtpSendRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Initiates phone OTP challenge.
    Enforces 60-second cooldown per phone and sliding 5 requests/10 min rate limit.
    """
    resend_available_at, expires_at = await OtpService.request_otp(
        session=db,
        phone=payload.phone,
        purpose=payload.purpose,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ApiResponse(
        success=True,
        data=OtpSendResponse(
            message="OTP challenge initiated successfully.",
            phone=payload.phone,
            expires_at=expires_at,
            cooldown_seconds=settings.OTP_COOLDOWN_SECONDS,
            expires_in_seconds=settings.OTP_EXPIRE_MINUTES * 60,
        ),
    )


@router.post(
    "/otp/verify",
    response_model=ApiResponse[AuthTokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Verify OTP and login/register",
)
async def verify_otp(
    payload: OtpVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Verifies 4-digit numeric OTP code.
    If phone has no account, creates User, Profile, and Cart automatically with unique Customer ID.
    Creates persistent user session and returns access and refresh tokens.
    """
    user, access_token, refresh_token = await AuthService.authenticate_or_register_via_otp(
        session=db,
        phone=payload.phone,
        otp_code=payload.otp,
        purpose=payload.purpose,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ApiResponse(
        success=True,
        data=AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            phone=user.phone,
            role=user.role,
            customer_code=user.customer_code,
            user=UserRead.model_validate(user),
        ),
    )


@router.post(
    "/register",
    response_model=ApiResponse[AuthTokenResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Customer registration with password",
)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Registers customer account with phone, full name, password, and generates unique DKC-XXXXXXXX customer ID.
    Hashes password using PBKDF2 (600,000 iterations).
    """
    user, access_token, refresh_token = await AuthService.register_customer(
        session=db,
        full_name=payload.full_name,
        phone=payload.phone,
        password=payload.password,
        email=payload.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ApiResponse(
        success=True,
        data=AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            phone=user.phone,
            role=user.role,
            customer_code=user.customer_code,
            user=UserRead.model_validate(user),
        ),
    )


@router.post(
    "/login",
    response_model=ApiResponse[AuthTokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Password login",
)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticates existing customer via phone (+91XXXXXXXXXX or 10-digit), email, or Customer ID and password.
    Protected against account enumeration via constant-time verification.
    """
    user, access_token, refresh_token = await AuthService.authenticate_via_password(
        session=db,
        identifier=payload.identifier,
        password=payload.password,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()

    return ApiResponse(
        success=True,
        data=AuthTokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            phone=user.phone,
            role=user.role,
            customer_code=user.customer_code,
            user=UserRead.model_validate(user),
        ),
    )


@router.post(
    "/refresh",
    response_model=ApiResponse[AuthTokenResponse],
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token",
)
async def refresh_token(
    payload: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Atomically rotates refresh tokens.
    If a previously rotated or revoked token is reused, revokes the entire token family.
    """
    user, access_token, new_refresh_token = await AuthService.rotate_refresh_token(
        session=db,
        raw_refresh_token=payload.refresh_token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ApiResponse(
        success=True,
        data=AuthTokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            phone=user.phone,
            role=user.role,
            customer_code=user.customer_code,
            user=UserRead.model_validate(user),
        ),
    )


@router.post(
    "/password-reset/request",
    response_model=ApiResponse[PasswordResetResponse],
    status_code=status.HTTP_200_OK,
    summary="Request password reset token",
)
async def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Initiates a password reset challenge.
    Enforces rate limiting and returns a generic response to prevent account enumeration.
    In development/test environment, provides the reset token for local test verification.
    """
    msg, dev_token = await AuthService.request_password_reset(
        session=db,
        identifier=payload.identifier,
        ip_address=request.client.host if request.client else None,
    )
    return ApiResponse(
        success=True,
        data=PasswordResetResponse(
            message=msg,
            reset_token=dev_token,
        ),
    )


@router.post(
    "/password-reset/confirm",
    response_model=ApiResponse[Dict[str, str]],
    status_code=status.HTTP_200_OK,
    summary="Confirm password reset with token",
)
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Confirms password reset using single-use verification token.
    Updates password hash, marks token used, and revokes all active sessions for the account.
    """
    await AuthService.confirm_password_reset(
        session=db,
        token=payload.token,
        new_password=payload.new_password,
    )
    return ApiResponse(
        success=True,
        data={"message": "Password has been successfully reset. Please log in with your new credentials."},
    )


@router.post(
    "/logout",
    response_model=ApiResponse[Dict[str, str]],
    status_code=status.HTTP_200_OK,
    summary="Revoke refresh token and logout",
)
async def logout(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Revokes the specified refresh token session.
    """
    await AuthService.revoke_session(session=db, raw_refresh_token=payload.refresh_token)
    return ApiResponse(
        success=True,
        data={"message": "Logged out successfully."},
    )


@router.get(
    "/me",
    response_model=ApiResponse[UserRead],
    status_code=status.HTTP_200_OK,
    summary="Retrieve current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the authenticated user details and profile.
    """
    return ApiResponse(
        success=True,
        data=UserRead.model_validate(current_user),
    )


# Safeguard #2: Restrict dev/test OTP and reset token inspectors from ever being registered in staging or production
if settings.ENVIRONMENT.lower() in ("development", "test"):
    @router.get(
        "/test/last-otp",
        response_model=ApiResponse[Dict[str, str]],
        status_code=status.HTTP_200_OK,
        summary="Test Delivery Mailbox Inspector (Dev/Test Only)",
    )
    async def get_last_test_otp(phone: str):
        """
        Retrieves the last delivered OTP for automated test verification and local development.
        Strictly inaccessible and unregistered in staging and production environments.
        """
        cleaned = phone.strip()
        if phone.startswith(" "):
            cleaned = "+" + phone.lstrip()
        elif not cleaned.startswith("+") and cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = "+" + cleaned
        elif not cleaned.startswith("+") and len(cleaned) == 10:
            cleaned = "+91" + cleaned
        otp = test_mailbox.get_last_otp(cleaned) or test_mailbox.get_last_otp(phone)
        if not otp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No recent test OTP found for phone {phone}.",
            )
        return ApiResponse(
            success=True,
            data={"phone": cleaned, "otp": otp},
        )

    @router.get(
        "/test/last-reset-token",
        response_model=ApiResponse[Dict[str, str]],
        status_code=status.HTTP_200_OK,
        summary="Test Reset Token Inspector (Dev/Test Only)",
    )
    async def get_last_test_reset_token(identifier: str):
        """
        Retrieves the last generated password reset token for automated test verification and local development.
        Strictly inaccessible and unregistered in staging and production environments.
        """
        cleaned = identifier.strip()
        if identifier.startswith(" "):
            cleaned = "+" + identifier.lstrip()
        elif not cleaned.startswith("+") and cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = "+" + cleaned
        elif not cleaned.startswith("+") and len(cleaned) == 10:
            cleaned = "+91" + cleaned

        token = test_reset_mailbox.get_last_token(cleaned) or test_reset_mailbox.get_last_token(identifier)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No recent test reset token found for identifier {identifier}.",
            )
        return ApiResponse(
            success=True,
            data={"identifier": cleaned, "token": token},
        )

