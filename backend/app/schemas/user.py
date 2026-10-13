from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProfileRead(BaseModel):
    """Customer profile details."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class ProfileUpdate(BaseModel):
    """Profile update payload."""

    full_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)


class AddressCreate(BaseModel):
    """Payload to create or add a new delivery address."""

    full_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    house_flat: str = Field(..., min_length=1, max_length=100)
    street_area: str = Field(..., min_length=1, max_length=255)
    landmark: Optional[str] = Field(None, max_length=150)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    pincode: str = Field(..., min_length=6, max_length=6)
    label: str = Field("home", pattern="^(home|work|other)$")
    is_default: bool = False

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v: str) -> str:
        if not (len(v) == 6 and v.isdigit()):
            raise ValueError("Pincode must be exactly 6 digits")
        return v


class AddressUpdate(BaseModel):
    """Payload to update an existing delivery address."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=15)
    house_flat: Optional[str] = Field(None, min_length=1, max_length=100)
    street_area: Optional[str] = Field(None, min_length=1, max_length=255)
    landmark: Optional[str] = Field(None, max_length=150)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    state: Optional[str] = Field(None, min_length=1, max_length=100)
    pincode: Optional[str] = Field(None, min_length=6, max_length=6)
    label: Optional[str] = Field(None, pattern="^(home|work|other)$")
    is_default: Optional[bool] = None

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not (len(v) == 6 and v.isdigit()):
            raise ValueError("Pincode must be exactly 6 digits")
        return v


class AddressRead(AddressCreate):
    """Saved customer address record."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime


class UserRead(BaseModel):
    """Customer account details."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    phone: str
    email: Optional[str] = None
    role: str
    customer_code: Optional[str] = None
    is_phone_verified: bool
    is_email_verified: bool
    is_active: bool
    profile: Optional[ProfileRead] = None
    created_at: datetime
