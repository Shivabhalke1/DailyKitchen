import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useCart } from '../src/context/CartContext';
import { useLocation } from '../src/context/LocationContext';
import {
  api,
  AddressRead,
  AddressCreate,
  DeliverySlotRead,
} from '../src/lib/api-client';
import { theme } from '../src/theme';
import { formatINR } from '@dailykitchen/shared-utils';
import { MapPin, Clock, CreditCard, ShieldCheck, Plus, Check } from 'lucide-react-native';

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { cart, items, subtotal, deliveryFee, packagingFee, total, refreshCart } = useCart();
  const { pincode } = useLocation();

  const [addresses, setAddresses] = useState<AddressRead[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const [slots, setSlots] = useState<DeliverySlotRead[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inline Add Address State
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddr, setNewAddr] = useState<AddressCreate>({
    full_name: '',
    phone: user?.phone || '+919876543210',
    house_flat: '',
    street_area: '',
    landmark: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: pincode || '560034',
    label: 'home',
    is_default: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    async function loadData() {
      setIsLoadingData(true);
      setErrorMessage(null);
      try {
        const [addrs, availableSlots] = await Promise.all([
          api.users.getAddresses(),
          api.delivery.getSlots(),
        ]);
        setAddresses(addrs || []);
        if (addrs && addrs.length > 0) {
          const defaultAddr = addrs.find((a) => a.is_default) || addrs[0];
          setSelectedAddressId(defaultAddr.id);
        } else {
          setIsAddingAddress(true);
        }

        setSlots(availableSlots || []);
        if (availableSlots && availableSlots.length > 0) {
          setSelectedSlotId(availableSlots[0].id);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load checkout details.');
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [isAuthenticated]);

  const handleSaveAddress = async () => {
    if (!newAddr.house_flat || !newAddr.street_area || !newAddr.pincode) {
      setErrorMessage('Please fill in House/Flat, Street, and PIN Code.');
      return;
    }

    setErrorMessage(null);
    try {
      const created = await api.users.createAddress({
        ...newAddr,
        phone: newAddr.phone || user?.phone || '+919876543210',
        full_name: newAddr.full_name || 'Customer',
      });
      setAddresses((prev) => [...prev, created]);
      setSelectedAddressId(created.id);
      setIsAddingAddress(false);
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
      const order = await api.orders.placeOrder({
        address_id: selectedAddressId,
        slot_id: selectedSlotId,
        payment_method: paymentMethod,
      });

      // Clear/refresh cart
      await refreshCart();

      // Navigate to Order Confirmation / Tracking
      router.replace(`/orders/${order.id}`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.centerTitle}>Please log in to continue</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={openAuthModal}>
          <Text style={styles.primaryBtnText}>Log In with Mobile Number</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0 && !isPlacingOrder) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.centerTitle}>Your cart is empty</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/')}>
          <Text style={styles.primaryBtnText}>Browse Produce Catalog</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Section 1: Delivery Address */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <Text style={styles.sectionTitle}>Delivery Destination</Text>
          </View>

          {isAddingAddress ? (
            <View style={styles.addAddressForm}>
              <TextInput
                style={styles.formInput}
                placeholder="Full Name"
                placeholderTextColor={theme.colors.neutral[400]}
                value={newAddr.full_name}
                onChangeText={(t) => setNewAddr({ ...newAddr, full_name: t })}
              />
              <TextInput
                style={styles.formInput}
                placeholder="House / Flat / Block No."
                placeholderTextColor={theme.colors.neutral[400]}
                value={newAddr.house_flat}
                onChangeText={(t) => setNewAddr({ ...newAddr, house_flat: t })}
              />
              <TextInput
                style={styles.formInput}
                placeholder="Street / Area / Apartment"
                placeholderTextColor={theme.colors.neutral[400]}
                value={newAddr.street_area}
                onChangeText={(t) => setNewAddr({ ...newAddr, street_area: t })}
              />
              <View style={styles.formRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="PIN Code"
                  placeholderTextColor={theme.colors.neutral[400]}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={newAddr.pincode}
                  onChangeText={(t) => setNewAddr({ ...newAddr, pincode: t.replace(/\D/g, '') })}
                />
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="City"
                  placeholderTextColor={theme.colors.neutral[400]}
                  value={newAddr.city}
                  onChangeText={(t) => setNewAddr({ ...newAddr, city: t })}
                />
              </View>
              <View style={styles.formButtonRow}>
                <TouchableOpacity style={styles.saveAddrBtn} onPress={handleSaveAddress}>
                  <Text style={styles.saveAddrBtnText}>Save Address</Text>
                </TouchableOpacity>
                {addresses.length > 0 && (
                  <TouchableOpacity
                    style={styles.cancelAddrBtn}
                    onPress={() => setIsAddingAddress(false)}
                  >
                    <Text style={styles.cancelAddrBtnText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.addressList}>
              {addresses.map((addr) => {
                const isSelected = selectedAddressId === addr.id;
                return (
                  <TouchableOpacity
                    key={addr.id}
                    style={[styles.addressItem, isSelected && styles.addressItemSelected]}
                    onPress={() => setSelectedAddressId(addr.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.radioCircle}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.addrTextWrap}>
                      <View style={styles.addrLabelRow}>
                        <Text style={styles.addrLabel}>{addr.label.toUpperCase()}</Text>
                        {addr.is_default && (
                          <View style={styles.defaultTag}>
                            <Text style={styles.defaultTagText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addrLine}>
                        {addr.house_flat}, {addr.street_area}, {addr.city} - {addr.pincode}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.newAddrBtn}
                onPress={() => setIsAddingAddress(true)}
              >
                <Plus size={16} color={theme.colors.primary[700]} />
                <Text style={styles.newAddrBtnText}>Add New Address</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Section 2: Delivery Slot */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={styles.sectionTitle}>Delivery Slot</Text>
          </View>

          {slots.length === 0 ? (
            <Text style={styles.noSlotsText}>Standard morning harvest slot will be booked.</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {slots.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[styles.slotItem, isSelected && styles.slotItemSelected]}
                    onPress={() => setSelectedSlotId(slot.id)}
                  >
                    <View style={styles.radioCircle}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View>
                      <Text style={styles.slotDate}>{slot.slot_date}</Text>
                      <Text style={styles.slotTime}>
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Section 3: Payment Method */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.sectionTitle}>Payment Method</Text>
          </View>

          <View style={styles.paymentOptions}>
            <TouchableOpacity
              style={[
                styles.payOption,
                paymentMethod === 'cod' && styles.payOptionSelected,
              ]}
              onPress={() => setPaymentMethod('cod')}
            >
              <View style={styles.radioCircle}>
                {paymentMethod === 'cod' && <View style={styles.radioInner} />}
              </View>
              <View>
                <Text style={styles.payTitle}>Cash on Delivery (COD)</Text>
                <Text style={styles.paySub}>Pay securely at your doorstep via cash or UPI</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.payOption,
                paymentMethod === 'upi' && styles.payOptionSelected,
              ]}
              onPress={() => setPaymentMethod('upi')}
            >
              <View style={styles.radioCircle}>
                {paymentMethod === 'upi' && <View style={styles.radioInner} />}
              </View>
              <View>
                <Text style={styles.payTitle}>UPI / Online Payment</Text>
                <Text style={styles.paySub}>Pay via Google Pay, PhonePe, or Cards</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 4: Authoritative Order Pricing */}
        <View style={styles.sectionCard}>
          <Text style={styles.orderSummaryHeading}>Order Bill Breakdown</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal ({items.length} items):</Text>
            <Text style={styles.summaryVal}>{formatINR(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Packaging Fee:</Text>
            <Text style={styles.summaryVal}>{formatINR(packagingFee)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee:</Text>
            <Text style={styles.summaryVal}>
              {deliveryFee === 0 ? 'FREE (₹0)' : formatINR(deliveryFee)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>Payable Total:</Text>
            <Text style={styles.summaryTotalVal}>{formatINR(total)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Order Placement Action */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomPriceLabel}>Total Amount</Text>
          <Text style={styles.bottomPriceVal}>{formatINR(total)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.placeOrderBtn, isPlacingOrder && styles.disabledBtn]}
          disabled={isPlacingOrder}
          onPress={handlePlaceOrder}
        >
          {isPlacingOrder ? (
            <ActivityIndicator color={theme.colors.neutral.white} />
          ) : (
            <Text style={styles.placeOrderBtnText}>Place Fresh Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.neutral.background,
  },
  scrollContent: {
    padding: theme.spacing[4],
    paddingBottom: 110,
    gap: theme.spacing[4],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  centerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary[700],
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.lg,
  },
  primaryBtnText: {
    color: theme.colors.neutral.white,
    fontWeight: '700',
    fontSize: theme.typography.fontSize.sm,
  },
  errorBox: {
    backgroundColor: theme.colors.error.light,
    borderWidth: 1,
    borderColor: theme.colors.error.border,
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
  },
  errorText: {
    color: theme.colors.error.main,
    fontSize: 11,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: theme.colors.neutral.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    gap: theme.spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2.5],
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary[800],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  addressList: {
    gap: 8,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    backgroundColor: theme.colors.neutral[50],
    gap: 10,
  },
  addressItemSelected: {
    borderColor: theme.colors.primary[700],
    backgroundColor: theme.colors.primary[50],
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.neutral[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[700],
  },
  addrTextWrap: {
    flex: 1,
    gap: 2,
  },
  addrLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addrLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  defaultTag: {
    backgroundColor: theme.colors.neutral[200],
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  defaultTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.neutral[700],
  },
  addrLine: {
    fontSize: 11,
    color: theme.colors.neutral[600],
    lineHeight: 16,
  },
  newAddrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary[50],
    marginTop: 4,
  },
  newAddrBtnText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.primary[800],
  },
  addAddressForm: {
    gap: 8,
  },
  formInput: {
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: theme.colors.neutral[900],
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  saveAddrBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary[700],
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  saveAddrBtnText: {
    color: theme.colors.neutral.white,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelAddrBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.neutral[200],
    alignItems: 'center',
  },
  cancelAddrBtnText: {
    color: theme.colors.neutral[700],
    fontSize: 12,
    fontWeight: '600',
  },
  noSlotsText: {
    fontSize: 11,
    color: theme.colors.neutral[500],
  },
  slotsGrid: {
    gap: 8,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.neutral[50],
  },
  slotItemSelected: {
    borderColor: theme.colors.primary[700],
    backgroundColor: theme.colors.primary[50],
  },
  slotDate: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  slotTime: {
    fontSize: 10,
    color: theme.colors.neutral[500],
  },
  paymentOptions: {
    gap: 8,
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.neutral[50],
  },
  payOptionSelected: {
    borderColor: theme.colors.primary[700],
    backgroundColor: theme.colors.primary[50],
  },
  payTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  paySub: {
    fontSize: 10,
    color: theme.colors.neutral[500],
    marginTop: 2,
  },
  orderSummaryHeading: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.neutral[800],
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.colors.neutral[600],
  },
  summaryVal: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.neutral[900],
  },
  summaryDivider: {
    height: 1,
    backgroundColor: theme.colors.neutral[200],
    marginVertical: 4,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  summaryTotalVal: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '800',
    color: theme.colors.primary[800],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
    paddingBottom: theme.spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
  },
  bottomPriceLabel: {
    fontSize: 10,
    color: theme.colors.neutral[500],
    fontWeight: '600',
  },
  bottomPriceVal: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.neutral[900],
  },
  placeOrderBtn: {
    backgroundColor: theme.colors.primary[700],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
  },
  disabledBtn: {
    backgroundColor: theme.colors.neutral[400],
  },
  placeOrderBtnText: {
    color: theme.colors.neutral.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '800',
  },
});
