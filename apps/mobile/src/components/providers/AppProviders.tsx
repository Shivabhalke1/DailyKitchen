import React from 'react';
import { AuthProvider } from '../../context/AuthContext';
import { LocationProvider } from '../../context/LocationContext';
import { CartProvider } from '../../context/CartContext';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LocationProvider>
        <CartProvider>{children}</CartProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
