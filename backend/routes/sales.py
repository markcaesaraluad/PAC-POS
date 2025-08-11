from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models import SaleCreate, SaleResponse, SaleItem
from auth_utils import get_any_authenticated_user
from database import get_collection
from services.receipt_service import receipt_service
from services.email_service import email_service
from services.print_service import print_service
from bson import ObjectId
from datetime import datetime
import uuid

router = APIRouter()

@router.post("", response_model=SaleResponse)
async def create_sale(
    sale: SaleCreate,
    current_user=Depends(get_any_authenticated_user)
):
    sales_collection = await get_collection("sales")
    products_collection = await get_collection("products")
    customers_collection = await get_collection("customers")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Verify products exist and have sufficient stock, also prepare cost snapshots
    items_with_cost_snapshots = []
    for item in sale.items:
        product = await products_collection.find_one({
            "_id": ObjectId(item.product_id),
            "business_id": ObjectId(business_id),
            "is_active": True
        })
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {item.product_name} not found",
            )
        
        if product["quantity"] < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for {item.product_name}. Available: {product['quantity']}, Requested: {item.quantity}",
            )
        
        # Create item with cost snapshot
        item_with_snapshot = item.dict()
        item_with_snapshot["unit_cost_snapshot"] = product.get("product_cost", 0.0)
        item_with_snapshot["id"] = str(ObjectId())  # Add ID for SaleItem response
        items_with_cost_snapshots.append(item_with_snapshot)
    
    # Generate sale number
    sale_number = f"SALE-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    # Create sale document
    sale_doc = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "cashier_id": ObjectId(current_user["_id"]),
        "cashier_name": sale.cashier_name,
        "customer_id": ObjectId(sale.customer_id) if sale.customer_id else None,
        "customer_name": sale.customer_name,
        "sale_number": sale_number,
        "items": items_with_cost_snapshots,
        "subtotal": sale.subtotal,
        "tax_amount": sale.tax_amount,
        "discount_amount": sale.discount_amount,
        "total_amount": sale.total_amount,
        "payment_method": sale.payment_method,
        "received_amount": sale.received_amount,
        "change_amount": sale.change_amount,
        "notes": sale.notes,
        "status": "completed",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Insert sale
    await sales_collection.insert_one(sale_doc)
    
    # Update product quantities
    for item in sale.items:
        await products_collection.update_one(
            {
                "_id": ObjectId(item.product_id),
                "business_id": ObjectId(business_id)
            },
            {"$inc": {"quantity": -item.quantity}}
        )
    
    # Update customer stats if customer provided
    if sale.customer_id:
        await customers_collection.update_one(
            {
                "_id": ObjectId(sale.customer_id),
                "business_id": ObjectId(business_id)
            },
            {
                "$inc": {
                    "total_spent": sale.total_amount,
                    "visit_count": 1
                }
            }
        )
    
    return SaleResponse(
        id=str(sale_doc["_id"]),
        business_id=str(sale_doc["business_id"]),
        cashier_id=str(sale_doc["cashier_id"]),
        cashier_name=sale_doc["cashier_name"],
        customer_id=str(sale_doc["customer_id"]) if sale_doc["customer_id"] else None,
        customer_name=sale_doc.get("customer_name"),
        sale_number=sale_doc["sale_number"],
        items=[SaleItem(**item) for item in items_with_cost_snapshots],
        subtotal=sale_doc["subtotal"],
        tax_amount=sale_doc["tax_amount"],
        discount_amount=sale_doc["discount_amount"],
        total_amount=sale_doc["total_amount"],
        payment_method=sale_doc["payment_method"],
        received_amount=sale_doc.get("received_amount"),
        change_amount=sale_doc.get("change_amount"),
        notes=sale_doc.get("notes"),
        status=sale_doc["status"],
        created_at=sale_doc["created_at"],
        updated_at=sale_doc["updated_at"]
    )

