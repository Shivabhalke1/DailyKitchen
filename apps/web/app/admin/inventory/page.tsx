'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, CategoryRead, ProductRead, ProductVariantRead } from '@/lib/api-client';

interface InventoryItemView {
  variantId: string;
  productId: string;
  productName: string;
  categoryName: string;
  weightLabel: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  price: string;
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [categories, setCategories] = useState<CategoryRead[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Adjust Stock Modal state
  const [selectedItem, setSelectedItem] = useState<InventoryItemView | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'adjust'>('add');
  const [delta, setDelta] = useState<number>(20);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete Variant Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<InventoryItemView | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchInventoryData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, productsRes] = await Promise.all([
        api.catalog.getCategories(),
        api.catalog.getProducts({ page: 1, page_size: 100 }),
      ]);

      setCategories(cats || []);

      const catMap = new Map<string, string>();
      cats.forEach((c) => catMap.set(c.id, c.name));

      const invList: InventoryItemView[] = [];

      (productsRes.items || []).forEach((p: ProductRead) => {
        if (!p.variants || p.variants.length === 0) {
          invList.push({
            variantId: `unconfigured-${p.id}`,
            productId: p.id,
            productName: p.name,
            categoryName: catMap.get(p.category_id) || 'General',
            weightLabel: 'No variants configured',
            stockQuantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            lowStockThreshold: 10,
            price: '0.00',
          });
        } else {
          p.variants.forEach((v: ProductVariantRead) => {
            const inv = v.inventory;
            const stock = inv?.stock_quantity ?? 0;
            const reserved = inv?.reserved_quantity ?? 0;
            invList.push({
              variantId: v.id,
              productId: p.id,
              productName: p.name,
              categoryName: catMap.get(p.category_id) || 'General',
              weightLabel: v.weight_label,
              stockQuantity: stock,
              reservedQuantity: reserved,
              availableQuantity: Math.max(0, stock - reserved),
              lowStockThreshold: 10,
              price: v.price,
            });
          });
        }
      });

