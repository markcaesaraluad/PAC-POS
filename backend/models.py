from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum
import uuid

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    BUSINESS_ADMIN = "business_admin"
    CASHIER = "cashier"

class BusinessStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"

class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    CONVERTED = "converted"
    CANCELLED = "cancelled"

# User Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole

class UserCreate(UserBase):
    password: str
    business_id: Optional[str] = None

class UserResponse(UserBase):
    id: str
    business_id: Optional[str] = None
    is_active: bool
    created_at: datetime

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    business_subdomain: Optional[str] = None

# Business Models
class BusinessBase(BaseModel):
    name: str
    description: Optional[str] = None
    subdomain: str
    contact_email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None

class BusinessCreate(BusinessBase):
    admin_name: str
    admin_email: EmailStr
    admin_password: str

class BusinessResponse(BusinessBase):
    id: str
    status: BusinessStatus
    logo_url: Optional[str] = None
    settings: Optional[Dict] = None
    created_at: datetime
    updated_at: datetime

class BusinessSettings(BaseModel):
    currency: str = "USD"
    tax_rate: float = 0.0
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None
    low_stock_threshold: int = 10
    printer_settings: Optional[Dict] = None

# Product Models
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    sku: str
    barcode: Optional[str] = None
    category_id: Optional[str] = None
    price: float
    product_cost: float = Field(..., ge=0, description="Product cost - required for profit tracking")
    quantity: int = 0
    image_url: Optional[str] = None
    brand: Optional[str] = None
    supplier: Optional[str] = None
    low_stock_threshold: int = 10
    status: str = "active"

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    product_cost: Optional[float] = Field(None, ge=0, description="Product cost for profit tracking")
    quantity: Optional[int] = None
    image_url: Optional[str] = None

class ProductResponse(ProductBase):
    id: str
    business_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

# Product Cost History Models
class ProductCostHistoryBase(BaseModel):
    product_id: str
    cost: float = Field(..., ge=0, description="Historical cost value")
    effective_from: datetime = Field(default_factory=datetime.utcnow)
    changed_by: str
    notes: Optional[str] = None

class ProductCostHistoryCreate(ProductCostHistoryBase):
    pass

class ProductCostHistoryResponse(ProductCostHistoryBase):
    id: str
    business_id: str
    created_at: datetime

# Category Models
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#3B82F6"

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str
    business_id: str
    product_count: int = 0
    created_at: datetime

# Customer Models
class CustomerBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: str
    business_id: str
    total_spent: float = 0.0
    visit_count: int = 0
    created_at: datetime

# Sale/Invoice Item Models
class SaleItem(BaseModel):
    product_id: str
    product_name: str
    product_sku: str
    quantity: int
    unit_price: float
    unit_cost_snapshot: Optional[float] = Field(None, description="Cost at time of sale for profit calculation")
    total_price: float

# Sale Models
class SaleBase(BaseModel):
    customer_id: Optional[str] = None
    items: List[SaleItem]
    subtotal: float
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float
    payment_method: str = "cash"
    notes: Optional[str] = None

class SaleCreate(SaleBase):
    pass

class SaleResponse(SaleBase):
    id: str
    business_id: str
    cashier_id: str
    sale_number: str
    status: str = "completed"
    created_at: datetime

# Invoice Models
class InvoiceBase(BaseModel):
    customer_id: Optional[str] = None
    items: List[SaleItem]
    subtotal: float
    tax_amount: float = 0.0
    discount_amount: float = 0.0
    total_amount: float
    notes: Optional[str] = None
    due_date: Optional[datetime] = None

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceUpdate(BaseModel):
    customer_id: Optional[str] = None
    items: Optional[List[SaleItem]] = None
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[InvoiceStatus] = None

class InvoiceResponse(InvoiceBase):
    id: str
    business_id: str
    created_by: str
    invoice_number: str
    status: InvoiceStatus = InvoiceStatus.DRAFT
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    converted_at: Optional[datetime] = None

# Receipt/Invoice Export Models
class ExportOptions(BaseModel):
    format: str = "pdf"  # pdf, image
    send_email: bool = False
    customer_email: Optional[EmailStr] = None

class ExportResponse(BaseModel):
    success: bool
    file_url: Optional[str] = None
    message: str

# Token Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    business: Optional[BusinessResponse] = None

# Profit Report Models
class ProfitReportFilter(BaseModel):
    start_date: Optional[str] = Field(None, description="Start date in YYYY-MM-DD format")
    end_date: Optional[str] = Field(None, description="End date in YYYY-MM-DD format")
    format: str = Field("excel", pattern="^(excel|csv|pdf)$")

class ProfitReportData(BaseModel):
    date_time: datetime
    invoice_id: str
    item_name: str
    item_sku: str
    quantity: int
    unit_price: float
    unit_cost: Optional[float] = None
    line_profit: float
    line_total: float

class ProfitReportSummary(BaseModel):
    gross_sales: float
    cost_of_goods_sold: float
    profit: float
    total_items: int
    start_date: str
    end_date: str