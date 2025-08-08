from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models import ProductCreate, ProductResponse, ProductUpdate
from auth_utils import get_business_admin_or_super, get_any_authenticated_user
from database import get_collection
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.post("", response_model=ProductResponse)
async def create_product(
    product: ProductCreate,
    current_user=Depends(get_business_admin_or_super)
):
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Check if SKU already exists in this business
    existing_product = await products_collection.find_one({
        "business_id": ObjectId(business_id),
        "sku": product.sku
    })
    if existing_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SKU already exists",
        )
    
    # Check if barcode already exists (if provided)
    if product.barcode:
        existing_barcode = await products_collection.find_one({
            "business_id": ObjectId(business_id),
            "barcode": product.barcode
        })
        if existing_barcode:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Barcode already exists",
            )
    
    product_doc = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "name": product.name,
        "description": product.description,
        "sku": product.sku,
        "barcode": product.barcode,
        "category_id": ObjectId(product.category_id) if product.category_id else None,
        "price": product.price,
        "cost": product.cost,
        "quantity": product.quantity,
        "image_url": product.image_url,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await products_collection.insert_one(product_doc)
    
    return ProductResponse(
        id=str(product_doc["_id"]),
        business_id=str(product_doc["business_id"]),
        name=product_doc["name"],
        description=product_doc["description"],
        sku=product_doc["sku"],
        barcode=product_doc["barcode"],
        category_id=str(product_doc["category_id"]) if product_doc["category_id"] else None,
        price=product_doc["price"],
        cost=product_doc["cost"],
        quantity=product_doc["quantity"],
        image_url=product_doc["image_url"],
        is_active=product_doc["is_active"],
        created_at=product_doc["created_at"],
        updated_at=product_doc["updated_at"]
    )

@router.get("", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(False),
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    current_user=Depends(get_any_authenticated_user)
):
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Build query
    query = {
        "business_id": ObjectId(business_id),
        "is_active": True
    }
    
    if category_id:
        query["category_id"] = ObjectId(category_id)
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}}
        ]
    
    if low_stock:
        # Get business settings for low stock threshold
        businesses_collection = await get_collection("businesses")
        business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
        threshold = business.get("settings", {}).get("low_stock_threshold", 10)
        query["quantity"] = {"$lte": threshold}
    
    products_cursor = products_collection.find(query).skip(skip).limit(limit)
    products = await products_cursor.to_list(length=None)
    
    return [
        ProductResponse(
            id=str(product["_id"]),
            business_id=str(product["business_id"]),
            name=product["name"],
            description=product.get("description"),
            sku=product["sku"],
            barcode=product.get("barcode"),
            category_id=str(product["category_id"]) if product.get("category_id") else None,
            price=product["price"],
            cost=product.get("cost"),
            quantity=product["quantity"],
            image_url=product.get("image_url"),
            is_active=product.get("is_active", True),
            created_at=product.get("created_at", datetime.utcnow()),
            updated_at=product.get("updated_at", datetime.utcnow())
        )
        for product in products
    ]

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    current_user=Depends(get_any_authenticated_user)
):
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    
    product = await products_collection.find_one({
        "_id": ObjectId(product_id),
        "business_id": ObjectId(business_id)
    })
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    return ProductResponse(
        id=str(product["_id"]),
        business_id=str(product["business_id"]),
        name=product["name"],
        description=product.get("description"),
        sku=product["sku"],
        barcode=product.get("barcode"),
        category_id=str(product["category_id"]) if product.get("category_id") else None,
        price=product["price"],
        cost=product.get("cost"),
        quantity=product["quantity"],
        image_url=product.get("image_url"),
        is_active=product.get("is_active", True),
        created_at=product.get("created_at", datetime.utcnow()),
        updated_at=product.get("updated_at", datetime.utcnow())
    )

@router.get("/barcode/{barcode}", response_model=ProductResponse)
async def get_product_by_barcode(
    barcode: str,
    current_user=Depends(get_any_authenticated_user)
):
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    
    product = await products_collection.find_one({
        "barcode": barcode,
        "business_id": ObjectId(business_id),
        "is_active": True
    })
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    return ProductResponse(
        id=str(product["_id"]),
        business_id=str(product["business_id"]),
        name=product["name"],
        description=product.get("description"),
        sku=product["sku"],
        barcode=product.get("barcode"),
        category_id=str(product["category_id"]) if product.get("category_id") else None,
        price=product["price"],
        cost=product.get("cost"),
        quantity=product["quantity"],
        image_url=product.get("image_url"),
        is_active=product.get("is_active", True),
        created_at=product.get("created_at", datetime.utcnow()),
        updated_at=product.get("updated_at", datetime.utcnow())
    )

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    product_update: ProductUpdate,
    current_user=Depends(get_business_admin_or_super)
):
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Build update data
    update_data = {k: v for k, v in product_update.dict(exclude_unset=True).items()}
    if update_data:
        update_data["updated_at"] = datetime.utcnow()
    
    result = await products_collection.update_one(
        {
            "_id": ObjectId(product_id),
            "business_id": ObjectId(business_id)
        },
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    # Return updated product
    updated_product = await products_collection.find_one({
        "_id": ObjectId(product_id),
        "business_id": ObjectId(business_id)
    })
    
    return ProductResponse(
        id=str(updated_product["_id"]),
        business_id=str(updated_product["business_id"]),
        name=updated_product["name"],
        description=updated_product.get("description"),
        sku=updated_product["sku"],
        barcode=updated_product.get("barcode"),
        category_id=str(updated_product["category_id"]) if updated_product.get("category_id") else None,
        price=updated_product["price"],
        cost=updated_product.get("cost"),
        quantity=updated_product["quantity"],
        image_url=updated_product.get("image_url"),
        is_active=updated_product.get("is_active", True),
        created_at=updated_product.get("created_at", datetime.utcnow()),
        updated_at=updated_product.get("updated_at", datetime.utcnow())
    )