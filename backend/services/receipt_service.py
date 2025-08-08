from jinja2 import Template
from weasyprint import HTML, CSS
from datetime import datetime
from typing import Dict, Any, Optional
import base64
import io

class ReceiptService:
    def __init__(self):
        self.receipt_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ transaction_type|title }} - {{ transaction_number }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: white;
            max-width: 300px;
            margin: 0 auto;
            padding: 10px;
        }
        
        .receipt-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
        }
        
        .business-logo {
            max-width: 100px;
            height: auto;
            margin-bottom: 10px;
        }
        
        .business-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
            text-transform: uppercase;
        }
        
        .business-info {
            font-size: 10px;
            margin-bottom: 3px;
        }
        
        .receipt-info {
            margin-bottom: 20px;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
        }
        
        .receipt-info-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        
        .items-section {
            margin-bottom: 20px;
        }
        
        .items-header {
            font-weight: bold;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
            margin-bottom: 10px;
        }
        
        .item {
            margin-bottom: 8px;
            border-bottom: 1px dotted #ccc;
            padding-bottom: 5px;
        }
        
        .item-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .item-name {
            font-weight: bold;
        }
        
        .item-details {
            font-size: 10px;
            color: #666;
            margin-left: 10px;
        }
        
        .totals-section {
            border-top: 2px solid #000;
            padding-top: 10px;
            margin-bottom: 20px;
        }
        
        .total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        
        .total-line.grand-total {
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 10px;
        }
        
        .payment-info {
            margin-bottom: 20px;
            border-top: 1px dashed #000;
            padding-top: 10px;
        }
        
        .receipt-footer {
            text-align: center;
            border-top: 1px dashed #000;
            padding-top: 10px;
            font-size: 10px;
        }
        
        .footer-message {
            margin-bottom: 10px;
            font-style: italic;
        }
        
        .barcode {
            margin: 10px 0;
            text-align: center;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="receipt-header">
        {% if business.logo_url %}
        <img src="{{ business.logo_url }}" alt="{{ business.name }}" class="business-logo">
        {% endif %}
        
        <div class="business-name">{{ business.name }}</div>
        
        {% if business.address %}
        <div class="business-info">{{ business.address }}</div>
        {% endif %}
        
        {% if business.phone %}
        <div class="business-info">Phone: {{ business.phone }}</div>
        {% endif %}
        
        {% if business.contact_email %}
        <div class="business-info">Email: {{ business.contact_email }}</div>
        {% endif %}
        
        {% if business.settings and business.settings.receipt_header %}
        <div class="business-info" style="margin-top: 10px; font-style: italic;">
            {{ business.settings.receipt_header }}
        </div>
        {% endif %}
    </div>
    
    <div class="receipt-info">
        <div class="receipt-info-line">
            <span>{{ transaction_type|title }} #:</span>
            <span>{{ transaction_number }}</span>
        </div>
        
        <div class="receipt-info-line">
            <span>Date:</span>
            <span>{{ transaction_date.strftime('%Y-%m-%d %H:%M:%S') }}</span>
        </div>
        
        {% if customer %}
        <div class="receipt-info-line">
            <span>Customer:</span>
            <span>{{ customer.name }}</span>
        </div>
        {% endif %}
        
        {% if cashier %}
        <div class="receipt-info-line">
            <span>Served by:</span>
            <span>{{ cashier.full_name }}</span>
        </div>
        {% endif %}
        
        {% if transaction_type == 'invoice' and due_date %}
        <div class="receipt-info-line">
            <span>Due Date:</span>
            <span>{{ due_date.strftime('%Y-%m-%d') }}</span>
        </div>
        {% endif %}
    </div>
    
    <div class="items-section">
        <div class="items-header">ITEMS</div>
        
        {% for item in items %}
        <div class="item">
            <div class="item-line">
                <span class="item-name">{{ item.product_name }}</span>
                <span>${{ "%.2f"|format(item.total_price) }}</span>
            </div>
            
            <div class="item-details">
                SKU: {{ item.product_sku }} | 
                Qty: {{ item.quantity }} × ${{ "%.2f"|format(item.unit_price) }}
            </div>
        </div>
        {% endfor %}
    </div>
    
    <div class="totals-section">
        <div class="total-line">
            <span>Subtotal:</span>
            <span>${{ "%.2f"|format(subtotal) }}</span>
        </div>
        
        {% if discount_amount > 0 %}
        <div class="total-line">
            <span>Discount:</span>
            <span>-${{ "%.2f"|format(discount_amount) }}</span>
        </div>
        {% endif %}
        
        {% if tax_amount > 0 %}
        <div class="total-line">
            <span>Tax:</span>
            <span>${{ "%.2f"|format(tax_amount) }}</span>
        </div>
        {% endif %}
        
        <div class="total-line grand-total">
            <span>TOTAL:</span>
            <span>${{ "%.2f"|format(total_amount) }}</span>
        </div>
    </div>
    
    {% if payment_method %}
    <div class="payment-info">
        <div class="total-line">
            <span>Payment Method:</span>
            <span>{{ payment_method|title }}</span>
        </div>
        
        {% if payment_method == 'cash' and change_amount is defined %}
        <div class="total-line">
            <span>Amount Paid:</span>
            <span>${{ "%.2f"|format(received_amount) }}</span>
        </div>
        
        {% if change_amount > 0 %}
        <div class="total-line">
            <span>Change:</span>
            <span>${{ "%.2f"|format(change_amount) }}</span>
        </div>
        {% endif %}
        {% endif %}
    </div>
    {% endif %}
    
    {% if notes %}
    <div class="payment-info">
        <div style="font-weight: bold; margin-bottom: 5px;">Notes:</div>
        <div style="font-size: 10px;">{{ notes }}</div>
    </div>
    {% endif %}
    
    <div class="receipt-footer">
        {% if business.settings and business.settings.receipt_footer %}
        <div class="footer-message">{{ business.settings.receipt_footer }}</div>
        {% endif %}
        
        <div class="barcode">
            <div style="font-family: monospace; font-size: 10px;">
                {{ transaction_number }}
            </div>
        </div>
        
        <div style="margin-top: 15px; font-size: 10px;">
            {{ transaction_type|title }} generated on {{ datetime.now().strftime('%Y-%m-%d at %H:%M:%S') }}
        </div>
        
        {% if transaction_type == 'invoice' %}
        <div style="margin-top: 10px; font-size: 10px; font-style: italic;">
            This is a computer generated invoice
        </div>
        {% endif %}
    </div>
</body>
</html>
        """

    def generate_receipt_html(
        self,
        transaction_data: Dict[str, Any],
        business_data: Dict[str, Any],
        customer_data: Optional[Dict[str, Any]] = None,
        cashier_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate HTML receipt from transaction data"""
        
        template = Template(self.receipt_template)
        
        return template.render(
            transaction_type=transaction_data.get("type", "receipt"),
            transaction_number=transaction_data.get("number"),
            transaction_date=transaction_data.get("date", datetime.now()),
            due_date=transaction_data.get("due_date"),
            business=business_data,
            customer=customer_data,
            cashier=cashier_data,
            items=transaction_data.get("items", []),
            subtotal=transaction_data.get("subtotal", 0),
            tax_amount=transaction_data.get("tax_amount", 0),
            discount_amount=transaction_data.get("discount_amount", 0),
            total_amount=transaction_data.get("total_amount", 0),
            payment_method=transaction_data.get("payment_method"),
            received_amount=transaction_data.get("received_amount"),
            change_amount=transaction_data.get("change_amount"),
            notes=transaction_data.get("notes"),
            datetime=datetime
        )

    def generate_receipt_pdf(self, html_content: str) -> bytes:
        """Generate PDF from HTML content"""
        try:
            # Create PDF from HTML
            html_doc = HTML(string=html_content)
            pdf_bytes = html_doc.write_pdf()
            return pdf_bytes
        except Exception as e:
            print(f"Error generating PDF: {str(e)}")
            return b""

    async def generate_transaction_receipt(
        self,
        transaction_type: str,  # 'sale' or 'invoice'
        transaction_data: Dict[str, Any],
        business_data: Dict[str, Any],
        customer_data: Optional[Dict[str, Any]] = None,
        cashier_data: Optional[Dict[str, Any]] = None,
        format_type: str = "html"  # 'html', 'pdf'
    ) -> tuple[str, Optional[bytes]]:
        """
        Generate receipt in specified format
        
        Returns:
            tuple: (html_content, pdf_bytes) - pdf_bytes is None if format is 'html'
        """
        
        # Prepare transaction data
        receipt_data = {
            "type": transaction_type,
            "number": transaction_data.get("sale_number" if transaction_type == "sale" else "invoice_number"),
            "date": transaction_data.get("created_at", datetime.now()),
            "due_date": transaction_data.get("due_date"),
            "items": transaction_data.get("items", []),
            "subtotal": transaction_data.get("subtotal", 0),
            "tax_amount": transaction_data.get("tax_amount", 0),
            "discount_amount": transaction_data.get("discount_amount", 0),
            "total_amount": transaction_data.get("total_amount", 0),
            "payment_method": transaction_data.get("payment_method"),
            "received_amount": transaction_data.get("received_amount"),
            "change_amount": transaction_data.get("change_amount"),
            "notes": transaction_data.get("notes")
        }
        
        # Generate HTML
        html_content = self.generate_receipt_html(
            transaction_data=receipt_data,
            business_data=business_data,
            customer_data=customer_data,
            cashier_data=cashier_data
        )
        
        # Generate PDF if requested
        pdf_bytes = None
        if format_type == "pdf":
            pdf_bytes = self.generate_receipt_pdf(html_content)
        
        return html_content, pdf_bytes

# Global receipt service instance
receipt_service = ReceiptService()