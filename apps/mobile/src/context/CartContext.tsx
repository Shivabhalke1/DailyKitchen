import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, CartItemRead, CartReadWithPricing } from '../lib/api-client';
import { useAuth } from './AuthContext';
import { calculatePricing } from '@dailykitchen/shared-utils';

interface CartContextType {
  cart: CartReadWithPricing | null;
  items: CartItemRead[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  packagingFee: number;
  total: number;
  isFreeDelivery: boolean;
  amountNeededForFreeDelivery: number;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  refreshCart: () => Promise<void>;
  addItem: (variantId: string, quantity?: number) => Promise<boolean>;
  updateItemQuantity: (itemId: string, newQuantity: number) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  getItemQuantity: (variantId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [cart, setCart] = useState<CartReadWithPricing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch fresh cart from server
  const fetchCartFromServer = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const serverCart = await api.cart.getCart();
      setCart(serverCart);
    } catch (err: any) {
      setError(err?.message || 'Could not fetch cart.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCartFromServer();
  }, [fetchCartFromServer]);

  // Optimistic Add Item with Recovery
  const addItem = useCallback(
    async (variantId: string, quantity: number = 1): Promise<boolean> => {
      if (!isAuthenticated) {
        openAuthModal();
        return false;
      }

      setIsUpdating(true);
      setError(null);
      const previousCart = cart;

      try {
        const freshCart = await api.cart.addItem(variantId, quantity);
        setCart(freshCart);
        return true;
      } catch (err: any) {
        // Recover previous state and fetch authoritative server cart
        setCart(previousCart);
        setError(err?.message || 'Failed to add item to cart. Please check available stock.');
        await fetchCartFromServer();
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isAuthenticated, openAuthModal, cart, fetchCartFromServer]
  );

  // Optimistic Update Quantity with Recovery
  const updateItemQuantity = useCallback(
    async (itemId: string, newQuantity: number): Promise<boolean> => {
      if (!isAuthenticated) return false;

      setIsUpdating(true);
      setError(null);
      const previousCart = cart;

      // If quantity is reduced to 0 or less, remove item
      if (newQuantity <= 0) {
        return removeItem(itemId);
      }

      // Optimistically update item quantity in local state
      if (cart) {
        const optimisticItems: CartItemRead[] = cart.items.map((it: CartItemRead) =>
          it.id === itemId ? { ...it, quantity: newQuantity } : it
        );
        const optimisticSubtotal = optimisticItems.reduce((acc: number, it: CartItemRead) => {
          const price = it.variant ? Number(it.variant.price) : 0;
          return acc + price * it.quantity;
        }, 0);
        const pricingRule = calculatePricing(optimisticSubtotal);

        setCart({
          ...cart,
          items: optimisticItems,
          item_count: optimisticItems.reduce((acc: number, it: CartItemRead) => acc + it.quantity, 0),
          subtotal: optimisticSubtotal.toFixed(2),
          pricing: {
            subtotal: pricingRule.subtotal.toFixed(2),
            delivery_fee: pricingRule.deliveryFee.toFixed(2),
            packaging_fee: pricingRule.packagingFee.toFixed(2),
            total: pricingRule.total.toFixed(2),
            is_free_delivery: pricingRule.isFreeDeliveryEligible,
          },
        });
      }

      try {
        const freshCart = await api.cart.updateItem(itemId, newQuantity);
        setCart(freshCart);
        return true;
      } catch (err: any) {
        // Rollback on rejection (e.g. stock limits exceeded)
        setCart(previousCart);
        setError(err?.message || 'Could not update item quantity.');
        await fetchCartFromServer();
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isAuthenticated, cart, fetchCartFromServer]
  );

  // Optimistic Remove Item with Recovery
  const removeItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      setIsUpdating(true);
      setError(null);
      const previousCart = cart;

      if (cart) {
        const filteredItems: CartItemRead[] = cart.items.filter((it: CartItemRead) => it.id !== itemId);
        const optimisticSubtotal = filteredItems.reduce((acc: number, it: CartItemRead) => {
          const price = it.variant ? Number(it.variant.price) : 0;
          return acc + price * it.quantity;
        }, 0);
        const pricingRule = calculatePricing(optimisticSubtotal);

        setCart({
          ...cart,
          items: filteredItems,
          item_count: filteredItems.reduce((acc: number, it: CartItemRead) => acc + it.quantity, 0),
          subtotal: optimisticSubtotal.toFixed(2),
          pricing: {
            subtotal: pricingRule.subtotal.toFixed(2),
            delivery_fee: pricingRule.deliveryFee.toFixed(2),
            packaging_fee: pricingRule.packagingFee.toFixed(2),
            total: pricingRule.total.toFixed(2),
            is_free_delivery: pricingRule.isFreeDeliveryEligible,
          },
        });
      }

      try {
        const freshCart = await api.cart.removeItem(itemId);
        setCart(freshCart);
        return true;
      } catch (err: any) {
        setCart(previousCart);
        setError(err?.message || 'Failed to remove item.');
        await fetchCartFromServer();
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isAuthenticated, cart, fetchCartFromServer]
  );

  // Clear Cart
  const clearCart = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) return false;
    setIsUpdating(true);
    setError(null);
    try {
      const freshCart = await api.cart.clearCart();
      setCart(freshCart);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to clear cart.');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [isAuthenticated]);

  const getItemQuantity = useCallback(
    (variantId: string): number => {
      if (!cart || !cart.items) return 0;
      const found = cart.items.find((it: CartItemRead) => it.variant_id === variantId);
      return found ? found.quantity : 0;
    },
    [cart]
  );

  // Derived values from authoritative server pricing
  const subtotal = cart?.pricing ? Number(cart.pricing.subtotal) : 0;
  const deliveryFee = cart?.pricing ? Number(cart.pricing.delivery_fee) : 0;
  const packagingFee = cart?.pricing ? Number(cart.pricing.packaging_fee) : 0;
  const total = cart?.pricing ? Number(cart.pricing.total) : 0;
  const isFreeDelivery = cart?.pricing ? cart.pricing.is_free_delivery : false;
  const amountNeededForFreeDelivery = Math.max(0, 99 - subtotal);
  const itemCount = cart?.items ? cart.items.reduce((acc: number, it: CartItemRead) => acc + it.quantity, 0) : 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        items: cart?.items || [],
        itemCount,
        subtotal,
        deliveryFee,
        packagingFee,
        total,
        isFreeDelivery,
        amountNeededForFreeDelivery,
        isLoading,
        isUpdating,
        error,
        refreshCart: fetchCartFromServer,
        addItem,
        updateItemQuantity,
        removeItem,
        clearCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
