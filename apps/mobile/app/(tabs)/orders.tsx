import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api, OrderRead } from '../../src/lib/api-client';
import { theme } from '../../src/theme';
import { formatINR } from '@dailykitchen/shared-utils';
import { ShoppingBag, ChevronRight, Clock, AlertCircle } from 'lucide-react-native';

export default function MobileOrdersScreen() {
  const router = useRouter();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [orders, setOrders] = useState<OrderRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setErrorMessage(null);
    try {
      const res = await api.orders.getOrders({ page_size: 50 });
      setOrders(res.items || []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch your orders.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [isAuthenticated]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadOrders();
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.authPromptContainer}>
        <View style={styles.authIconCircle}>
          <ShoppingBag size={32} color={theme.colors.primary[700]} />
        </View>
        <Text style={styles.authPromptTitle}>Log in to view your orders</Text>
        <Text style={styles.authPromptSubtitle}>
          Track your fresh produce deliveries, view past invoices, and manage orders.
        </Text>
        <TouchableOpacity style={styles.loginBtn} onPress={openAuthModal}>
          <Text style={styles.loginBtnText}>Log In with Mobile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Order History</Text>
        <Text style={styles.orderCountBadge}>{orders.length} orders</Text>
      </View>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary[700]} />
        </View>
      ) : errorMessage ? (
        <View style={styles.errorBox}>
          <AlertCircle size={20} color={theme.colors.error.main} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySub}>
            Your fresh farm orders will appear here once placed.
          </Text>
        </View>
      ) : (
        orders.map((order) => {
          const isCancelled = order.status === 'cancelled';
          const isDelivered = order.status === 'delivered';

          return (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/orders/${order.id}`)}
            >
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    isCancelled && styles.statusBadgeCancelled,
                    isDelivered && styles.statusBadgeDelivered,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isCancelled && styles.statusTextCancelled,
                      isDelivered && styles.statusTextDelivered,
                    ]}
                  >
                    {order.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.itemCountText}>
                    {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
                  </Text>
                  <Text style={styles.orderTotalText}>
                    {formatINR(Number(order.total_amount))}
                  </Text>
                </View>

                <View style={styles.trackActionWrap}>
                  <Text style={styles.trackActionText}>Track Order</Text>
                  <ChevronRight size={16} color={theme.colors.primary[700]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.neutral.background,
    minHeight: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  orderCountBadge: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    fontWeight: '600',
  },
  authPromptContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
    backgroundColor: theme.colors.neutral.background,
    gap: theme.spacing[3],
  },
  authIconCircle: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  authPromptTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.neutral[900],
    textAlign: 'center',
  },
  authPromptSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  loginBtn: {
    backgroundColor: theme.colors.primary[700],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    marginTop: 8,
  },
  loginBtnText: {
    color: theme.colors.neutral.white,
    fontWeight: '700',
    fontSize: theme.typography.fontSize.sm,
  },
  loaderWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error.light,
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.lg,
    gap: 8,
  },
  errorText: {
    color: theme.colors.error.main,
    fontSize: theme.typography.fontSize.xs,
    flex: 1,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '700',
    color: theme.colors.neutral[800],
  },
  emptySub: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
  },
  orderCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    marginBottom: theme.spacing[3],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderNumber: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  orderDate: {
    fontSize: 11,
    color: theme.colors.neutral[500],
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
  },
  statusBadgeCancelled: {
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.border,
  },
  statusBadgeDelivered: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusBadgeText: {
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
  divider: {
    height: 1,
    backgroundColor: theme.colors.neutral[100],
    marginVertical: theme.spacing[3],
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemCountText: {
    fontSize: 11,
    color: theme.colors.neutral[500],
    fontWeight: '500',
  },
  orderTotalText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  trackActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackActionText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.primary[700],
  },
});
