'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api, OrderRead } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  CheckCircle2,
  Clock,
  Truck,
  Package,
  XCircle,
  MapPin,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';
import { formatINR } from '@dailykitchen/shared-utils';

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, openAuthModal } = useAuth();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<OrderRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    let isMounted = true;
    async function loadOrder() {
      setIsLoading(true);
      setError(null);
      try {
        const orderData = await api.orders.getOrder(orderId);
        if (isMounted) setOrder(orderData);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Could not find this order.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (orderId) {
      loadOrder();
    }

    return () => {
      isMounted = false;
    };
  }, [orderId, isAuthenticated, openAuthModal]);

  const handleCancelOrder = async () => {
    if (!order) return;
    const confirmed = window.confirm('Are you sure you want to cancel this order?');
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      const updated = await api.orders.cancelOrder(order.id, 'Cancelled by customer from web');
      setOrder(updated);
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel order.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Please log in to view order details</h1>
        <Button variant="primary" onClick={openAuthModal}>
          Log In with Phone
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-brand-700 animate-spin" />
        <p className="text-sm font-semibold text-textMuted">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h1 className="text-xl font-bold">Order Not Found</h1>
        <p className="text-sm text-textMuted">{error || 'Unable to locate order information.'}</p>
        <Link href="/">
          <Button variant="primary">Return Home</Button>
        </Link>
      </div>
    );
  }

  const steps = [
    { key: 'placed', label: 'Order Placed', icon: Package },
    { key: 'confirmed', label: 'Confirmed & Packed', icon: CheckCircle2 },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  ];

  const getStepStatus = (stepKey: string) => {
    if (order.status === 'cancelled') return 'cancelled';
    const statusOrder = ['placed', 'confirmed', 'out_for_delivery', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);
    const stepIndex = statusOrder.indexOf(stepKey);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  const canCancel = order.status === 'placed' || order.status === 'pending';

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-borderSubtle pb-6">
        <div className="space-y-1">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Orders</span>
          </Link>
          <h1 className="text-2xl font-black text-textPrimary tracking-tight">
            Order #{order.order_number}
          </h1>
          <p className="text-xs text-textMuted">
            Placed on {new Date(order.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div>
          <span
            className={`inline-block text-xs font-black uppercase px-3 py-1.5 rounded-full ${
              order.status === 'delivered'
                ? 'bg-emerald-100 text-emerald-800'
                : order.status === 'cancelled'
                ? 'bg-red-100 text-red-800'
                : 'bg-brand-100 text-brand-800'
            }`}
          >
            Status: {order.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Progress Timeline Stepper */}
      {order.status !== 'cancelled' ? (
        <Card padding="md" className="space-y-4 bg-slate-50 border-borderSubtle">
          <h2 className="text-xs font-bold uppercase tracking-wider text-textMuted">Live Delivery Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {steps.map((st) => {
              const Icon = st.icon;
              const status = getStepStatus(st.key);

              return (
                <div key={st.key} className="flex flex-col items-center text-center space-y-2">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      status === 'completed'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : status === 'active'
                        ? 'bg-brand-700 text-white ring-4 ring-brand-200'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs font-bold leading-tight ${
                      status === 'completed' || status === 'active'
                        ? 'text-textPrimary'
                        : 'text-textMuted'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-3">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div className="space-y-1">
            <p className="font-bold text-sm">This order has been cancelled</p>
            <p className="text-xs text-red-700">
              {order.notes || 'Items have been released back to fresh inventory.'}
            </p>
          </div>
        </div>
      )}

      {/* Delivery & Items Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Address Card */}
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-brand-700 font-bold text-sm border-b border-borderSubtle pb-2">
            <MapPin className="w-4 h-4" />
            <span>Delivery Destination</span>
          </div>
          {order.address_snapshot ? (
            <div className="text-xs text-textMuted leading-relaxed space-y-0.5">
              <p className="font-bold text-textPrimary">{order.address_snapshot.full_name}</p>
              <p>{order.address_snapshot.house_flat}, {order.address_snapshot.street_area}</p>
              <p>{order.address_snapshot.city} - {order.address_snapshot.pincode}</p>
              <p className="text-textPrimary font-semibold pt-1">Phone: {order.address_snapshot.phone}</p>
            </div>
          ) : (
            <p className="text-xs text-textMuted">Address recorded with order.</p>
          )}
        </Card>

        {/* Slot Card */}
        <Card padding="md" className="space-y-2">
          <div className="flex items-center gap-2 text-brand-700 font-bold text-sm border-b border-borderSubtle pb-2">
            <Clock className="w-4 h-4" />
            <span>Delivery Slot</span>
          </div>
          <div className="text-xs text-textMuted leading-relaxed space-y-0.5">
            <p className="font-bold text-textPrimary">Standard Delivery Schedule</p>
            <p>Confirmed Slot Ref: {order.slot_id.slice(0, 16)}...</p>
            <p className="font-semibold text-textPrimary pt-1">
              Guaranteed morning harvest dispatch
            </p>
          </div>
        </Card>
      </div>

      {/* Items Breakdown */}
      <Card padding="md" className="space-y-4">
        <h2 className="font-bold text-base text-textPrimary border-b border-borderSubtle pb-2">
          Harvest Items ({order.items?.length || 0})
        </h2>

        <div className="divide-y divide-borderSubtle/60">
          {order.items?.map((item) => (
            <div key={item.id} className="py-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-textPrimary text-sm">{item.product_name_snap}</p>
                <p className="text-textMuted">{item.weight_label_snap} × {item.quantity}</p>
              </div>
              <span className="font-bold text-textPrimary text-sm">
                {formatINR(Number(item.line_total))}
              </span>
            </div>
          ))}
        </div>

        {/* Financial Breakdown */}
        <div className="border-t border-borderSubtle pt-3 space-y-2 text-xs text-textMuted">
          <div className="flex justify-between">
            <span>Produce Subtotal:</span>
            <span className="font-semibold text-textPrimary">{formatINR(Number(order.subtotal))}</span>
          </div>
          <div className="flex justify-between">
            <span>Packaging Fee:</span>
            <span className="font-semibold text-textPrimary">{formatINR(Number(order.packaging_fee))}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery Fee:</span>
            <span className="font-semibold text-textPrimary">
              {Number(order.delivery_fee) === 0 ? (
                <span className="text-emerald-700 font-bold">FREE</span>
              ) : (
                formatINR(Number(order.delivery_fee))
              )}
            </span>
          </div>
          <div className="border-t border-borderSubtle pt-2 flex justify-between text-base font-black text-textPrimary">
            <span>Total Amount:</span>
            <span className="text-brand-900">{formatINR(Number(order.total_amount))}</span>
          </div>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-borderSubtle">
        <Link href="/">
          <Button variant="outline">Continue Shopping</Button>
        </Link>

        {canCancel && (
          <Button
            variant="outline"
            onClick={handleCancelOrder}
            disabled={isCancelling}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel Order'}
          </Button>
        )}
      </div>
    </div>
  );
}
