'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, OrderRead } from '@/lib/api-client';

const STATUS_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'placed', label: 'Placed' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'out_for_delivery', label: 'Out for Delivery' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get('order_id');

  const [orders, setOrders] = useState<OrderRead[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inspector modal state
  const [selectedOrder, setSelectedOrder] = useState<OrderRead | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.orders.list({
        status: activeTab === 'all' ? undefined : activeTab,
        page: 1,
        pageSize: 50,
      });
      setOrders(res.items || []);
      setTotal(res.total || 0);

      // If initial order query param exists, load it
      if (initialOrderId && !selectedOrder) {
        const found = res.items.find((o) => o.id === initialOrderId);
        if (found) {
          setSelectedOrder(found);
        } else {
          try {
            const single = await api.admin.orders.get(initialOrderId);
            setSelectedOrder(single);
          } catch {
            // Ignore if not found
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve orders.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, initialOrderId, selectedOrder]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleUpdateStatus = async (nextStatus: string, reason?: string) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    setActionError(null);

    try {
      const updated = await api.admin.orders.updateStatus(
        selectedOrder.id,
        nextStatus,
        reason || `Status progressed to ${nextStatus} by administrator`
      );
      setSelectedOrder(updated);
      setShowCancelModal(false);
      setCancelReason('');
      await fetchOrders();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update order status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
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

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesNumber = o.order_number?.toLowerCase().includes(q);
    const matchesPhone = o.address_snapshot?.phone?.toLowerCase().includes(q);
    const matchesName = o.address_snapshot?.full_name?.toLowerCase().includes(q);
    return matchesNumber || matchesPhone || matchesName;
  });

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Order Fulfillment &amp; Dispatch Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            State-machine governed order pipeline ({total} registered orders)
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 self-start sm:self-auto min-h-[44px]"
        >
          <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
          <span>Refresh Queue</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-sm"
        >
          {error}
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[40px] ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order # or Phone..."
            className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[40px]"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Order Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Pincode</th>
                <th className="py-3 px-4">Slot</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading orders...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <p className="font-bold text-slate-200 text-sm mb-1">No customer orders recorded yet</p>
                    <p className="text-xs text-slate-500">When customers place orders from the storefront, they will appear here in real-time.</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No orders matching selected criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-emerald-400">
                      {order.order_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">
                        {order.address_snapshot?.full_name || 'Customer'}
                      </div>
                      <div className="text-slate-400 text-xs font-mono">
                        {order.address_snapshot?.phone || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {order.address_snapshot?.pincode || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {order.delivery_fee === '0.00' ? '📅 Scheduled' : '⚡ Express 30m'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-300">
                      {order.payment_method?.replace('_', ' ') || 'UPI'}
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold border border-slate-700 min-h-[36px]"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Inspector Modal / Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-emerald-400">
                      {selectedOrder.order_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(
                        selectedOrder.status
                      )}`}
                    >
                      {selectedOrder.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Placed on {new Date(selectedOrder.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center min-h-[36px]"
                  title="Close inspector"
                >
                  ✕
                </button>
              </div>

              {actionError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs"
                >
                  <strong>State Transition Error: </strong>
                  {actionError}
                </div>
              )}

              {/* Delivery Destination */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Delivery Destination
                </div>
                <div className="text-sm font-semibold text-white">
                  {selectedOrder.address_snapshot?.full_name} ({selectedOrder.address_snapshot?.phone})
                </div>
                <div className="text-xs text-slate-300 leading-relaxed">
                  {selectedOrder.address_snapshot?.house_flat},{' '}
                  {selectedOrder.address_snapshot?.street_area},{' '}
                  {selectedOrder.address_snapshot?.landmark && `Near ${selectedOrder.address_snapshot?.landmark}, `}
                  {selectedOrder.address_snapshot?.city} - {selectedOrder.address_snapshot?.pincode}
                </div>
                {selectedOrder.notes && (
                  <div className="text-xs text-amber-300 pt-1 border-t border-slate-800/80">
                    <strong>Note: </strong> {selectedOrder.notes}
                  </div>
                )}
              </div>

              {/* Produce Items Line Table */}
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Produce Items ({selectedOrder.items?.length || 0})
                </div>
                <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800 bg-slate-950">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">
                          {item.product_name_snap}
                        </div>
                        <div className="text-slate-400">
                          {item.weight_label_snap} • Qty: {item.quantity}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-emerald-400">
                          {formatCurrency(item.line_total)}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          @{formatCurrency(item.unit_price)} each
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Bill Breakdown */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Eco-Packaging Fee</span>
                  <span>{formatCurrency(selectedOrder.packaging_fee)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Delivery Fee</span>
                  <span>{formatCurrency(selectedOrder.delivery_fee)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-slate-800">
                  <span>Total Amount</span>
                  <span className="text-emerald-400 font-extrabold">
                    {formatCurrency(selectedOrder.total_amount)}
                  </span>
                </div>
              </div>

              {/* Fulfillment Actions State Machine */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Order Progression Actions
                </div>

                <div className="flex flex-col gap-2">
                  {selectedOrder.status === 'placed' && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus('confirmed')}
                      className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs min-h-[44px] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🚜 Confirm Harvest &amp; Pack</span>
                    </button>
                  )}

                  {selectedOrder.status === 'confirmed' && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus('out_for_delivery')}
                      className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs min-h-[44px] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🚚 Dispatch for Delivery</span>
                    </button>
                  )}

                  {selectedOrder.status === 'out_for_delivery' && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus('delivered')}
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs min-h-[44px] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>✅ Mark Order Delivered</span>
                    </button>
                  )}

                  {['placed', 'confirmed', 'out_for_delivery'].includes(selectedOrder.status) && (
                    <button
                      disabled={isUpdating}
                      onClick={() => setShowCancelModal(true)}
                      className="w-full py-2.5 px-4 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-xs min-h-[44px] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🚫 Cancel Order &amp; Release Stock</span>
                    </button>
                  )}

                  {selectedOrder.status === 'delivered' && (
                    <div className="p-3 text-center text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900 rounded-lg">
                      Order successfully delivered. Inventory reservations consumed.
                    </div>
                  )}

                  {selectedOrder.status === 'cancelled' && (
                    <div className="p-3 text-center text-xs text-rose-400 bg-rose-950/40 border border-rose-900 rounded-lg">
                      Order cancelled. Reserved inventory was restored to available stock.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold min-h-[44px]"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Cancellation Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">
              Confirm Order Cancellation
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cancelling this order will release all reserved inventory items back into
              available stock. A mandatory operational reason is required for the audit trail.
            </p>

            <div>
              <label
                htmlFor="cancelReason"
                className="block text-xs font-semibold uppercase text-slate-300 mb-1.5"
              >
                Reason for Cancellation
              </label>
              <textarea
                id="cancelReason"
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Customer requested cancellation due to address mistake, produce out of stock..."
                className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={isUpdating || !cancelReason.trim()}
                onClick={() => handleUpdateStatus('cancelled', cancelReason.trim())}
                className="flex-1 py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs min-h-[44px] disabled:opacity-50 transition-colors"
              >
                {isUpdating ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs min-h-[44px] transition-colors"
              >
                Abort
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
