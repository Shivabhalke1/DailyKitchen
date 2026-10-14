'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/context/LocationContext';
import { useCart } from '@/context/CartContext';
import {
  MapPin,
  ShoppingBag,
  User as UserIcon,
  LogOut,
  ChevronDown,
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

  // Display user's profile full name instead of raw phone number
  const displayName = user?.profile?.full_name || 'My Account';

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl backdrop-saturate-150 border-b border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3 sm:gap-6">
          {/* Brand Logo & Location Pill */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 sm:gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-2xl transition-transform active:scale-[0.98]"
              aria-label="DailyKitchen Home"
            >
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/25 font-black text-lg tracking-tight">
                DK
              </span>
              <span className="hidden sm:block">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 block leading-tight">
                  DailyKitchen
                </span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-700 block">
                  Fresh Food. Happy Homes.
                </span>
              </span>
            </Link>

            {/* Location Selector Pill */}
            <button
              onClick={openLocationModal}
              className="group inline-flex items-center gap-2.5 px-3.5 py-1.5 sm:py-2 rounded-full bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 hover:border-emerald-300 text-xs transition-all duration-200 text-left shadow-sm"
              aria-label={`Change delivery PIN code. Current: ${pincode}`}
            >
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-xs">
                <MapPin className="w-3.5 h-3.5" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <span>{zone ? zone.name.split(' ')[0] : 'Bengaluru'}</span>
                  <span className="font-mono text-emerald-700 font-extrabold">({pincode})</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 transition-transform group-hover:translate-y-0.5" />
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
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
                  className="group inline-flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 hover:border-slate-300 transition-all duration-200 text-left shadow-sm active:scale-[0.98]"
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="true"
                >
                  {/* Default human icon inside circular avatar */}
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center shadow-xs flex-shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </span>

                  {/* Display User Name instead of number */}
                  <span className="hidden md:inline text-slate-800 font-semibold text-xs sm:text-sm max-w-[130px] truncate">
                    {displayName}
                  </span>

                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-100 mb-1.5">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Signed in as</p>
                      <p className="text-sm font-bold text-slate-900 truncate mt-0.5">
                        {displayName}
                      </p>
                      {user?.phone && (
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{user.phone}</p>
                      )}
                      {user?.customer_code && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">Customer ID:</span>
                          <span className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                            {user.customer_code}
                          </span>
                        </div>
                      )}
                    </div>

                    <Link
                      href="/orders"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <span className="text-base">📦</span>
                      <span>My Orders</span>
                    </Link>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100 mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs sm:text-sm text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all shadow-sm active:scale-95"
              >
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserIcon className="w-3.5 h-3.5" />
                </span>
                <span>Login</span>
              </button>
            )}

            {/* Premium Emerald Cart Button */}
            <button
              onClick={toggleCartDrawer}
              className="group inline-flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[42px] cursor-pointer"
              aria-label={`Shopping cart with ${itemCount} items, total ${subtotal > 0 ? formatINR(subtotal) : '₹0'}`}
            >
              <span className="relative flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform group-hover:scale-110 text-white" />
              </span>

              <span className="flex items-center gap-1.5 font-bold tracking-tight">
                <span>Cart</span>
                {itemCount > 0 ? (
                  <>
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      {itemCount}
                    </span>
                    <span className="opacity-50">•</span>
                    <span className="font-extrabold">{formatINR(subtotal)}</span>
                  </>
                ) : (
                  <span className="text-[11px] font-black px-1.5 py-0.5 rounded-full bg-emerald-700 text-emerald-100">
                    0
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
