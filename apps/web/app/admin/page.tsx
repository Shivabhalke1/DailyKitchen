'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, DashboardMetricsRead, OrderRead } from '@/lib/api-client';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetricsRead | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [metricsData, ordersData] = await Promise.all([
        api.admin.dashboard.getMetrics(),
        api.admin.orders.list({ page: 1, pageSize: 6 }),
      ]);
      setMetrics(metricsData);
      setRecentOrders(ordersData.items || []);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message || 'Failed to load live operations data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'placed':
        return 'bg-amber-950/70 text-amber-300 border-amber-800/80';
      case 'confirmed':
        return 'bg-blue-950/70 text-blue-300 border-blue-800/80';
      case 'out_for_delivery':
        return 'bg-purple-950/70 text-purple-300 border-purple-800/80';
      case 'delivered':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80';
      case 'cancelled':
        return 'bg-rose-950/70 text-rose-300 border-rose-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Daily Operations Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time fulfillment metrics, revenue tracking, and inventory status for{' '}
            <span className="text-emerald-400 font-medium">
              {metrics?.date || 'Today'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-slate-500 hidden sm:inline">
              Updated at {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors min-h-[44px]"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
            <span>{isLoading ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-sm flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            onClick={fetchDashboardData}
            className="underline font-semibold text-rose-200 ml-4 hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Orders Today
            </span>
            <span className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm">
              📦
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white">
              {metrics ? metrics.total_orders_today : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active dispatch throughput
            </p>
          </div>
        </div>

        {/* Revenue Today */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Gross Revenue
            </span>
            <span className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 text-sm">
              💰
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-400">
              {metrics ? formatCurrency(metrics.revenue_today) : '—'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Strictly excludes cancelled orders
            </p>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Stock Warnings
            </span>
            <span className="p-2 rounded-lg bg-amber-950 border border-amber-800 text-amber-400 text-sm">
              ⚠️
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-400">
              {metrics ? metrics.low_stock_variants_count : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {metrics?.out_of_stock_variants_count || 0} variants depleted
            </p>
          </div>
        </div>

        {/* Slot Capacity */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Slot Utilization
            </span>
            <span className="p-2 rounded-lg bg-blue-950 border border-blue-800 text-blue-400 text-sm">
              🚚
            </span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white">
              {metrics ? `${metrics.slot_utilization_percent}%` : '—'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Delivery fleet scheduled capacity
            </p>
          </div>
        </div>
      </div>

      {/* Orders by Status Breakdown */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
          Order Pipeline Distribution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { key: 'placed', label: 'Placed', color: 'text-amber-400' },
            { key: 'confirmed', label: 'Confirmed', color: 'text-blue-400' },
            { key: 'out_for_delivery', label: 'Out for Delivery', color: 'text-purple-400' },
            { key: 'delivered', label: 'Delivered', color: 'text-emerald-400' },
            { key: 'cancelled', label: 'Cancelled', color: 'text-rose-400' },
          ].map((st) => (
            <div
              key={st.key}
              className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-center"
            >
              <div className={`text-2xl font-bold ${st.color}`}>
                {metrics?.orders_by_status?.[st.key] || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Orders Queue Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              Recent Customer Orders
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live orders requiring fulfillment inspection and harvest confirmation
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 min-h-[36px]"
          >
            <span>View All Orders</span>
            <span>→</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Delivery Mode</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No orders registered yet today.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-emerald-400">
                      {order.order_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">
                        {order.address_snapshot?.full_name || 'Customer'}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {order.address_snapshot?.phone || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {order.items?.length || 0} produce line(s)
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-400">
                      {order.delivery_fee === '0.00' ? '📅 Scheduled' : '⚡ Express 30m'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                          order.status
                        )}`}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/orders?order_id=${order.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-950 border border-emerald-800 text-emerald-400 hover:bg-emerald-900/60 transition-colors text-xs font-medium min-h-[36px]"
                      >
                        <span>Inspect</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
