import { GeneratedApi } from '@dailykitchen/contracts';

type Schemas = GeneratedApi.components['schemas'];

export type CategoryRead = Schemas['CategoryRead'] & {
  default_price?: string | null;
};
export type ProductRead = Schemas['ProductRead'];
export type ProductVariantRead = Schemas['ProductVariantRead'];
export type PaginatedProductRead = Schemas['PaginatedProductRead'];
export type CartReadWithPricing = Schemas['CartReadWithPricing'];
export type CartItemRead = Schemas['CartItemRead'];
export type ZoneCheckResponse = Schemas['ZoneCheckResponse'];
export type DeliveryZoneRead = Schemas['DeliveryZoneRead'];
export type DeliverySlotRead = Schemas['DeliverySlotRead'];
export type OrderRead = Schemas['OrderRead'];
export type OrderCreate = Schemas['OrderCreate'];
export type AddressRead = Schemas['AddressRead'];
export type AddressCreate = Schemas['AddressCreate'];
export type ProfileRead = Schemas['ProfileRead'];
export type ProfileUpdate = Schemas['ProfileUpdate'];
export type UserRead = Schemas['UserRead'];
export type AuthTokenResponse = Schemas['AuthTokenResponse'];
export type OtpSendResponse = Schemas['OtpSendResponse'];
export type PaymentRead = Schemas['PaymentRead'];
export type PaymentIntentCreate = Schemas['PaymentIntentCreate'];
export type DashboardMetricsRead = Schemas['DashboardMetricsRead'];
export type CategoryCreate = Schemas['CategoryCreate'] & {
  is_active?: boolean;
  default_price?: string | null;
};
export type CategoryUpdate = Partial<Schemas['CategoryUpdate']> & {
  slug?: string;
  default_price?: string | null;
  is_active?: boolean;
};
export type ProductCreate = Schemas['ProductCreate'] & {
  is_active?: boolean;
};
export type ProductUpdate = Partial<Schemas['ProductUpdate']> & {
  category_id?: string;
  slug?: string;
  is_active?: boolean;
};
export interface ProductPricingUpdate {
  price: string;
  mrp?: string;
  variant_id?: string;
}

export type VariantCreate = Schemas['VariantCreate'];
export type VariantUpdate = Schemas['VariantUpdate'];
export type InventoryAdjust = Schemas['InventoryAdjust'];
export type InventoryRead = Schemas['InventoryRead'];
export type ZoneCreate = Schemas['ZoneCreate'];
export type BulkSlotCreate = Schemas['BulkSlotCreate'];
export interface SingleSlotCreate {
  zone_id: string;
  slot_date: string;
  slot_type?: string;
  start_time: string;
  end_time: string;
  max_orders: number;
}
export type SlotUpdate = Schemas['SlotUpdate'];
export type OrderStatusUpdate = Schemas['OrderStatusUpdate'];
export type PaginatedOrderRead = Schemas['PaginatedOrderRead'];
export type AdminCustomerListItem = Schemas['AdminCustomerListItem'];
export type AdminCustomerListResponse = Schemas['AdminCustomerListResponse'];
export type AdminCustomerDetail = Schemas['AdminCustomerDetail'];
export type PasswordResetRequest = Schemas['PasswordResetRequest'];
export type PasswordResetResponse = Schemas['PasswordResetResponse'];
export type PasswordResetConfirmRequest = Schemas['PasswordResetConfirmRequest'];

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://dailykitchen.onrender.com/api/v1';

