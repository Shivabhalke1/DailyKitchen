'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, DeliveryZoneRead, ZoneCheckResponse } from '@/lib/api-client';

interface LocationContextType {
  pincode: string;
  zone: DeliveryZoneRead | null;
  isServiceable: boolean;
  isChecking: boolean;
  error: string | null;
  isLocationModalOpen: boolean;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  checkPincode: (newPincode: string) => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const DEFAULT_PINCODE = '560034';
const PINCODE_STORAGE_KEY = 'dk_customer_pincode';

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [pincode, setPincode] = useState<string>(DEFAULT_PINCODE);
  const [zone, setZone] = useState<DeliveryZoneRead | null>(null);
  const [isServiceable, setIsServiceable] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);

  const checkPincode = useCallback(async (code: string): Promise<boolean> => {
    setIsChecking(true);
    setError(null);

    try {
      const res: ZoneCheckResponse = await api.delivery.checkPincode(code);
      setPincode(code);
      setIsServiceable(res.is_serviceable);
      setZone(res.zone || null);

      if (typeof window !== 'undefined') {
        localStorage.setItem(PINCODE_STORAGE_KEY, code);
      }

      if (!res.is_serviceable) {
        setError(`We currently do not deliver to PIN code ${code}. Try 560034 or 560066.`);
        return false;
      }

      setIsLocationModalOpen(false);
      return true;
    } catch (err: any) {
      setError(err?.message || 'Failed to verify delivery zone.');
      setIsServiceable(false);
      setZone(null);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    let savedPincode = DEFAULT_PINCODE;
    if (typeof window !== 'undefined') {
      savedPincode = localStorage.getItem(PINCODE_STORAGE_KEY) || DEFAULT_PINCODE;
    }
    checkPincode(savedPincode);
  }, [checkPincode]);

  return (
    <LocationContext.Provider
      value={{
        pincode,
        zone,
        isServiceable,
        isChecking,
        error,
        isLocationModalOpen,
        openLocationModal: () => setIsLocationModalOpen(true),
        closeLocationModal: () => setIsLocationModalOpen(false),
        checkPincode,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
