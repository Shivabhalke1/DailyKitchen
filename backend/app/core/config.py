from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "DailyKitchen API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Security secrets (strictly separated)
    SECRET_KEY: str = "dailykitchen-insecure-dev-app-secret-do-not-use-in-production"
    JWT_SECRET_KEY: str = "dailykitchen-insecure-dev-jwt-secret-do-not-use-in-production"
    OTP_SECRET: str = "dailykitchen-insecure-dev-otp-secret-do-not-use-in-production"

    # JWT Configuration (pinned algorithm & claims)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7     # 7 days
    JWT_ISSUER: str = "dailykitchen"
    JWT_AUDIENCE: str = "dailykitchen-client"

    # OTP Lifecycle Configuration
    OTP_EXPIRE_MINUTES: int = 5            # Strictly 5 minutes
    OTP_COOLDOWN_SECONDS: int = 60         # 60s cooldown
    OTP_MAX_ATTEMPTS: int = 3              # Max 3 attempts
    OTP_RATE_LIMIT_MAX_REQUESTS: int = 5   # Max 5 requests
    OTP_RATE_LIMIT_WINDOW_MINUTES: int = 10# per 10-minute window

    # Database connection string
    DATABASE_URL: str = "sqlite+aiosqlite:///./dailykitchen.db"

    # Explicit approved CORS Origins
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8081",
    ]

    # Authoritative pricing rules
    PACKAGING_FEE: float = 10.0
    STANDARD_DELIVERY_FEE: float = 40.0
    FREE_DELIVERY_THRESHOLD: float = 99.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """
        Enforce that production environments NEVER use default, insecure, or shared secrets.
        """
        if self.ENVIRONMENT.lower() == "production":
            insecure_markers = ["insecure", "change-this", "dev-secret", "default", "secret"]
            secrets_to_check = [
                ("SECRET_KEY", self.SECRET_KEY),
                ("JWT_SECRET_KEY", self.JWT_SECRET_KEY),
                ("OTP_SECRET", self.OTP_SECRET),
            ]
            for name, val in secrets_to_check:
                if (
                    not val
                    or len(val) < 32
                    or any(marker in val.lower() for marker in insecure_markers)
                ):
                    raise ValueError(
                        f"FATAL SECURITY MISCONFIGURATION: In production mode, {name} must be set "
                        "via environment variables with at least 32 characters of high-entropy randomness."
                    )
            # Secrets must be distinct
            if len({self.SECRET_KEY, self.JWT_SECRET_KEY, self.OTP_SECRET}) < 3:
                raise ValueError("FATAL SECURITY MISCONFIGURATION: SECRET_KEY, JWT_SECRET_KEY, and OTP_SECRET must all be distinct.")

            if self.DEBUG:
                raise ValueError("FATAL SECURITY MISCONFIGURATION: DEBUG must be set to False in production.")
        return self


settings = Settings()
