'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, CartReadWithPricing, CartItemRead, ApiError } from '@/lib/api-client';
import { useAuth } from './AuthContext';

interface CartContextType {
  cart: CartReadWithPricing | null;
  items: CartItemRead[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  packagingFee: number;
  total: number;
  isFreeDelivery: boolean;
  freeDeliveryShortfall: number;
  freeDeliveryProgress: number;
  isCartDrawerOpen: boolean;
  isUpdating: boolean;
  error: string | null;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleCartDrawer: () => void;
  addItem: (variantId: string, quantity?: number) => Promise<boolean>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  refreshCart: () => Promise<void>;
  getItemQuantityByVariant: (variantId: string) => number;
  getCartItemByVariant: (variantId: string) => CartItemRead | undefined;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [cart, setCart] = useState<CartReadWithPricing | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snapshot for recoverable rollback
  const previousCartRef = useRef<CartReadWithPricing | null>(null);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }

    try {
      const serverCart = await api.cart.getCart();
      setCart(serverCart);
      previousCartRef.current = serverCart;
      setError(null);
    } catch (err: any) {
      // Ignore if unauthenticated
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const items = cart?.items || [];
  const itemCount = cart?.item_count || items.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = Number(cart?.pricing?.subtotal || 0);
  const deliveryFee = Number(cart?.pricing?.delivery_fee || 0);
  const packagingFee = Number(cart?.pricing?.packaging_fee || 0);
  const total = Number(cart?.pricing?.total || 0);
  const isFreeDelivery = cart?.pricing?.is_free_delivery ?? subtotal >= 99;
  const freeDeliveryShortfall = Math.max(0, 99 - subtotal);
  const freeDeliveryProgress = Math.min(100, Math.round((subtotal / 99) * 100));

  const getItemQuantityByVariant = useCallback(
    (variantId: string): number => {
      const found = items.find((it) => it.variant_id === variantId);
      return found ? found.quantity : 0;
    },
    [items]
  );

  const getCartItemByVariant = useCallback(
    (variantId: string): CartItemRead | undefined => {
      return items.find((it) => it.variant_id === variantId);
    },
    [items]
  );

  // Optimistic & Recoverable Add Item
  const addItem = useCallback(
    async (variantId: string, quantity: number = 1): Promise<boolean> => {
      if (!isAuthenticated) {
        openAuthModal();
        return false;
      }

      setIsUpdating(true);
      setError(null);
      previousCartRef.current = cart;

      try {
        const updatedCart = await api.cart.addItem(variantId, quantity);
        setCart(updatedCart);
        previousCartRef.current = updatedCart;
        return true;
      } catch (err: any) {
        // Rollback to server actual state
        setError(err?.message || 'Failed to add item to cart.');
        await fetchCart();
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isAuthenticated, openAuthModal, cart, fetchCart]
  );

  // Optimistic & Recoverable Update Quantity
  const updateItemQuantity = useCallback(
    async (itemId: string, quantity: number): Promise<boolean> => {
      if (!isAuthenticated) {
        openAuthModal();
        return false;
      }

      setIsUpdating(true);
      setError(null);
      previousCartRef.current = cart;

      try {
        let updatedCart: CartReadWithPricing;
        if (quantity <= 0) {
          updatedCart = await api.cart.removeItem(itemId);
        } else {
          updatedCart = await api.cart.updateItem(itemId, quantity);
        }
        setCart(updatedCart);
        previousCartRef.current = updatedCart;
        return true;
      } catch (err: any) {
        setError(err?.message || 'Failed to update item quantity.');
        await fetchCart();
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isAuthenticated, openAuthModal, cart, fetchCart]
  );

  // Remove Item
  const removeItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;

      setIsUpdating(true);
      setError(null);
      previousCartRef.current = cart;

      try {
        const updatedCart = await api.cart.removeItem(itemId);
        setCart(updatedCart);
        previousCartRef.current = updatedCart;
        return true;
      } catch (err: any) {
        setError(err?.message || 'Failed to remove item.');
        await fetchCart();
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [isAuthenticated, cart, fetchCart]
  );

  // Clear Cart
  const clearCart = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) return false;

    setIsUpdating(true);
    try {
      const updatedCart = await api.cart.clearCart();
      setCart(updatedCart);
      previousCartRef.current = updatedCart;
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to clear cart.');
      await fetchCart();
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [isAuthenticated, fetchCart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        items,
        itemCount,
        subtotal,
        deliveryFee,
        packagingFee,
        total,
        isFreeDelivery,
        freeDeliveryShortfall,
        freeDeliveryProgress,
        isCartDrawerOpen,
        isUpdating,
        error,
        openCartDrawer: () => setIsCartDrawerOpen(true),
        closeCartDrawer: () => setIsCartDrawerOpen(false),
        toggleCartDrawer: () => setIsCartDrawerOpen((prev) => !prev),
        addItem,
        updateItemQuantity,
        removeItem,
        clearCart,
        refreshCart: fetchCart,
        getItemQuantityByVariant,
        getCartItemByVariant,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
