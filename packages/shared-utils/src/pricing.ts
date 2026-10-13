import type { PricingBreakdown } from '@dailykitchen/contracts';

/**
 * DailyKitchen Pricing Policy Constants:
 * - Packaging fee: ₹10
 * - Standard delivery fee: ₹40
 * - Free delivery threshold: subtotal >= ₹99
 *
 * NOTE: The backend API remains the authoritative source for all final order amounts.
 * Client calculations are for immediate UX feedback only.
 */
export const PACKAGING_FEE = 10;
export const STANDARD_DELIVERY_FEE = 40;
export const FREE_DELIVERY_THRESHOLD = 99;

export function calculatePricing(rawSubtotal: number): PricingBreakdown {
  const subtotal = Math.max(0, Math.round((rawSubtotal + Number.EPSILON) * 100) / 100);

  if (subtotal === 0) {
    return {
      subtotal: 0,
      packagingFee: 0,
      deliveryFee: 0,
      total: 0,
      isFreeDeliveryEligible: false,
      amountNeededForFreeDelivery: FREE_DELIVERY_THRESHOLD,
    };
  }

  const isFreeDeliveryEligible = subtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = isFreeDeliveryEligible ? 0 : STANDARD_DELIVERY_FEE;
  const packagingFee = PACKAGING_FEE;
  const total = Math.round((subtotal + deliveryFee + packagingFee + Number.EPSILON) * 100) / 100;
  const amountNeededForFreeDelivery = isFreeDeliveryEligible
    ? 0
    : Math.round((FREE_DELIVERY_THRESHOLD - subtotal + Number.EPSILON) * 100) / 100;

  return {
    subtotal,
    packagingFee,
    deliveryFee,
    total,
    isFreeDeliveryEligible,
    amountNeededForFreeDelivery,
  };
}
