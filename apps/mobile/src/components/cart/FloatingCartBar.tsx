import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { theme } from '../../theme';
import { formatINR } from '@dailykitchen/shared-utils';
import { ShoppingBag, ArrowRight } from 'lucide-react-native';

export function FloatingCartBar() {
  const router = useRouter();
  const { itemCount, total } = useCart();

  if (itemCount === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.bar}
        activeOpacity={0.9}
        onPress={() => router.push('/cart')}
      >
        <View style={styles.leftGroup}>
          <View style={styles.iconCircle}>
            <ShoppingBag size={18} color={theme.colors.neutral.white} />
          </View>
          <View>
            <Text style={styles.itemCountText}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.totalText}>{formatINR(total)}</Text>
          </View>
        </View>

        <View style={styles.rightGroup}>
          <Text style={styles.ctaText}>View Cart</Text>
          <ArrowRight size={18} color={theme.colors.neutral.white} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  bar: {
    backgroundColor: theme.colors.primary[800],
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCountText: {
    fontSize: theme.typography.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  totalText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.neutral.white,
    fontWeight: '800',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1.5],
  },
  ctaText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral.white,
    fontWeight: '700',
  },
});
