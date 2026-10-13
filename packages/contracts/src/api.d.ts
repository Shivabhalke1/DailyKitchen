export interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    error: ApiError | null;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
}
export interface HealthResponse {
    status: 'healthy' | 'degraded' | 'unhealthy';
    service: string;
    version: string;
    environment: string;
}
//# sourceMappingURL=api.d.ts.map