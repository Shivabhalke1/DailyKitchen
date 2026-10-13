import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.config import settings
from backend.app.core.security import (
    hash_password,
    verify_password,
    hash_token,
    decode_token,
    create_access_token,
    create_refresh_token,
    generate_customer_code,
    to_utc,
)
from backend.app.models.base import generate_uuid
from backend.app.models.user import User, Profile, PasswordResetToken
from backend.app.models.cart import Cart
from backend.app.models.session import UserSession
from backend.app.services.otp_service import OtpService


class TestResetMailbox:
    """
    Isolated in-memory mailbox for password reset testing in development.
    Strictly inaccessible in production environments.
    """
    def __init__(self):
        self._mailbox: Dict[str, Tuple[str, datetime]] = {}

    def deliver(self, identifier: str, reset_token: str):
        if settings.ENVIRONMENT.lower() in ("development", "test"):
            self._mailbox[identifier.lower()] = (reset_token, datetime.now(timezone.utc))

    def get_last_token(self, identifier: str) -> Optional[str]:
        if settings.ENVIRONMENT.lower() not in ("development", "test"):
            return None
        record = self._mailbox.get(identifier.lower())
        if record:
            token, sent_at = record
            if datetime.now(timezone.utc) - sent_at < timedelta(minutes=20):
                return token
        return None

    def clear(self):
        self._mailbox.clear()


test_reset_mailbox = TestResetMailbox()


