'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Truck,
} from 'lucide-react';
import { formatINR } from '@dailykitchen/shared-utils';

export function CartDrawer() {
  const {
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
    closeCartDrawer,
    updateItemQuantity,
    removeItem,
    clearCart,
    isUpdating,
    error,
  } = useCart();

  const { isAuthenticated, openAuthModal } = useAuth();

  if (!isCartDrawerOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={closeCartDrawer}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-borderSubtle animate-slideInRight">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-borderSubtle flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h2 id="cart-drawer-title" className="text-base font-bold text-textPrimary">
                My Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearCart()}
                  disabled={isUpdating}
                  className="text-xs text-textMuted hover:text-red-600 transition-colors px-2 py-1"
                >
                  Clear All
                </button>
              )}
              <button
                type="button"
                onClick={closeCartDrawer}
                className="text-textMuted hover:text-textPrimary p-1.5 rounded-lg transition-colors"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Recoverable Error Banner */}
          {error && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Free Delivery Tracker Bar */}
          {items.length > 0 && (
            <div className="bg-brand-50/60 p-4 border-b border-brand-100">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="flex items-center gap-1.5 text-brand-800">
                  <Truck className="w-4 h-4 text-brand-700" />
                  {isFreeDelivery ? (
                    <span className="text-brand-700 font-bold">🎉 FREE Delivery Unlocked!</span>
                  ) : (
                    <span>Add {formatINR(freeDeliveryShortfall)} more for FREE delivery</span>
                  )}
                </span>
                <span className="text-brand-900 font-bold">{freeDeliveryProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-brand-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${freeDeliveryProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-20 h-20 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-lg text-textPrimary">Your cart is empty</p>
                  <p className="text-sm text-textMuted max-w-xs">
                    Fresh vegetables and fruits harvested daily are waiting for you.
                  </p>
                </div>
                <Button variant="primary" onClick={closeCartDrawer}>
                  Start Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const variant = item.variant;
                  const unitPrice = variant ? Number(variant.price) : 0;
                  const lineTotal = unitPrice * item.quantity;

                  const itemName =
                    variant?.product_name ||
                    (variant as any)?.product?.name ||
                    (variant?.weight_label ? `Fresh Harvest (${variant.weight_label})` : 'Fresh Produce');

                  const itemImage =
                    variant?.product_image_url ||
                    (variant as any)?.product?.image_url;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-borderSubtle bg-white hover:border-slate-300 transition-all flex items-center justify-between gap-3"
                    >
                      {/* Item Thumbnail Image */}
                      {itemImage && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200">
                          <img
                            src={itemImage}
                            alt={itemName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-textPrimary truncate">
                          {itemName}
                        </p>
                        <p className="text-xs text-textMuted font-medium">
                          {variant?.weight_label || 'Standard Pack'} • {formatINR(unitPrice)}
                        </p>
                        <p className="text-xs font-bold text-brand-800 mt-1">
                          {formatINR(lineTotal)}
                        </p>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                          disabled={isUpdating}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-textPrimary hover:bg-slate-200 transition-colors text-xs font-bold"
                          aria-label={`Decrease quantity of ${itemName}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-black text-textPrimary">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                          disabled={isUpdating || item.quantity >= 20}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-brand-700 text-white hover:bg-brand-800 transition-colors text-xs font-bold"
                          aria-label={`Increase quantity of ${itemName}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Remove Trash Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={isUpdating}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                        aria-label={`Remove ${itemName} from cart`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bill Summary & Checkout Footer */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-borderSubtle bg-slate-50 space-y-4">
              {/* Bill Details */}
              <div className="space-y-1.5 text-xs text-textMuted">
                <div className="flex justify-between">
                  <span>Items Subtotal</span>
                  <span className="font-semibold text-textPrimary">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Packaging Fee (Safe produce crates)</span>
                  <span className="font-semibold text-textPrimary">{formatINR(packagingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee (Orders under ₹99: ₹40)</span>
                  <span className="font-semibold text-textPrimary">
                    {isFreeDelivery ? (
                      <span className="text-brand-700 font-bold uppercase">FREE</span>
                    ) : (
                      formatINR(deliveryFee)
                    )}
                  </span>
                </div>
                <div className="pt-2 border-t border-borderSubtle flex justify-between text-sm font-bold text-textPrimary">
                  <span>Total Amount</span>
                  <span className="text-base text-brand-800 font-black">{formatINR(total)}</span>
                </div>
              </div>

              {/* Checkout Action Button */}
              {isAuthenticated ? (
                <Link href="/checkout" onClick={closeCartDrawer} className="block">
                  <Button variant="primary" size="lg" className="w-full flex items-center justify-center gap-2">
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    closeCartDrawer();
                    openAuthModal();
                  }}
                >
                  Login to Checkout
                </Button>
              )}

              <div className="flex items-center justify-center gap-2 text-[10px] text-textMuted">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
                <span>100% Quality Guarantee • Hassle-free refunds</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