async function refreshAuthSession(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Mutex promise to deduplicate concurrent refresh calls
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = await res.json();
      if (data.authenticated && data.access_token) {
        setAccessToken(data.access_token);
        return data.access_token;
      }
      setAccessToken(null);
      return null;
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

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { requiresAuth = false, retryOn401 = true, ...fetchOptions } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BACKEND_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

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
      err?.message || 'Network connection failed. Please check your internet connection.',
      0
    );
  }

  // 401 Interception & Refresh Retry
  if (response.status === 401 && requiresAuth && retryOn401) {
    const newToken = await refreshAuthSession();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      try {
        response = await fetch(url, {
          ...fetchOptions,
          headers,
        });
      } catch (err: any) {
        throw new ApiError(err?.message || 'Network error on retry', 0);
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
    let errorMessage: string;
    if (Array.isArray(responseData?.detail)) {
      errorMessage = responseData.detail
        .map((d: any) => d.msg || `${d.loc?.slice(-1)} is invalid`)
        .join(', ');
    } else if (typeof responseData?.detail === 'string') {
      errorMessage = responseData.detail;
    } else {
      errorMessage =
        responseData?.message ||
        responseData?.error?.message ||
        `Request failed with status ${response.status}`;
    }
    throw new ApiError(errorMessage, response.status, responseData);
  }

  // Unwrap standardized backend ApiResponse envelope if present
  if (responseData && typeof responseData === 'object' && 'success' in responseData && 'data' in responseData) {
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

    getTestOtp: (phone: string) =>
      request<{ phone: string; otp: string }>(
        `/auth/test/last-otp?phone=${encodeURIComponent(phone)}`,
        { method: 'GET' }
      ),

    register: (payload: { fullName: string; phone: string; password: string; email?: string }) =>
      request<AuthTokenResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: payload.fullName,
          phone: payload.phone,
          password: payload.password,
          email: payload.email || undefined,
        }),
      }),

    login: (identifier: string, password: string) =>
      request<AuthTokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }),

    requestPasswordReset: (identifier: string) =>
      request<PasswordResetResponse>('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      }),

    confirmPasswordReset: (token: string, newPassword: string) =>
      request<{ message: string }>('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      }),

    getTestResetToken: (identifier: string) =>
      request<{ identifier: string; token: string }>(
        `/auth/test/last-reset-token?identifier=${encodeURIComponent(identifier)}`,
        { method: 'GET' }
      ),

    getMe: () =>
      request<UserRead>('/auth/me', {
        method: 'GET',
        requiresAuth: true,
      }),
  },

  // Customer Profile & Address Book
  users: {
    getProfile: () =>
      request<UserRead>('/users/me', {
        method: 'GET',
        requiresAuth: true,
      }),

    updateProfile: (payload: ProfileUpdate) =>
      request<ProfileRead>('/users/me/profile', {
        method: 'PATCH',
        requiresAuth: true,
        body: JSON.stringify(payload),
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

    getCategoryBySlug: (slug: string) =>
      request<CategoryRead & { active_product_count: number }>(`/catalog/categories/${slug}`, {
        method: 'GET',
      }),

    getProducts: (params?: {
      category?: string;
      popular?: boolean;
      fresh?: boolean;
      q?: string;
      page?: number;
      page_size?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set('category', params.category);
      if (params?.popular !== undefined) searchParams.set('popular', String(params.popular));
      if (params?.fresh !== undefined) searchParams.set('fresh', String(params.fresh));
      if (params?.q) searchParams.set('q', params.q);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.page_size) searchParams.set('page_size', String(params.page_size));

      const queryStr = searchParams.toString();
      return request<PaginatedProductRead>(
        `/catalog/products${queryStr ? `?${queryStr}` : ''}`,
        { method: 'GET' }
      );
    },

    getProductBySlug: (slug: string) =>
      request<ProductRead>(`/catalog/products/${slug}`, {
        method: 'GET',
      }),
  },

  // Shopping Cart
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
      const searchParams = new URLSearchParams();
      if (params?.zoneId) searchParams.set('zone_id', params.zoneId);
      if (params?.date) searchParams.set('date', params.date);
      if (params?.slotType) searchParams.set('slot_type', params.slotType);

      const queryStr = searchParams.toString();
      return request<DeliverySlotRead[]>(
        `/delivery/slots${queryStr ? `?${queryStr}` : ''}`,
        { method: 'GET' }
      );
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

    getOrders: () =>
      request<{ items: OrderRead[]; total: number }>('/orders', {
        method: 'GET',
        requiresAuth: true,
      }),

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

  // Payments
  payments: {
    createIntent: (payload: PaymentIntentCreate) =>
      request<PaymentRead>('/payments/intent', {
        method: 'POST',
        requiresAuth: true,
        body: JSON.stringify(payload),
      }),
  },

  // Backoffice Operations & Admin Console
  admin: {
    login: (identifier: string, password: string) =>
      request<AuthTokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }),

    dashboard: {
      getMetrics: (date?: string) =>
        request<DashboardMetricsRead>(
          `/admin/dashboard/metrics${date ? `?date=${encodeURIComponent(date)}` : ''}`,
          { method: 'GET', requiresAuth: true }
        ),
    },

    orders: {
      list: (params?: { page?: number; pageSize?: number; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.pageSize) q.set('page_size', String(params.pageSize));
        if (params?.status) q.set('status', params.status);
        const query = q.toString();
        return request<PaginatedOrderRead>(`/admin/orders${query ? `?${query}` : ''}`, {
          method: 'GET',
          requiresAuth: true,
        });
      },

      get: (orderId: string) =>
        request<OrderRead>(`/admin/orders/${orderId}`, {
          method: 'GET',
          requiresAuth: true,
        }),

      updateStatus: (orderId: string, status: string, notes?: string) =>
        request<OrderRead>(`/admin/orders/${orderId}/status`, {
          method: 'PATCH',
          requiresAuth: true,
          body: JSON.stringify({ status, notes }),
        }),
    },

    catalog: {
      getCategories: () =>
        request<CategoryRead[]>('/admin/catalog/categories', {
          method: 'GET',
          requiresAuth: true,
        }),

      getProducts: () =>
        request<ProductRead[]>('/admin/catalog/products', {
          method: 'GET',
          requiresAuth: true,
        }),

      createCategory: (payload: CategoryCreate) =>
        request<CategoryRead>('/admin/catalog/categories', {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      updateCategory: (id: string, payload: CategoryUpdate) =>
        request<CategoryRead>(`/admin/catalog/categories/${id}`, {
          method: 'PUT',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      createProduct: (payload: ProductCreate) =>
        request<ProductRead>('/admin/catalog/products', {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      updateProduct: (id: string, payload: ProductUpdate) =>
        request<ProductRead>(`/admin/catalog/products/${id}`, {
          method: 'PUT',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      createVariant: (productId: string, payload: VariantCreate) =>
        request<ProductVariantRead>(`/admin/catalog/products/${productId}/variants`, {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      updateVariant: (id: string, payload: VariantUpdate) =>
        request<ProductVariantRead>(`/admin/catalog/variants/${id}`, {
          method: 'PUT',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      adjustInventory: (variantId: string, payload: InventoryAdjust) =>
        request<InventoryRead>(`/admin/catalog/variants/${variantId}/inventory`, {
          method: 'PUT',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      zeroInventory: (variantId: string, reason?: string) =>
        request<InventoryRead>(
          `/admin/catalog/variants/${variantId}/inventory/zero${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`,
          {
            method: 'POST',
            requiresAuth: true,
          }
        ),

      deleteVariant: (variantId: string) =>
        request<{ success: boolean; message: string; action: string }>(
          `/admin/catalog/variants/${variantId}`,
          {
            method: 'DELETE',
            requiresAuth: true,
          }
        ),

      deleteProduct: (productId: string) =>
        request<{ success: boolean; message: string; action: string }>(
          `/admin/catalog/products/${productId}`,
          {
            method: 'DELETE',
            requiresAuth: true,
          }
        ),

      deleteCategory: (categoryId: string) =>
        request<{ success: boolean; message: string; action: string }>(
          `/admin/catalog/categories/${categoryId}`,
          {
            method: 'DELETE',
            requiresAuth: true,
          }
        ),

      uploadImage: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<{
          success: boolean;
          image_url: string;
          filename: string;
          original_filename: string;
          size_bytes: number;
          content_type: string;
        }>('/admin/catalog/upload-image', {
          method: 'POST',
          requiresAuth: true,
          body: formData,
        });
      },

      updateProductPricing: (productId: string, payload: ProductPricingUpdate) =>
        request<ProductRead>(`/admin/catalog/products/${productId}/pricing`, {
          method: 'PUT',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),
    },

    delivery: {
      listZones: () =>
        request<DeliveryZoneRead[]>('/delivery/zones', {
          method: 'GET',
        }),

      createZone: (payload: ZoneCreate) =>
        request<DeliveryZoneRead>('/admin/delivery/zones', {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      deleteZone: (zoneId: string) =>
        request<{ success: boolean; message: string; zone_id?: string }>(
          `/admin/delivery/zones/${zoneId}`,
          {
            method: 'DELETE',
            requiresAuth: true,
          }
        ),

      listSlots: (params?: { zoneId?: string; date?: string }) => {
        const q = new URLSearchParams();
        if (params?.zoneId) q.set('zone_id', params.zoneId);
        if (params?.date) q.set('date', params.date);
        const query = q.toString();
        return request<DeliverySlotRead[]>(`/admin/delivery/slots${query ? `?${query}` : ''}`, {
          method: 'GET',
          requiresAuth: true,
        });
      },

      createSingleSlot: (payload: SingleSlotCreate) =>
        request<DeliverySlotRead>('/admin/delivery/slots/single', {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      bulkCreateSlots: (payload: BulkSlotCreate) =>
        request<DeliverySlotRead[]>('/admin/delivery/slots', {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      updateSlot: (slotId: string, payload: SlotUpdate) =>
        request<DeliverySlotRead>(`/admin/delivery/slots/${slotId}`, {
          method: 'PATCH',
          requiresAuth: true,
          body: JSON.stringify(payload),
        }),

      deleteSlot: (slotId: string) =>
        request<{ success: boolean; message: string; slot_id?: string }>(
          `/admin/delivery/slots/${slotId}`,
          {
            method: 'DELETE',
            requiresAuth: true,
          }
        ),
    },

    customers: {
      list: (params?: { q?: string; page?: number; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.q) q.set('q', params.q);
        if (params?.page) q.set('page', String(params.page));
        if (params?.limit) q.set('limit', String(params.limit));
        const query = q.toString();
        return request<AdminCustomerListResponse>(
          `/admin/customers${query ? `?${query}` : ''}`,
          {
            method: 'GET',
            requiresAuth: true,
          }
        );
      },

      get: (customerId: string) =>
        request<AdminCustomerDetail>(`/admin/customers/${customerId}`, {
          method: 'GET',
          requiresAuth: true,
        }),

      delete: (customerId: string, options?: { hard_delete?: boolean }) => {
        const query = options?.hard_delete ? '?hard_delete=true' : '';
        return request<{ success: boolean; customer_id: string; action: string; message: string }>(
          `/admin/customers/${customerId}${query}`,
          {
            method: 'DELETE',
            requiresAuth: true,
          }
        );
      },
    },
  },
};
