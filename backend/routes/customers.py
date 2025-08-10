from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models import CustomerCreate, CustomerResponse
from auth_utils import get_business_admin_or_super, get_any_authenticated_user
from database import get_collection
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.post("", response_model=CustomerResponse)
async def create_customer(
    customer: CustomerCreate,
    current_user=Depends(get_business_admin_or_super)
):
    customers_collection = await get_collection("customers")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Check if customer email already exists in this business (if provided)
    if customer.email:
        existing_customer = await customers_collection.find_one({
            "business_id": ObjectId(business_id),
            "email": customer.email
        })
        if existing_customer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer email already exists",
            )
    
    customer_doc = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "total_spent": 0.0,
        "visit_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await customers_collection.insert_one(customer_doc)
    
    return CustomerResponse(
        id=str(customer_doc["_id"]),
        business_id=str(customer_doc["business_id"]),
        name=customer_doc["name"],
        email=customer_doc["email"],
        phone=customer_doc["phone"],
        address=customer_doc["address"],
        total_spent=customer_doc["total_spent"],
        visit_count=customer_doc["visit_count"],
        created_at=customer_doc["created_at"],
        updated_at=customer_doc["updated_at"]
    )

@router.get("", response_model=List[CustomerResponse])
async def get_customers(
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    current_user=Depends(get_any_authenticated_user)
):
    customers_collection = await get_collection("customers")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Build query
    query = {"business_id": ObjectId(business_id)}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    customers_cursor = customers_collection.find(query).skip(skip).limit(limit)
    customers = await customers_cursor.to_list(length=None)
    
    return [
        CustomerResponse(
            id=str(customer["_id"]),
            business_id=str(customer["business_id"]),
            name=customer["name"],
            email=customer.get("email"),
            phone=customer.get("phone"),
            address=customer.get("address"),
            total_spent=customer.get("total_spent", 0.0),
            visit_count=customer.get("visit_count", 0),
            created_at=customer.get("created_at", datetime.utcnow())
        )
        for customer in customers
    ]

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    current_user=Depends(get_any_authenticated_user)
):
    customers_collection = await get_collection("customers")
    
    business_id = current_user["business_id"]
    
    customer = await customers_collection.find_one({
        "_id": ObjectId(customer_id),
        "business_id": ObjectId(business_id)
    })
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    
    return CustomerResponse(
        id=str(customer["_id"]),
        business_id=str(customer["business_id"]),
        name=customer["name"],
        email=customer.get("email"),
        phone=customer.get("phone"),
        address=customer.get("address"),
        total_spent=customer.get("total_spent", 0.0),
        visit_count=customer.get("visit_count", 0),
        created_at=customer.get("created_at", datetime.utcnow())
    )

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_update: CustomerCreate,
    current_user=Depends(get_business_admin_or_super)
):
    customers_collection = await get_collection("customers")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Check if new email conflicts with existing customer (exclude current customer)
    if customer_update.email:
        existing_customer = await customers_collection.find_one({
            "business_id": ObjectId(business_id),
            "email": customer_update.email,
            "_id": {"$ne": ObjectId(customer_id)}
        })
        if existing_customer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer email already exists",
            )
    
    result = await customers_collection.update_one(
        {
            "_id": ObjectId(customer_id),
            "business_id": ObjectId(business_id)
        },
        {
            "$set": {
                "name": customer_update.name,
                "email": customer_update.email,
                "phone": customer_update.phone,
                "address": customer_update.address
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    
    # Return updated customer
    updated_customer = await customers_collection.find_one({
        "_id": ObjectId(customer_id),
        "business_id": ObjectId(business_id)
    })
    
    return CustomerResponse(
        id=str(updated_customer["_id"]),
        business_id=str(updated_customer["business_id"]),
        name=updated_customer["name"],
        email=updated_customer.get("email"),
        phone=updated_customer.get("phone"),
        address=updated_customer.get("address"),
        total_spent=updated_customer.get("total_spent", 0.0),
        visit_count=updated_customer.get("visit_count", 0),
        created_at=updated_customer.get("created_at", datetime.utcnow())
    )

@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    current_user=Depends(get_business_admin_or_super)
):
    customers_collection = await get_collection("customers")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    result = await customers_collection.delete_one({
        "_id": ObjectId(customer_id),
        "business_id": ObjectId(business_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    
    return {"message": "Customer deleted successfully"}