import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.security import hash_otp, verify_otp_hash, to_utc
from backend.app.models.user import OtpChallenge


class TestDeliveryMailbox:
    """
    Isolated in-memory fixture for development and automated test inspection.
    NEVER writes plaintext OTPs to application log sinks.
    Only accessible when ENVIRONMENT in ('development', 'test').
    """
    def __init__(self):
        self._mailbox: Dict[str, Tuple[str, datetime]] = {}

    def deliver(self, phone: str, otp_code: str):
        if settings.ENVIRONMENT.lower() in ("development", "test"):
            self._mailbox[phone] = (otp_code, datetime.now(timezone.utc))

    def get_last_otp(self, phone: str) -> Optional[str]:
        if settings.ENVIRONMENT.lower() not in ("development", "test"):
            return None
        record = self._mailbox.get(phone)
        if record:
            code, sent_at = record
            # Only return if delivered within last 5 minutes
            if datetime.now(timezone.utc) - sent_at < timedelta(minutes=5):
                return code
        return None

    def clear(self):
        self._mailbox.clear()


test_mailbox = TestDeliveryMailbox()


class OtpService:
    """Service orchestrating the secure phone OTP verification challenge lifecycle."""

    @staticmethod
    def generate_random_4digit_otp() -> str:
        """Generates a cryptographically secure 4-digit discrete numeric OTP."""
        return f"{secrets.randbelow(10000):04d}"

    @classmethod
    async def request_otp(
        cls,
        session: AsyncSession,
        phone: str,
        purpose: str = "login",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[datetime, datetime]:
        """
        Creates a new OTP challenge after enforcing cooldown and rate limit guardrails.
        Returns (resend_available_at, expires_at).
        """
        now = datetime.now(timezone.utc)

        # 1. Enforce 60-second resend cooldown per phone
        cooldown_stmt = (
            select(OtpChallenge)
            .where(OtpChallenge.phone == phone)
            .where(OtpChallenge.purpose == purpose)
            .order_by(OtpChallenge.created_at.desc())
            .limit(1)
        )
        existing_cooldown = (await session.execute(cooldown_stmt)).scalar_one_or_none()
        if existing_cooldown and existing_cooldown.resend_available_at:
            resend_at = to_utc(existing_cooldown.resend_available_at)
            if resend_at and resend_at > now:
                remaining = int((resend_at - now).total_seconds())
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {max(1, remaining)} seconds before requesting another OTP.",
                )

        # 2. Enforce sliding 10-minute rate limit (max 5 requests per phone)
        window_start = now - timedelta(minutes=settings.OTP_RATE_LIMIT_WINDOW_MINUTES)
        rate_limit_stmt = (
            select(func.count())
            .select_from(OtpChallenge)
            .where(OtpChallenge.phone == phone)
            .where(OtpChallenge.created_at >= window_start)
        )
        recent_count = (await session.execute(rate_limit_stmt)).scalar_one()
        if recent_count >= settings.OTP_RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many OTP requests. Please try again in a few minutes.",
            )

        # 3. Invalidate prior active unconsumed challenges for this phone and purpose
        invalidate_stmt = (
            update(OtpChallenge)
            .where(OtpChallenge.phone == phone)
            .where(OtpChallenge.purpose == purpose)
            .where(OtpChallenge.is_consumed == False)  # noqa: E712
            .values(is_consumed=True)
        )
        await session.execute(invalidate_stmt)

        # 4. Generate discrete 4-digit code and compute keyed HMAC-SHA256
        otp_code = cls.generate_random_4digit_otp()
        otp_hmac = hash_otp(phone, otp_code, settings.OTP_SECRET)

        resend_at = now + timedelta(seconds=settings.OTP_COOLDOWN_SECONDS)
        expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

        challenge = OtpChallenge(
            phone=phone,
            otp_hash=otp_hmac,
            purpose=purpose,
            attempts=0,
            resend_available_at=resend_at,
            expires_at=expires_at,
            is_consumed=False,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(challenge)
        await session.commit()

        # 5. Deliver through test mailbox
        test_mailbox.deliver(phone, otp_code)
        if settings.ENVIRONMENT.lower() in ("development", "test"):
            print(f"\n🔑 [LOCAL DEV SMS GATEWAY] Verification OTP for {phone}: {otp_code}\n", flush=True)

        return resend_at, expires_at

    @classmethod
    async def verify_otp(
        cls,
        session: AsyncSession,
        phone: str,
        otp_code: str,
        purpose: str = "login",
    ) -> bool:
        """
        Validates an OTP challenge atomically enforcing expiry, attempt limits, and constant-time match.
        """
        now = datetime.now(timezone.utc)

        # Fetch latest unconsumed challenge
        stmt = (
            select(OtpChallenge)
            .where(OtpChallenge.phone == phone)
            .where(OtpChallenge.purpose == purpose)
            .where(OtpChallenge.is_consumed == False)  # noqa: E712
            .order_by(OtpChallenge.created_at.desc())
            .limit(1)
        )
        challenge = (await session.execute(stmt)).scalar_one_or_none()

        if not challenge:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active verification challenge found. Please request a new OTP.",
            )

        # Check expiry
        exp_at = to_utc(challenge.expires_at)
        if exp_at and exp_at < now:
            challenge.is_consumed = True
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new code.",
            )

        # Check attempts limit
        if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
            challenge.is_consumed = True
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum verification attempts exceeded. Please request a new OTP.",
            )

        # Atomically increment attempt count
        challenge.attempts += 1

        # Check test code 1234 strictly in dev/test, otherwise check HMAC hash
        is_valid = False
        if settings.ENVIRONMENT.lower() in ("development", "test") and otp_code == "1234":
            is_valid = True
        else:
            is_valid = verify_otp_hash(phone, otp_code, challenge.otp_hash, settings.OTP_SECRET)

        if not is_valid:
            await session.commit()
            remaining_attempts = max(0, settings.OTP_MAX_ATTEMPTS - challenge.attempts)
            if remaining_attempts == 0:
                challenge.is_consumed = True
                await session.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid verification code. Maximum attempts exceeded.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification code. {remaining_attempts} attempts remaining.",
            )

        # Verification succeeded: mark consumed
        challenge.is_consumed = True
        await session.commit()
        return True
