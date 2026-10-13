import pytest
from backend.app.services.pricing import calculate_order_pricing
from backend.app.core.config import Settings


def test_pricing_below_threshold():
    """Cart below ₹99 should incur ₹40 delivery fee and ₹10 packaging fee."""
    result = calculate_order_pricing(98.0)
    assert result["subtotal"] == 98.0
    assert result["packaging_fee"] == 10.0
    assert result["delivery_fee"] == 40.0
    assert result["total"] == 148.0
    assert result["is_free_delivery_eligible"] is False
    assert result["amount_needed_for_free_delivery"] == 1.0


def test_pricing_at_exact_threshold():
    """Cart at exactly ₹99 qualifies for free delivery with ₹10 packaging fee."""
    result = calculate_order_pricing(99.0)
    assert result["subtotal"] == 99.0
    assert result["packaging_fee"] == 10.0
    assert result["delivery_fee"] == 0.0
    assert result["total"] == 109.0
    assert result["is_free_delivery_eligible"] is True
    assert result["amount_needed_for_free_delivery"] == 0.0


def test_pricing_above_threshold():
    """Cart above ₹99 qualifies for free delivery with ₹10 packaging fee."""
    result = calculate_order_pricing(249.50)
    assert result["subtotal"] == 249.50
    assert result["packaging_fee"] == 10.0
    assert result["delivery_fee"] == 0.0
    assert result["total"] == 259.50
    assert result["is_free_delivery_eligible"] is True
    assert result["amount_needed_for_free_delivery"] == 0.0


def test_empty_cart():
    result = calculate_order_pricing(0.0)
    assert result["subtotal"] == 0.0
    assert result["total"] == 0.0
    assert result["is_free_delivery_eligible"] is False


def test_production_secret_validation_rejects_insecure_key():
    """Verify that settings reject insecure default secret keys when ENVIRONMENT=production."""
    with pytest.raises(ValueError, match="FATAL SECURITY MISCONFIGURATION"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="insecure-default-key",
            DEBUG=False,
        )


def test_production_secret_validation_rejects_debug_true():
    """Verify that settings reject DEBUG=True when ENVIRONMENT=production."""
    with pytest.raises(ValueError, match="DEBUG must be set to False"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-very-long-secure-random-key-with-over-32-characters-12345",
            JWT_SECRET_KEY="jwt-very-long-secure-random-key-with-over-32-characters-12345",
            OTP_SECRET="otp-very-long-secure-random-key-with-over-32-characters-12345",
            DEBUG=True,
        )
