from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.api.deps import get_current_user
from backend.app.models.user import User, Profile, Address
from backend.app.schemas.common import ApiResponse
from backend.app.schemas.user import (
    ProfileRead,
    ProfileUpdate,
    AddressCreate,
    AddressUpdate,
    AddressRead,
)

router = APIRouter()


@router.patch(
    "/me/profile",
    response_model=ApiResponse[ProfileRead],
    status_code=status.HTTP_200_OK,
    summary="Update customer profile",
)
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates authenticated customer profile (full name, avatar URL).
    """
    profile = current_user.profile
    if not profile:
        profile = Profile(user_id=current_user.id)
        db.add(profile)

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(profile, field, val)

    await db.commit()
    await db.refresh(profile)

    return ApiResponse(
        success=True,
        data=ProfileRead.model_validate(profile),
    )


@router.get(
    "/me/addresses",
    response_model=ApiResponse[List[AddressRead]],
    status_code=status.HTTP_200_OK,
    summary="List saved customer addresses",
)
async def list_addresses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves all saved delivery addresses for the authenticated user,
    ordered by default address first, then creation date descending.
    """
    stmt = (
        select(Address)
        .where(Address.user_id == current_user.id)
        .order_by(Address.is_default.desc(), Address.created_at.desc())
    )
    result = await db.execute(stmt)
    addresses = result.scalars().all()

    return ApiResponse(
        success=True,
        data=[AddressRead.model_validate(addr) for addr in addresses],
    )


@router.post(
    "/me/addresses",
    response_model=ApiResponse[AddressRead],
    status_code=status.HTTP_201_CREATED,
    summary="Add new customer delivery address",
)
async def create_address(
    payload: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a new delivery address for the authenticated user.
    Maintains the single-default guarantee atomically.
    The first added address is automatically designated as default.
    """
    # Check existing address count for this user
    count_stmt = (
        select(func.count())
        .select_from(Address)
        .where(Address.user_id == current_user.id)
    )
    addr_count = (await db.execute(count_stmt)).scalar_one()

    is_default = payload.is_default or (addr_count == 0)

    if is_default and addr_count > 0:
        # Atomically clear prior defaults to satisfy partial unique index
        clear_stmt = (
            update(Address)
            .where(Address.user_id == current_user.id)
            .values(is_default=False)
        )
        await db.execute(clear_stmt)

    address = Address(
        user_id=current_user.id,
        full_name=payload.full_name,
        phone=payload.phone,
        house_flat=payload.house_flat,
        street_area=payload.street_area,
        landmark=payload.landmark,
        city=payload.city,
        state=payload.state,
        pincode=payload.pincode,
        label=payload.label,
        is_default=is_default,
    )
    db.add(address)
    await db.commit()
    await db.refresh(address)

    return ApiResponse(
        success=True,
        data=AddressRead.model_validate(address),
    )


@router.patch(
    "/me/addresses/{address_id}",
    response_model=ApiResponse[AddressRead],
    status_code=status.HTTP_200_OK,
    summary="Update delivery address",
)
async def update_address(
    address_id: str,
    payload: AddressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates an existing delivery address belonging to the authenticated customer.
    Enforces strict ownership isolation; returns 404 if not found or unauthorized.
    """
    stmt = (
        select(Address)
        .where(Address.id == address_id)
        .where(Address.user_id == current_user.id)
    )
    address = (await db.execute(stmt)).scalar_one_or_none()

    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("is_default") is True:
        # Clear other defaults first
        clear_stmt = (
            update(Address)
            .where(Address.user_id == current_user.id)
            .where(Address.id != address_id)
            .values(is_default=False)
        )
        await db.execute(clear_stmt)

    for field, val in update_data.items():
        setattr(address, field, val)

    await db.commit()
    await db.refresh(address)

    return ApiResponse(
        success=True,
        data=AddressRead.model_validate(address),
    )


@router.put(
    "/me/addresses/{address_id}/default",
    response_model=ApiResponse[AddressRead],
    status_code=status.HTTP_200_OK,
    summary="Set address as default",
)
async def set_default_address(
    address_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Atomically designates an address as the customer's primary default address.
    Clears the default flag from any previous default address.
    """
    stmt = (
        select(Address)
        .where(Address.id == address_id)
        .where(Address.user_id == current_user.id)
    )
    address = (await db.execute(stmt)).scalar_one_or_none()

    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found.",
        )

    # Clear previous defaults
    clear_stmt = (
        update(Address)
        .where(Address.user_id == current_user.id)
        .values(is_default=False)
    )
    await db.execute(clear_stmt)

    address.is_default = True
    await db.commit()
    await db.refresh(address)

    return ApiResponse(
        success=True,
        data=AddressRead.model_validate(address),
    )


@router.delete(
    "/me/addresses/{address_id}",
    response_model=ApiResponse[Dict[str, str]],
    status_code=status.HTTP_200_OK,
    summary="Delete delivery address",
)
async def delete_address(
    address_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes an existing address after verifying customer ownership.
    If the deleted address was the default, automatically promotes the most recent remaining address.
    """
    stmt = (
        select(Address)
        .where(Address.id == address_id)
        .where(Address.user_id == current_user.id)
    )
    address = (await db.execute(stmt)).scalar_one_or_none()

    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found.",
        )

    was_default = address.is_default
    await db.delete(address)
    await db.flush()

    # If it was default, make the most recent remaining address the default
    if was_default:
        remaining_stmt = (
            select(Address)
            .where(Address.user_id == current_user.id)
            .order_by(Address.created_at.desc())
            .limit(1)
        )
        remaining = (await db.execute(remaining_stmt)).scalar_one_or_none()
        if remaining:
            remaining.is_default = True

    await db.commit()

    return ApiResponse(
        success=True,
        data={"message": "Address deleted successfully."},
    )
