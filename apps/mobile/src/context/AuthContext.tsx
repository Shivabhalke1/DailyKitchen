import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  api,
  setAccessToken,
  refreshAuthSession,
  onSessionRevoked,
  UserRead,
  STORAGE_KEYS,
} from '../lib/api-client';
import { getSecureItem, saveSecureItem } from '../lib/secure-storage';

interface AuthContextType {
  user: UserRead | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  requestOtp: (phone: string) => Promise<{ cooldown_seconds: number; expires_in_seconds: number }>;
  verifyOtp: (phone: string, otp: string) => Promise<UserRead | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Initialize session on mount from hardware-backed secure storage
  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const storedUser = await getSecureItem(STORAGE_KEYS.USER_DATA);
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (isMounted) setUser(parsed);
          } catch {
            // Ignore corrupted cached user
          }
        }

        // Attempt silent refresh to establish in-memory access token
        const freshToken = await refreshAuthSession();
        if (freshToken && isMounted) {
          try {
            const freshUser = await api.users.getProfile();
            if (isMounted) {
              setUser(freshUser);
              await saveSecureItem(STORAGE_KEYS.USER_DATA, JSON.stringify(freshUser));
            }
          } catch {
            // Retain cached user profile if network temporarily offline
          }
        }
      } catch {
        // Fallback to unauthenticated guest
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    bootstrapSession();

    // Register callback for when refresh token is permanently expired/rejected
    onSessionRevoked(() => {
      if (isMounted) {
        setUser(null);
        setAccessToken(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const res = await api.auth.sendOtp(phone, 'login');
    return {
      cooldown_seconds: res.cooldown_seconds || 60,
      expires_in_seconds: res.expires_in_seconds || 300,
    };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const tokenData = await api.auth.verifyOtp(phone, otp, 'login');

    setAccessToken(tokenData.access_token);

    if (tokenData.refresh_token) {
      await saveSecureItem(STORAGE_KEYS.REFRESH_TOKEN, tokenData.refresh_token);
    }

    const userData = tokenData.user || null;
    if (userData) {
      await saveSecureItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      setUser(userData);
    }

    setIsAuthModalOpen(false);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const freshUser = await api.users.getProfile();
      setUser(freshUser);
      await saveSecureItem(STORAGE_KEYS.USER_DATA, JSON.stringify(freshUser));
    } catch {
      // Ignore if unauthorized
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        requestOtp,
        verifyOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
