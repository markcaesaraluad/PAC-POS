from fastapi import APIRouter, HTTPException, status, Depends, Query, File, UploadFile
from typing import List, Optional
from models import ProductCreate, ProductResponse, ProductUpdate, ProductCostHistoryResponse, StockAdjustmentCreate, BulkImportResponse, LabelPrintOptions, BarcodeGenerateRequest
from auth_utils import get_business_admin_or_super, get_any_authenticated_user
from database import get_collection
from bson import ObjectId
from datetime import datetime
import uuid
import io
import pandas as pd
from fastapi.responses import StreamingResponse

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
        "product_cost": product.product_cost,
        "quantity": product.quantity,
        "image_url": product.image_url,
        "brand": product.brand,
        "supplier": product.supplier,
        "low_stock_threshold": product.low_stock_threshold,
        "status": product.status,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await products_collection.insert_one(product_doc)
    
    # Create initial cost history entry
    cost_history_collection = await get_collection("product_cost_history")
    cost_history_doc = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "product_id": product_doc["_id"],
        "cost": product.product_cost,
        "effective_from": datetime.utcnow(),
        "changed_by": ObjectId(current_user["_id"]),
        "notes": "Initial cost entry",
        "created_at": datetime.utcnow()
    }
    await cost_history_collection.insert_one(cost_history_doc)
    
    return ProductResponse(
        id=str(product_doc["_id"]),
        business_id=str(product_doc["business_id"]),
        name=product_doc["name"],
        description=product_doc["description"],
        sku=product_doc["sku"],
        barcode=product_doc["barcode"],
        category_id=str(product_doc["category_id"]) if product_doc["category_id"] else None,
        price=product_doc["price"],
        product_cost=product_doc["product_cost"],
        quantity=product_doc["quantity"],
        image_url=product_doc["image_url"],
        brand=product_doc["brand"],
        supplier=product_doc["supplier"],
        low_stock_threshold=product_doc["low_stock_threshold"],
        status=product_doc["status"],
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
            product_cost=product.get("product_cost"),
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
        product_cost=product.get("product_cost"),
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
        product_cost=product.get("product_cost"),
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
    
    # Check if cost is being updated to create history entry
    cost_changed = False
    if 'product_cost' in update_data:
        # Get current product to compare costs
        current_product = await products_collection.find_one({
            "_id": ObjectId(product_id),
            "business_id": ObjectId(business_id)
        })
        
        if current_product and current_product.get("product_cost") != update_data["product_cost"]:
            cost_changed = True
            new_cost = update_data["product_cost"]
    
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
    
    # Create cost history entry if cost changed
    if cost_changed:
        cost_history_collection = await get_collection("product_cost_history")
        cost_history_doc = {
            "_id": ObjectId(),
            "business_id": ObjectId(business_id),
            "product_id": ObjectId(product_id),
            "cost": new_cost,
            "effective_from": datetime.utcnow(),
            "changed_by": ObjectId(current_user["_id"]),
            "notes": "Cost updated via product management",
            "created_at": datetime.utcnow()
        }
        await cost_history_collection.insert_one(cost_history_doc)
    
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
        product_cost=updated_product.get("product_cost"),
        quantity=updated_product["quantity"],
        image_url=updated_product.get("image_url"),
        is_active=updated_product.get("is_active", True),
        created_at=updated_product.get("created_at", datetime.utcnow()),
        updated_at=updated_product.get("updated_at", datetime.utcnow())
    )

