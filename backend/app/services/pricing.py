from decimal import Decimal, ROUND_HALF_UP
from typing import TypedDict
from backend.app.core.config import settings


class PricingResult(TypedDict):
    subtotal: float
    packaging_fee: float
    delivery_fee: float
    total: float
    is_free_delivery_eligible: bool
    amount_needed_for_free_delivery: float


def round_inr(val: float) -> float:
    """Accurately round to two decimal places for INR currency calculations."""
    return float(Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def calculate_order_pricing(subtotal: float) -> PricingResult:
    """
    Authoritative backend calculation for DailyKitchen cart and order pricing.
    
    Locked Business Rules:
    - Packaging Fee: ₹10
    - Delivery Fee: ₹40
    - Free Delivery Eligibility: subtotal >= ₹99.00
    - Backend is 100% authoritative for all final order amounts.
    """
    subtotal_clean = max(0.0, round_inr(subtotal))

    if subtotal_clean == 0.0:
        return {
            "subtotal": 0.0,
            "packaging_fee": 0.0,
            "delivery_fee": 0.0,
            "total": 0.0,
            "is_free_delivery_eligible": False,
            "amount_needed_for_free_delivery": float(settings.FREE_DELIVERY_THRESHOLD),
        }

    is_free_delivery = subtotal_clean >= settings.FREE_DELIVERY_THRESHOLD
    delivery_fee = 0.0 if is_free_delivery else float(settings.STANDARD_DELIVERY_FEE)
    packaging_fee = float(settings.PACKAGING_FEE)
    total = round_inr(subtotal_clean + delivery_fee + packaging_fee)
    amount_needed = 0.0 if is_free_delivery else round_inr(settings.FREE_DELIVERY_THRESHOLD - subtotal_clean)

    return {
        "subtotal": subtotal_clean,
        "packaging_fee": packaging_fee,
        "delivery_fee": delivery_fee,
        "total": total,
        "is_free_delivery_eligible": is_free_delivery,
        "amount_needed_for_free_delivery": amount_needed,
    }
