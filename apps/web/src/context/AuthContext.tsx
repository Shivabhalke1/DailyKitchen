'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken, UserRead, ApiError } from '@/lib/api-client';

interface AuthContextType {
  user: UserRead | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  requestOtp: (phone: string) => Promise<{ cooldown_seconds: number; expires_in_seconds: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<UserRead | null>;
  loginWithPassword: (identifier: string, password: string) => Promise<UserRead | null>;
  registerWithPassword: (fullName: string, phone: string, password: string, email?: string) => Promise<UserRead | null>;
  requestPasswordReset: (identifier: string) => Promise<{ message: string; reset_token?: string | null }>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const LOCAL_USER_KEY = 'dk_user';
const LOCAL_TOKEN_KEY = 'dk_token';

let sessionCheckPromise: Promise<any> | null = null;

function fetchSessionOnce(): Promise<any> {
  if (!sessionCheckPromise) {
    sessionCheckPromise = fetch('/api/auth/session', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .catch(() => ({ authenticated: false }))
      .finally(() => {
        setTimeout(() => {
          sessionCheckPromise = null;
        }, 2000);
      });
  }
  return sessionCheckPromise;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [accessToken, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initialize session on mount via Next.js BFF HttpOnly cookie
  useEffect(() => {
    let isMounted = true;

    // Restore cached credentials on mount without causing SSR hydration mismatch
    try {
      const savedUser = localStorage.getItem(LOCAL_USER_KEY);
      const savedToken = localStorage.getItem(LOCAL_TOKEN_KEY);
      if (savedUser && savedToken && isMounted) {
        setAccessToken(savedToken);
        setTokenState(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch {
      // Ignore parse errors
    }

    async function checkInitialSession() {
      try {
        const data = await fetchSessionOnce();

        if (data && data.authenticated && data.access_token) {
          if (isMounted) {
            setAccessToken(data.access_token);
            setTokenState(data.access_token);
            setUser(data.user);
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_TOKEN_KEY, data.access_token);
            if (data.user) {
              localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(data.user));
            }
          }
        } else {
          // Cookie is expired or missing: clear stale client state
          if (typeof window !== 'undefined') {
            localStorage.removeItem(LOCAL_USER_KEY);
            localStorage.removeItem(LOCAL_TOKEN_KEY);
          }
          if (isMounted) {
            setAccessToken(null);
            setTokenState(null);
            setUser(null);
          }
        }
      } catch (err) {
        // Silently treat as guest
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkInitialSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const res = await api.auth.sendOtp(phone, 'login');
    return {
      cooldown_seconds: res.cooldown_seconds,
      expires_in_seconds: res.expires_in_seconds,
    };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    // 1. Verify with backend
    const tokenData = await api.auth.verifyOtp(phone, otp, 'login');

    // 2. Establish persistent HttpOnly session via Next.js BFF
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: tokenData.user,
      }),
    });

    // 3. Update memory & local storage state
    const userData = tokenData.user || null;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_TOKEN_KEY, tokenData.access_token);
      if (userData) {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userData));
      }
    }
    setAccessToken(tokenData.access_token);
    setTokenState(tokenData.access_token);
    setUser(userData);
    setIsAuthModalOpen(false);

    return userData;
  }, []);

  const loginWithPassword = useCallback(async (identifier: string, password: string) => {
    // 1. Authenticate with backend using credentials
    const tokenData = await api.auth.login(identifier, password);

    // 2. Establish persistent HttpOnly session via Next.js BFF
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        user: tokenData.user,
      }),
    });

    // 3. Update memory & local storage state
    const userData = tokenData.user || null;
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_TOKEN_KEY, tokenData.access_token);
      if (userData) {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userData));
      }
    }
    setAccessToken(tokenData.access_token);
    setTokenState(tokenData.access_token);
    setUser(userData);
    setIsAuthModalOpen(false);

    return userData;
  }, []);

  const registerWithPassword = useCallback(
    async (fullName: string, phone: string, password: string, email?: string) => {
      // 1. Register with backend
      const tokenData = await api.auth.register({
        fullName,
        phone,
        password,
        email,
      });

      // 2. Establish persistent HttpOnly session via Next.js BFF
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          user: tokenData.user,
        }),
      });

      // 3. Update memory & local storage state
      const userData = tokenData.user || null;
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_TOKEN_KEY, tokenData.access_token);
        if (userData) {
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userData));
        }
      }
      setAccessToken(tokenData.access_token);
      setTokenState(tokenData.access_token);
      setUser(userData);
      setIsAuthModalOpen(false);

      return userData;
    },
    []
  );

  const requestPasswordReset = useCallback(async (identifier: string) => {
    return await api.auth.requestPasswordReset(identifier);
  }, []);

  const confirmPasswordReset = useCallback(async (token: string, newPassword: string) => {
    await api.auth.confirmPasswordReset(token, newPassword);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LOCAL_USER_KEY);
        localStorage.removeItem(LOCAL_TOKEN_KEY);
      }
      setAccessToken(null);
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      const updatedUser = await api.users.getProfile();
      setUser(updatedUser);
      if (typeof window !== 'undefined' && updatedUser) {
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updatedUser));
      }
    } catch (err) {
      // Ignore if unauthenticated
    }
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        requestOtp,
        verifyOtp,
        loginWithPassword,
        registerWithPassword,
        requestPasswordReset,
        confirmPasswordReset,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