@router.get("/{product_id}/cost-history", response_model=List[ProductCostHistoryResponse])
async def get_product_cost_history(
    product_id: str,
    current_user=Depends(get_business_admin_or_super)
):
    """Get cost history for a product - Admin only"""
    products_collection = await get_collection("products")
    cost_history_collection = await get_collection("product_cost_history")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Verify product exists and belongs to business
    product = await products_collection.find_one({
        "_id": ObjectId(product_id),
        "business_id": ObjectId(business_id)
    })
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    
    # Get cost history sorted by effective_from descending (newest first)
    history_cursor = cost_history_collection.find({
        "product_id": ObjectId(product_id),
        "business_id": ObjectId(business_id)
    }).sort("effective_from", -1)
    
    history_records = await history_cursor.to_list(length=None)
    
    return [
        ProductCostHistoryResponse(
            id=str(record["_id"]),
            business_id=str(record["business_id"]),
            product_id=str(record["product_id"]),
            cost=record["cost"],
            effective_from=record["effective_from"],
            changed_by=str(record["changed_by"]),
            notes=record.get("notes"),
            created_at=record["created_at"]
        )
        for record in history_records
    ]

# Helper function to generate unique SKU
async def generate_unique_sku(business_id: str, base_name: str = "") -> str:
    """Generate a unique SKU for the business"""
    products_collection = await get_collection("products")
    
    # Create base from name or use generic
    clean_name = ''.join(c for c in base_name.upper() if c.isalnum())[:4]
    if not clean_name:
        clean_name = "PROD"
    
    # Generate unique identifier
    import time
    timestamp = str(int(time.time()))[-6:]  # Last 6 digits of timestamp
    import random
    random_suffix = ''.join(random.choices('0123456789ABCDEF', k=3))
    
    counter = 1
    while True:
        if counter == 1:
            sku = f"{clean_name}-{timestamp}{random_suffix}"
        else:
            sku = f"{clean_name}-{timestamp}{random_suffix}-{counter}"
        
        # Check if SKU exists
        existing = await products_collection.find_one({
            "business_id": ObjectId(business_id),
            "sku": sku
        })
        
        if not existing:
            return sku
        
        counter += 1
        if counter > 100:  # Safety break
            return f"PROD-{uuid.uuid4().hex[:8].upper()}"

