'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api, OrderRead } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ShoppingBag, ArrowRight, Loader2, AlertCircle, Clock } from 'lucide-react';
import { formatINR } from '@dailykitchen/shared-utils';

export default function OrderHistoryPage() {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<OrderRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    let isMounted = true;
    async function loadOrders() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.orders.getOrders();
        if (isMounted) setOrders(res.items || []);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to load your orders.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOrders();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, openAuthModal]);

  if (!isAuthenticated) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Please log in to view your orders</h1>
        <Button variant="primary" onClick={openAuthModal}>
          Log In
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-borderSubtle pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-textPrimary tracking-tight">
            My Order History
          </h1>
          <p className="text-sm text-textMuted">
            Track active deliveries and review your previous farm-fresh orders.
          </p>
        </div>
        {user?.customer_code && (
          <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 px-3.5 py-1.5 rounded-xl self-start sm:self-auto shadow-sm">
            <span className="text-xs font-semibold text-brand-800">Customer ID:</span>
            <span className="font-mono text-xs font-black text-brand-950 tracking-wider">
              {user.customer_code}
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-700 animate-spin" />
          <p className="text-sm font-semibold text-textMuted">Fetching order history...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center space-y-4 bg-white rounded-2xl border border-borderSubtle p-8">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-textPrimary">No orders placed yet</p>
          <p className="text-xs text-textMuted max-w-xs mx-auto">
            Your delivered farm-fresh orders will appear here.
          </p>
          <Link href="/">
            <Button variant="primary" size="md">
              Start Shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              padding="md"
              className="hover:border-slate-300 transition-all space-y-3 bg-white"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-borderSubtle pb-2.5">
                <div>
                  <span className="font-bold text-sm text-textPrimary">
                    Order #{order.order_number}
                  </span>
                  <p className="text-xs text-textMuted">
                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <span
                  className={`inline-block text-[11px] font-black uppercase px-2.5 py-1 rounded-full self-start sm:self-auto ${
                    order.status === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-brand-100 text-brand-800'
                  }`}
                >
                  {order.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-textMuted pt-1">
                <span>
                  {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'} •{' '}
                  <span className="font-bold text-textPrimary">{formatINR(Number(order.total_amount))}</span>
                </span>

                <Link
                  href={`/orders/${order.id}`}
                  className="inline-flex items-center gap-1 font-bold text-brand-700 hover:text-brand-800 text-xs"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
