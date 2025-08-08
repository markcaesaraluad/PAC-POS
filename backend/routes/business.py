from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from models import BusinessResponse, BusinessSettings, UserCreate, UserResponse, UserRole
from auth_utils import get_business_admin_or_super, get_password_hash
from database import get_collection
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.get("/info", response_model=BusinessResponse)
async def get_business_info(current_user=Depends(get_business_admin_or_super)):
    businesses_collection = await get_collection("businesses")
    
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business ID",
        )
    
    business = await businesses_collection.find_one({"_id": ObjectId(current_user["business_id"])})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found",
        )
    
    return BusinessResponse(
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

@router.put("/settings")
async def update_business_settings(
    settings: BusinessSettings,
    current_user=get_business_admin_or_super()
):
    businesses_collection = await get_collection("businesses")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business ID",
        )
    
    result = await businesses_collection.update_one(
        {"_id": ObjectId(business_id)},
        {
            "$set": {
                "settings": settings.dict(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found",
        )
    
    return {"message": "Settings updated successfully"}

@router.post("/users", response_model=UserResponse)
async def create_cashier(
    user_data: UserCreate,
    current_user=get_business_admin_or_super()
):
    users_collection = await get_collection("users")
    
    # Only business admin can create users for their business
    if current_user["role"] != "business_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business admin can create cashiers",
        )
    
    # Check if user email already exists
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )
    
    # Create cashier user
    user_doc = {
        "_id": ObjectId(),
        "email": user_data.email,
        "password": get_password_hash(user_data.password),
        "full_name": user_data.full_name,
        "role": UserRole.CASHIER,
        "business_id": ObjectId(current_user["business_id"]),
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    await users_collection.insert_one(user_doc)
    
    return UserResponse(
        id=str(user_doc["_id"]),
        email=user_doc["email"],
        full_name=user_doc["full_name"],
        role=user_doc["role"],
        business_id=str(user_doc["business_id"]),
        is_active=user_doc["is_active"],
        created_at=user_doc["created_at"]
    )

@router.get("/users", response_model=List[UserResponse])
async def get_business_users(current_user=get_business_admin_or_super()):
    users_collection = await get_collection("users")
    
    if current_user["role"] != "business_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business admin can view users",
        )
    
    users_cursor = users_collection.find({"business_id": ObjectId(current_user["business_id"])})
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

@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    status_data: dict,
    current_user=get_business_admin_or_super()
):
    users_collection = await get_collection("users")
    
    if current_user["role"] != "business_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business admin can modify users",
        )
    
    result = await users_collection.update_one(
        {
            "_id": ObjectId(user_id),
            "business_id": ObjectId(current_user["business_id"])
        },
        {"$set": {"is_active": status_data["is_active"]}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {"message": "User status updated successfully"}