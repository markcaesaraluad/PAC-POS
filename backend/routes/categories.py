from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from models import CategoryCreate, CategoryResponse
from auth_utils import get_business_admin_or_super, get_any_authenticated_user
from database import get_collection
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=CategoryResponse)
async def create_category(
    category: CategoryCreate,
    current_user=Depends(get_business_admin_or_super)
):
    categories_collection = await get_collection("categories")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Check if category name already exists in this business
    existing_category = await categories_collection.find_one({
        "business_id": ObjectId(business_id),
        "name": category.name
    })
    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name already exists",
        )
    
    category_doc = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "name": category.name,
        "description": category.description,
        "color": category.color,
        "created_at": datetime.utcnow()
    }
    
    await categories_collection.insert_one(category_doc)
    
    return CategoryResponse(
        id=str(category_doc["_id"]),
        business_id=str(category_doc["business_id"]),
        name=category_doc["name"],
        description=category_doc["description"],
        color=category_doc["color"],
        product_count=0,
        created_at=category_doc["created_at"]
    )

@router.get("/", response_model=List[CategoryResponse])
async def get_categories(current_user=Depends(get_any_authenticated_user)):
    categories_collection = await get_collection("categories")
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    categories_cursor = categories_collection.find({"business_id": ObjectId(business_id)})
    categories = await categories_cursor.to_list(length=None)
    
    # Get product counts for each category
    category_responses = []
    for category in categories:
        product_count = await products_collection.count_documents({
            "category_id": category["_id"],
            "business_id": ObjectId(business_id),
            "is_active": True
        })
        
        category_responses.append(CategoryResponse(
            id=str(category["_id"]),
            business_id=str(category["business_id"]),
            name=category["name"],
            description=category.get("description"),
            color=category.get("color", "#3B82F6"),
            product_count=product_count,
            created_at=category.get("created_at", datetime.utcnow())
        ))
    
    return category_responses

@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    current_user=Depends(get_any_authenticated_user)
):
    categories_collection = await get_collection("categories")
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    
    category = await categories_collection.find_one({
        "_id": ObjectId(category_id),
        "business_id": ObjectId(business_id)
    })
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    
    product_count = await products_collection.count_documents({
        "category_id": ObjectId(category_id),
        "business_id": ObjectId(business_id),
        "is_active": True
    })
    
    return CategoryResponse(
        id=str(category["_id"]),
        business_id=str(category["business_id"]),
        name=category["name"],
        description=category.get("description"),
        color=category.get("color", "#3B82F6"),
        product_count=product_count,
        created_at=category.get("created_at", datetime.utcnow())
    )

@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    category_update: CategoryCreate,
    current_user=get_business_admin_or_super()
):
    categories_collection = await get_collection("categories")
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Check if new name conflicts with existing category (exclude current category)
    existing_category = await categories_collection.find_one({
        "business_id": ObjectId(business_id),
        "name": category_update.name,
        "_id": {"$ne": ObjectId(category_id)}
    })
    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name already exists",
        )
    
    result = await categories_collection.update_one(
        {
            "_id": ObjectId(category_id),
            "business_id": ObjectId(business_id)
        },
        {
            "$set": {
                "name": category_update.name,
                "description": category_update.description,
                "color": category_update.color
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    
    # Get product count
    product_count = await products_collection.count_documents({
        "category_id": ObjectId(category_id),
        "business_id": ObjectId(business_id),
        "is_active": True
    })
    
    return CategoryResponse(
        id=category_id,
        business_id=str(business_id),
        name=category_update.name,
        description=category_update.description,
        color=category_update.color,
        product_count=product_count,
        created_at=datetime.utcnow()  # This should be fetched from DB in real implementation
    )

@router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    current_user=get_business_admin_or_super()
):
    categories_collection = await get_collection("categories")
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Check if category has products
    product_count = await products_collection.count_documents({
        "category_id": ObjectId(category_id),
        "business_id": ObjectId(business_id),
        "is_active": True
    })
    
    if product_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete category with {product_count} products. Move products to another category first.",
        )
    
    result = await categories_collection.delete_one({
        "_id": ObjectId(category_id),
        "business_id": ObjectId(business_id)
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    
    return {"message": "Category deleted successfully"}