import { Platform } from 'react-native';
import {
  saveSecureItem,
  getSecureItem,
  deleteSecureItem,
} from './secure-storage';
import type { components } from '@dailykitchen/contracts';

// Schema types
export type UserRead = components['schemas']['UserRead'];
export type AuthTokenResponse = components['schemas']['AuthTokenResponse'];
export type OtpSendResponse = components['schemas']['OtpSendResponse'];
export type CategoryRead = components['schemas']['CategoryRead'];
export type ProductRead = components['schemas']['ProductRead'];
export type PaginatedProductRead = components['schemas']['PaginatedProductRead'];
export type ProductVariantRead = components['schemas']['ProductVariantRead'];
export type CartReadWithPricing = components['schemas']['CartReadWithPricing'];
export type CartItemRead = components['schemas']['CartItemRead'];
export type ZoneCheckResponse = components['schemas']['ZoneCheckResponse'];
export type DeliveryZoneRead = components['schemas']['DeliveryZoneRead'];
export type DeliverySlotRead = components['schemas']['DeliverySlotRead'];
export type AddressRead = components['schemas']['AddressRead'];
export type AddressCreate = components['schemas']['AddressCreate'];
export type OrderRead = components['schemas']['OrderRead'];
export type OrderItemRead = components['schemas']['OrderItemRead'];
export type OrderCreate = components['schemas']['OrderCreate'];
export type PaginatedOrderRead = components['schemas']['PaginatedOrderRead'];
export type PaymentRead = components['schemas']['PaymentRead'];

export const STORAGE_KEYS = {
  REFRESH_TOKEN: 'dk_mobile_refresh_token',
  USER_DATA: 'dk_mobile_user_data',
};

/**
 * Resolves the appropriate backend base URL based on platform & environment.
 */
export function getBackendBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // Android emulator maps 10.0.2.2 to host machine's localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }

  // iOS simulator, macOS, and Web preview use localhost
  return 'http://localhost:8000/api/v1';
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// In-Memory Access Token
let inMemoryAccessToken: string | null = null;
let sessionRevocationCallback: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function onSessionRevoked(cb: () => void): void {
  sessionRevocationCallback = cb;
}

