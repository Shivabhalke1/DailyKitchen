import json
import os
from pathlib import Path
from backend.app.main import app


def export_openapi():
    """Export FastAPI OpenAPI 3.1 schema to docs/contracts/openapi.json."""
    openapi_schema = app.openapi()
    
    # Target directory
    repo_root = Path(__file__).resolve().parents[3]
    out_dir = repo_root / "docs" / "contracts"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    out_file = out_dir / "openapi.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, indent=2)
    
    print(f"Exported OpenAPI schema to {out_file}")


if __name__ == "__main__":
    export_openapi()
