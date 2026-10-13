import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ProductRead, ProductVariantRead } from '../../lib/api-client';
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

  return (
    <View style={styles.cardContainer}>
      {/* Produce Image & Badges */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.produceImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imageFallback}>
            <Leaf size={32} color={theme.colors.primary[600]} />
          </View>
        )}

        {product.is_fresh_today && (
          <View style={styles.freshBadge}>
            <Sparkles size={10} color="#065F46" />
            <Text style={styles.freshBadgeText}>Morning Harvest</Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        {/* Variant Picker Chips if multiple variants */}
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
            >
              <Text style={styles.addButtonText}>ADD</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={handleDecrement}
                disabled={isUpdating}
              >
                <Minus size={14} color={theme.colors.primary[800]} />
              </TouchableOpacity>
              <Text style={styles.stepperQuantity}>{currentQty}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={handleIncrement}
                disabled={isUpdating || currentQty >= 20}
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
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: theme.spacing[3],
  },
  imageContainer: {
    height: 125,
    width: '100%',
    backgroundColor: theme.colors.neutral[100],
    position: 'relative',
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
    top: 8,
    left: 8,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#A7F3D0',
  },
  freshBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  detailsContainer: {
    padding: theme.spacing[3],
    gap: theme.spacing[2],
  },
  productName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  singleWeightText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    fontWeight: '500',
  },
  variantChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  variantChip: {
    paddingHorizontal: 6,
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
    marginTop: 4,
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
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
  },
  stepperButton: {
    padding: 4,
  },
  stepperQuantity: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.primary[900],
    minWidth: 14,
    textAlign: 'center',
  },
});
