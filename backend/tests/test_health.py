import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_returns_healthy(client: AsyncClient):
    """Verify that /api/v1/health returns HTTP 200 with healthy service status."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "DailyKitchen API"
    assert data["database"] == "healthy"
    assert "version" in data
    assert "environment" in data
    assert data["rules"]["free_delivery_threshold"] == 99.0
    assert data["rules"]["standard_delivery_fee"] == 40.0
    assert data["rules"]["packaging_fee"] == 10.0


@pytest.mark.asyncio
async def test_root_returns_status(client: AsyncClient):
    """Verify root endpoint provides discovery links."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["docs_url"] == "/api/v1/docs"
    assert data["health_url"] == "/api/v1/health"


@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient):
    """Verify standard security headers are injected into HTTP responses."""
    response = await client.get("/api/v1/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
