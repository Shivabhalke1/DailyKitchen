'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import { CartProvider } from '@/context/CartContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { AuthModal } from '@/components/modals/AuthModal';
import { LocationModal } from '@/components/modals/LocationModal';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return (
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
          {children}
        </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <LocationProvider>
        <CartProvider>
          {/* Top Announcement Bar */}
          <aside
            aria-label="Delivery announcement"
            className="bg-brand-800 text-brand-50 text-[11px] sm:text-xs py-2 px-4 text-center font-semibold tracking-wide"
          >
            <span>
              🌱 Free Delivery on orders ₹99 &amp; above • Flat ₹10 Eco-Packaging Fee • Freshly Harvested Daily
            </span>
          </aside>

          {/* Navigation Header */}
          <Header />

          {/* Page Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>

          {/* Global Footer */}
          <Footer />

          {/* Overlays / Modals */}
          <CartDrawer />
          <AuthModal />
          <LocationModal />
        </CartProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
