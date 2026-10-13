'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  api,
  DeliveryZoneRead,
  DeliverySlotRead,
  ZoneCreate,
  BulkSlotCreate,
} from '@/lib/api-client';

export default function AdminDeliveryPage() {
  const [zones, setZones] = useState<DeliveryZoneRead[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [slots, setSlots] = useState<DeliverySlotRead[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showZoneModal, setShowZoneModal] = useState<boolean>(false);
  const [showBulkSlotModal, setShowBulkSlotModal] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Zone Form
  const [zoneName, setZoneName] = useState('');
  const [zonePincode, setZonePincode] = useState('');
  const [zoneExpress, setZoneExpress] = useState(true);

  // Bulk Slots Form
  const [slotType, setSlotType] = useState('standard');
  const [maxOrdersPerSlot, setMaxOrdersPerSlot] = useState(25);

  const fetchZonesAndSlots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const zList = await api.admin.delivery.listZones();
      setZones(zList || []);

      const activeZoneId = selectedZoneId || (zList.length > 0 ? zList[0].id : '');
      if (activeZoneId && !selectedZoneId) {
        setSelectedZoneId(activeZoneId);
      }

      if (activeZoneId) {
        const sList = await api.admin.delivery.listSlots({
          zoneId: activeZoneId,
          date: selectedDate,
        });
        setSlots(sList || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load delivery operations.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedZoneId, selectedDate]);

  useEffect(() => {
    fetchZonesAndSlots();
  }, [fetchZonesAndSlots]);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: ZoneCreate = {
        name: zoneName.trim(),
        pincode: zonePincode.trim(),
        is_express_available: zoneExpress,
      };
      const created = await api.admin.delivery.createZone(payload);
      setShowZoneModal(false);
      setZoneName('');
      setZonePincode('');
      setSelectedZoneId(created.id);
      await fetchZonesAndSlots();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create delivery zone.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkCreateDefaultSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZoneId) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const normalizedSlotType = (slotType === 'scheduled' || slotType === 'standard') ? 'standard' : 'express';
      // Default daily 2-hour distribution windows
      const defaultSlots = [
        { slot_type: normalizedSlotType, start_time: '06:00:00', end_time: '08:00:00', max_orders: maxOrdersPerSlot },
        { slot_type: normalizedSlotType, start_time: '08:00:00', end_time: '10:00:00', max_orders: maxOrdersPerSlot },
        { slot_type: normalizedSlotType, start_time: '10:00:00', end_time: '12:00:00', max_orders: maxOrdersPerSlot },
        { slot_type: normalizedSlotType, start_time: '14:00:00', end_time: '16:00:00', max_orders: maxOrdersPerSlot },
        { slot_type: normalizedSlotType, start_time: '16:00:00', end_time: '18:00:00', max_orders: maxOrdersPerSlot },
        { slot_type: normalizedSlotType, start_time: '18:00:00', end_time: '20:00:00', max_orders: maxOrdersPerSlot },
      ];

      const payload: BulkSlotCreate = {
        zone_id: selectedZoneId,
        slot_date: selectedDate,
        slots: defaultSlots,
      };

      await api.admin.delivery.bulkCreateSlots(payload);
      setShowBulkSlotModal(false);
      await fetchZonesAndSlots();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to generate bulk delivery slots.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFreeze = async (slot: DeliverySlotRead) => {
    try {
      await api.admin.delivery.updateSlot(slot.id, {
        is_active: !slot.is_active,
      });
      await fetchZonesAndSlots();
    } catch (err: any) {
      setError(err?.message || 'Failed to update slot status.');
    }
  };

  const handleUpdateMaxOrders = async (slot: DeliverySlotRead, delta: number) => {
    const nextMax = slot.max_orders + delta;
    if (nextMax < slot.current_orders) {
      alert(`Cannot reduce capacity below currently booked orders (${slot.current_orders}).`);
      return;
    }
    try {
      await api.admin.delivery.updateSlot(slot.id, {
        max_orders: nextMax,
      });
      await fetchZonesAndSlots();
    } catch (err: any) {
      alert(err?.message || 'Failed to update slot capacity.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Delivery Zones &amp; Slot Capacity Scheduler
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Dispatch territory management, slot capacity utilization, and emergency freeze controls
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setFormError(null);
              setShowZoneModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold min-h-[44px]"
          >
            + Add Zone
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setShowBulkSlotModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold min-h-[44px] transition-colors"
          >
            ⚡ Bulk Schedule Windows
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-sm"
        >
          {error}
        </div>
      )}

      {/* Territory Zones Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {zones.map((z) => (
          <div
            key={z.id}
            onClick={() => setSelectedZoneId(z.id)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              selectedZoneId === z.id
                ? 'bg-slate-900 border-emerald-500 shadow-md shadow-emerald-950/40'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">{z.name}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                PIN: {z.pincode}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  z.is_express_available
                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {z.is_express_available ? '⚡ Express 30m Active' : 'Scheduled Only'}
              </span>
              <span className="text-emerald-400 font-medium">● Serviceable</span>
            </div>
          </div>
        ))}
      </div>

      {/* Target Date and Slot Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label
            htmlFor="slotDate"
            className="text-xs font-bold uppercase tracking-wider text-slate-300"
          >
            Target Date:
          </label>
          <input
            id="slotDate"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono min-h-[38px] focus:border-emerald-500"
          />
        </div>

        <button
          onClick={fetchZonesAndSlots}
          disabled={isLoading}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 min-h-[38px]"
        >
          <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
          <span>Refresh Slots</span>
        </button>
      </div>

      {/* Slots Capacity Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Capacity Schedule for {selectedDate}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {slots.length} Windows Scheduled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[11px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Time Window</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Capacity Utilization</th>
                <th className="py-3 px-4">Booked / Max</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span>Checking slot capacity...</span>
                    </div>
                  </td>
                </tr>
              ) : slots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No delivery slots created for this zone and date. Click &ldquo;Bulk Schedule Windows&rdquo; above.
                  </td>
                </tr>
              ) : (
                slots.map((slot) => {
                  const percent = Math.min(
                    100,
                    Math.round((slot.current_orders / slot.max_orders) * 100)
                  );
                  const isFull = slot.current_orders >= slot.max_orders;

                  return (
                    <tr
                      key={slot.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !slot.is_active ? 'opacity-60 bg-slate-950/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {slot.start_time.slice(0, 5)} — {slot.end_time.slice(0, 5)}
                      </td>
                      <td className="py-3.5 px-4 capitalize text-slate-300">
                        {slot.slot_type}
                      </td>
                      <td className="py-3.5 px-4 w-48">
                        <div className="space-y-1">
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percent >= 90
                                  ? 'bg-rose-500'
                                  : percent >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {percent}% utilized
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium">
                        <span className="text-emerald-400">{slot.current_orders}</span>
                        <span className="text-slate-500"> / {slot.max_orders}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {!slot.is_active ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/70 border border-rose-800 text-rose-300">
                            Frozen
                          </span>
                        ) : isFull ? (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-950/70 border border-amber-800 text-amber-300">
                            Saturated (Full)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/70 border border-emerald-800 text-emerald-300">
                            Open
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleUpdateMaxOrders(slot, 5)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono"
                            title="Increase capacity by 5"
                          >
                            +5
                          </button>
                          <button
                            onClick={() => handleUpdateMaxOrders(slot, -5)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono"
                            title="Decrease capacity by 5"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => handleToggleFreeze(slot)}
                            className={`px-3 py-1 rounded text-xs font-semibold min-h-[32px] transition-colors ${
                              slot.is_active
                                ? 'bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300'
                                : 'bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300'
                            }`}
                          >
                            {slot.is_active ? 'Freeze' : 'Unfreeze'}
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

      {/* Add Zone Modal */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Add Delivery Zone</h2>
            {formError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateZone} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">Zone Name</label>
                <input
                  type="text"
                  required
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="e.g. Indiranagar & Domlur"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">Postal Pincode (6 digits)</label>
                <input
                  type="text"
                  required
                  pattern="^[1-9][0-9]{5}$"
                  value={zonePincode}
                  onChange={(e) => setZonePincode(e.target.value)}
                  placeholder="560038"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px] font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="expressToggle"
                  type="checkbox"
                  checked={zoneExpress}
                  onChange={(e) => setZoneExpress(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="expressToggle" className="text-slate-300 font-medium">
                  Support Express 30-min Delivery
                </label>
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold min-h-[44px]"
                >
                  {isSubmitting ? 'Creating Zone...' : 'Save Zone'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Create Slots Modal */}
      {showBulkSlotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-white">Generate Bulk Schedule Windows</h2>
            <p className="text-xs text-slate-400">
              Instantiates 6 standard 2-hour delivery windows (06:00 to 20:00) for{' '}
              <span className="text-emerald-400 font-semibold">{selectedDate}</span>.
            </p>
            {formError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs">
                {formError}
              </div>
            )}
            <form onSubmit={handleBulkCreateDefaultSlots} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">Slot Type</label>
                <select
                  value={slotType}
                  onChange={(e) => setSlotType(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                >
                  <option value="scheduled">Standard Scheduled</option>
                  <option value="instant_express">Express</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold uppercase text-slate-300 mb-1">Max Orders per Window</label>
                <input
                  type="number"
                  required
                  min={5}
                  max={200}
                  value={maxOrdersPerSlot}
                  onChange={(e) => setMaxOrdersPerSlot(parseInt(e.target.value) || 25)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 min-h-[40px]"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold min-h-[44px]"
                >
                  {isSubmitting ? 'Generating...' : 'Instantiate Schedule'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkSlotModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
