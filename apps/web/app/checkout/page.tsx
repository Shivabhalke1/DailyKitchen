'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import { useCart } from '@/context/CartContext';
import {
  api,
  AddressRead,
  DeliverySlotRead,
  OrderRead,
  AddressCreate,
} from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  MapPin,
  Clock,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { formatINR } from '@dailykitchen/shared-utils';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { pincode, zone } = useLocation();
  const { items, subtotal, packagingFee, deliveryFee, total, isFreeDelivery, refreshCart } = useCart();

  const [addresses, setAddresses] = useState<AddressRead[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const [slots, setSlots] = useState<DeliverySlotRead[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cod'>('cod');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Address form state
  const [newAddr, setNewAddr] = useState<AddressCreate>({
    full_name: '',
    phone: '',
    house_flat: '',
    street_area: '',
    pincode: pincode || '560034',
    city: 'Bengaluru',
    state: 'Karnataka',
    label: 'home',
    is_default: true,
  });

  // Prompt login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal();
    }
  }, [isAuthenticated, openAuthModal]);

  // Load addresses and slots
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    async function loadCheckoutData() {
      setIsLoadingData(true);
      try {
        const [addrs, slotsData] = await Promise.all([
          api.users.getAddresses(),
          api.delivery.getSlots({ zoneId: zone?.id }),
        ]);

        if (isMounted) {
          setAddresses(addrs || []);
          if (addrs && addrs.length > 0) {
            const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
            setSelectedAddressId(defaultAddr.id);
          } else {
            setIsAddingAddress(true);
          }

          setSlots(slotsData || []);
          if (slotsData && slotsData.length > 0) {
            setSelectedSlotId(slotsData[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.message || 'Failed to load checkout options.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    }

    loadCheckoutData();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, zone]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddr.house_flat || !newAddr.street_area || !newAddr.pincode) {
      setErrorMessage('Please fill in required address fields.');
      return;
    }

    try {
      const created = await api.users.createAddress({
        ...newAddr,
        phone: newAddr.phone || user?.phone || '',
        full_name: newAddr.full_name || 'Home Delivery',
      });
      setAddresses((prev) => [...prev, created]);
      setSelectedAddressId(created.id);
      setIsAddingAddress(false);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save address.');
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setErrorMessage('Please select or add a delivery address.');
      return;
    }
    if (!selectedSlotId) {
      setErrorMessage('Please select an available delivery slot.');
      return;
    }

    setIsPlacingOrder(true);
    setErrorMessage(null);

    try {
      // Step 1: Place order with atomic checkout pipeline
      const order = await api.orders.placeOrder({
        address_id: selectedAddressId,
        slot_id: selectedSlotId,
        payment_method: paymentMethod,
      });

      // Step 2: If online payment, generate payment intent
      if (paymentMethod === 'upi') {
        const idempotencyKey = `pay_${order.id}_${Date.now()}`;
        await api.payments.createIntent({
          order_id: order.id,
          provider: 'razorpay',
          idempotency_key: idempotencyKey,
        });
      }

      // Step 3: Refresh cart to sync empty state and navigate
      await refreshCart();
      router.push(`/orders/${order.id}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to place order. Please check item availability.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Please log in to continue</h1>
        <p className="text-sm text-textMuted">You need to be logged in to view checkout and place an order.</p>
        <Button variant="primary" onClick={openAuthModal}>
          Log In with Phone
        </Button>
      </div>
    );
  }

  if (items.length === 0 && !isPlacingOrder) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold">Your cart is empty</h1>
        <p className="text-sm text-textMuted">Add fresh vegetables or fruits before proceeding to checkout.</p>
        <Button variant="primary" onClick={() => router.push('/')}>
          Browse Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-textPrimary tracking-tight">
          Checkout &amp; Delivery
        </h1>
        <p className="text-sm text-textMuted">
          Review your delivery details, slot, and payment method.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoadingData ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-700 animate-spin" />
          <p className="text-sm font-semibold text-textMuted">Loading addresses and slots...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left 2 Columns: Address, Slot, Payment */}
          <div className="md:col-span-2 space-y-6">
            {/* 1. Delivery Address Card */}
            <Card padding="md" className="space-y-4">
              <div className="flex items-center justify-between border-b border-borderSubtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h2 className="font-bold text-base text-textPrimary">Delivery Address</h2>
                </div>

                {!isAddingAddress && (
                  <button
                    type="button"
                    onClick={() => setIsAddingAddress(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New</span>
                  </button>
                )}
              </div>

              {isAddingAddress ? (
                <form onSubmit={handleSaveAddress} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      placeholder="House / Flat / Block No."
                      value={newAddr.house_flat}
                      onChange={(e) => setNewAddr({ ...newAddr, house_flat: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="Apartment / Street / Road"
                      value={newAddr.street_area}
                      onChange={(e) => setNewAddr({ ...newAddr, street_area: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <Input
                      placeholder="PIN Code"
                      value={newAddr.pincode}
                      onChange={(e) => setNewAddr({ ...newAddr, pincode: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="City"
                      value={newAddr.city}
                      onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
                    />
                    <Input
                      placeholder="State"
                      value={newAddr.state}
                      onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="submit" variant="primary" size="sm">
                      Save Address
                    </Button>
                    {addresses.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddingAddress(false)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="space-y-2.5">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600'
                            : 'border-borderSubtle bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-textPrimary capitalize">
                              {addr.label || 'Home'}
                            </span>
                            {addr.is_default && (
                              <span className="text-[10px] uppercase font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-textMuted leading-relaxed">
                            {addr.house_flat}, {addr.street_area}, {addr.city} - {addr.pincode}
                          </p>
                        </div>
                        <div className="pt-0.5">
                          <input
                            type="radio"
                            name="delivery_address"
                            checked={isSelected}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 2. Delivery Slot Picker Card */}
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-2 border-b border-borderSubtle pb-3">
                <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h2 className="font-bold text-base text-textPrimary">Select Delivery Slot</h2>
              </div>

              {slots.length === 0 ? (
                <p className="text-xs text-textMuted">No delivery slots available for this zone today.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {slots.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    const remainingCapacity = slot.max_orders - slot.current_orders;
                    const isFull = remainingCapacity <= 0;

                    return (
                      <div
                        key={slot.id}
                        onClick={() => !isFull && setSelectedSlotId(slot.id)}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                          isFull
                            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                            : isSelected
                            ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600 cursor-pointer'
                            : 'border-borderSubtle bg-white hover:border-slate-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs capitalize text-textPrimary flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-brand-600" />
                            <span>
                              {slot.slot_type === 'instant_express' ? '⚡ Express 30m' : 'Scheduled Delivery'}
                            </span>
                          </span>
                          <input
                            type="radio"
                            name="delivery_slot"
                            checked={isSelected}
                            disabled={isFull}
                            onChange={() => setSelectedSlotId(slot.id)}
                            className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                          />
                        </div>

                        <div className="text-xs text-textMuted">
                          <p className="font-semibold text-textPrimary">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </p>
                          <p className="text-[11px] text-textMuted mt-0.5">Date: {slot.slot_date}</p>
                        </div>

                        <div className="text-[10px] font-bold text-brand-700">
                          {isFull ? (
                            <span className="text-red-600">Slot Fully Booked</span>
                          ) : (
                            <span>{remainingCapacity} slots remaining</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 3. Payment Method Card */}
            <Card padding="md" className="space-y-4">
              <div className="flex items-center gap-2 border-b border-borderSubtle pb-3">
                <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h2 className="font-bold text-base text-textPrimary">Payment Method</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    paymentMethod === 'cod'
                      ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600'
                      : 'border-borderSubtle bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="font-bold text-sm text-textPrimary">Cash / UPI on Delivery</p>
                      <p className="text-xs text-textMuted">Pay when fresh produce reaches your door</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                  />
                </div>

                <div
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    paymentMethod === 'upi'
                      ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600'
                      : 'border-borderSubtle bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-brand-600" />
                    <div>
                      <p className="font-bold text-sm text-textPrimary">Online Payment (UPI)</p>
                      <p className="text-xs text-textMuted">Instant verification via secure intent</p>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'upi'}
                    onChange={() => setPaymentMethod('upi')}
                    className="text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Order Bill Summary */}
          <div className="space-y-4">
            <Card padding="md" className="space-y-4 bg-slate-50 border-borderSubtle sticky top-28">
              <h2 className="font-bold text-base text-textPrimary border-b border-borderSubtle pb-2">
                Order Summary
              </h2>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.map((it) => (
                  <div key={it.id} className="flex justify-between text-xs text-textMuted">
                    <span className="truncate pr-2">
                      {((it.variant as any)?.product?.name || (it.variant?.weight_label ? `Produce (${it.variant.weight_label})` : 'Farm Fresh Item'))} × {it.quantity}
                    </span>
                    <span className="font-semibold text-textPrimary shrink-0">
                      {formatINR(Number(it.variant?.price || 0) * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-borderSubtle pt-3 space-y-2 text-xs text-textMuted">
                <div className="flex justify-between">
                  <span>Merchandise Subtotal:</span>
                  <span className="font-semibold text-textPrimary">{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Packaging Fee:</span>
                  <span className="font-semibold text-textPrimary">{formatINR(packagingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span className="font-semibold text-textPrimary">
                    {isFreeDelivery ? (
                      <span className="text-emerald-700 font-bold uppercase">FREE</span>
                    ) : (
                      formatINR(deliveryFee)
                    )}
                  </span>
                </div>
                <div className="border-t border-borderSubtle pt-2 flex justify-between text-base font-black text-textPrimary">
                  <span>Total Payable:</span>
                  <span className="text-brand-900">{formatINR(total)}</span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                onClick={handlePlaceOrder}
                disabled={isPlacingOrder || !selectedAddressId || !selectedSlotId}
                className="w-full flex items-center justify-center gap-2 font-bold"
              >
                {isPlacingOrder ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Place Order</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-textMuted pt-1">
                <ShieldCheck className="w-4 h-4 text-brand-600" />
                <span>Zero Surge • FSSAI Grade Quality</span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
