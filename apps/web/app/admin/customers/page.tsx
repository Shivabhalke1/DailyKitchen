'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api, AdminCustomerListItem, AdminCustomerDetail, OrderRead } from '@/lib/api-client';
import { formatINR } from '@dailykitchen/shared-utils';
import {
  Search,
  Users,
  ShoppingBag,
  MapPin,
  Calendar,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected customer for detailed modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Deletion modal state
  const [customerToDelete, setCustomerToDelete] = useState<AdminCustomerListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const loadCustomers = useCallback(async (query: string, pageNum: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.customers.list({
        q: query.trim() || undefined,
        page: pageNum,
        limit: 20,
      });
      setCustomers(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer directory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers(searchQuery, page);
  }, [loadCustomers, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCustomers(searchQuery, 1);
  };

  const handleViewCustomer = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await api.admin.customers.get(customerId);
      setCustomerDetail(detail);
    } catch (err: any) {
      setDetailError(err?.message || 'Failed to fetch customer details.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedCustomerId(null);
    setCustomerDetail(null);
    setDetailError(null);
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      const res = await api.admin.customers.delete(customerToDelete.id, {
        hard_delete: forceDelete,
      });
      setDeleteSuccessMessage(res.message);
      setCustomerToDelete(null);
      if (selectedCustomerId === customerToDelete.id) {
        setSelectedCustomerId(null);
        setCustomerDetail(null);
      }
      loadCustomers(searchQuery, page);
      setTimeout(() => setDeleteSuccessMessage(null), 6000);
    } catch (err: any) {
      setDeleteErrorMessage(err?.message || 'Failed to delete customer.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Customers Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Lookup permanent customer accounts, lifetime spending, and immutable order history.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 max-w-md w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, phone, name..."
              className="w-full bg-slate-900 border border-slate-750 text-slate-100 text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-500"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20"
          >
            Search
          </button>
        </form>
      </div>

      {deleteSuccessMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{deleteSuccessMessage}</span>
          </div>
          <button onClick={() => setDeleteSuccessMessage(null)} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {deleteErrorMessage && (
        <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{deleteErrorMessage}</span>
          </div>
          <button onClick={() => setDeleteErrorMessage(null)} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              <tr>
                <th className="py-3.5 px-4">Customer ID</th>
                <th className="py-3.5 px-4">Name &amp; Phone</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4 text-center">Orders</th>
                <th className="py-3.5 px-4 text-right">Lifetime Spend</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    <span>Loading customers directory...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-slate-300">
                      {searchQuery ? `No customers found matching "${searchQuery}"` : 'No registered customers yet'}
                    </p>
                    <p className="text-[11px] mt-0.5 text-slate-500">
                      {searchQuery ? 'Try refining your search filter.' : 'When customers register from the storefront, their profiles and Customer IDs will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-850/50 transition-colors">
                    {/* Customer ID */}
                    <td className="py-3.5 px-4">
                      {c.customer_code ? (
                        <span className="font-mono font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded text-[11px]">
                          {c.customer_code}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">None</span>
                      )}
                    </td>

                    {/* Name & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100">{c.full_name || 'Guest Customer'}</div>
                      <div className="font-mono text-slate-400 text-[11px]">{c.phone}</div>
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 text-slate-400">{c.email || '—'}</td>

                    {/* Orders */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block bg-slate-800 text-slate-200 font-bold px-2 py-0.5 rounded-full text-[11px]">
                        {c.total_orders}
                      </span>
                    </td>

                    {/* Spend */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                      {formatINR(Number(c.total_spend))}
                    </td>

                    {/* Joined */}
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewCustomer(c.id)}
                          className="inline-flex items-center gap-1 bg-slate-800 hover:bg-emerald-600 hover:text-slate-950 text-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                        >
                          <span>History</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setCustomerToDelete(c);
                            setForceDelete(false);
                            setDeleteErrorMessage(null);
                          }}
                          title="Delete or deactivate customer"
                          className="inline-flex items-center gap-1 bg-red-950/40 hover:bg-red-600 hover:text-white text-red-400 border border-red-900/60 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-bold text-slate-200">{customers.length}</span> of{' '}
            <span className="font-bold text-slate-200">{total}</span> customers
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg font-semibold transition-all"
            >
              Previous
            </button>
            <span className="font-bold text-slate-200 px-1">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={customers.length < 20 || isLoading}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg font-semibold transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* --- Customer Detail Modal --- */}
      {selectedCustomerId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>{customerDetail?.full_name || 'Customer Account'}</span>
                    {customerDetail?.customer_code && (
                      <span className="font-mono text-xs font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                        {customerDetail.customer_code}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {customerDetail?.phone} {customerDetail?.email ? `• ${customerDetail.email}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 text-xs">
              {isLoadingDetail ? (
                <div className="py-20 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                  <span>Loading deep order snapshots...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{detailError}</span>
                </div>
              ) : customerDetail ? (
                <>
                  {/* Lifetime Stat Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-400 font-medium">Valid Orders</span>
                      <p className="text-lg font-black text-slate-100 mt-1">
                        {customerDetail.total_orders}{' '}
                        <span className="text-[10px] text-slate-500 font-normal">(excl. cancelled)</span>
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-400 font-medium">Delivered Spend</span>
                      <p className="text-lg font-black text-emerald-400 font-mono mt-1">
                        {formatINR(Number(customerDetail.total_spend))}
                      </p>
                    </div>
                  </div>

                  {/* Saved Addresses */}
                  {customerDetail.addresses && customerDetail.addresses.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Saved Delivery Addresses ({customerDetail.addresses.length})</span>
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {customerDetail.addresses.map((addr) => (
                          <div
                            key={addr.id}
                            className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between font-bold text-slate-200">
                              <span>{addr.label.toUpperCase()}</span>
                              {addr.is_default && (
                                <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded font-bold">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400">
                              {addr.house_flat}, {addr.street_area}
                            </p>
                            <p className="text-slate-400 font-mono">
                              {addr.city}, {addr.pincode}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Immutable Historical Orders */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Order History &amp; Snapshots ({customerDetail.orders?.length ?? 0})</span>
                    </h4>

                    {(customerDetail.orders?.length ?? 0) === 0 ? (
                      <p className="text-slate-500 italic py-4 text-center">No orders placed by this customer.</p>
                    ) : (
                      <div className="space-y-3">
                        {(customerDetail.orders || []).map((order) => (
                          <div
                            key={order.id}
                            className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5"
                          >
                            {/* Order Header */}
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-mono font-bold text-slate-200 text-xs">
                                  #{order.order_number}
                                </span>
                                <span className="text-[11px] text-slate-400 ml-2">
                                  {new Date(order.created_at).toLocaleString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    order.status === 'delivered'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : order.status === 'cancelled'
                                      ? 'bg-red-950 text-red-400 border border-red-800'
                                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                                  }`}
                                >
                                  {order.status}
                                </span>
                                <span className="font-mono font-bold text-slate-100 text-xs">
                                  {formatINR(Number(order.total_amount))}
                                </span>
                              </div>
                            </div>

                            {/* Immutable Item Snapshots */}
                            <div className="border-t border-slate-800/80 pt-2 space-y-1">
                              {order.items.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between text-[11px] text-slate-300"
                                >
                                  <span>
                                    {it.quantity}x {it.product_name_snap}
                                  </span>
                                  <span className="font-mono font-semibold text-slate-400">
                                    {formatINR(Number(it.line_total))}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Address Snapshot */}
                            {order.address_snapshot && (
                              <div className="text-[10px] text-slate-500 border-t border-slate-850 pt-1.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span className="truncate">
                                  Delivered to: {order.address_snapshot.house_flat},{' '}
                                  {order.address_snapshot.street_area}, PIN {order.address_snapshot.pincode}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
              {customerDetail && (
                <button
                  onClick={() => {
                    setCustomerToDelete({
                      id: customerDetail.id,
                      customer_code: customerDetail.customer_code,
                      phone: customerDetail.phone,
                      email: customerDetail.email,
                      full_name: customerDetail.full_name,
                      is_active: customerDetail.is_active,
                      total_orders: customerDetail.total_orders,
                      total_spend: customerDetail.total_spend,
                      created_at: customerDetail.created_at,
                    });
                    setForceDelete(false);
                    setDeleteErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 px-3 py-2 rounded-xl border border-red-900/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Customer</span>
                </button>
              )}
              <button
                onClick={handleCloseDetail}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Delete Customer Confirmation Modal --- */}
      {customerToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-slate-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5 text-red-400">
                <div className="w-9 h-9 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Delete Customer Account</h3>
                  <p className="text-[11px] text-slate-400">Confirmation required</p>
                </div>
              </div>
              <button
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Are you sure you want to delete customer{' '}
                <strong className="text-slate-100">
                  {customerToDelete.full_name || customerToDelete.phone}
                </strong>{' '}
                ({customerToDelete.customer_code || customerToDelete.phone})?
              </p>

              {customerToDelete.total_orders > 0 && (
                <div className="p-3 bg-amber-950/30 border border-amber-800/80 rounded-xl text-amber-200 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Customer has {customerToDelete.total_orders} historical order(s)</span>
                  </p>
                  <p className="text-[11px] text-amber-300/80 leading-normal">
                    By default, deleting this customer will safely deactivate their account and revoke active sessions while preserving immutable financial audit records.
                  </p>
                </div>
              )}

              {deleteErrorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{deleteErrorMessage}</span>
                </div>
              )}

              <label className="flex items-start gap-2.5 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={forceDelete}
                  onChange={(e) => setForceDelete(e.target.checked)}
                  disabled={isDeleting}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900"
                />
                <span className="text-[11px] text-slate-300">
                  <strong className="text-slate-200 block mb-0.5">Force permanent purge</strong>
                  Permanently wipe all customer orders, item records, addresses, and account credentials from database.
                </span>
              </label>
            </div>

            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/30 transition-all"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
