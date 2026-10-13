'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', href: '/admin', icon: '📊' },
  { name: 'Orders & Fulfillment', href: '/admin/orders', icon: '📦' },
  { name: 'Customers Directory', href: '/admin/customers', icon: '👥' },
  { name: 'Inventory Control', href: '/admin/inventory', icon: '🥕' },
  { name: 'Catalog & Variants', href: '/admin/catalog', icon: '🏷️' },
  { name: 'Delivery & Slots', href: '/admin/delivery', icon: '🚚' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoading) return;

    if (!isLoginPage) {
      if (!isAuthenticated || user?.role !== 'admin') {
        router.replace('/admin/login');
      }
    } else {
      if (isAuthenticated && user?.role === 'admin') {
        router.replace('/admin');
      }
    }
  }, [isAuthenticated, isLoading, user, isLoginPage, router]);

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-900 flex flex-col">{children}</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-emerald-400 font-semibold text-sm tracking-wide">
              Verifying Operator Credentials...
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Checking administrative role &amp; active session tokens.
            </p>
          </div>
          <Link
            href="/admin/login"
            className="text-xs text-slate-400 hover:text-emerald-400 underline transition-colors pt-2"
          >
            Go directly to Operator Login →
          </Link>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null; // Redirecting to /admin/login
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Operations Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 font-bold text-lg text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-lg">
              🌱
            </span>
            <span>DailyKitchen Operations</span>
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-950 border border-emerald-800/60 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Dispatch System
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-200">
              {user.email || user.phone}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-500">
              Administrator
            </p>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace('/admin/login');
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-rose-400 transition-colors min-h-[36px] flex items-center gap-1.5"
            title="Sign out of operations console"
          >
            <span>Exit</span>
            <span>↗</span>
          </button>
        </div>
      </header>

      {/* Main Grid: Sidebar + Console Area */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/60 p-3 sm:p-4 shrink-0">
          <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Console Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-950 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
