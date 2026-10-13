export interface User {
    id: string;
    fullName: string;
    phone: string;
    email: string;
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    createdAt: string;
}
export interface AuthTokens {
    accessToken: string;
    tokenType: 'bearer';
    expiresIn: number;
    refreshToken?: string;
}
export interface LoginRequest {
    identifier: string;
    password: string;
}
export interface RegisterRequest {
    fullName: string;
    phone: string;
    email: string;
    password: string;
}
export interface OTPRequest {
    phone: string;
}
export interface OTPResponse {
    message: string;
    cooldownSeconds: number;
    expiresInSeconds: number;
}
export interface OTPVerifyRequest {
    phone: string;
    otp: string;
}
export interface AuthResponse {
    user: User;
    tokens: AuthTokens;
}
//# sourceMappingURL=auth.d.ts.map