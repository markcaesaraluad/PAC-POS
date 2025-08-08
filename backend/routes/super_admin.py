from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from models import BusinessCreate, BusinessResponse, UserResponse, UserRole, BusinessStatus
from auth_utils import get_super_admin, get_password_hash
from database import get_collection
from bson import ObjectId
from datetime import datetime
import uuid

router = APIRouter()

@router.post("/businesses", response_model=BusinessResponse)
async def create_business(
    business_data: BusinessCreate,
    current_user=Depends(get_super_admin)
):
    businesses_collection = await get_collection("businesses")
    users_collection = await get_collection("users")
    
    # Check if subdomain already exists
    existing_business = await businesses_collection.find_one({"subdomain": business_data.subdomain})
    if existing_business:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subdomain already exists",
        )
    
    # Check if admin email already exists
    existing_user = await users_collection.find_one({"email": business_data.admin_email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin email already exists",
        )
    
    # Create business document
    business_doc = {
        "_id": ObjectId(),
        "name": business_data.name,
        "description": business_data.description,
        "subdomain": business_data.subdomain.lower(),
        "contact_email": business_data.contact_email,
        "phone": business_data.phone,
        "address": business_data.address,
        "status": BusinessStatus.ACTIVE,
        "logo_url": None,
        "settings": {
            "currency": "USD",
            "tax_rate": 0.0,
            "receipt_header": f"Welcome to {business_data.name}",
            "receipt_footer": "Thank you for your business!",
            "low_stock_threshold": 10,
            "printer_settings": {}
        },
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert business
    await businesses_collection.insert_one(business_doc)
    
    # Create business admin user
    admin_doc = {
        "_id": ObjectId(),
        "email": business_data.admin_email,
        "password": get_password_hash(business_data.admin_password),
        "full_name": business_data.admin_name,
        "role": UserRole.BUSINESS_ADMIN,
        "business_id": business_doc["_id"],
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    await users_collection.insert_one(admin_doc)
    
    return BusinessResponse(
        id=str(business_doc["_id"]),
        name=business_doc["name"],
        description=business_doc["description"],
        subdomain=business_doc["subdomain"],
        contact_email=business_doc["contact_email"],
        phone=business_doc["phone"],
        address=business_doc["address"],
        status=business_doc["status"],
        logo_url=business_doc["logo_url"],
        settings=business_doc["settings"],
        created_at=business_doc["created_at"],
        updated_at=business_doc["updated_at"]
    )

@router.get("/businesses", response_model=List[BusinessResponse])
async def list_businesses(current_user=Depends(get_super_admin)):
    businesses_collection = await get_collection("businesses")
    businesses_cursor = businesses_collection.find({})
    businesses = await businesses_cursor.to_list(length=None)
    
    return [
        BusinessResponse(
            id=str(business["_id"]),
            name=business["name"],
            description=business.get("description"),
            subdomain=business["subdomain"],
            contact_email=business["contact_email"],
            phone=business.get("phone"),
            address=business.get("address"),
            status=business.get("status", "active"),
            logo_url=business.get("logo_url"),
            settings=business.get("settings", {}),
            created_at=business.get("created_at", datetime.utcnow()),
            updated_at=business.get("updated_at", datetime.utcnow())
        )
        for business in businesses
    ]

@router.put("/businesses/{business_id}/status")
async def update_business_status(
    business_id: str,
    status_update: dict,
    current_user=get_super_admin()
):
    businesses_collection = await get_collection("businesses")
    
    result = await businesses_collection.update_one(
        {"_id": ObjectId(business_id)},
        {
            "$set": {
                "status": status_update["status"],
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found",
        )
    
    return {"message": "Business status updated successfully"}

@router.get("/businesses/{business_id}/users", response_model=List[UserResponse])
async def get_business_users(
    business_id: str,
    current_user=get_super_admin()
):
    users_collection = await get_collection("users")
    users_cursor = users_collection.find({"business_id": ObjectId(business_id)})
    users = await users_cursor.to_list(length=None)
    
    return [
        UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            full_name=user["full_name"],
            role=user["role"],
            business_id=str(user["business_id"]),
            is_active=user.get("is_active", True),
            created_at=user.get("created_at", datetime.utcnow())
        )
        for user in users
    ]