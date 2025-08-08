from fastapi import APIRouter, HTTPException, status, Depends, Query, Response
from typing import Optional
from datetime import datetime, timedelta
from auth_utils import get_business_admin_or_super, get_any_authenticated_user
from database import get_collection
from services.reports_service import reports_service
from bson import ObjectId
import json

router = APIRouter()

@router.get("/sales")
async def generate_sales_report(
    format: str = Query("excel", regex="^(excel|pdf)$"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user=Depends(get_any_authenticated_user)
):
    """Generate sales report in Excel or PDF format"""
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Set default date range (last 30 days if not provided)
    if not start_date:
        start_dt = datetime.now() - timedelta(days=30)
    else:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid start_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"
            )
    
    if not end_date:
        end_dt = datetime.now()
    else:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"
            )
    
    # Get sales data from database
    sales_collection = await get_collection("sales")
    customers_collection = await get_collection("customers")
    users_collection = await get_collection("users")
    
    # Build query
    query = {
        "business_id": ObjectId(business_id),
        "created_at": {
            "$gte": start_dt,
            "$lte": end_dt
        }
    }
    
    # For cashiers, only their sales
    if current_user["role"] == "cashier":
        query["cashier_id"] = ObjectId(current_user["_id"])
    
    # Get sales data
    sales_cursor = sales_collection.find(query).sort("created_at", -1)
    sales = await sales_cursor.to_list(length=None)
    
    # Enrich sales data with customer and cashier names
    enriched_sales = []
    for sale in sales:
        # Get customer name if available
        customer_name = None
        if sale.get("customer_id"):
            customer = await customers_collection.find_one({"_id": sale["customer_id"]})
            customer_name = customer["name"] if customer else None
        
        # Get cashier name
        cashier_name = None
        if sale.get("cashier_id"):
            cashier = await users_collection.find_one({"_id": sale["cashier_id"]})
            cashier_name = cashier["full_name"] if cashier else None
        
        # Convert ObjectIds to strings for JSON serialization
        sale_dict = dict(sale)
        sale_dict["_id"] = str(sale_dict["_id"])
        sale_dict["business_id"] = str(sale_dict["business_id"])
        if sale_dict.get("customer_id"):
            sale_dict["customer_id"] = str(sale_dict["customer_id"])
        if sale_dict.get("cashier_id"):
            sale_dict["cashier_id"] = str(sale_dict["cashier_id"])
        
        sale_dict["customer_name"] = customer_name
        sale_dict["cashier_name"] = cashier_name
        
        enriched_sales.append(sale_dict)
    
    try:
        # Generate report
        report_bytes, filename = await reports_service.generate_sales_report(
            sales_data=enriched_sales,
            start_date=start_dt,
            end_date=end_dt,
            format_type=format
        )
        
        # Return appropriate response
        if format == "excel":
            return Response(
                content=report_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:  # PDF
            return Response(
                content=report_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )

@router.get("/inventory")
async def generate_inventory_report(
    format: str = Query("excel", regex="^(excel|pdf)$"),
    include_inactive: bool = Query(False),
    low_stock_only: bool = Query(False),
    current_user=Depends(get_business_admin_or_super)
):
    """Generate inventory report in Excel or PDF format"""
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Get products data from database
    products_collection = await get_collection("products")
    categories_collection = await get_collection("categories")
    businesses_collection = await get_collection("businesses")
    
    # Build query
    query = {"business_id": ObjectId(business_id)}
    if not include_inactive:
        query["is_active"] = True
    
    # Get business settings for low stock threshold
    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
    low_stock_threshold = business.get("settings", {}).get("low_stock_threshold", 10)
    
    if low_stock_only:
        query["quantity"] = {"$lte": low_stock_threshold}
    
    # Get products data
    products_cursor = products_collection.find(query).sort("name", 1)
    products = await products_cursor.to_list(length=None)
    
    # Get categories for enrichment
    categories_cursor = categories_collection.find({"business_id": ObjectId(business_id)})
    categories = await categories_cursor.to_list(length=None)
    categories_dict = {str(cat["_id"]): cat["name"] for cat in categories}
    
    # Enrich products data with category names
    enriched_products = []
    for product in products:
        product_dict = dict(product)
        product_dict["_id"] = str(product_dict["_id"])
        product_dict["business_id"] = str(product_dict["business_id"])
        if product_dict.get("category_id"):
            product_dict["category_id"] = str(product_dict["category_id"])
            product_dict["category_name"] = categories_dict.get(product_dict["category_id"], "Uncategorized")
        else:
            product_dict["category_name"] = "Uncategorized"
        
        product_dict["low_stock_threshold"] = low_stock_threshold
        enriched_products.append(product_dict)
    
    try:
        # Generate report
        report_bytes, filename = await reports_service.generate_inventory_report(
            products_data=enriched_products,
            format_type=format
        )
        
        # Return appropriate response
        if format == "excel":
            return Response(
                content=report_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:  # PDF
            return Response(
                content=report_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate inventory report: {str(e)}"
        )

@router.get("/customers")
async def generate_customers_report(
    format: str = Query("excel", regex="^(excel|pdf)$"),
    top_customers: int = Query(50, ge=1, le=500),
    current_user=Depends(get_business_admin_or_super)
):
    """Generate customers report with purchase history"""
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Get customers data
    customers_collection = await get_collection("customers")
    sales_collection = await get_collection("sales")
    
    # Get all customers for this business
    customers_cursor = customers_collection.find({"business_id": ObjectId(business_id)}).sort("total_spent", -1)
    customers = await customers_cursor.to_list(length=top_customers)
    
    # Enrich with recent purchase data
    enriched_customers = []
    for customer in customers:
        customer_dict = dict(customer)
        customer_dict["_id"] = str(customer_dict["_id"])
        customer_dict["business_id"] = str(customer_dict["business_id"])
        
        # Get last purchase date
        last_sale = await sales_collection.find_one(
            {"business_id": ObjectId(business_id), "customer_id": customer["_id"]},
            sort=[("created_at", -1)]
        )
        customer_dict["last_purchase_date"] = last_sale["created_at"] if last_sale else None
        
        enriched_customers.append(customer_dict)
    
    # Create Excel/PDF with customer data
    try:
        if format == "excel":
            # Create Excel file
            from io import BytesIO
            import pandas as pd
            
            output = BytesIO()
            
            # Prepare customer data
            customer_records = []
            for customer in enriched_customers:
                customer_records.append({
                    'Customer Name': customer.get('name', ''),
                    'Email': customer.get('email', ''),
                    'Phone': customer.get('phone', ''),
                    'Total Spent': customer.get('total_spent', 0),
                    'Visit Count': customer.get('visit_count', 0),
                    'Average Per Visit': customer.get('total_spent', 0) / max(customer.get('visit_count', 1), 1),
                    'Last Purchase': customer.get('last_purchase_date', ''),
                    'Joined Date': customer.get('created_at', '')
                })
            
            df = pd.DataFrame(customer_records)
            
            with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                df.to_excel(writer, sheet_name='Customers Report', index=False)
                
                workbook = writer.book
                worksheet = writer.sheets['Customers Report']
                
                # Format styles
                header_format = workbook.add_format({
                    'bold': True,
                    'text_wrap': True,
                    'valign': 'top',
                    'fg_color': '#D7E4BC',
                    'border': 1
                })
                
                money_format = workbook.add_format({'num_format': '$#,##0.00'})
                date_format = workbook.add_format({'num_format': 'yyyy-mm-dd hh:mm'})
                
                # Set column widths
                worksheet.set_column('A:A', 25)  # Name
                worksheet.set_column('B:B', 25)  # Email
                worksheet.set_column('C:C', 15)  # Phone
                worksheet.set_column('D:D', 12, money_format)  # Total Spent
                worksheet.set_column('E:E', 12)  # Visit Count
                worksheet.set_column('F:F', 15, money_format)  # Average
                worksheet.set_column('G:H', 18, date_format)  # Dates
                
                # Apply header format
                for col_num, value in enumerate(df.columns.values):
                    worksheet.write(0, col_num, value, header_format)
            
            output.seek(0)
            filename = f"customers_report_{datetime.now().strftime('%Y%m%d')}.xlsx"
            
            return Response(
                content=output.getvalue(),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        else:  # PDF format
            # Simple PDF implementation - could be enhanced
            return {"message": "PDF format for customers report coming soon"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate customers report: {str(e)}"
        )

@router.get("/daily-summary")
async def get_daily_summary_report(
    date: Optional[str] = Query(None),
    current_user=Depends(get_any_authenticated_user)
):
    """Get daily summary statistics"""
    
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
    
    # Get collections
    sales_collection = await get_collection("sales")
    products_collection = await get_collection("products")
    customers_collection = await get_collection("customers")
    
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
    total_tax = sum(sale.get("tax_amount", 0) for sale in sales)
    total_discount = sum(sale.get("discount_amount", 0) for sale in sales)
    total_items_sold = sum(sum(item["quantity"] for item in sale["items"]) for sale in sales)
    
    # Get unique customers count
    unique_customers = set()
    for sale in sales:
        if sale.get("customer_id"):
            unique_customers.add(str(sale["customer_id"]))
    
    # Get low stock products count
    low_stock_count = await products_collection.count_documents({
        "business_id": ObjectId(business_id),
        "quantity": {"$lte": 10},  # TODO: Use business settings
        "is_active": True
    })
    
    return {
        "date": target_date.isoformat(),
        "sales": {
            "total_sales": total_sales,
            "total_revenue": total_revenue,
            "total_tax": total_tax,
            "total_discount": total_discount,
            "average_sale": total_revenue / total_sales if total_sales > 0 else 0,
        },
        "products": {
            "total_items_sold": total_items_sold,
            "low_stock_count": low_stock_count,
        },
        "customers": {
            "unique_customers_served": len(unique_customers),
        },
        "cashier_performance": {
            "cashier_name": current_user.get("full_name", ""),
            "personal_sales": total_sales if current_user["role"] == "cashier" else None
        }
    }