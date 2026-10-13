import pytest
from decimal import Decimal
from pydantic import ValidationError

from backend.app.schemas import (
    ApiResponse,
    ApiError,
    OtpSendRequest,
    OtpVerifyRequest,
    AddressCreate,
    CartItemCreate,
    OrderCreate,
    ProductVariantRead,
    InventoryRead,
    DeliverySlotRead,
)


def test_api_response_envelope():
    """Verify uniform ApiResponse success and error envelopes."""
    success_resp = ApiResponse(success=True, data={"key": "val"}, error=None)
    assert success_resp.success is True
    assert success_resp.data == {"key": "val"}
    assert success_resp.error is None

    err = ApiError(code="INVALID_OTP", message="The entered OTP is incorrect", details={"attempts_remaining": 2})
    error_resp = ApiResponse[dict](success=False, data=None, error=err)
    assert error_resp.success is False
    assert error_resp.error.code == "INVALID_OTP"
    assert error_resp.error.details["attempts_remaining"] == 2


def test_otp_phone_normalization_and_validation():
    """Verify phone normalization to E.164 (+91...)."""
    req1 = OtpSendRequest(phone="9876543210", purpose="login")
    assert req1.phone == "+919876543210"

    req2 = OtpSendRequest(phone="+919876543210", purpose="register")
    assert req2.phone == "+919876543210"

    with pytest.raises(ValidationError):
        OtpSendRequest(phone="12345", purpose="login")

    with pytest.raises(ValidationError):
        OtpSendRequest(phone="9876543210", purpose="invalid_purpose")


def test_otp_verify_validation():
    """Verify OTP verification code constraints."""
    req = OtpVerifyRequest(phone="9876543210", otp="1234", purpose="login")
    assert req.otp == "1234"

    with pytest.raises(ValidationError):
        OtpVerifyRequest(phone="9876543210", otp="abc", purpose="login")


def test_address_pincode_validation():
    """Verify 6-digit Indian PIN code validation."""
    addr = AddressCreate(
        full_name="Aarav Sharma",
        phone="+919876543210",
        house_flat="402",
        street_area="Koramangala",
        city="Bengaluru",
        state="Karnataka",
        pincode="560034",
    )
    assert addr.pincode == "560034"

    with pytest.raises(ValidationError):
        AddressCreate(
            full_name="Aarav Sharma",
            phone="+919876543210",
            house_flat="402",
            street_area="Koramangala",
            city="Bengaluru",
            state="Karnataka",
            pincode="56003",  # 5 digits -> invalid
        )


def test_cart_item_quantity_bounds():
    """Verify cart item quantity must be between 1 and 20."""
    valid_item = CartItemCreate(variant_id="var-123", quantity=5)
    assert valid_item.quantity == 5

    with pytest.raises(ValidationError):
        CartItemCreate(variant_id="var-123", quantity=0)

    with pytest.raises(ValidationError):
        CartItemCreate(variant_id="var-123", quantity=21)


def test_catalog_variant_computed_fields():
    """Verify computed discount_amount and available_quantity calculations."""
    inv = InventoryRead(stock_quantity=50, reserved_quantity=10)
    assert inv.available_quantity == 40
    assert inv.is_in_stock is True

    variant = ProductVariantRead(
        id="v-1",
        product_id="p-1",
        weight_label="500g",
        weight_grams=500,
        price=Decimal("40.00"),
        mrp=Decimal("50.00"),
        is_available=True,
        display_order=0,
        inventory=inv,
    )
    assert variant.discount_amount == Decimal("10.00")


def test_order_create_payment_method_validation():
    """Verify allowed payment methods for order creation."""
    order = OrderCreate(address_id="addr-1", slot_id="slot-1", payment_method="upi")
    assert order.payment_method == "upi"

    with pytest.raises(ValidationError):
        OrderCreate(address_id="addr-1", slot_id="slot-1", payment_method="crypto")
