from fastapi import APIRouter, HTTPException, status, Depends, File, UploadFile
from typing import List, Optional
from models import BusinessResponse, BusinessSettings, UserCreate, UserResponse, UserRole, BusinessUpdateRequest
from auth_utils import get_business_admin_or_super, get_password_hash
from database import get_collection
from bson import ObjectId
from datetime import datetime
import os
import uuid

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

@router.put("/details")
async def update_business_details(
    business_update: BusinessUpdateRequest,
    current_user=Depends(get_business_admin_or_super)
):
    """Update business details (name, address, phone, etc.)"""
    businesses_collection = await get_collection("businesses")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business ID",
        )
    
    # Build update data
    update_data = {
        "updated_at": datetime.utcnow()
    }
    
    if business_update.name is not None:
        update_data["name"] = business_update.name
    if business_update.description is not None:
        update_data["description"] = business_update.description
    if business_update.address is not None:
        update_data["address"] = business_update.address
    if business_update.phone is not None:
        update_data["phone"] = business_update.phone
    if business_update.contact_email is not None:
        update_data["contact_email"] = business_update.contact_email
    if business_update.logo_url is not None:
        update_data["logo_url"] = business_update.logo_url
    
    result = await businesses_collection.update_one(
        {"_id": ObjectId(business_id)},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    return {"message": "Business details updated successfully"}

@router.post("/logo-upload")
async def upload_business_logo(
    file: UploadFile = File(...),
    current_user=Depends(get_business_admin_or_super)
):
    """Upload business logo"""
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business ID",
        )
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, GIF, WebP allowed"
        )
    
    # Validate file size (max 5MB)
    if file.size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 5MB"
        )
    
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = "/app/uploads/logos"
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"{business_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Generate URL (relative path for serving)
        logo_url = f"/uploads/logos/{unique_filename}"
        
        # Update business with logo URL
        businesses_collection = await get_collection("businesses")
        await businesses_collection.update_one(
            {"_id": ObjectId(business_id)},
            {
                "$set": {
                    "logo_url": logo_url,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {
            "message": "Logo uploaded successfully",
            "logo_url": logo_url
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload logo: {str(e)}"
        )

@router.delete("/logo")
async def remove_business_logo(current_user=Depends(get_business_admin_or_super)):
    """Remove business logo"""
    businesses_collection = await get_collection("businesses")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business ID",
        )
    
    # Get current logo URL to delete file
    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
    if business and business.get("logo_url"):
        # Attempt to delete file (don't fail if file doesn't exist)
        try:
            file_path = f"/app{business['logo_url']}"
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not delete logo file: {e}")
    
    # Remove logo URL from database
    await businesses_collection.update_one(
        {"_id": ObjectId(business_id)},
        {
            "$unset": {"logo_url": ""},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Logo removed successfully"}

@router.put("/settings")
async def update_business_settings(
    settings: BusinessSettings,
    current_user=Depends(get_business_admin_or_super)
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
    current_user=Depends(get_business_admin_or_super)
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
        "role": UserRole.CASHIER,
        "business_id": ObjectId(current_user["business_id"]),
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await users_collection.insert_one(user_doc)
    
    return UserResponse(
        id=str(user_doc["_id"]),
        email=user_doc["email"],
        role=user_doc["role"],
        business_id=str(user_doc["business_id"]),
        is_active=user_doc["is_active"],
        created_at=user_doc["created_at"],
        updated_at=user_doc["updated_at"]
    )

@router.get("/users", response_model=List[UserResponse])
async def get_business_users(current_user=Depends(get_business_admin_or_super)):
    users_collection = await get_collection("users")
    
    # Only business admin can view users for their business
    if current_user["role"] != "business_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business admin can view users",
        )
    
    users_cursor = users_collection.find({
        "business_id": ObjectId(current_user["business_id"]),
        "role": {"$ne": UserRole.SUPER_ADMIN}
    })
    users = await users_cursor.to_list(length=None)
    
    return [
        UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            role=user["role"],
            business_id=str(user["business_id"]),
            is_active=user["is_active"],
            created_at=user["created_at"],
            updated_at=user["updated_at"]
        )
        for user in users
    ]