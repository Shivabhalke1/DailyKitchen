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
            className="bg-emerald-800 text-white text-[11px] sm:text-xs py-2 px-4 text-center font-semibold tracking-wide shadow-xs"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5">
                <span>🌱</span>
                <span>Free Delivery on orders ₹99 &amp; above</span>
                <span className="opacity-40">•</span>
                <span>Flat ₹10 Eco-Packaging Fee</span>
                <span className="opacity-40">•</span>
                <span>Freshly Harvested Daily</span>
              </span>
            </div>
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