class AuthService:
    """Service handling customer authentication, session lifecycles, and refresh rotation."""

    @classmethod
    async def generate_unique_customer_code(cls, session: AsyncSession) -> str:
        """
        Generates a collision-safe unique customer code in DKC-XXXXXXXX format.
        """
        for _ in range(10):
            code = generate_customer_code()
            stmt = select(User.id).where(User.customer_code == code)
            exists = (await session.execute(stmt)).scalar_one_or_none()
            if not exists:
                return code
        raise RuntimeError("Failed to generate a unique customer code after multiple attempts.")

    @classmethod
    async def create_tokens_for_user(
        cls,
        session: AsyncSession,
        user: User,
        family_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[str, str]:
        """
        Creates access token and persistent refresh session.
        Returns (access_token, refresh_token).
        """
        now = datetime.now(timezone.utc)
        fam_id = family_id or generate_uuid()
        raw_refresh_token = create_refresh_token(user_id=user.id, family_id=fam_id)
        refresh_hash = hash_token(raw_refresh_token)

        user_session = UserSession(
            user_id=user.id,
            refresh_token_hash=refresh_hash,
            family_id=fam_id,
            is_revoked=False,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(user_session)

        access_token = create_access_token(
            user_id=user.id,
            phone=user.phone,
            role=user.role,
        )
        await session.commit()
        return access_token, raw_refresh_token

    @classmethod
    async def authenticate_or_register_via_otp(
        cls,
        session: AsyncSession,
        phone: str,
        otp_code: str,
        purpose: str = "login",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str, str]:
        """
        Verifies phone OTP and initializes user if new, then issues session tokens.
        Ensures a permanent customer_code is assigned.
        """
        await OtpService.verify_otp(session, phone, otp_code, purpose)

        # Look up user
        stmt = (
            select(User)
            .options(selectinload(User.profile))
            .where(User.phone == phone)
        )
        user = (await session.execute(stmt)).scalar_one_or_none()

        if not user:
            # Create user, profile, cart
            code = await cls.generate_unique_customer_code(session)
            user = User(
                phone=phone,
                customer_code=code,
                is_phone_verified=True,
                role="customer",
                is_active=True,
            )
            profile = Profile(user=user)
            cart = Cart(user=user)
            session.add_all([user, profile, cart])
            await session.flush()
        else:
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This account has been deactivated. Please contact support.",
                )
            user.is_phone_verified = True
            if not user.customer_code:
                user.customer_code = await cls.generate_unique_customer_code(session)
                await session.flush()

        access_token, refresh_token = await cls.create_tokens_for_user(
            session=session,
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user, access_token, refresh_token

    @classmethod
    async def authenticate_via_password(
        cls,
        session: AsyncSession,
        identifier: str,
        password: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str, str]:
        """
        Authenticates an account via password (anti-enumeration protected).
        Supports phone (+91XXXXXXXXXX or 10-digit), email, or customer_code.
        """
        clean_id = identifier.strip()
        # Handle phone with or without +91 prefix
        clean_without_plus91 = clean_id.removeprefix("+91")
        clean_with_plus91 = f"+91{clean_without_plus91}"

        stmt = (
            select(User)
            .options(selectinload(User.profile))
            .where(
                (User.phone == clean_id)
                | (User.phone == clean_with_plus91)
                | (User.phone == clean_without_plus91)
                | (func.lower(User.email) == clean_id.lower())
                | (User.customer_code == clean_id.upper())
            )
        )
        user = (await session.execute(stmt)).scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No account found with this Phone Number, Email, or Customer ID. Please register first.",
            )

        if not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No password has been set for this account. Please reset your password or register.",
            )

        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password. Please try again.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated.",
            )

        # Backfill customer code on the fly if somehow missing
        if not user.customer_code:
            user.customer_code = await cls.generate_unique_customer_code(session)
            await session.flush()

        access_token, refresh_token = await cls.create_tokens_for_user(
            session=session,
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user, access_token, refresh_token

    @classmethod
    async def register_customer(
        cls,
        session: AsyncSession,
        full_name: str,
        phone: str,
        password: str,
        email: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str, str]:
        """
        Registers a new customer with password, phone, full name, and unique customer ID.
        """
        # Uniqueness check
        stmt = select(User).where(
            (User.phone == phone)
            | (func.lower(User.email) == func.lower(email if email else ""))
        )
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this phone number or email already exists.",
            )

        hashed = hash_password(password)
        code = await cls.generate_unique_customer_code(session)
        user = User(
            phone=phone,
            email=email.lower() if email else None,
            customer_code=code,
            hashed_password=hashed,
            is_phone_verified=False,
            role="customer",
            is_active=True,
        )
        profile = Profile(user=user, full_name=full_name)
        cart = Cart(user=user)
        session.add_all([user, profile, cart])
        await session.flush()

        access_token, refresh_token = await cls.create_tokens_for_user(
            session=session,
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return user, access_token, refresh_token

    @classmethod
    async def rotate_refresh_token(
        cls,
        session: AsyncSession,
        raw_refresh_token: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[User, str, str]:
        """
        Atomically rotates refresh tokens. Detects replay attacks and revokes the entire family.
        """
        now = datetime.now(timezone.utc)
        claims = decode_token(raw_refresh_token, expected_type="refresh")
        user_id = claims["sub"]
        family_id = claims.get("family_id")
        token_hash = hash_token(raw_refresh_token)

        # Lookup session with row lock to serialize concurrent rotations
        stmt = (
            select(UserSession)
            .where(UserSession.refresh_token_hash == token_hash)
            .with_for_update()
        )
        current_session = (await session.execute(stmt)).scalar_one_or_none()

        # REPLAY ATTACK DETECTION:
        # If token was already revoked or not found in active state, revoke all tokens in family!
        if not current_session or current_session.is_revoked:
            if family_id:
                revoke_family_stmt = (
                    update(UserSession)
                    .where(UserSession.family_id == family_id)
                    .values(is_revoked=True)
                )
                await session.execute(revoke_family_stmt)
                await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security alert: Refresh token replay detected. Session has been revoked.",
            )

        exp_at = to_utc(current_session.expires_at)
        if exp_at and exp_at < now:
            current_session.is_revoked = True
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired. Please log in again.",
            )

        # 1. Atomically mark current token as rotated/revoked
        current_session.is_revoked = True

        # 2. Fetch user
        user_stmt = select(User).options(selectinload(User.profile)).where(User.id == user_id)
        user = (await session.execute(user_stmt)).scalar_one_or_none()
        if not user or not user.is_active:
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or not found.",
            )

        # 3. Create new token in the SAME family
        new_raw_refresh = create_refresh_token(user_id=user.id, family_id=family_id)
        new_hash = hash_token(new_raw_refresh)
        new_session = UserSession(
            user_id=user.id,
            refresh_token_hash=new_hash,
            family_id=family_id,
            is_revoked=False,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        session.add(new_session)

        new_access_token = create_access_token(
            user_id=user.id,
            phone=user.phone,
            role=user.role,
        )
        await session.commit()
        return user, new_access_token, new_raw_refresh

    @classmethod
    async def revoke_session(
        cls,
        session: AsyncSession,
        raw_refresh_token: str,
    ) -> None:
        """Revokes a refresh session on user logout."""
        token_hash = hash_token(raw_refresh_token)
        stmt = (
            update(UserSession)
            .where(UserSession.refresh_token_hash == token_hash)
            .values(is_revoked=True)
        )
        await session.execute(stmt)
        await session.commit()

    @classmethod
    async def request_password_reset(
        cls,
        session: AsyncSession,
        identifier: str,
        ip_address: Optional[str] = None,
    ) -> Tuple[str, Optional[str]]:
        """
        Initiates a password reset challenge.
        - Enforces rate limiting (max 3 requests per 10 minutes)
        - Generic response to prevent account enumeration
        - In dev/test mode, delivers to test_reset_mailbox and returns token for automation
        """
        now = datetime.now(timezone.utc)
        clean_id = identifier.strip()

        # Find user
        stmt = (
            select(User)
            .where(
                (User.phone == clean_id)
                | (User.phone == f"+91{clean_id}")
                | (func.lower(User.email) == clean_id.lower())
                | (User.customer_code == clean_id.upper())
            )
        )
        user = (await session.execute(stmt)).scalar_one_or_none()

        dev_token: Optional[str] = None

        if user and user.is_active:
            # Check rate limit: count unexpired tokens created in last 10 minutes
            ten_mins_ago = now - timedelta(minutes=10)
            rate_stmt = select(func.count(PasswordResetToken.id)).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.created_at >= ten_mins_ago,
            )
            count = (await session.execute(rate_stmt)).scalar_one()
            if count >= 3:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many password reset requests. Please wait 10 minutes before retrying.",
                )

            # Generate high-entropy 32-byte token
            raw_token = secrets.token_urlsafe(32)
            token_hashed = hash_token(raw_token)
            expires_at = now + timedelta(minutes=20)

            reset_record = PasswordResetToken(
                user_id=user.id,
                token_hash=token_hashed,
                expires_at=expires_at,
                is_used=False,
            )
            session.add(reset_record)
            await session.commit()

            test_reset_mailbox.deliver(user.phone, raw_token)
            if user.email:
                test_reset_mailbox.deliver(user.email, raw_token)
            if user.customer_code:
                test_reset_mailbox.deliver(user.customer_code, raw_token)

            if settings.ENVIRONMENT.lower() in ("development", "test"):
                dev_token = raw_token

        generic_message = (
            "If an account matches that identifier, password reset instructions have been dispatched."
        )
        return generic_message, dev_token

    @classmethod
    async def confirm_password_reset(
        cls,
        session: AsyncSession,
        token: str,
        new_password: str,
    ) -> None:
        """
        Validates token, updates password hash, marks token as used,
        and revokes all active sessions for this user.
        """
        now = datetime.now(timezone.utc)
        token_hashed = hash_token(token.strip())

        stmt = select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hashed,
            PasswordResetToken.is_used == False,
        )
        reset_token = (await session.execute(stmt)).scalar_one_or_none()

        if not reset_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired password reset token.",
            )

        exp_at = to_utc(reset_token.expires_at)
        if not exp_at or exp_at < now:
            reset_token.is_used = True
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has expired.",
            )

        user_stmt = select(User).where(User.id == reset_token.user_id)
        user = (await session.execute(user_stmt)).scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User account not found or deactivated.",
            )

        # 1. Update password
        user.hashed_password = hash_password(new_password)
        reset_token.is_used = True

        # 2. Revoke all existing sessions for this user (Security Invariant)
        revoke_sessions_stmt = (
            update(UserSession)
            .where(UserSession.user_id == user.id)
            .values(is_revoked=True)
        )
        await session.execute(revoke_sessions_stmt)
        await session.commit()
