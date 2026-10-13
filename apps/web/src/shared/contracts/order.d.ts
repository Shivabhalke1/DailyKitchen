import { CartItem, PricingBreakdown } from './cart.js';
export type OrderStatus = 'placed' | 'confirmed' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cod';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type DeliveryType = 'instant_express' | 'scheduled';
export interface Address {
    id: string;
    fullName: string;
    phone: string;
    houseFlat: string;
    streetArea: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    label: 'home' | 'work' | 'other';
    isDefault: boolean;
}
export interface DeliverySlot {
    id: string;
    type: DeliveryType;
    date: string;
    timeWindow: string;
    isAvailable: boolean;
}
export interface Order {
    id: string;
    orderNumber: string;
    userId: string;
    status: OrderStatus;
    items: CartItem[];
    pricing: PricingBreakdown;
    deliveryAddress: Address;
    deliverySlot: DeliverySlot;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    createdAt: string;
    estimatedDeliveryTime: string;
}
//# sourceMappingURL=order.d.ts.map