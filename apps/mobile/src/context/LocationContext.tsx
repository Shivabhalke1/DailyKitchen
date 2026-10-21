import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, DeliveryZoneRead } from '../lib/api-client';
import { getSecureItem, saveSecureItem } from '../lib/secure-storage';

interface LocationContextType {
  pincode: string;
  isServiceable: boolean;
  zone: DeliveryZoneRead | null;
  isLoading: boolean;
  isLocationModalOpen: boolean;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  checkAndSetPincode: (newPin: string) => Promise<{ isServiceable: boolean; message: string }>;
}

const PINCODE_STORAGE_KEY = 'dk_mobile_pincode';
const DEFAULT_PINCODE = '585401'; // Default Bidar serviceable operating zone

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [pincode, setPincode] = useState<string>(DEFAULT_PINCODE);
  const [isServiceable, setIsServiceable] = useState<boolean>(true);
  const [zone, setZone] = useState<DeliveryZoneRead | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);

  const checkPincodeInternal = useCallback(async (pinToCheck: string) => {
    try {
      const res = await api.delivery.checkPincode(pinToCheck);
      setIsServiceable(res.is_serviceable);
      setZone(res.zone || null);
      return {
        isServiceable: res.is_serviceable,
        message: res.message || (res.is_serviceable ? 'Serviceable' : 'Currently unserviceable'),
      };
    } catch {
      setIsServiceable(false);
      setZone(null);
      return { isServiceable: false, message: 'Could not check pincode serviceability' };
    }
  }, []);

  // Initialize saved PIN on startup
  useEffect(() => {
    let isMounted = true;

    async function loadSavedLocation() {
      try {
        const savedPin = await getSecureItem(PINCODE_STORAGE_KEY);
        const activePin = savedPin || DEFAULT_PINCODE;
        if (isMounted) setPincode(activePin);
        await checkPincodeInternal(activePin);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSavedLocation();

    return () => {
      isMounted = false;
    };
  }, [checkPincodeInternal]);

  const checkAndSetPincode = useCallback(
    async (newPin: string) => {
      setIsLoading(true);
      try {
        const result = await checkPincodeInternal(newPin);
        if (result.isServiceable) {
          setPincode(newPin);
          await saveSecureItem(PINCODE_STORAGE_KEY, newPin);
        }
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [checkPincodeInternal]
  );

  return (
    <LocationContext.Provider
      value={{
        pincode,
        isServiceable,
        zone,
        isLoading,
        isLocationModalOpen,
        openLocationModal: () => setIsLocationModalOpen(true),
        closeLocationModal: () => setIsLocationModalOpen(false),
        checkAndSetPincode,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return ctx;
}
