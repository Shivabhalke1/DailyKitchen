from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiError(BaseModel):
    """Standardized API error envelope payload."""

    code: str = Field(..., description="Machine-readable application error code")
    message: str = Field(..., description="Human-readable error explanation")
    details: Optional[Any] = Field(None, description="Detailed field errors or diagnostic metadata")


class ApiResponse(BaseModel, Generic[T]):
    """Uniform top-level response envelope for all DailyKitchen API endpoints."""

    success: bool = Field(..., description="Indicates whether the request succeeded")
    data: Optional[T] = Field(None, description="Payload data when success is true")
    error: Optional[ApiError] = Field(None, description="Error payload when success is false")


class PaginationParams(BaseModel):
    """Standard pagination query parameters."""

    page: int = Field(1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(20, ge=1, le=100, description="Items per page (max 100)")
