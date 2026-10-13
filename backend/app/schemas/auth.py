from datetime import datetime
import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator, AliasChoices

from backend.app.schemas.user import UserRead


class OtpSendRequest(BaseModel):
    """Request to initiate a phone OTP challenge."""

    phone: str = Field(..., description="Customer phone number in E.164 format (+91...)")
    purpose: str = Field("login", description="Purpose: login, register, verify_phone")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.match(r"^\+91[6-9]\d{9}$", cleaned):
            if re.match(r"^[6-9]\d{9}$", cleaned):
                cleaned = f"+91{cleaned}"
            else:
                raise ValueError("Phone number must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX)")
        return cleaned

    @field_validator("purpose")
    @classmethod
    def validate_purpose(cls, v: str) -> str:
        if v not in ("login", "register", "verify_phone"):
            raise ValueError("Purpose must be 'login', 'register', or 'verify_phone'")
        return v


class OtpSendResponse(BaseModel):
    """Response returned upon successful OTP challenge issuance."""

    message: str
    phone: Optional[str] = None
    cooldown_seconds: int = 60
    expires_in_seconds: int = 300
    expires_at: Optional[datetime] = None


class OtpVerifyRequest(BaseModel):
    """Request to verify an OTP challenge."""

    phone: str = Field(..., description="Customer phone number in E.164 format (+91...)")
    otp: str = Field(
        ...,
        min_length=4,
        max_length=6,
        description="4 or 6 digit verification code",
        validation_alias=AliasChoices("otp", "otp_code"),
    )
    purpose: str = Field("login", description="Purpose matching the challenge")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.match(r"^\+91[6-9]\d{9}$", cleaned):
            if re.match(r"^[6-9]\d{9}$", cleaned):
                cleaned = f"+91{cleaned}"
            else:
                raise ValueError("Phone number must be a valid 10-digit Indian mobile number")
        return cleaned

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP must contain digits only")
        return v


class LoginRequest(BaseModel):
    """Password login request supporting phone or email."""

    identifier: str = Field(..., description="Customer phone or email address")
    password: str = Field(..., min_length=6, description="Account password")


class RegisterRequest(BaseModel):
    """Customer registration request with password."""

    full_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., description="10-digit Indian mobile number or E.164 format")
    password: str = Field(..., min_length=6, description="Account password")
    email: Optional[str] = Field(None, description="Optional email address")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.match(r"^\+91[6-9]\d{9}$", cleaned):
            if re.match(r"^[6-9]\d{9}$", cleaned):
                cleaned = f"+91{cleaned}"
            else:
                raise ValueError("Phone number must be a valid 10-digit Indian mobile number")
        return cleaned


class RefreshTokenRequest(BaseModel):
    """Request payload to rotate an active refresh session."""

    refresh_token: str = Field(..., description="Valid 7-day refresh token")


class AuthTokenResponse(BaseModel):
    """Authentication tokens returned upon successful login or verification."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 minutes
    refresh_token: Optional[str] = None
    user_id: str
    phone: str
    role: str
    customer_code: Optional[str] = None
    user: Optional[UserRead] = None


class PasswordResetRequest(BaseModel):
    """Payload to initiate a password reset request."""

    identifier: str = Field(..., description="Customer phone number or email address")


class PasswordResetResponse(BaseModel):
    """Generic response returned on password reset request to prevent account enumeration."""

    message: str = "If an account matches that identifier, password reset instructions have been dispatched."
    reset_token: Optional[str] = Field(None, description="Reset token provided exclusively in development/test environment for automated verification.")


class PasswordResetConfirmRequest(BaseModel):
    """Payload to confirm password reset and set new credentials."""

    token: str = Field(..., min_length=16, description="Password reset verification token")
    new_password: str = Field(..., min_length=6, description="New account password (min 6 characters)")

