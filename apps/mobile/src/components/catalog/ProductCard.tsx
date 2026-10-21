import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ProductRead, ProductVariantRead, resolveMediaUrl } from '../../lib/api-client';
import { useCart } from '../../context/CartContext';
import { theme } from '../../theme';
import { formatINR } from '@dailykitchen/shared-utils';
import { Plus, Minus, Leaf, Sparkles } from 'lucide-react-native';

interface ProductCardProps {
  product: ProductRead;
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, updateItemQuantity, removeItem, isUpdating } = useCart();

  const variants = product.variants || [];
  const defaultVariant = variants[0] || null;
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantRead | null>(defaultVariant);

  if (!selectedVariant) return null;

  // Find line item in cart matching selected variant
  const cartItem = items.find((it) => it.variant_id === selectedVariant.id);
  const currentQty = cartItem ? cartItem.quantity : 0;

  const isAvailable = selectedVariant.is_available && (selectedVariant.inventory?.is_in_stock ?? true);
  const priceNum = Number(selectedVariant.price);
  const mrpNum = Number(selectedVariant.mrp);
  const hasDiscount = mrpNum > priceNum;

  const handleAdd = () => {
    if (!isAvailable || isUpdating) return;
    addItem(selectedVariant.id, 1);
  };

  const handleIncrement = () => {
    if (!cartItem || isUpdating || currentQty >= 20) return;
    updateItemQuantity(cartItem.id, currentQty + 1);
  };

  const handleDecrement = () => {
    if (!cartItem || isUpdating) return;
    if (currentQty <= 1) {
      removeItem(cartItem.id);
    } else {
      updateItemQuantity(cartItem.id, currentQty - 1);
    }
  };

  const imageUrl = resolveMediaUrl(product.image_url);

  return (
    <View style={styles.cardContainer}>
      {/* Left: Square Produce Image */}
      <View style={styles.imageWrapper}>
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.produceImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imageFallback}>
              <Leaf size={28} color={theme.colors.primary[600]} />
            </View>
          )}

          {product.is_fresh_today && (
            <View style={styles.freshBadge}>
              <Sparkles size={8} color="#065F46" />
              <Text style={styles.freshBadgeText}>Fresh</Text>
            </View>
          )}
        </View>
      </View>

      {/* Right: Details, Variants & Actions */}
      <View style={styles.detailsContainer}>
        {/* Top: Name & Category */}
        <View style={styles.headerRow}>
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
        </View>

        {/* Variants / Weight Chips */}
        {variants.length > 1 ? (
          <View style={styles.variantChipsRow}>
            {variants.map((v) => {
              const isSelected = selectedVariant.id === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.variantChip, isSelected && styles.variantChipSelected]}
                  onPress={() => setSelectedVariant(v)}
                >
                  <Text
                    style={[
                      styles.variantChipText,
                      isSelected && styles.variantChipTextSelected,
                    ]}
                  >
                    {v.weight_label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={styles.singleWeightText}>{selectedVariant.weight_label}</Text>
        )}

        {/* Price & Action Row */}
        <View style={styles.priceAndActionRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.priceText}>{formatINR(priceNum)}</Text>
            {hasDiscount && (
              <Text style={styles.mrpText}>{formatINR(mrpNum)}</Text>
            )}
          </View>

          {/* Add or Stepper Button */}
          {!isAvailable ? (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          ) : currentQty === 0 ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAdd}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              <Text style={styles.addButtonText}>ADD</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={handleDecrement}
                disabled={isUpdating}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Minus size={14} color={theme.colors.primary[800]} />
              </TouchableOpacity>
              <Text style={styles.stepperQuantity}>{currentQty}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={handleIncrement}
                disabled={isUpdating || currentQty >= 20}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Plus size={14} color={theme.colors.primary[800]} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    padding: 12,
    marginBottom: theme.spacing[3],
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  imageWrapper: {
    position: 'relative',
  },
  imageContainer: {
    width: 96,
    height: 96,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 4,
  },
  produceImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freshBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 0.5,
    borderColor: '#86EFAC',
  },
  freshBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 14,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  headerRow: {
    marginBottom: 4,
  },
  productName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.neutral[900],
    lineHeight: 18,
  },
  singleWeightText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    fontWeight: '500',
    marginBottom: 6,
  },
  variantChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  variantChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
    backgroundColor: theme.colors.neutral[50],
  },
  variantChipSelected: {
    borderColor: theme.colors.primary[700],
    backgroundColor: theme.colors.primary[50],
  },
  variantChipText: {
    fontSize: 10,
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  variantChipTextSelected: {
    color: theme.colors.primary[800],
    fontWeight: '700',
  },
  priceAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  mrpText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  addButton: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[600],
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  addButtonText: {
    color: theme.colors.primary[800],
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
  },
  outOfStockBadge: {
    backgroundColor: theme.colors.neutral[200],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  outOfStockText: {
    color: theme.colors.neutral[600],
    fontSize: 10,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[600],
    borderWidth: 1.5,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 8,
  },
  stepperButton: {
    padding: 2,
  },
  stepperQuantity: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.primary[900],
    minWidth: 16,
    textAlign: 'center',
  },
});
