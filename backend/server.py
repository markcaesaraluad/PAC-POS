from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from typing import Optional, List
import os
from decouple import config
import asyncio

# Import route modules
from routes import auth, super_admin, business, products, categories, customers, sales
from database import connect_to_mongo, close_mongo_connection

app = FastAPI(title="Modern POS System", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Middleware for multi-tenant support
@app.middleware("http")
async def add_business_context(request: Request, call_next):
    # Extract subdomain from host
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

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Modern POS System is running"}

@app.get("/")
async def root():
    return {"message": "Modern POS System API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)