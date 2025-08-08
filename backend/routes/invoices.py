from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from models import (InvoiceCreate, InvoiceResponse, InvoiceUpdate, InvoiceStatus, 
                   SaleCreate, SaleResponse, ExportOptions, ExportResponse, SaleItem)
from auth_utils import get_business_admin_or_super, get_any_authenticated_user
from database import get_collection
from services.receipt_service import receipt_service
from services.email_service import email_service
from services.print_service import print_service
from bson import ObjectId
from datetime import datetime
import uuid

router = APIRouter()

@router.post("/", response_model=InvoiceResponse)
async def create_invoice(
    invoice: InvoiceCreate,
    current_user=Depends(get_any_authenticated_user)
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

@router.get("/", response_model=List[InvoiceResponse])
async def get_invoices(
    status_filter: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    current_user=Depends(get_any_authenticated_user)
):
    invoices_collection = await get_collection("invoices")
    
    business_id = current_user["business_id"]
    if current_user["role"] == "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super admin must specify business context",
        )
    
    # Build query
    query = {"business_id": ObjectId(business_id)}
    
    if status_filter:
        query["status"] = status_filter
        
    if customer_id:
        query["customer_id"] = ObjectId(customer_id)
    
    # For cashiers, only show their own invoices
    if current_user["role"] == "cashier":
        query["created_by"] = ObjectId(current_user["_id"])
    
    invoices_cursor = invoices_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    invoices = await invoices_cursor.to_list(length=None)
    
    return [
        InvoiceResponse(
            id=str(invoice["_id"]),
            business_id=str(invoice["business_id"]),
            created_by=str(invoice["created_by"]),
            customer_id=str(invoice["customer_id"]) if invoice.get("customer_id") else None,
            invoice_number=invoice["invoice_number"],
            items=[SaleItem(**item) for item in invoice["items"]],
            subtotal=invoice["subtotal"],
            tax_amount=invoice["tax_amount"],
            discount_amount=invoice["discount_amount"],
            total_amount=invoice["total_amount"],
            notes=invoice.get("notes"),
            due_date=invoice.get("due_date"),
            status=invoice.get("status", InvoiceStatus.DRAFT),
            created_at=invoice.get("created_at", datetime.utcnow()),
            updated_at=invoice.get("updated_at", datetime.utcnow()),
            sent_at=invoice.get("sent_at"),
            converted_at=invoice.get("converted_at")
        )
        for invoice in invoices
    ]