@router.get("", response_model=List[SaleResponse])
async def get_sales(
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    customer_id: Optional[str] = Query(None),
    date_preset: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user=Depends(get_any_authenticated_user)
):
    sales_collection = await get_collection("sales")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Build query
    query = {"business_id": ObjectId(business_id)}
    
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    
    # Handle date filtering
    if date_preset or start_date or end_date:
        from datetime import datetime, timedelta
        
        if date_preset == "today":
            today = datetime.now().date()
            start_of_day = datetime.combine(today, datetime.min.time())
            end_of_day = datetime.combine(today, datetime.max.time())
            query["created_at"] = {"$gte": start_of_day, "$lte": end_of_day}
        elif date_preset == "yesterday":
            yesterday = datetime.now().date() - timedelta(days=1)
            start_of_day = datetime.combine(yesterday, datetime.min.time())
            end_of_day = datetime.combine(yesterday, datetime.max.time())
            query["created_at"] = {"$gte": start_of_day, "$lte": end_of_day}
        elif date_preset == "this_week":
            today = datetime.now().date()
            start_of_week = today - timedelta(days=today.weekday())
            start_of_day = datetime.combine(start_of_week, datetime.min.time())
            end_of_day = datetime.combine(today, datetime.max.time())
            query["created_at"] = {"$gte": start_of_day, "$lte": end_of_day}
        elif date_preset == "this_month":
            today = datetime.now().date()
            start_of_month = today.replace(day=1)
            start_of_day = datetime.combine(start_of_month, datetime.min.time())
            end_of_day = datetime.combine(today, datetime.max.time())
            query["created_at"] = {"$gte": start_of_day, "$lte": end_of_day}
        elif start_date and end_date:
            # Custom date range
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query["created_at"] = {"$gte": start_dt, "$lte": end_dt}
        elif start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query["created_at"] = {"$gte": start_dt}
        elif end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query["created_at"] = {"$lte": end_dt}
    
    # For cashiers, only show their own sales
    if current_user["role"] == "cashier":
        query["cashier_id"] = ObjectId(current_user["_id"])
    
    sales_cursor = sales_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    sales = await sales_cursor.to_list(length=None)
    
    return [
        SaleResponse(
            id=str(sale["_id"]),
            business_id=str(sale["business_id"]),
            cashier_id=str(sale["cashier_id"]),
            customer_id=str(sale["customer_id"]) if sale.get("customer_id") else None,
            sale_number=sale["sale_number"],
            items=[SaleItem(**item) for item in sale["items"]],
            subtotal=sale["subtotal"],
            tax_amount=sale["tax_amount"],
            discount_amount=sale["discount_amount"],
            total_amount=sale["total_amount"],
            payment_method=sale["payment_method"],
            status=sale.get("status", "completed"),
            created_at=sale.get("created_at", datetime.utcnow())
        )
        for sale in sales
    ]

@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: str,
    current_user=Depends(get_any_authenticated_user)
):
    sales_collection = await get_collection("sales")
    
    business_id = current_user["business_id"]
    
    # Build query
    query = {
        "_id": ObjectId(sale_id),
        "business_id": ObjectId(business_id)
    }
    
    # For cashiers, only allow access to their own sales
    if current_user["role"] == "cashier":
        query["cashier_id"] = ObjectId(current_user["_id"])
    
    sale = await sales_collection.find_one(query)
    
    if not sale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sale not found",
        )
    
    return SaleResponse(
        id=str(sale["_id"]),
        business_id=str(sale["business_id"]),
        cashier_id=str(sale["cashier_id"]),
        customer_id=str(sale["customer_id"]) if sale.get("customer_id") else None,
        sale_number=sale["sale_number"],
        items=[SaleItem(**item) for item in sale["items"]],
        subtotal=sale["subtotal"],
        tax_amount=sale["tax_amount"],
        discount_amount=sale["discount_amount"],
        total_amount=sale["total_amount"],
        payment_method=sale["payment_method"],
        status=sale.get("status", "completed"),
        created_at=sale.get("created_at", datetime.utcnow())
    )

@router.get("/daily-summary/stats")
async def get_daily_sales_stats(
    date: Optional[str] = Query(None),
    current_user=Depends(get_any_authenticated_user)
):
    sales_collection = await get_collection("sales")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Use today if no date provided
    target_date = datetime.now().date() if not date else datetime.fromisoformat(date).date()
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())
    
    # Build query
    query = {
        "business_id": ObjectId(business_id),
        "created_at": {"$gte": start_of_day, "$lte": end_of_day}
    }
    
    # For cashiers, only their sales
    if current_user["role"] == "cashier":
        query["cashier_id"] = ObjectId(current_user["_id"])
    
    # Get sales for the day
    sales_cursor = sales_collection.find(query)
    sales = await sales_cursor.to_list(length=None)
    
    # Calculate stats
    total_sales = len(sales)
    total_revenue = sum(sale["total_amount"] for sale in sales)
    total_items_sold = sum(sum(item["quantity"] for item in sale["items"]) for sale in sales)
    
    return {
        "date": target_date.isoformat(),
        "total_sales": total_sales,
        "total_revenue": total_revenue,
        "total_items_sold": total_items_sold,
        "average_sale": total_revenue / total_sales if total_sales > 0 else 0
    }