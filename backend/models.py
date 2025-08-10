from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Enum Classes
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    BUSINESS_ADMIN = "business_admin"
    CASHIER = "cashier"

class BusinessStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    INACTIVE = "inactive"

# User Models
class UserBase(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.CASHIER

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: str
    business_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

# Business Models
class BusinessBase(BaseModel):
    name: str
    description: Optional[str] = None
    subdomain: str
    contact_email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None

class BusinessCreate(BusinessBase):
    pass

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[BusinessStatus] = None

class BusinessUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None

class BusinessSettings(BaseModel):
    currency: str = "USD"
    tax_rate: float = 0.0
    receipt_header: str = ""
    receipt_footer: str = ""
    low_stock_threshold: int = 10
    printer_type: str = "local"  # local, network, bluetooth
    selected_printer: Optional[str] = None
    printer_settings: Dict[str, Any] = Field(default_factory=dict)

class BusinessResponse(BusinessBase):
    id: str
    status: BusinessStatus = BusinessStatus.ACTIVE
    logo_url: Optional[str] = None
    settings: BusinessSettings = Field(default_factory=BusinessSettings)
    created_at: datetime
    updated_at: datetime

# Category Models
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: str
    business_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

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
    brand: Optional[str] = None
    supplier: Optional[str] = None
    low_stock_threshold: Optional[int] = None
    status: Optional[str] = None

class ProductResponse(ProductBase):
    id: str
    business_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

# Product Cost History Models
class ProductCostHistoryBase(BaseModel):
    product_id: str
    cost: float
    effective_from: datetime
    changed_by: str
    notes: Optional[str] = None

class ProductCostHistoryResponse(ProductCostHistoryBase):
    id: str
    business_id: str
    created_at: datetime

# Customer Models
class CustomerBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: str
    business_id: str
    created_at: datetime
    updated_at: datetime

# Sale Models
class SaleItemBase(BaseModel):
    product_id: str
    product_name: str
    sku: str
    quantity: int
    unit_price: float
    unit_price_snapshot: float = Field(..., description="Price at time of sale")
    unit_cost_snapshot: float = Field(..., description="Cost at time of sale for profit tracking")
    total_price: float

class SaleItemCreate(SaleItemBase):
    pass

class SaleItemResponse(SaleItemBase):
    id: str

# Alias for backward compatibility
SaleItem = SaleItemResponse

class SaleBase(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    cashier_id: str
    cashier_name: str
    subtotal: float
    tax_amount: float = 0
    discount_amount: float = 0
    total_amount: float
    payment_method: str
    received_amount: Optional[float] = None
    change_amount: Optional[float] = None
    notes: Optional[str] = None
    status: str = "completed"

class SaleCreate(SaleBase):
    items: List[SaleItemCreate]

class SaleResponse(SaleBase):
    id: str
    business_id: str
    sale_number: str
    items: List[SaleItemResponse]
    created_at: datetime
    updated_at: datetime

# Invoice Models (similar to Sale but for invoicing)
class InvoiceItemBase(BaseModel):
    product_id: str
    product_name: str
    sku: str
    quantity: int
    unit_price: float
    total_price: float

class InvoiceItemCreate(InvoiceItemBase):
    pass

class InvoiceItemResponse(InvoiceItemBase):
    id: str

class InvoiceBase(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    cashier_id: str
    cashier_name: str
    subtotal: float
    tax_amount: float = 0
    discount_amount: float = 0
    total_amount: float
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: str = "draft"  # draft, sent, paid, overdue

class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate]

class InvoiceResponse(InvoiceBase):
    id: str
    business_id: str
    invoice_number: str
    items: List[InvoiceItemResponse]
    created_at: datetime
    updated_at: datetime

# Report Models
class SalesReportItem(BaseModel):
    date: str
    sales_count: int
    total_revenue: float
    total_profit: float
    items_sold: int

class SalesReportResponse(BaseModel):
    business_id: str
    period: str
    start_date: str
    end_date: str
    summary: Dict[str, Any]
    daily_breakdown: List[SalesReportItem]

class ProfitReportItem(BaseModel):
    sale_id: str
    sale_number: str
    date: str
    cashier_name: str
    customer_name: Optional[str]
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    total_cost: float
    gross_profit: float
    profit_margin: float

class ProfitReportSummary(BaseModel):
    gross_sales: float
    cost_of_goods_sold: float
    profit: float
    total_items: int
    start_date: str
    end_date: str

# Stock Adjustment Models
class StockAdjustmentBase(BaseModel):
    product_id: str
    adjustment_type: str  # 'add' or 'subtract'
    quantity_before: int
    quantity_after: int
    adjustment_quantity: int
    reason: str
    notes: Optional[str] = None

class StockAdjustmentCreate(BaseModel):
    type: str  # 'add' or 'subtract'
    quantity: int = Field(..., gt=0)
    reason: str
    notes: Optional[str] = None

class StockAdjustmentResponse(StockAdjustmentBase):
    id: str
    business_id: str
    created_by: str
    created_at: datetime

# Bulk Import Models
class BulkImportResponse(BaseModel):
    success: bool
    imported_count: int
    error_count: int
    errors: List[str]
    imported_skus: List[str]

# Product Label/Barcode Models
class LabelPrintOptions(BaseModel):
    product_ids: List[str]
    label_size: str = "58mm"  # 58mm, 80mm, label
    format: str = "barcode_top"  # barcode_top, barcode_bottom
    copies: int = Field(1, ge=1, le=10)

class BarcodeGenerateRequest(BaseModel):
    product_ids: List[str]

# Authentication Models
class UserLogin(BaseModel):
    email: EmailStr
    password: str
    business_subdomain: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    business: Optional[BusinessResponse] = None