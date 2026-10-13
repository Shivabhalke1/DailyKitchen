from backend.app.models.base import Base, TimestampMixin, generate_uuid
import backend.app.models  # Ensures all 18 models are loaded and registered on Base.metadata

__all__ = ["Base", "TimestampMixin", "generate_uuid"]
