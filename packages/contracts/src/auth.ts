export interface User {
  id: string;
  fullName: string;
  phone: string; // 10 digits e.g., "9876543210" with +91 country context
  email: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: 'bearer';
  expiresIn: number; // in seconds
  refreshToken?: string;
}

export interface LoginRequest {
  identifier: string; // Phone or Email
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  phone: string; // 10 digits, +91
  email: string;
  password: string;
}

export interface OTPRequest {
  phone: string;
}

export interface OTPResponse {
  message: string;
  cooldownSeconds: number; // 60s cooldown
  expiresInSeconds: number; // 300s (5m) expiry
}

export interface OTPVerifyRequest {
  phone: string;
  otp: string; // 4 digits
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}
