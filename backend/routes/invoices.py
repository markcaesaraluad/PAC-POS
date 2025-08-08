from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models import (InvoiceCreate, InvoiceResponse, InvoiceUpdate, InvoiceStatus, 
                   SaleCreate, SaleResponse, ExportOptions, ExportResponse, SaleItem)
from auth_utils import get_business_admin_or_super, get_any_authenticated_user
from database import get_collection
from bson import ObjectId
from datetime import datetime
import uuid

router = APIRouter()

@router.post("/", response_model=InvoiceResponse)
async def create_invoice(
    invoice: InvoiceCreate,
    current_user=get_any_authenticated_user()
):
    invoices_collection = await get_collection("invoices")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Generate invoice number
    invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    # Create invoice document
    invoice_doc = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "created_by": ObjectId(current_user["_id"]),
        "customer_id": ObjectId(invoice.customer_id) if invoice.customer_id else None,
        "invoice_number": invoice_number,
        "items": [item.dict() for item in invoice.items],
        "subtotal": invoice.subtotal,
        "tax_amount": invoice.tax_amount,
        "discount_amount": invoice.discount_amount,
        "total_amount": invoice.total_amount,
        "notes": invoice.notes,
        "due_date": invoice.due_date,
        "status": InvoiceStatus.DRAFT,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "sent_at": None,
        "converted_at": None
    }
    
    # Insert invoice
    await invoices_collection.insert_one(invoice_doc)
    
    return InvoiceResponse(
        id=str(invoice_doc["_id"]),
        business_id=str(invoice_doc["business_id"]),
        created_by=str(invoice_doc["created_by"]),
        customer_id=str(invoice_doc["customer_id"]) if invoice_doc["customer_id"] else None,
        invoice_number=invoice_doc["invoice_number"],
        items=invoice.items,
        subtotal=invoice_doc["subtotal"],
        tax_amount=invoice_doc["tax_amount"],
        discount_amount=invoice_doc["discount_amount"],
        total_amount=invoice_doc["total_amount"],
        notes=invoice_doc["notes"],
        due_date=invoice_doc["due_date"],
        status=invoice_doc["status"],
        created_at=invoice_doc["created_at"],
        updated_at=invoice_doc["updated_at"],
        sent_at=invoice_doc["sent_at"],
        converted_at=invoice_doc["converted_at"]
    )

@router.post("/{invoice_id}/convert-to-sale", response_model=SaleResponse)
async def convert_invoice_to_sale(
    invoice_id: str,
    payment_method: str = "cash",
    current_user=get_any_authenticated_user()
):
    invoices_collection = await get_collection("invoices")
    sales_collection = await get_collection("sales")
    products_collection = await get_collection("products")
    customers_collection = await get_collection("customers")
    
    business_id = current_user["business_id"]
    
    # Get invoice
    invoice = await invoices_collection.find_one({
        "_id": ObjectId(invoice_id),
        "business_id": ObjectId(business_id)
    })
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    if invoice.get("status") == InvoiceStatus.CONVERTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice already converted to sale",
        )
    
    # Generate sale number
    sale_number = f"SALE-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
    
    # Create sale document
    sale_doc = {
        "_id": ObjectId(),
        "business_id": ObjectId(business_id),
        "cashier_id": ObjectId(current_user["_id"]),
        "customer_id": invoice.get("customer_id"),
        "sale_number": sale_number,
        "items": invoice["items"],
        "subtotal": invoice["subtotal"],
        "tax_amount": invoice["tax_amount"],
        "discount_amount": invoice["discount_amount"],
        "total_amount": invoice["total_amount"],
        "payment_method": payment_method,
        "notes": invoice.get("notes"),
        "status": "completed",
        "invoice_id": ObjectId(invoice_id),
        "created_at": datetime.utcnow()
    }
    
    # Insert sale and update invoice status
    await sales_collection.insert_one(sale_doc)
    await invoices_collection.update_one(
        {"_id": ObjectId(invoice_id)},
        {
            "$set": {
                "status": InvoiceStatus.CONVERTED,
                "converted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    return SaleResponse(
        id=str(sale_doc["_id"]),
        business_id=str(sale_doc["business_id"]),
        cashier_id=str(sale_doc["cashier_id"]),
        customer_id=str(sale_doc["customer_id"]) if sale_doc.get("customer_id") else None,
        sale_number=sale_doc["sale_number"],
        items=[SaleItem(**item) for item in sale_doc["items"]],
        subtotal=sale_doc["subtotal"],
        tax_amount=sale_doc["tax_amount"],
        discount_amount=sale_doc["discount_amount"],
        total_amount=sale_doc["total_amount"],
        payment_method=sale_doc["payment_method"],
        notes=sale_doc.get("notes"),
        status=sale_doc["status"],
        created_at=sale_doc["created_at"]
    )

@router.post("/{invoice_id}/export", response_model=ExportResponse)
async def export_invoice(
    invoice_id: str,
    export_options: ExportOptions,
    current_user=get_any_authenticated_user()
):
    # Mock implementation - will be enhanced with actual PDF/image generation
    return ExportResponse(
        success=True,
        file_url=f"/exports/invoice_{invoice_id}.{export_options.format}",
        message=f"Invoice exported as {export_options.format.upper()} successfully"
    )