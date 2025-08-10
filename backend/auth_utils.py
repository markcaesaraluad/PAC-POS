from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from decouple import config
from models import UserRole
from database import get_collection
from bson import ObjectId

# Security configuration
SECRET_KEY = config("SECRET_KEY")
ALGORITHM = config("ALGORITHM", default="HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(config("ACCESS_TOKEN_EXPIRE_MINUTES", default="30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

async def get_current_user(token_data=Depends(verify_token)):
    users_collection = await get_collection("users")
    user = await users_collection.find_one({"_id": ObjectId(token_data["sub"])})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    # Add business_id from token to user object if present
    if token_data.get("business_id"):
        user["business_id"] = token_data["business_id"]
    
    return user

async def check_business_status(current_user=Depends(get_current_user)):
    """
    Check if business is active and user has access.
    Super Admin can access any business regardless of status.
    """
    # Super Admin can access any business
    if current_user["role"] == UserRole.SUPER_ADMIN:
        return current_user
    
    # If user has business_id, check business status
    if current_user.get("business_id"):
        businesses_collection = await get_collection("businesses")
        business = await businesses_collection.find_one({"_id": ObjectId(current_user["business_id"])})
        
        if not business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business not found",
            )
        
        # Block access if business is suspended
        if business.get("status") == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Business is suspended",
            )
    
    return current_user

async def require_role(required_roles: list):
    def role_checker(current_user=Depends(get_current_user)):
        if current_user["role"] not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user
    return role_checker

# Role-specific dependencies
async def get_super_admin(current_user=Depends(get_current_user)):
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user

async def get_business_admin_or_super(current_user=Depends(get_current_user)):
    if current_user["role"] not in [UserRole.SUPER_ADMIN, UserRole.BUSINESS_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user

async def get_any_authenticated_user(current_user=Depends(get_current_user)):
    return current_user