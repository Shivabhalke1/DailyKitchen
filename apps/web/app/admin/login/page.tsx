'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginWithPassword, logout } = useAuth();

  const [identifier, setIdentifier] = useState('+919999999999');
  const [password, setPassword] = useState('Admin@123456');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const user = await loginWithPassword(identifier.trim(), password);

      if (!user) {
        throw new Error('Authentication returned empty user record.');
      }

      if (user.role !== 'admin') {
        // Customer account attempting to enter admin console
        await logout();
        setErrorMessage(
          'Access Denied: Customer accounts cannot access the DailyKitchen Operations Console. Administrator role required.'
        );
        return;
      }

      if (!user.is_active) {
        await logout();
        setErrorMessage('Account Deactivated: This administrator account is disabled.');
        return;
      }

      // Success
      router.replace('/admin');
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'Failed to sign in. Verify your administrator credentials and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-2xl mb-3">
            🌱
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Operations Console Login
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Restricted access for DailyKitchen administrators &amp; dispatch managers
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs sm:text-sm leading-relaxed"
          >
            <strong>Authentication Error: </strong>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="identifier"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Admin Phone or Email
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="+919999999999 or admin@dailykitchen.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[44px] transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[44px] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Authorizing...</span>
              </>
            ) : (
              <span>Sign In to Console</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Unauthorized access attempts are logged with client IP address and timestamp.
            Customer accounts must authenticate via OTP on the storefront.
          </p>
        </div>
      </div>
    </div>
  );
}
