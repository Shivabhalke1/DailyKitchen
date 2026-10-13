'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/Button';
import {
  MapPin,
  ShoppingBag,
  User as UserIcon,
  Search,
  LogOut,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '@dailykitchen/shared-utils';

export function Header() {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const { pincode, zone, openLocationModal } = useLocation();
  const { itemCount, subtotal, toggleCartDrawer } = useCart();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-borderSubtle shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3 sm:gap-6">
          {/* Brand Logo & Location Pill */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-brand-700 hover:text-brand-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-md"
              aria-label="DailyKitchen Home"
            >
              <span className="w-10 h-10 rounded-xl bg-brand-700 text-white flex items-center justify-center shadow-md shadow-brand-700/20 font-extrabold text-xl">
                DK
              </span>
              <span className="hidden sm:block">
                <span className="font-extrabold text-xl tracking-tight text-brand-900 block leading-tight">
                  DailyKitchen
                </span>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-600 block">
                  Fresh Food. Happy Homes.
                </span>
              </span>
            </Link>

            {/* Location Selector Pill */}
            <button
              onClick={openLocationModal}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-brand-50 border border-slate-200 hover:border-brand-300 text-xs transition-all text-left"
              aria-label={`Change delivery PIN code. Current: ${pincode}`}
            >
              <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span className="flex flex-col leading-none">
                <span className="font-semibold text-textPrimary flex items-center gap-1">
                  <span>{zone ? zone.name.split(' ')[0] : 'Bengaluru'}</span>
                  <span className="font-mono text-brand-700 font-bold">({pincode})</span>
                  <ChevronDown className="w-3 h-3 text-textMuted" />
                </span>
                <span className="text-[10px] text-textMuted mt-0.5">
                  {zone?.is_express_available ? '⚡ Express 30m' : 'Standard Delivery'}
                </span>
              </span>
            </button>
          </div>

          {/* Right Action Controls: Account & Cart */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Account Trigger */}
            {isMounted && isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 border border-transparent hover:border-borderSubtle text-sm font-medium transition-colors"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-xs">
                    {user?.phone ? user.phone.slice(-4) : <UserIcon className="w-4 h-4" />}
                  </span>
                  <span className="hidden md:inline text-textPrimary font-semibold">
                    {user?.phone || 'Account'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-textMuted" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-borderSubtle py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-borderSubtle">
                      <p className="text-xs text-textMuted">Logged in as</p>
                      <p className="text-sm font-bold text-textPrimary truncate">
                        {user?.profile?.full_name || user?.phone}
                      </p>
                      {user?.customer_code && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-[10px] text-textMuted font-medium">Customer ID:</span>
                          <span className="font-mono text-[10px] font-extrabold bg-brand-50 text-brand-800 px-1.5 py-0.5 rounded border border-brand-200">
                            {user.customer_code}
                          </span>
                        </div>
                      )}
                      <span className="inline-block mt-1.5 text-[10px] uppercase font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {user?.role}
                      </span>
                    </div>

                    <Link
                      href="/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-textPrimary hover:bg-slate-50 transition-colors"
                    >
                      My Orders
                    </Link>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-borderSubtle mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="md"
                onClick={openAuthModal}
                className="hidden sm:inline-flex items-center gap-1.5 font-semibold text-sm"
              >
                <UserIcon className="w-4 h-4 text-brand-700" />
                <span>Login</span>
              </Button>
            )}

            {/* Cart Trigger Button */}
            <button
              onClick={toggleCartDrawer}
              className="relative inline-flex items-center gap-2.5 bg-brand-700 hover:bg-brand-800 text-white px-3.5 sm:px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-brand-700/25 transition-all hover:scale-[1.02] active:scale-[0.98] min-h-touch"
              aria-label={`Shopping cart with ${itemCount} items, total ${formatINR(subtotal)}`}
            >
              <span className="relative inline-flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-amber-400 text-brand-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                    {itemCount}
                  </span>
                )}
              </span>
              <span className="flex flex-col text-left leading-none">
                <span className="text-[10px] text-brand-200 font-medium">My Cart</span>
                <span className="font-extrabold text-xs sm:text-sm">
                  {subtotal > 0 ? formatINR(subtotal) : 'Empty'}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