// Mutex promise to coordinate simultaneous 401 refresh calls
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAuthSession(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await getSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!storedRefreshToken) {
        setAccessToken(null);
        if (sessionRevocationCallback) sessionRevocationCallback();
        return null;
      }

      const res = await fetch(`${getBackendBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
      });

      if (!res.ok) {
        // Refresh token expired or revoked - clear secure storage
        await deleteSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
        await deleteSecureItem(STORAGE_KEYS.USER_DATA);
        setAccessToken(null);
        if (sessionRevocationCallback) sessionRevocationCallback();
        return null;
      }

      const data = await res.json();
      const tokenPayload: AuthTokenResponse = data.data || data;

      // Update in-memory access token
      setAccessToken(tokenPayload.access_token);

      // Persist rotated refresh token in hardware-backed secure store
      if (tokenPayload.refresh_token) {
        await saveSecureItem(STORAGE_KEYS.REFRESH_TOKEN, tokenPayload.refresh_token);
      }
      if (tokenPayload.user) {
        await saveSecureItem(STORAGE_KEYS.USER_DATA, JSON.stringify(tokenPayload.user));
      }

      return tokenPayload.access_token;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  retryOn401?: boolean;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = false, retryOn401 = true, ...fetchOptions } = options;

  const baseUrl = getBackendBaseUrl();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  if (requiresAuth && inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      err?.message || 'Unable to connect to DailyKitchen services. Please check your network.',
      0
    );
  }

  // 401 Token Refresh Interceptor
  if (response.status === 401 && requiresAuth && retryOn401) {
    const freshToken = await refreshAuthSession();
    if (freshToken) {
      headers.set('Authorization', `Bearer ${freshToken}`);
      try {
        response = await fetch(url, {
          ...fetchOptions,
          headers,
        });
      } catch (err: any) {
        throw new ApiError(err?.message || 'Network error on authentication retry', 0);
      }
    }
  }

  let responseData: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMsg =
      responseData?.detail ||
      responseData?.message ||
      responseData?.error?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, responseData);
  }

  // Unwrap standardized backend ApiResponse envelope
  if (
    responseData &&
    typeof responseData === 'object' &&
    'success' in responseData &&
    'data' in responseData
  ) {
    return responseData.data as T;
  }

  return responseData as T;
}

export const api = {
  // Authentication & Identity
  auth: {
    sendOtp: (phone: string, purpose: string = 'login') =>
      request<OtpSendResponse>('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone, purpose }),
      }),

    verifyOtp: (phone: string, otp: string, purpose: string = 'login') =>
      request<AuthTokenResponse>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, otp, purpose }),
      }),

    getMe: () =>
      request<UserRead>('/auth/me', {
        method: 'GET',
        requiresAuth: true,
      }),

    logout: async () => {
      try {
        await request('/auth/logout', {
          method: 'POST',
          requiresAuth: true,
        });
      } finally {
        await deleteSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
        await deleteSecureItem(STORAGE_KEYS.USER_DATA);
        setAccessToken(null);
      }
    },
  },

  // Customer Profile & Address Book
  users: {
    getProfile: () =>
      request<UserRead>('/users/me/profile', {
        method: 'GET',
        requiresAuth: true,
      }),

    updateProfile: (data: { full_name?: string; avatar_url?: string }) =>
      request<UserRead>('/users/me/profile', {
        method: 'PATCH',
        requiresAuth: true,
        body: JSON.stringify(data),
      }),

    getAddresses: () =>
      request<AddressRead[]>('/users/me/addresses', {
        method: 'GET',
        requiresAuth: true,
      }),

    createAddress: (payload: AddressCreate) =>
      request<AddressRead>('/users/me/addresses', {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify(payload),
      }),

    updateAddress: (addressId: string, payload: Partial<AddressCreate>) =>
      request<AddressRead>(`/users/me/addresses/${addressId}`, {
        method: 'PATCH',
        requiresAuth: true,
        body: JSON.stringify(payload),
      }),

    setDefaultAddress: (addressId: string) =>
      request<AddressRead>(`/users/me/addresses/${addressId}/default`, {
        method: 'PUT',
        requiresAuth: true,
      }),

    deleteAddress: (addressId: string) =>
      request<{ message: string }>(`/users/me/addresses/${addressId}`, {
        method: 'DELETE',
        requiresAuth: true,
      }),
  },

  // Catalog & Produce
  catalog: {
    getCategories: () =>
      request<CategoryRead[]>('/catalog/categories', {
        method: 'GET',
      }),

    getProducts: (params?: { category_id?: string; search?: string; page_size?: number }) => {
      const sp = new URLSearchParams();
      if (params?.category_id) sp.set('category_id', params.category_id);
      if (params?.search) sp.set('search', params.search);
      if (params?.page_size) sp.set('page_size', params.page_size.toString());

      const qs = sp.toString();
      return request<PaginatedProductRead>(`/catalog/products${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      });
    },

    getProductBySlug: (slug: string) =>
      request<ProductRead>(`/catalog/products/${slug}`, {
        method: 'GET',
      }),

    getFeaturedProducts: () =>
      request<ProductRead[]>('/catalog/products/featured', {
        method: 'GET',
      }),
  },

  // Shopping Cart (Authoritative Server State)
  cart: {
    getCart: () =>
      request<CartReadWithPricing>('/cart', {
        method: 'GET',
        requiresAuth: true,
      }),

    addItem: (variantId: string, quantity: number = 1) =>
      request<CartReadWithPricing>('/cart/items', {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify({ variant_id: variantId, quantity }),
      }),

    updateItem: (itemId: string, quantity: number) =>
      request<CartReadWithPricing>(`/cart/items/${itemId}`, {
        method: 'PATCH',
        requiresAuth: true,
        body: JSON.stringify({ quantity }),
      }),

    removeItem: (itemId: string) =>
      request<CartReadWithPricing>(`/cart/items/${itemId}`, {
        method: 'DELETE',
        requiresAuth: true,
      }),

    clearCart: () =>
      request<CartReadWithPricing>('/cart', {
        method: 'DELETE',
        requiresAuth: true,
      }),
  },

  // Delivery Zones & Slots
  delivery: {
    checkPincode: (pincode: string) =>
      request<ZoneCheckResponse>(`/delivery/zones/check?pincode=${encodeURIComponent(pincode)}`, {
        method: 'GET',
      }),

    getZones: () =>
      request<DeliveryZoneRead[]>('/delivery/zones', {
        method: 'GET',
      }),

    getSlots: (params?: { zoneId?: string; date?: string; slotType?: string }) => {
      const sp = new URLSearchParams();
      if (params?.zoneId) sp.set('zone_id', params.zoneId);
      if (params?.date) sp.set('date', params.date);
      if (params?.slotType) sp.set('slot_type', params.slotType);

      const qs = sp.toString();
      return request<DeliverySlotRead[]>(`/delivery/slots${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      });
    },
  },

  // Order Lifecycle
  orders: {
    placeOrder: (payload: OrderCreate) =>
      request<OrderRead>('/orders', {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify(payload),
      }),

    getOrders: (params?: { page?: number; page_size?: number; status?: string }) => {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', params.page.toString());
      if (params?.page_size) sp.set('page_size', params.page_size.toString());
      if (params?.status) sp.set('status', params.status);

      const qs = sp.toString();
      return request<PaginatedOrderRead>(`/orders${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        requiresAuth: true,
      });
    },

    getOrder: (orderId: string) =>
      request<OrderRead>(`/orders/${orderId}`, {
        method: 'GET',
        requiresAuth: true,
      }),

    cancelOrder: (orderId: string, reason: string) =>
      request<OrderRead>(`/orders/${orderId}/cancel`, {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify({ reason }),
      }),
  },
};
