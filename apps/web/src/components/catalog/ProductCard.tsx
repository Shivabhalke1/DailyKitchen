'use client';

import React, { useState } from 'react';
import { ProductRead, ProductVariantRead } from '@/lib/api-client';
import { useCart } from '@/context/CartContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Plus, Minus, Sparkles, Check, Flame } from 'lucide-react';
import { formatINR } from '@dailykitchen/shared-utils';

interface ProductCardProps {
  product: ProductRead;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, updateItemQuantity, getCartItemByVariant, isUpdating } = useCart();
  const variants = product.variants || [];

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const selectedVariant: ProductVariantRead | undefined = variants[selectedVariantIdx];

  if (!selectedVariant) {
    return (
      <div className="bg-white rounded-2xl border border-borderSubtle shadow-sm flex flex-col overflow-hidden opacity-90">
        <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center overflow-hidden">
          <div className="absolute top-2.5 left-2.5">
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-sm">
              <span>Preparing Fresh</span>
            </span>
          </div>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="text-3xl">🌱</div>
          )}
        </div>
        <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-textPrimary">{product.name}</h3>
            {product.description && (
              <p className="text-xs text-textMuted line-clamp-2 mt-0.5">{product.description}</p>
            )}
          </div>
          <div className="pt-2 border-t border-borderSubtle/60 flex items-center justify-between">
            <span className="text-xs text-textMuted font-medium">Pack sizes coming soon</span>
            <span className="text-xs text-slate-500 font-semibold px-2 py-1 bg-slate-100 rounded-lg">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    );
  }

  const cartItem = getCartItemByVariant(selectedVariant.id);
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  const price = Number(selectedVariant.price);
  const mrp = Number(selectedVariant.mrp);
  const hasDiscount = mrp > price;
  const savings = mrp - price;
  const isAvailable = selectedVariant.is_available && (selectedVariant.inventory?.stock_quantity ?? 1) > 0;

  return (
    <div className="bg-white rounded-2xl border border-borderSubtle hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group">
      {/* Visual Header / Image Container */}
      <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center overflow-hidden">
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {product.is_fresh_today && (
            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-sm">
              <Sparkles className="w-3 h-3" />
              <span>Fresh Today</span>
            </span>
          )}
          {product.is_popular && (
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full shadow-sm">
              <Flame className="w-3 h-3" />
              <span>Popular</span>
            </span>
          )}
        </div>

        {/* Real Produce Photograph */}
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center text-2xl font-black">
            {product.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <h3 className="font-bold text-sm sm:text-base text-textPrimary leading-snug line-clamp-1">
            {product.name}
          </h3>
          <p className="text-xs text-textMuted line-clamp-2 leading-relaxed">
            {product.description || 'Farm-fresh daily harvest sourced with rigorous quality standards.'}
          </p>
        </div>

        {/* Weight Variant Switcher */}
        {variants.length > 1 && (
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-textMuted tracking-wider">Weight:</span>
            <div className="flex flex-wrap gap-1.5">
              {variants.map((v, idx) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantIdx(idx)}
                  className={`text-xs px-2 py-1 rounded-lg font-bold transition-all border ${
                    selectedVariantIdx === idx
                      ? 'bg-brand-50 text-brand-800 border-brand-600 shadow-sm'
                      : 'bg-slate-50 text-textMuted border-borderSubtle hover:bg-slate-100'
                  }`}
                >
                  {v.weight_label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pricing & Add Stepper Footer */}
        <div className="pt-2 border-t border-borderSubtle/60 flex items-end justify-between gap-2">
          {/* Prices */}
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black text-textPrimary">
                {formatINR(price)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-textMuted line-through font-medium">
                  {formatINR(mrp)}
                </span>
              )}
            </div>
            {hasDiscount && (
              <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                Save {formatINR(savings)}
              </span>
            )}
          </div>

          {/* Action Button: Stepper or Add */}
          <div>
            {!isAvailable ? (
              <span className="text-xs text-red-600 font-bold px-2 py-1 bg-red-50 rounded-lg">
                Out of Stock
              </span>
            ) : quantityInCart > 0 && cartItem ? (
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateItemQuantity(cartItem.id, quantityInCart - 1)}
                  disabled={isUpdating}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-textPrimary hover:bg-slate-200 transition-colors text-xs font-bold"
                  aria-label={`Decrease quantity of ${product.name}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-xs font-black text-textPrimary">
                  {quantityInCart}
                </span>
                <button
                  type="button"
                  onClick={() => updateItemQuantity(cartItem.id, quantityInCart + 1)}
                  disabled={isUpdating || quantityInCart >= 20}
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-brand-700 text-white hover:bg-brand-800 transition-colors text-xs font-bold"
                  aria-label={`Increase quantity of ${product.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => addItem(selectedVariant.id, 1)}
                disabled={isUpdating}
                className="font-bold text-xs px-3 py-1.5 flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
