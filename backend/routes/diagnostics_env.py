from fastapi import APIRouter
from decouple import config
import os
from typing import Dict, Any
from database import get_collection
import logging

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get("/env-summary")
async def get_environment_summary() -> Dict[str, Any]:
    """
    Get safe environment summary for debugging deployment issues.
    DOES NOT EXPOSE SECRETS - only configuration that helps debug deployment.
    """
    
    return {
        "environment": {
            "NODE_ENV": config("NODE_ENV", default="development"),
            "ENVIRONMENT": config("ENVIRONMENT", default="preview"),
            "is_production": config("NODE_ENV", default="development") == "production"
        },
        "api_config": {
            "backend_internal_port": "8001",
            "frontend_backend_url_expected": config("FRONTEND_BACKEND_URL", default="not_set"),
            "api_base_path": "/api"
        },
        "cors_config": {
            "cors_origins": config("CORS_ALLOWED_ORIGINS", default="*"),
            "credentials_enabled": True,
            "note": "CORS origins should be specific domains in production"
        },
        "cookie_config": {
            "secure": config("COOKIE_SECURE", default="false", cast=bool),
            "same_site": config("COOKIE_SAMESITE", default="Lax"),
            "domain": config("COOKIE_DOMAIN", default="not_set"),
            "note": "Secure should be true in production HTTPS"
        },
        "auth_config": {
            "algorithm": config("ALGORITHM", default="HS256"),
            "token_expire_minutes": config("ACCESS_TOKEN_EXPIRE_MINUTES", default=30, cast=int),
            "jwt_secret_configured": "yes" if config("SECRET_KEY", default="").strip() else "no"
        },
        "database": {
            "mongo_configured": "yes" if config("MONGO_URL", default="").strip() else "no",
            "connection_string_type": "local" if "localhost" in config("MONGO_URL", default="") else "remote"
        },
        "proxy_headers": {
            "trust_proxy_enabled": config("TRUST_PROXY", default="false", cast=bool),
            "note": "Should be true if behind reverse proxy/load balancer"
        }
    }