      setItems(invList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load inventory status.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  // Open modal to Add Stock
  const handleOpenAddStock = (item: InventoryItemView) => {
    setSelectedItem(item);
    setAdjustmentMode('add');
    setDelta(25);
    setReason('Fresh morning harvest restock');
    setModalError(null);
  };

  // Open modal for Custom Delta Adjustment
  const handleOpenAdjustment = (item: InventoryItemView) => {
    setSelectedItem(item);
    setAdjustmentMode('adjust');
    setDelta(0);
    setReason('');
    setModalError(null);
  };

  // Zero out stock (Deplete unsold inventory)
  const handleZeroOutStock = async (item: InventoryItemView) => {
    if (item.availableQuantity <= 0) {
      alert('Available stock is already 0.');
      return;
    }

    const confirmed = window.confirm(
      `Zero out unsold stock for ${item.productName} (${item.weightLabel})?\n\nThis will write off ${item.availableQuantity} available units (reserved orders will be preserved).`
    );
    if (!confirmed) return;

    try {
      await api.admin.catalog.zeroInventory(
        item.variantId,
        'Written off by admin as spoiled/depleted'
      );
      setBannerMessage({
        type: 'success',
        text: `Successfully zeroed out inventory for ${item.productName} (${item.weightLabel}).`,
      });
      await fetchInventoryData();
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err?.message || 'Failed to zero out inventory.',
      });
    }
  };

  // Delete or Deactivate Variant / Produce
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      if (itemToDelete.variantId.startsWith('unconfigured-')) {
        const res = await api.admin.catalog.deleteProduct(itemToDelete.productId);
        setItemToDelete(null);
        setBannerMessage({
          type: 'success',
          text: res.message || `Produce item ${itemToDelete.productName} removed from catalog.`,
        });
      } else {
        const res = await api.admin.catalog.deleteVariant(itemToDelete.variantId);
        setItemToDelete(null);
        setBannerMessage({
          type: 'success',
          text: res.message || `Inventory and variant for ${itemToDelete.productName} removed.`,
        });
      }
      await fetchInventoryData();
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: err?.message || 'Failed to delete item.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    // Client-side barrier pre-check
    const projectedStock = selectedItem.stockQuantity + delta;
    if (projectedStock < selectedItem.reservedQuantity) {
      setModalError(
        `Cannot reduce stock to ${projectedStock}. It cannot be less than active reserved quantity (${selectedItem.reservedQuantity}) committed to in-flight orders.`
      );
      return;
    }

    if (!reason.trim()) {
      setModalError('A mandatory operational reason is required for inventory audit logs.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await api.admin.catalog.adjustInventory(selectedItem.variantId, {
        delta,
        reason: reason.trim(),
      });
      setBannerMessage({
        type: 'success',
        text: `Updated stock for ${selectedItem.productName} by ${delta > 0 ? `+${delta}` : delta} units.`,
      });
      setSelectedItem(null);
      await fetchInventoryData();
    } catch (err: any) {
      setModalError(err?.message || 'Failed to record inventory adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'all' && item.categoryName !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.productName.toLowerCase().includes(q) ||
        item.weightLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Inventory Controls &amp; Stock Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time physical stock, restock intake, write-offs, and deletion controls
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/catalog"
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[44px]"
          >
            <span>+ Add Produce / Variant</span>
          </Link>
          <button
            onClick={fetchInventoryData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 min-h-[44px]"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {bannerMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg text-xs sm:text-sm flex items-center justify-between border ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/70 border-rose-800 text-rose-300'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            onClick={() => setBannerMessage(null)}
            className="font-bold ml-4 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-sm"
        >
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-colors ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
            }`}
          >
            All Categories ({items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.name)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[40px] transition-colors ${
                selectedCategory === c.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full md:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search produce name..."
            className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[40px]"
          />
        </div>
      </div>

      {/* Inventory Grid Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Produce</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Weight</th>
                <th className="py-3 px-4">Physical Stock</th>
                <th className="py-3 px-4">Reserved</th>
                <th className="py-3 px-4">Available</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span>Auditing produce inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <p className="font-bold text-slate-200 text-sm mb-1">No produce items or inventory registered yet</p>
                    <p className="text-xs text-slate-500 mb-3">Add fresh categories, produce items, and weight variants from the Admin Catalog.</p>
                    <Link
                      href="/admin/catalog"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      <span>Go to Admin Catalog</span>
                    </Link>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No items found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isDepleted = item.availableQuantity <= 0;
                  const isLow =
                    !isDepleted && item.availableQuantity <= item.lowStockThreshold;

                  return (
                    <tr key={item.variantId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {item.productName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {item.categoryName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {item.weightLabel}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-200">
                        {item.stockQuantity}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-amber-400">
                        {item.reservedQuantity}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {item.availableQuantity}
                      </td>
                      <td className="py-3.5 px-4">
                        {isDepleted ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-950/70 border border-rose-800/80 text-rose-300">
                            Depleted
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950/70 border border-amber-800/80 text-amber-300">
                            Low Stock (≤{item.lowStockThreshold})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 border border-emerald-800/80 text-emerald-300">
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Add Stock Button */}
                          <button
                            onClick={() => handleOpenAddStock(item)}
                            className="px-2.5 py-1 rounded-md bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-semibold text-xs min-h-[32px] transition-colors"
                            title="Add stock units directly"
                          >
                            + Add Stock
                          </button>

                          {/* 2. Adjust Delta Button */}
                          <button
                            onClick={() => handleOpenAdjustment(item)}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 min-h-[32px] transition-colors"
                            title="Custom delta adjustment"
                          >
                            Adjust
                          </button>

                          {/* 3. Zero Out Stock */}
                          <button
                            onClick={() => handleZeroOutStock(item)}
                            disabled={item.availableQuantity <= 0}
                            className="px-2.5 py-1 rounded-md bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800 text-amber-300 font-semibold text-xs min-h-[32px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Zero out available stock"
                          >
                            Zero Out
                          </button>

                          {/* 4. Delete / Remove Variant */}
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="px-2.5 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-xs min-h-[32px] transition-colors"
                            title="Delete or remove this inventory item"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Adjust Stock Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">
                {adjustmentMode === 'add'
                  ? `Add Stock: ${selectedItem.productName} (${selectedItem.weightLabel})`
                  : `Adjust Stock: ${selectedItem.productName} (${selectedItem.weightLabel})`}
              </h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs leading-relaxed"
              >
                <strong>Validation Constraint: </strong>
                {modalError}
              </div>
            )}

            {/* Current Metrics Box */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 text-center text-xs">
              <div>
                <span className="text-slate-400 block">Current Stock</span>
                <span className="text-white font-mono font-bold text-base">
                  {selectedItem.stockQuantity}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Reserved</span>
                <span className="text-amber-400 font-mono font-bold text-base">
                  {selectedItem.reservedQuantity}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">New Projected</span>
                <span className="text-emerald-400 font-mono font-bold text-base">
                  {selectedItem.stockQuantity + delta}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="space-y-4">
              <div>
                <label
                  htmlFor="deltaInput"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  {adjustmentMode === 'add'
                    ? 'Units to Add (Restock Quantity)'
                    : 'Delta Units (+ to Restock, - to Spoil/Write-off)'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="deltaInput"
                    type="number"
                    required
                    value={delta}
                    onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm font-mono min-h-[44px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDelta((d) => d + 10)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-emerald-400 min-h-[36px]"
                    >
                      +10
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelta((d) => d + 50)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-emerald-400 min-h-[36px]"
                    >
                      +50
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelta((d) => d + 100)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-emerald-400 min-h-[36px]"
                    >
                      +100
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reasonInput"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Audit Reason (Mandatory)
                </label>
                <input
                  id="reasonInput"
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Morning farm harvest restock intake"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs min-h-[44px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting || delta === 0}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs min-h-[44px] transition-colors disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : adjustmentMode === 'add'
                    ? `Confirm Add +${delta} Units`
                    : 'Apply Adjustment'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs min-h-[44px] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Remove Variant or Produce Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">
              {itemToDelete.variantId.startsWith('unconfigured-')
                ? `Delete Produce Item: ${itemToDelete.productName}`
                : `Delete Inventory: ${itemToDelete.productName} (${itemToDelete.weightLabel})`}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {itemToDelete.variantId.startsWith('unconfigured-')
                ? 'This produce item has no configured variants. Deleting it will permanently remove the produce item from the catalog.'
                : 'Are you sure you want to delete this produce variant and its inventory record?'}
            </p>
            {!itemToDelete.variantId.startsWith('unconfigured-') && (
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1">
                <div><strong>Current Stock:</strong> {itemToDelete.stockQuantity}</div>
                <div><strong>Reserved Orders:</strong> {itemToDelete.reservedQuantity}</div>
                {itemToDelete.reservedQuantity > 0 && (
                  <div className="text-rose-400 font-semibold pt-1">
                    ⚠️ Note: Cannot be deleted while there are active reservations ({itemToDelete.reservedQuantity}).
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={isDeleting || (!itemToDelete.variantId.startsWith('unconfigured-') && itemToDelete.reservedQuantity > 0)}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs min-h-[44px] transition-colors disabled:opacity-50"
              >
                {isDeleting
                  ? 'Deleting...'
                  : itemToDelete.variantId.startsWith('unconfigured-')
                  ? 'Yes, Delete Produce'
                  : 'Yes, Delete / Remove'}
              </button>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
