import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../src/context/CartContext';
import { useAuth } from '../src/context/AuthContext';
import { theme } from '../src/theme';
import { formatINR } from '@dailykitchen/shared-utils';
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react-native';

export default function CartScreen() {
  const router = useRouter();
  const { isAuthenticated, openAuthModal } = useAuth();
  const {
    items,
    itemCount,
    subtotal,
    deliveryFee,
    packagingFee,
    total,
    isFreeDelivery,
    amountNeededForFreeDelivery,
    updateItemQuantity,
    removeItem,
    isUpdating,
    error,
  } = useCart();

  if (!isAuthenticated) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingBag size={48} color={theme.colors.primary[700]} />
        <Text style={styles.emptyTitle}>Log in to view your cart</Text>
        <Text style={styles.emptySub}>
          Sign in to access your saved produce items and proceed to checkout.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={openAuthModal}>
          <Text style={styles.primaryBtnText}>Log In or Register</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <ShoppingBag size={48} color={theme.colors.neutral[400]} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>
          Explore our fresh morning harvest and add farm vegetables or fruits.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/')}>
          <Text style={styles.primaryBtnText}>Browse Fresh Produce</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const deliveryProgress = Math.min(100, Math.round((subtotal / 99) * 100));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Free Delivery Qualification Progress Bar */}
        <View style={styles.freeDeliveryBanner}>
          <View style={styles.bannerTopRow}>
            <Sparkles size={16} color={isFreeDelivery ? '#065F46' : '#92400E'} />
            <Text
              style={[
                styles.bannerText,
                isFreeDelivery ? styles.bannerTextFree : styles.bannerTextPending,
              ]}
            >
              {isFreeDelivery
                ? '🎉 You have unlocked Free Delivery!'
                : `Add ${formatINR(amountNeededForFreeDelivery)} more for Free Delivery!`}
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${deliveryProgress}%` },
                isFreeDelivery && styles.progressBarFillSuccess,
              ]}
            />
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Line Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionHeading}>
            Harvest Basket ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </Text>

          {items.map((it) => {
            const variant = it.variant;
            const unitPrice = variant ? Number(variant.price) : 0;
            const lineTotal = unitPrice * it.quantity;
            const itemName =
              (variant as any)?.product?.name ||
              (variant?.weight_label ? `Farm Fresh Item (${variant.weight_label})` : 'Farm Fresh Item');

            return (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {itemName}
                  </Text>
                  <Text style={styles.itemWeight}>
                    {variant?.weight_label || 'Pack'} • {formatINR(unitPrice)}
                  </Text>
                  <Text style={styles.itemLineTotal}>{formatINR(lineTotal)}</Text>
                </View>

                {/* Stepper Controls */}
                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => updateItemQuantity(it.id, it.quantity - 1)}
                    disabled={isUpdating}
                  >
                    <Minus size={14} color={theme.colors.neutral[800]} />
                  </TouchableOpacity>
                  <Text style={styles.stepCount}>{it.quantity}</Text>
                  <TouchableOpacity
                    style={[styles.stepBtn, styles.stepBtnAdd]}
                    onPress={() => updateItemQuantity(it.id, it.quantity + 1)}
                    disabled={isUpdating || it.quantity >= 20}
                  >
                    <Plus size={14} color={theme.colors.neutral.white} />
                  </TouchableOpacity>
                </View>

                {/* Trash Button */}
                <TouchableOpacity
                  style={styles.trashBtn}
                  onPress={() => removeItem(it.id)}
                  disabled={isUpdating}
                >
                  <Trash2 size={16} color={theme.colors.neutral[400]} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Bill Summary (Authoritative Server Pricing Breakdown) */}
        <View style={styles.billCard}>
          <Text style={styles.billHeading}>Bill Summary</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Merchandise Subtotal:</Text>
            <Text style={styles.billVal}>{formatINR(subtotal)}</Text>
          </View>

          <View style={styles.billRow}>
            <View style={styles.labelWithNote}>
              <Text style={styles.billLabel}>Eco-Packaging Fee:</Text>
              <Text style={styles.noteTag}>Standard</Text>
            </View>
            <Text style={styles.billVal}>{formatINR(packagingFee)}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Charge:</Text>
            {isFreeDelivery ? (
              <Text style={styles.freeDeliveryText}>FREE (₹0)</Text>
            ) : (
              <Text style={styles.billVal}>{formatINR(deliveryFee)}</Text>
            )}
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRowTotal}>
            <View>
              <Text style={styles.totalLabel}>Total Payable Amount</Text>
              <Text style={styles.taxSub}>Inclusive of all taxes</Text>
            </View>
            <Text style={styles.totalVal}>{formatINR(total)}</Text>
          </View>
        </View>

        {/* Trust Badges */}
        <View style={styles.trustBadgeRow}>
          <ShieldCheck size={16} color={theme.colors.primary[700]} />
          <Text style={styles.trustBadgeText}>
            Direct from farm • 100% Guaranteed Weight Accuracy
          </Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Checkout Footer */}
      <View style={styles.checkoutFooter}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>To Pay</Text>
          <Text style={styles.footerPriceVal}>{formatINR(total)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          activeOpacity={0.9}
          onPress={() => router.push('/checkout')}
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
          <ArrowRight size={18} color={theme.colors.neutral.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutral.background,
  },
  scrollContent: {
    padding: theme.spacing[4],
    paddingBottom: 100,
    gap: theme.spacing[4],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
    backgroundColor: theme.colors.neutral.background,
    gap: theme.spacing[3],
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  emptySub: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary[700],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    marginTop: 8,
  },
  primaryBtnText: {
    color: theme.colors.neutral.white,
    fontWeight: '700',
    fontSize: theme.typography.fontSize.sm,
  },
  freeDeliveryBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing[3],
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 6,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bannerTextPending: {
    color: '#92400E',
  },
  bannerTextFree: {
    color: '#065F46',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: theme.borderRadius.full,
  },
  progressBarFillSuccess: {
    backgroundColor: '#10B981',
  },
  errorBanner: {
    backgroundColor: theme.colors.error.light,
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
  },
  errorText: {
    color: theme.colors.error.main,
    fontSize: 11,
    fontWeight: '600',
  },
  itemsSection: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    gap: theme.spacing[3],
  },
  sectionHeading: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[100],
    gap: 8,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  itemWeight: {
    fontSize: 11,
    color: theme.colors.neutral[500],
  },
  itemLineTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary[800],
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.borderRadius.md,
    padding: 3,
    gap: 6,
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: theme.colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnAdd: {
    backgroundColor: theme.colors.primary[700],
  },
  stepCount: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.neutral[900],
    minWidth: 16,
    textAlign: 'center',
  },
  trashBtn: {
    padding: 6,
  },
  billCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    gap: theme.spacing[2.5],
  },
  billHeading: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.neutral[900],
    marginBottom: 4,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelWithNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noteTag: {
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: theme.colors.neutral[100],
    color: theme.colors.neutral[600],
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  billLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[600],
  },
  billVal: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  freeDeliveryText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
    color: '#065F46',
  },
  billDivider: {
    height: 1,
    backgroundColor: theme.colors.neutral[200],
    marginVertical: 4,
  },
  billRowTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  taxSub: {
    fontSize: 10,
    color: theme.colors.neutral[400],
  },
  totalVal: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.primary[800],
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary[800],
  },
  checkoutFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
    paddingBottom: theme.spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  footerPriceCol: {
    gap: 1,
  },
  footerPriceLabel: {
    fontSize: 10,
    color: theme.colors.neutral[500],
    fontWeight: '600',
  },
  footerPriceVal: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  checkoutBtn: {
    backgroundColor: theme.colors.primary[700],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutBtnText: {
    color: theme.colors.neutral.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
  },
});
