from fastapi import APIRouter, HTTPException, status, Depends, Request
from models import UserLogin, Token, UserResponse, BusinessResponse
from auth_utils import verify_password, create_access_token, get_any_authenticated_user
from database import get_collection
from bson import ObjectId
from datetime import datetime
import logging
import uuid
from decouple import config

# Setup logging for auth debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, request: Request):
    # Generate correlation ID for this login attempt
    correlation_id = str(uuid.uuid4())[:8]
    logger.info(f"[{correlation_id}] LOGIN_START: email={user_credentials.email}, subdomain={getattr(user_credentials, 'business_subdomain', 'none')}")
    
    users_collection = await get_collection("users")
    businesses_collection = await get_collection("businesses")
    
    # Find user by email
    user = await users_collection.find_one({"email": user_credentials.email})
    if not user:
        logger.info(f"[{correlation_id}] LOGIN_FAIL: user_not_found, email={user_credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    if not verify_password(user_credentials.password, user["password"]):
        logger.info(f"[{correlation_id}] LOGIN_FAIL: invalid_password, email={user_credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    # Check if user is active
    if not user.get("is_active", True):
        logger.info(f"[{correlation_id}] LOGIN_FAIL: user_inactive, email={user_credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )
    
    # For super admin, no business context needed
    business = None
    if user["role"] != "super_admin":
        # Check business context for business admins and cashiers
        business_subdomain = getattr(request.state, 'business_subdomain', None)
        if not business_subdomain:
            business_subdomain = user_credentials.business_subdomain
            
        if business_subdomain:
            business = await businesses_collection.find_one({"subdomain": business_subdomain})
            if not business:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Business not found",
                )
            
            # Verify user belongs to this business
            if str(user.get("business_id")) != str(business["_id"]):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User does not belong to this business",
                )
            
            # Check if business is suspended (but allow login to show suspended message)
            # Business status will be checked at endpoint level
                
        elif user["role"] != "super_admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business context required",
            )
    
    # Create access token
    access_token = create_access_token(
        data={
            "sub": str(user["_id"]),
            "role": user["role"],
            "business_id": str(business["_id"]) if business else None
        }
    )
    
    # Prepare response
    user_response = UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        role=user["role"],
        business_id=str(user.get("business_id")) if user.get("business_id") else None,
        is_active=user.get("is_active", True),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow())
    )
    
    business_response = None
    if business:
        business_response = BusinessResponse(
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
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
        business=business_response
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_any_authenticated_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        role=current_user["role"],
        business_id=str(current_user.get("business_id")) if current_user.get("business_id") else None,
        is_active=current_user.get("is_active", True),
        created_at=current_user.get("created_at", datetime.utcnow()),
        updated_at=current_user.get("updated_at", datetime.utcnow())
    )