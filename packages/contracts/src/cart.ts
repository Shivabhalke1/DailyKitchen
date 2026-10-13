import { Product, ProductVariant } from './catalog.js';

export interface CartItem {
  id: string;
  variantId: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
  itemTotal: number;
}

export interface PricingBreakdown {
  subtotal: number;
  packagingFee: number; // ₹10 fixed
  deliveryFee: number;  // ₹0 if subtotal >= ₹99, else ₹40
  total: number;
  isFreeDeliveryEligible: boolean;
  amountNeededForFreeDelivery: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  pricing: PricingBreakdown;
  itemCount: number;
}
