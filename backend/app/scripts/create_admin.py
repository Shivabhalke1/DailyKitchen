#!/usr/bin/env python3
"""
CLI utility to provision or promote an administrator account for DailyKitchen.
Usage:
    PYTHONPATH=. python3 backend/app/scripts/create_admin.py --phone +919999999999 --password SecretPassword123 --name "Store Manager"
"""

import argparse
import asyncio
import sys
from sqlalchemy import select

from backend.app.core.security import hash_password
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.user import Profile, User


async def create_or_promote_admin(phone: str, password: str, full_name: str, email: str = None):
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.phone == phone)
        user = (await session.execute(stmt)).scalar_one_or_none()

        if user:
            print(f"Existing account found for {phone}. Promoting role from '{user.role}' to 'admin'...")
            user.role = "admin"
            user.is_active = True
            user.hashed_password = hash_password(password)
            if email:
                user.email = email.lower()
        else:
            print(f"Creating new administrator account for {phone}...")
            user = User(
                phone=phone,
                email=email.lower() if email else None,
                hashed_password=hash_password(password),
                is_phone_verified=True,
                is_email_verified=True if email else False,
                role="admin",
                is_active=True,
            )
            profile = Profile(user=user, full_name=full_name)
            session.add_all([user, profile])

        await session.commit()
        print(f"Successfully provisioned administrator account for phone: {phone} (ID: {user.id})")


def main():
    parser = argparse.ArgumentParser(description="Provision DailyKitchen Admin Account")
    parser.add_argument("--phone", required=True, help="E.164 phone number (e.g. +919999999999)")
    parser.add_argument("--password", required=True, help="Administrator password")
    parser.add_argument("--name", default="Administrator", help="Admin display name")
    parser.add_argument("--email", default=None, help="Admin email address")

    args = parser.parse_args()
    asyncio.run(create_or_promote_admin(args.phone, args.password, args.name, args.email))


if __name__ == "__main__":
    main()