@router.post("/{invoice_id}/convert-to-sale", response_model=SaleResponse)
async def convert_invoice_to_sale(
    invoice_id: str,
    payment_method: str = "cash",
    current_user=Depends(get_any_authenticated_user)
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

@router.post("/{invoice_id}/generate-receipt")
async def generate_invoice_receipt(
    invoice_id: str,
    format_type: str = "html",  # html, pdf
    current_user=Depends(get_any_authenticated_user)
):
    """Generate receipt for invoice"""
    invoices_collection = await get_collection("invoices")
    businesses_collection = await get_collection("businesses")
    customers_collection = await get_collection("customers")
    users_collection = await get_collection("users")
    
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
    
    # Get business info
    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
    
    # Get customer info if available
    customer_data = None
    if invoice.get("customer_id"):
        customer = await customers_collection.find_one({"_id": invoice["customer_id"]})
        if customer:
            customer_data = {
                "name": customer["name"],
                "email": customer.get("email"),
                "phone": customer.get("phone")
            }
    
    # Get cashier info
    cashier = await users_collection.find_one({"_id": invoice["created_by"]})
    cashier_data = {"full_name": cashier["full_name"]} if cashier else None
    
    # Generate receipt
    html_content, pdf_bytes = await receipt_service.generate_transaction_receipt(
        transaction_type="invoice",
        transaction_data=invoice,
        business_data=business,
        customer_data=customer_data,
        cashier_data=cashier_data,
        format_type=format_type
    )
    
    if format_type == "pdf" and pdf_bytes:
        return {
            "success": True,
            "format": "pdf",
            "content": pdf_bytes.hex(),  # Return as hex string for API
            "filename": f"invoice_{invoice['invoice_number']}.pdf"
        }
    else:
        return {
            "success": True,
            "format": "html",
            "content": html_content,
            "filename": f"invoice_{invoice['invoice_number']}.html"
        }

@router.post("/{invoice_id}/send-email")
async def send_invoice_email(
    invoice_id: str,
    email_address: Optional[str] = None,
    include_pdf: bool = True,
    current_user=Depends(get_any_authenticated_user)
):
    """Send invoice via email"""
    invoices_collection = await get_collection("invoices")
    businesses_collection = await get_collection("businesses")
    customers_collection = await get_collection("customers")
    users_collection = await get_collection("users")
    
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
    
    # Get business info
    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
    
    # Get customer info and email
    customer_email = email_address
    customer_name = "Customer"
    
    if invoice.get("customer_id") and not customer_email:
        customer = await customers_collection.find_one({"_id": invoice["customer_id"]})
        if customer and customer.get("email"):
            customer_email = customer["email"]
            customer_name = customer["name"]
    
    if not customer_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No email address provided and customer has no email",
        )
    
    # Get customer and cashier data
    customer_data = None
    if invoice.get("customer_id"):
        customer = await customers_collection.find_one({"_id": invoice["customer_id"]})
        if customer:
            customer_data = {
                "name": customer["name"],
                "email": customer.get("email"),
                "phone": customer.get("phone")
            }
            customer_name = customer["name"]
    
    cashier = await users_collection.find_one({"_id": invoice["created_by"]})
    cashier_data = {"full_name": cashier["full_name"]} if cashier else None
    
    # Generate receipt HTML and PDF
    html_content, pdf_bytes = await receipt_service.generate_transaction_receipt(
        transaction_type="invoice",
        transaction_data=invoice,
        business_data=business,
        customer_data=customer_data,
        cashier_data=cashier_data,
        format_type="pdf" if include_pdf else "html"
    )
    
    # Send email
    email_sent = await email_service.send_receipt_email(
        to_email=customer_email,
        customer_name=customer_name,
        receipt_html=html_content,
        receipt_pdf=pdf_bytes if include_pdf else None,
        business_name=business["name"],
        transaction_type="invoice"
    )
    
    if email_sent:
        # Update invoice status
        await invoices_collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {
                "$set": {
                    "status": InvoiceStatus.SENT,
                    "sent_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {"success": True, "message": f"Invoice sent to {customer_email}"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email",
        )

@router.post("/{invoice_id}/print")
async def print_invoice(
    invoice_id: str,
    printer_name: str = "default",
    current_user=Depends(get_any_authenticated_user)
):
    """Add invoice to print queue"""
    invoices_collection = await get_collection("invoices")
    businesses_collection = await get_collection("businesses")
    customers_collection = await get_collection("customers")
    users_collection = await get_collection("users")
    
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
    
    # Get related data
    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
    
    customer_data = None
    if invoice.get("customer_id"):
        customer = await customers_collection.find_one({"_id": invoice["customer_id"]})
        if customer:
            customer_data = {
                "name": customer["name"],
                "email": customer.get("email"),
                "phone": customer.get("phone")
            }
    
    cashier = await users_collection.find_one({"_id": invoice["created_by"]})
    cashier_data = {"full_name": cashier["full_name"]} if cashier else None
    
    # Generate receipt HTML for printing
    html_content, _ = await receipt_service.generate_transaction_receipt(
        transaction_type="invoice",
        transaction_data=invoice,
        business_data=business,
        customer_data=customer_data,
        cashier_data=cashier_data,
        format_type="html"
    )
    
    # Add to print queue
    job_id = await print_service.add_print_job(
        content=html_content,
        printer_name=printer_name,
        job_type="invoice"
    )
    
    return {
        "success": True,
        "message": "Invoice added to print queue",
        "job_id": job_id
    }

@router.get("/print-status/{job_id}")
async def get_print_status(
    job_id: str,
    current_user=Depends(get_any_authenticated_user)
):
    """Get print job status"""
    status = print_service.get_job_status(job_id)
    
    if not status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Print job not found",
        )
    
    return status