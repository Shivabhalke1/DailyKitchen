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
    packagingFee: number;
    deliveryFee: number;
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
//# sourceMappingURL=cart.d.ts.map