from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.proxy_headers import ProxyHeadersMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from typing import Optional, List
import os
from decouple import config
import asyncio

# Import route modules
from routes import auth, super_admin, business, products, categories, customers, sales, invoices, reports, profit_reports, diagnostics
from routes import diagnostics_env, test_post
from database import connect_to_mongo, close_mongo_connection

# Import error handling middleware
from middleware.error_handler import setup_error_handling
from decouple import config

app = FastAPI(title="Modern POS System", version="1.0.0")

# Setup global error handling (must be before other middleware)
setup_error_handling(app)

# CORS middleware - Environment-aware configuration
cors_origins = config("CORS_ALLOWED_ORIGINS", default="*")
if cors_origins == "*":
    # Development/preview mode - allow all origins
    allowed_origins = ["*"]
else:
    # Production mode - use specific origins
    allowed_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount static files for logo uploads
if not os.path.exists("/app/uploads"):
    os.makedirs("/app/uploads", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

# Security
security = HTTPBearer()

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Trust proxy configuration for production deployment
trust_proxy = config("TRUST_PROXY", default="false", cast=bool)

# Middleware for proxy headers (if behind reverse proxy/load balancer)
@app.middleware("http")
async def handle_proxy_headers(request: Request, call_next):
    if trust_proxy:
        # Handle X-Forwarded-* headers from reverse proxy
        forwarded_proto = request.headers.get("X-Forwarded-Proto")
        forwarded_host = request.headers.get("X-Forwarded-Host")
        
        if forwarded_proto:
            request.scope["scheme"] = forwarded_proto
        if forwarded_host:
            request.scope["server"] = (forwarded_host, None)
            
    response = await call_next(request)
    return response

# Middleware for multi-tenant support
@app.middleware("http")
async def add_business_context(request: Request, call_next):
    # For API calls, don't set business context from subdomain
    # Let the authentication endpoints handle business context from request body
    if request.url.path.startswith("/api/"):
        request.state.business_subdomain = None
    else:
        # Extract subdomain from host for non-API requests
        host = request.headers.get("host", "").lower()
        if "." in host:
            subdomain = host.split(".")[0]
            if subdomain not in ["www", "api"]:
                request.state.business_subdomain = subdomain
            else:
                request.state.business_subdomain = None
        else:
            request.state.business_subdomain = None
    
    response = await call_next(request)
    return response

# Include routers with API prefix
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(super_admin.router, prefix="/api/super-admin", tags=["Super Admin"])
app.include_router(business.router, prefix="/api/business", tags=["Business"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
app.include_router(invoices.router, prefix="/api/invoices", tags=["Invoices"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(profit_reports.router, prefix="/api/reports", tags=["Profit Reports"])
app.include_router(diagnostics.router, tags=["Diagnostics"])  # Admin-only diagnostics
app.include_router(diagnostics_env.router, prefix="/api/_diag", tags=["Auth Diagnostics"])  # Authentication debugging
app.include_router(test_post.router, prefix="/api/_test", tags=["Test POST Endpoint"])  # POST testing

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Modern POS System is running"}

@app.get("/")
async def root():
    return {"message": "Modern POS System API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)