@router.post("/bulk-import")
async def bulk_import_products(
    file: UploadFile = File(...),
    current_user=Depends(get_business_admin_or_super)
):
    """Bulk import products from CSV/Excel file"""
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Validate file type
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be CSV or Excel format",
        )
    
    try:
        contents = await file.read()
        
        # Parse file based on type
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
        
        # Validate required columns
        required_columns = ['name', 'price', 'product_cost', 'quantity']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {', '.join(missing_columns)}",
            )
        
        products_collection = await get_collection("products")
        categories_collection = await get_collection("categories")
        
        # Get existing products and categories for validation
        existing_products = await products_collection.find({
            "business_id": ObjectId(business_id)
        }).to_list(length=None)
        existing_skus = {p["sku"] for p in existing_products}
        existing_barcodes = {p.get("barcode") for p in existing_products if p.get("barcode")}
        
        categories = await categories_collection.find({
            "business_id": ObjectId(business_id)
        }).to_list(length=None)
        category_map = {cat["name"].lower(): str(cat["_id"]) for cat in categories}
        
        successful_imports = []
        errors = []
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Validate required fields
                if pd.isna(row['name']) or str(row['name']).strip() == '':
                    errors.append(f"Row {index + 2}: Name is required")
                    continue
                
                if pd.isna(row['price']) or float(row['price']) <= 0:
                    errors.append(f"Row {index + 2}: Valid price is required")
                    continue
                
                if pd.isna(row['product_cost']) or float(row['product_cost']) < 0:
                    errors.append(f"Row {index + 2}: Valid product cost is required")
                    continue
                
                if pd.isna(row['quantity']) or int(row['quantity']) < 0:
                    errors.append(f"Row {index + 2}: Valid quantity is required")
                    continue
                
                # Handle SKU - generate if empty
                sku = str(row.get('sku', '')).strip()
                if not sku:
                    sku = await generate_unique_sku(business_id, str(row['name']))
                
                # Check for duplicate SKU
                if sku in existing_skus:
                    errors.append(f"Row {index + 2}: SKU '{sku}' already exists")
                    continue
                existing_skus.add(sku)
                
                # Handle barcode - optional but must be unique
                barcode = str(row.get('barcode', '')).strip() if not pd.isna(row.get('barcode')) else None
                if barcode:
                    if barcode in existing_barcodes:
                        errors.append(f"Row {index + 2}: Barcode '{barcode}' already exists")
                        continue
                    existing_barcodes.add(barcode)
                
                # Handle category
                category_id = None
                if not pd.isna(row.get('category')) and str(row['category']).strip():
                    category_name = str(row['category']).strip().lower()
                    category_id = category_map.get(category_name)
                    if not category_id:
                        # Create new category
                        new_category = {
                            "_id": ObjectId(),
                            "business_id": ObjectId(business_id),
                            "name": str(row['category']).strip(),
                            "description": f"Auto-created from import",
                            "is_active": True,
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                        await categories_collection.insert_one(new_category)
                        category_id = str(new_category["_id"])
                        category_map[category_name] = category_id
                
                # Create product document
                product_doc = {
                    "_id": ObjectId(),
                    "business_id": ObjectId(business_id),
                    "name": str(row['name']).strip(),
                    "description": str(row.get('description', '')).strip() if not pd.isna(row.get('description')) else '',
                    "sku": sku,
                    "barcode": barcode,
                    "category_id": ObjectId(category_id) if category_id else None,
                    "price": float(row['price']),
                    "product_cost": float(row['product_cost']),
                    "quantity": int(row['quantity']),
                    "brand": str(row.get('brand', '')).strip() if not pd.isna(row.get('brand')) else '',
                    "supplier": str(row.get('supplier', '')).strip() if not pd.isna(row.get('supplier')) else '',
                    "status": str(row.get('status', 'active')).strip().lower() if not pd.isna(row.get('status')) else 'active',
                    "is_active": True,
                    "low_stock_threshold": int(row.get('low_stock_threshold', 10)) if not pd.isna(row.get('low_stock_threshold')) else 10,
                    "image_url": None,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                # Insert product
                await products_collection.insert_one(product_doc)
                successful_imports.append(sku)
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
                continue
        
        return {
            "success": True,
            "imported_count": len(successful_imports),
            "error_count": len(errors),
            "errors": errors[:20],  # Limit to first 20 errors
            "imported_skus": successful_imports
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process file: {str(e)}"
        )

@router.get("/export")
async def export_products(
    format: str = Query("csv", regex="^(csv|excel)$"),
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    low_stock: Optional[bool] = None,
    status: Optional[str] = None,
    current_user=Depends(get_any_authenticated_user)
):
    """Export products to CSV or Excel"""
    products_collection = await get_collection("products")
    categories_collection = await get_collection("categories")
    
    business_id = current_user["business_id"]
    
    # Build filter query (same as main products endpoint)
    filter_query = {"business_id": ObjectId(business_id)}
    
    if search:
        filter_query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}}
        ]
    
    if category_id:
        filter_query["category_id"] = ObjectId(category_id)
    
    if low_stock:
        # Add low stock filter logic here
        filter_query["$expr"] = {"$lte": ["$quantity", "$low_stock_threshold"]}
    
    if status:
        filter_query["status"] = status
    
    # Get products with category names
    pipeline = [
        {"$match": filter_query},
        {
            "$lookup": {
                "from": "categories",
                "localField": "category_id",
                "foreignField": "_id",
                "as": "category"
            }
        },
        {
            "$addFields": {
                "category_name": {"$ifNull": [{"$first": "$category.name"}, ""]}
            }
        },
        {"$sort": {"name": 1}}
    ]
    
    products = await products_collection.aggregate(pipeline).to_list(length=None)
    
    if not products:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No products found matching criteria"
        )
    
    # Prepare data for export
    export_data = []
    for product in products:
        export_data.append({
            'Name': product['name'],
            'SKU': product['sku'],
            'Barcode': product.get('barcode', ''),
            'Category': product.get('category_name', ''),
            'Product_Cost': product.get('product_cost', 0),
            'Price': product['price'],
            'Quantity': product['quantity'],
            'Status': product.get('status', 'active'),
            'Description': product.get('description', ''),
            'Brand': product.get('brand', ''),
            'Supplier': product.get('supplier', ''),
            'Low_Stock_Threshold': product.get('low_stock_threshold', 10)
        })
    
    df = pd.DataFrame(export_data)
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"products_export_{timestamp}"
    
    if format == "csv":
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
        )
    else:  # excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Products', index=False)
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}.xlsx"}
        )

