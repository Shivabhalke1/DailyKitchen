import os
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, Response

from backend.app.core.config import settings
from backend.app.api.deps import get_db
from backend.app.api.v1.api import api_router
from backend.app.db.session import engine
from backend.app.db.base import Base
from backend.app.models.catalog import UploadedImage


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure upload directories exist
    upload_dir = os.path.join(os.getcwd(), "uploads")
    os.makedirs(os.path.join(upload_dir, "catalog"), exist_ok=True)

    # Startup: ensure tables exist and schema migrations are applied
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if "sqlite" in settings.DATABASE_URL:
            try:
                await conn.execute(text("ALTER TABLE categories ADD COLUMN default_price NUMERIC(10, 2)"))
            except Exception:
                pass
        else:
            try:
                await conn.execute(text("ALTER TABLE categories ADD COLUMN IF NOT EXISTS default_price NUMERIC(10, 2)"))
            except Exception:
                pass
    yield
    # Shutdown: clean up DB connections
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Persistent catalog image serving (serves from local cache or database fallback)
@app.get("/uploads/catalog/{filename}")
async def get_catalog_image(filename: str, db: AsyncSession = Depends(get_db)):
    # 1. Fast local disk cache check
    local_path = os.path.join(os.getcwd(), "uploads", "catalog", filename)
    if os.path.exists(local_path):
        return FileResponse(
            local_path,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    # 2. Database lookup (persisted permanently across Render sleep cycles / redeploys)
    stmt = select(UploadedImage).where(UploadedImage.filename == filename)
    res = await db.execute(stmt)
    record = res.scalar_one_or_none()
    if record:
        # Re-write to local disk cache for subsequent requests
        try:
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(record.data)
        except Exception:
            pass
        return Response(
            content=record.data,
            media_type=record.content_type,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    return JSONResponse(status_code=404, content={"detail": "Image not found"})


# Mount local uploads directory for any other static files
upload_dir = os.path.join(os.getcwd(), "uploads")
os.makedirs(os.path.join(upload_dir, "catalog"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")


# Enforce security headers
app.add_middleware(SecurityHeadersMiddleware)

# Explicit approved CORS configuration supporting all production and preview Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        headers["Access-Control-Allow-Headers"] = "*"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers=headers,
    )

# Mount versioned API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": f"{settings.API_V1_STR}/docs",
        "health_url": f"{settings.API_V1_STR}/health",
    }
