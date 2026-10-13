import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, OrderRead, OrderItemRead } from '../../src/lib/api-client';
import { theme } from '../../src/theme';
import { formatINR } from '@dailykitchen/shared-utils';
import {
  CheckCircle2,
  Clock,
  Truck,
  Package,
  XCircle,
  MapPin,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react-native';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed', desc: 'Order received and verified' },
  { key: 'confirmed', label: 'Confirmed', desc: 'Produce queued for harvest' },
  { key: 'dispatched', label: 'Dispatched', desc: 'Out for morning delivery' },
  { key: 'delivered', label: 'Delivered', desc: 'Delivered fresh to your doorstep' },
];

export default function OrderTrackingScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const orderId = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const [order, setOrder] = useState<OrderRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrder = async () => {
    if (!orderId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.orders.getOrder(orderId);
      setOrder(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load order details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? Items will be released back to fresh inventory.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const updated = await api.orders.cancelOrder(
                orderId,
                'Customer requested cancellation from mobile app'
              );
              setOrder(updated);
            } catch (err: any) {
              Alert.alert('Cancellation Failed', err?.message || 'Could not cancel order.');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary[700]} />
        <Text style={styles.centerText}>Loading order tracking details...</Text>
      </View>
    );
  }

  if (errorMessage || !order) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={32} color={theme.colors.error.main} />
        <Text style={styles.errorHeading}>{errorMessage || 'Order not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate tracking stepper active index
  const isCancelled = order.status === 'cancelled';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const activeIndex = currentStepIndex !== -1 ? currentStepIndex : 0;
  const canCancel = ['placed', 'confirmed'].includes(order.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Order Identity Card */}
      <View style={styles.orderIdentityCard}>
        <View style={styles.orderIdRow}>
          <View>
            <Text style={styles.orderNumberText}>{order.order_number}</Text>
            <Text style={styles.orderDateText}>
              Placed on{' '}
              {new Date(order.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              isCancelled && styles.statusPillCancelled,
              order.status === 'delivered' && styles.statusPillDelivered,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                isCancelled && styles.statusTextCancelled,
                order.status === 'delivered' && styles.statusTextDelivered,
              ]}
            >
              {order.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Visual Tracking Stepper or Cancellation Alert */}
      {isCancelled ? (
        <View style={styles.cancelledAlert}>
          <XCircle size={20} color={theme.colors.error.main} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cancelledTitle}>This order has been cancelled</Text>
            <Text style={styles.cancelledSub}>
              {order.notes || 'Reserved items have been returned to fresh inventory.'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.stepperCard}>
          <Text style={styles.stepperCardHeading}>Live Delivery Progress</Text>
          <View style={styles.stepperContainer}>
            {STATUS_STEPS.map((step, idx) => {
              const isPastOrCurrent = idx <= activeIndex;
              const isCurrent = idx === activeIndex;

              return (
                <View key={step.key} style={styles.stepRow}>
                  {/* Step Indicator & Line */}
                  <View style={styles.stepIndicatorCol}>
                    <View
                      style={[
                        styles.stepDot,
                        isPastOrCurrent && styles.stepDotActive,
                        isCurrent && styles.stepDotCurrent,
                      ]}
                    >
                      {isPastOrCurrent ? (
                        <CheckCircle2 size={14} color={theme.colors.neutral.white} />
                      ) : (
                        <View style={styles.stepDotInnerInactive} />
                      )}
                    </View>
                    {idx < STATUS_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          idx < activeIndex && styles.stepLineActive,
                        ]}
                      />
                    )}
                  </View>

                  {/* Step Text */}
                  <View style={styles.stepTextCol}>
                    <Text
                      style={[
                        styles.stepLabel,
                        isPastOrCurrent && styles.stepLabelActive,
                        isCurrent && styles.stepLabelCurrent,
                      ]}
                    >
                      {step.label}
                    </Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Delivery Destination & Slot Snapshots */}
      <View style={styles.snapshotGrid}>
        {/* Address Card */}
        <View style={styles.snapshotCard}>
          <View style={styles.snapshotCardHeader}>
            <MapPin size={16} color={theme.colors.primary[700]} />
            <Text style={styles.snapshotCardTitle}>Delivery Destination</Text>
          </View>
          {order.address_snapshot ? (
            <View style={styles.snapshotContent}>
              <Text style={styles.addrRecipient}>
                {order.address_snapshot.full_name} ({order.address_snapshot.phone})
              </Text>
              <Text style={styles.addrText}>
                {order.address_snapshot.house_flat}, {order.address_snapshot.street_area}
              </Text>
              <Text style={styles.addrText}>
                {order.address_snapshot.city} - {order.address_snapshot.pincode}
              </Text>
            </View>
          ) : (
            <Text style={styles.snapshotContent}>Address recorded with order.</Text>
          )}
        </View>

        {/* Slot Card */}
        <View style={styles.snapshotCard}>
          <View style={styles.snapshotCardHeader}>
            <Clock size={16} color={theme.colors.primary[700]} />
            <Text style={styles.snapshotCardTitle}>Delivery Schedule</Text>
          </View>
          <View style={styles.snapshotContent}>
            <Text style={styles.addrRecipient}>Morning Harvest Slot</Text>
            <Text style={styles.addrText}>Slot ID: {order.slot_id.slice(0, 16)}...</Text>
            <Text style={styles.slotConfirmedNote}>
              Guaranteed morning harvest dispatch
            </Text>
          </View>
        </View>
      </View>

      {/* Immutable Line Items Snapshot */}
      <View style={styles.itemsCard}>
        <Text style={styles.itemsCardTitle}>
          Harvest Items Snapshot ({order.items?.length || 0})
        </Text>

        {order.items?.map((it: OrderItemRead) => (
          <View key={it.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemNameSnap}>{it.product_name_snap}</Text>
              <Text style={styles.itemWeightSnap}>
                {it.weight_label_snap} × {it.quantity}
              </Text>
            </View>
            <Text style={styles.itemPriceSnap}>
              {formatINR(Number(it.line_total))}
            </Text>
          </View>
        ))}

        {/* Financial Breakdown */}
        <View style={styles.pricingDivider} />
        <View style={styles.priceRow}>
          <Text style={styles.priceRowLabel}>Subtotal:</Text>
          <Text style={styles.priceRowVal}>{formatINR(Number(order.subtotal))}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceRowLabel}>Eco-Packaging Fee:</Text>
          <Text style={styles.priceRowVal}>{formatINR(Number(order.packaging_fee))}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceRowLabel}>Delivery Charge:</Text>
          <Text style={styles.priceRowVal}>
            {Number(order.delivery_fee) === 0 ? 'FREE (₹0)' : formatINR(Number(order.delivery_fee))}
          </Text>
        </View>
        <View style={styles.pricingDivider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Paid / To Pay:</Text>
          <Text style={styles.totalVal}>{formatINR(Number(order.total_amount))}</Text>
        </View>
        <Text style={styles.paymentMethodNote}>
          Payment Method: {order.payment_method.toUpperCase()} ({order.payment_status.toUpperCase()})
        </Text>
      </View>

      {/* Cancellation Action if Permitted */}
      {canCancel && (
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={handleCancelOrder}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <ActivityIndicator color={theme.colors.error.main} />
          ) : (
            <Text style={styles.cancelBtnText}>Cancel Order</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral.background,
    gap: theme.spacing[4],
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  centerText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
  },
  errorHeading: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.error.main,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: theme.colors.primary[700],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
  },
  backBtnText: {
    color: theme.colors.neutral.white,
    fontWeight: '700',
    fontSize: 12,
  },
  orderIdentityCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderNumberText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  orderDateText: {
    fontSize: 11,
    color: theme.colors.neutral[500],
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
  },
  statusPillCancelled: {
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.border,
  },
  statusPillDelivered: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary[800],
  },
  statusTextCancelled: {
    color: theme.colors.error.main,
  },
  statusTextDelivered: {
    color: '#15803D',
  },
  cancelledAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
  },
  cancelledTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.error.main,
  },
  cancelledSub: {
    fontSize: 11,
    color: theme.colors.error.main,
    marginTop: 2,
  },
  stepperCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    gap: theme.spacing[3],
  },
  stepperCardHeading: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  stepperContainer: {
    paddingLeft: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 24,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepDotActive: {
    backgroundColor: theme.colors.primary[700],
  },
  stepDotCurrent: {
    borderWidth: 3,
    borderColor: theme.colors.primary[200],
  },
  stepDotInnerInactive: {
    width: 6,
    height: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.neutral[400],
  },
  stepLine: {
    width: 2,
    height: 36,
    backgroundColor: theme.colors.neutral[200],
    marginVertical: -2,
  },
  stepLineActive: {
    backgroundColor: theme.colors.primary[700],
  },
  stepTextCol: {
    flex: 1,
    paddingBottom: 20,
  },
  stepLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.neutral[500],
  },
  stepLabelActive: {
    color: theme.colors.neutral[900],
    fontWeight: '700',
  },
  stepLabelCurrent: {
    color: theme.colors.primary[800],
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 10,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  snapshotGrid: {
    gap: theme.spacing[3],
  },
  snapshotCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    gap: 8,
  },
  snapshotCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  snapshotCardTitle: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.primary[800],
  },
  snapshotContent: {
    gap: 2,
  },
  addrRecipient: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  addrText: {
    fontSize: 11,
    color: theme.colors.neutral[600],
  },
  slotConfirmedNote: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary[700],
    marginTop: 2,
  },
  itemsCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    gap: 8,
  },
  itemsCardTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.neutral[900],
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemNameSnap: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  itemWeightSnap: {
    fontSize: 10,
    color: theme.colors.neutral[500],
  },
  itemPriceSnap: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  pricingDivider: {
    height: 1,
    backgroundColor: theme.colors.neutral[100],
    marginVertical: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceRowLabel: {
    fontSize: 11,
    color: theme.colors.neutral[600],
  },
  priceRowVal: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  totalVal: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.primary[800],
  },
  paymentMethodNote: {
    fontSize: 10,
    color: theme.colors.neutral[400],
    marginTop: 2,
  },
  cancelBtn: {
    backgroundColor: theme.colors.neutral.white,
    borderWidth: 1.5,
    borderColor: theme.colors.error.border,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: theme.colors.error.main,
    fontSize: 12,
    fontWeight: '800',
  },
});