@router.post("/{product_id}/stock-adjustment")
async def adjust_product_stock(
    product_id: str,
    adjustment_data: dict,
    current_user=Depends(get_business_admin_or_super)
):
    """Adjust product stock with reason tracking"""
    products_collection = await get_collection("products")
    stock_adjustments_collection = await get_collection("stock_adjustments")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Validate input
    adjustment_type = adjustment_data.get('type')  # 'add' or 'subtract'
    quantity = adjustment_data.get('quantity', 0)
    reason = adjustment_data.get('reason', '')
    notes = adjustment_data.get('notes', '')
    
    if adjustment_type not in ['add', 'subtract']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Adjustment type must be 'add' or 'subtract'"
        )
    
    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0"
        )
    
    # Get current product
    product = await products_collection.find_one({
        "_id": ObjectId(product_id),
        "business_id": ObjectId(business_id)
    })
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    current_quantity = product.get('quantity', 0)
    
    # Calculate new quantity
    if adjustment_type == 'add':
        new_quantity = current_quantity + quantity
    else:  # subtract
        new_quantity = max(0, current_quantity - quantity)  # Don't allow negative stock
    
    # Update product quantity
    await products_collection.update_one(
        {"_id": ObjectId(product_id)},
        {
            "$set": {
                "quantity": new_quantity,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Record stock adjustment
    adjustment_record = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "product_id": ObjectId(product_id),
        "adjustment_type": adjustment_type,
        "quantity_before": current_quantity,
        "quantity_after": new_quantity,
        "adjustment_quantity": quantity,
        "reason": reason,
        "notes": notes,
        "created_by": ObjectId(current_user["_id"]),
        "created_at": datetime.utcnow()
    }
    
    await stock_adjustments_collection.insert_one(adjustment_record)
    
    return {
        "success": True,
        "product_id": product_id,
        "old_quantity": current_quantity,
        "new_quantity": new_quantity,
        "adjustment": f"{'+' if adjustment_type == 'add' else '-'}{quantity}",
        "reason": reason
    }

@router.post("/{product_id}/duplicate")
async def duplicate_product(
    product_id: str,
    duplicate_options: dict = {},
    current_user=Depends(get_business_admin_or_super)
):
    """Duplicate a product with optional modifications"""
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Get original product
    original_product = await products_collection.find_one({
        "_id": ObjectId(product_id),
        "business_id": ObjectId(business_id)
    })
    
    if not original_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Create duplicate
    duplicate_product = original_product.copy()
    duplicate_product["_id"] = ObjectId()
    
    # Modify fields for duplicate
    duplicate_product["name"] = f"{original_product['name']} (Copy)"
    
    # Generate new unique SKU
    duplicate_product["sku"] = await generate_unique_sku(business_id, original_product['name'])
    
    # Handle barcode - clear it to avoid duplicates unless specified
    if not duplicate_options.get('copy_barcode', False):
        duplicate_product["barcode"] = None
    
    # Handle quantity
    if not duplicate_options.get('copy_quantity', False):
        duplicate_product["quantity"] = 0
    
    # Update timestamps
    duplicate_product["created_at"] = datetime.utcnow()
    duplicate_product["updated_at"] = datetime.utcnow()
    
    # Insert duplicate
    await products_collection.insert_one(duplicate_product)
    
    return {
        "success": True,
        "original_id": product_id,
        "duplicate_id": str(duplicate_product["_id"]),
        "duplicate_name": duplicate_product["name"],
        "duplicate_sku": duplicate_product["sku"]
    }

@router.patch("/{product_id}/status")
async def toggle_product_status(
    product_id: str,
    status_data: dict,
    current_user=Depends(get_business_admin_or_super)
):
    """Toggle product active/inactive status"""
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    new_status = status_data.get('status')
    if new_status not in ['active', 'inactive']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'active' or 'inactive'"
        )
    
    result = await products_collection.update_one(
        {
            "_id": ObjectId(product_id),
            "business_id": ObjectId(business_id)
        },
        {
            "$set": {
                "status": new_status,
                "is_active": new_status == 'active',
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return {
        "success": True,
        "product_id": product_id,
        "new_status": new_status
    }

@router.post("/generate-barcodes")
async def generate_barcodes_for_products(
    request: BarcodeGenerateRequest,
    current_user=Depends(get_business_admin_or_super)
):
    """Generate barcodes for products that don't have them"""
    products_collection = await get_collection("products")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    updated_products = []
    
    for product_id in request.product_ids:
        product = await products_collection.find_one({
            "_id": ObjectId(product_id),
            "business_id": ObjectId(business_id)
        })
        
        if not product:
            continue
        
        # Generate barcode if missing
        if not product.get('barcode'):
            # Use SKU as barcode or generate from SKU
            barcode = product['sku'].replace('-', '').upper()
            
            # Update product with barcode
            await products_collection.update_one(
                {"_id": ObjectId(product_id)},
                {
                    "$set": {
                        "barcode": barcode,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            updated_products.append({
                "product_id": product_id,
                "name": product['name'],
                "sku": product['sku'],
                "barcode": barcode
            })
    
    return {
        "success": True,
        "updated_count": len(updated_products),
        "updated_products": updated_products
    }

@router.post("/print-labels")
async def print_product_labels(
    options: LabelPrintOptions,
    current_user=Depends(get_business_admin_or_super)
):
    """Generate labels for printing"""
    products_collection = await get_collection("products")
    businesses_collection = await get_collection("businesses")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Get business info for currency
    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
    currency = business.get("settings", {}).get("currency", "USD")
    
    labels_data = []
    
    for product_id in options.product_ids:
        product = await products_collection.find_one({
            "_id": ObjectId(product_id),
            "business_id": ObjectId(business_id)
        })
        
        if not product:
            continue
        
        # Ensure product has barcode
        barcode = product.get('barcode') or product['sku'].replace('-', '').upper()
        
        labels_data.append({
            "product_id": product_id,
            "name": product['name'],
            "sku": product['sku'],
            "barcode": barcode,
            "price": product['price'],
            "currency": currency
        })
    
    # Generate label layout based on options
    label_format = {
        "size": options.label_size,
        "format": options.format,
        "copies": options.copies,
        "products": labels_data
    }
    
    return {
        "success": True,
        "label_count": len(labels_data) * options.copies,
        "label_data": label_format
    }

@router.get("/download-template")
async def download_import_template(
    format: str = Query("csv", regex="^(csv|excel)$")
):
    """Download bulk import template"""
    
    # Template data
    template_data = [
        {
            'name': 'Sample Product 1',
            'sku': 'SAMPLE-001',
            'barcode': '1234567890123',
            'category': 'Electronics',
            'product_cost': 10.00,
            'price': 19.99,
            'quantity': 50,
            'status': 'active',
            'description': 'Sample product description',
            'brand': 'Sample Brand',
            'supplier': 'Sample Supplier',
            'low_stock_threshold': 5
        },
        {
            'name': 'Sample Product 2',
            'sku': '',  # Will be auto-generated
            'barcode': '',
            'category': 'Books',
            'product_cost': 5.00,
            'price': 12.99,
            'quantity': 25,
            'status': 'active',
            'description': '',
            'brand': '',
            'supplier': '',
            'low_stock_threshold': 10
        }
    ]
    
    df = pd.DataFrame(template_data)
    
    if format == "csv":
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=products_import_template.csv"}
        )
    else:  # excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Products', index=False)
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=products_import_template.xlsx"}
        )