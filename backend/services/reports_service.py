"""
Reports Service - Generate Excel and PDF reports for sales and business data
"""

import pandas as pd
from io import BytesIO
import xlsxwriter
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
from weasyprint import HTML, CSS
from jinja2 import Template
import logging

logger = logging.getLogger(__name__)

class ReportsService:
    def __init__(self):
        self.excel_mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        self.pdf_mime_type = "application/pdf"
    
    async def generate_sales_report(
        self, 
        sales_data: List[Dict[str, Any]], 
        start_date: datetime, 
        end_date: datetime,
        format_type: str = "excel"
    ) -> tuple[bytes, str]:
        """Generate sales report in Excel or PDF format"""
        
        if format_type.lower() == "excel":
            return await self._generate_sales_excel(sales_data, start_date, end_date)
        elif format_type.lower() == "pdf":
            return await self._generate_sales_pdf(sales_data, start_date, end_date)
        else:
            raise ValueError("Format must be 'excel' or 'pdf'")
    
    async def _generate_sales_excel(
        self, 
        sales_data: List[Dict[str, Any]], 
        start_date: datetime, 
        end_date: datetime
    ) -> tuple[bytes, str]:
        """Generate Excel sales report"""
        
        output = BytesIO()
        
        # Create workbook with xlsxwriter
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            workbook = writer.book
            
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
            
            # Sales Summary Sheet
            summary_data = self._calculate_sales_summary(sales_data)
            summary_df = pd.DataFrame([summary_data])
            summary_df.to_excel(writer, sheet_name='Sales Summary', index=False)
            
            summary_sheet = writer.sheets['Sales Summary']
            summary_sheet.set_column('A:F', 15)
            for col_num, value in enumerate(summary_df.columns.values):
                summary_sheet.write(0, col_num, value, header_format)
            
            # Detailed Sales Sheet
            if sales_data:
                sales_df = self._prepare_sales_dataframe(sales_data)
                sales_df.to_excel(writer, sheet_name='Detailed Sales', index=False)
                
                sales_sheet = writer.sheets['Detailed Sales']
                sales_sheet.set_column('A:A', 15)  # Sale Number
                sales_sheet.set_column('B:B', 20)  # Date
                sales_sheet.set_column('C:C', 20)  # Customer
                sales_sheet.set_column('D:D', 20)  # Cashier
                sales_sheet.set_column('E:E', 15)  # Items Count
                sales_sheet.set_column('F:I', 12)  # Money columns
                sales_sheet.set_column('J:J', 15)  # Payment Method
                
                # Apply formats
                for col_num, value in enumerate(sales_df.columns.values):
                    sales_sheet.write(0, col_num, value, header_format)
            
            # Products Performance Sheet
            products_performance = self._calculate_products_performance(sales_data)
            if products_performance:
                products_df = pd.DataFrame(products_performance)
                products_df.to_excel(writer, sheet_name='Products Performance', index=False)
                
                products_sheet = writer.sheets['Products Performance']
                products_sheet.set_column('A:A', 25)  # Product Name
                products_sheet.set_column('B:B', 15)  # SKU
                products_sheet.set_column('C:E', 12)  # Quantities and Revenue
                
                for col_num, value in enumerate(products_df.columns.values):
                    products_sheet.write(0, col_num, value, header_format)
        
        output.seek(0)
        filename = f"sales_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.xlsx"
        
        return output.getvalue(), filename
    
    async def _generate_sales_pdf(
        self, 
        sales_data: List[Dict[str, Any]], 
        start_date: datetime, 
        end_date: datetime
    ) -> tuple[bytes, str]:
        """Generate PDF sales report"""
        
        # Calculate summary data
        summary_data = self._calculate_sales_summary(sales_data)
        products_performance = self._calculate_products_performance(sales_data)
        
        # HTML template for PDF
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; color: #333; margin-bottom: 30px; }
                .summary { background: #f5f5f5; padding: 20px; margin-bottom: 30px; border-radius: 5px; }
                .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                .summary-item { text-align: center; }
                .summary-value { font-size: 24px; font-weight: bold; color: #2c5aa0; }
                .summary-label { color: #666; margin-top: 5px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                .money { text-align: right; }
                .center { text-align: center; }
                .products-table { font-size: 12px; }
                .page-break { page-break-before: always; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Sales Report</h1>
                <p>{{ start_date }} to {{ end_date }}</p>
            </div>
            
            <div class="summary">
                <h2>Summary</h2>
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-value">${{ "%.2f"|format(summary.total_revenue) }}</div>
                        <div class="summary-label">Total Revenue</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">{{ summary.total_sales }}</div>
                        <div class="summary-label">Total Sales</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">{{ summary.total_items_sold }}</div>
                        <div class="summary-label">Items Sold</div>
                    </div>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <div style="display: inline-block; margin: 0 20px;">
                        <strong>Average Sale: ${{ "%.2f"|format(summary.average_sale) }}</strong>
                    </div>
                    <div style="display: inline-block; margin: 0 20px;">
                        <strong>Total Tax: ${{ "%.2f"|format(summary.total_tax) }}</strong>
                    </div>
                </div>
            </div>
            
            {% if products_performance %}
            <div>
                <h2>Top Products Performance</h2>
                <table class="products-table">
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>SKU</th>
                            <th class="center">Qty Sold</th>
                            <th class="money">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for product in products_performance[:10] %}
                        <tr>
                            <td>{{ product.product_name }}</td>
                            <td>{{ product.sku }}</td>
                            <td class="center">{{ product.quantity_sold }}</td>
                            <td class="money">${{ "%.2f"|format(product.total_revenue) }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
            {% endif %}
            
            {% if sales_data %}
            <div class="page-break">
                <h2>Recent Sales Details</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Sale #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th class="center">Items</th>
                            <th class="money">Amount</th>
                            <th>Payment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for sale in sales_data[:20] %}
                        <tr>
                            <td>{{ sale.sale_number }}</td>
                            <td>{{ sale.created_at.strftime('%Y-%m-%d %H:%M') }}</td>
                            <td>{{ sale.customer_name or 'Walk-in Customer' }}</td>
                            <td class="center">{{ sale.items|length if sale.items else 0 }}</td>
                            <td class="money">${{ "%.2f"|format(sale.total_amount) }}</td>
                            <td>{{ sale.payment_method|title }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
            {% endif %}
        </body>
        </html>
        """
        
        template = Template(html_template)
        html_content = template.render(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d'),
            summary=summary_data,
            products_performance=products_performance,
            sales_data=sales_data
        )
        
        # Generate PDF
        try:
            pdf_bytes = HTML(string=html_content).write_pdf()
            filename = f"sales_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf"
            return pdf_bytes, filename
        except Exception as e:
            logger.error(f"Error generating PDF: {e}")
            raise
    
    def _calculate_sales_summary(self, sales_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate sales summary statistics"""
        
        if not sales_data:
            return {
                'total_revenue': 0,
                'total_sales': 0,
                'total_items_sold': 0,
                'average_sale': 0,
                'total_tax': 0,
                'total_discount': 0
            }
        
        total_revenue = sum(sale.get('total_amount', 0) for sale in sales_data)
        total_sales = len(sales_data)
        total_items_sold = sum(
            sum(item.get('quantity', 0) for item in sale.get('items', []))
            for sale in sales_data
        )
        total_tax = sum(sale.get('tax_amount', 0) for sale in sales_data)
        total_discount = sum(sale.get('discount_amount', 0) for sale in sales_data)
        
        return {
            'total_revenue': total_revenue,
            'total_sales': total_sales,
            'total_items_sold': total_items_sold,
            'average_sale': total_revenue / total_sales if total_sales > 0 else 0,
            'total_tax': total_tax,
            'total_discount': total_discount
        }
    
    def _prepare_sales_dataframe(self, sales_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """Prepare sales data for Excel export"""
        
        sales_records = []
        for sale in sales_data:
            sales_records.append({
                'Sale Number': sale.get('sale_number', ''),
                'Date': sale.get('created_at', ''),
                'Customer': sale.get('customer_name', 'Walk-in Customer'),
                'Cashier': sale.get('cashier_name', ''),
                'Items Count': len(sale.get('items', [])),
                'Subtotal': sale.get('subtotal', 0),
                'Tax': sale.get('tax_amount', 0),
                'Discount': sale.get('discount_amount', 0),
                'Total': sale.get('total_amount', 0),
                'Payment Method': sale.get('payment_method', '').title()
            })
        
        return pd.DataFrame(sales_records)
    
    def _calculate_products_performance(self, sales_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Calculate product performance metrics"""
        
        products_data = {}
        
        for sale in sales_data:
            for item in sale.get('items', []):
                product_id = item.get('product_id', '')
                product_name = item.get('product_name', '')
                product_sku = item.get('product_sku', '')
                quantity = item.get('quantity', 0)
                total_price = item.get('total_price', 0)
                
                if product_id not in products_data:
                    products_data[product_id] = {
                        'product_name': product_name,
                        'sku': product_sku,
                        'quantity_sold': 0,
                        'total_revenue': 0
                    }
                
                products_data[product_id]['quantity_sold'] += quantity
                products_data[product_id]['total_revenue'] += total_price
        
        # Sort by revenue descending
        products_performance = list(products_data.values())
        products_performance.sort(key=lambda x: x['total_revenue'], reverse=True)
        
        return products_performance
    
    async def generate_inventory_report(
        self, 
        products_data: List[Dict[str, Any]], 
        format_type: str = "excel"
    ) -> tuple[bytes, str]:
        """Generate inventory report"""
        
        if format_type.lower() == "excel":
            return await self._generate_inventory_excel(products_data)
        elif format_type.lower() == "pdf":
            return await self._generate_inventory_pdf(products_data)
        else:
            raise ValueError("Format must be 'excel' or 'pdf'")
    
    async def _generate_inventory_excel(self, products_data: List[Dict[str, Any]]) -> tuple[bytes, str]:
        """Generate Excel inventory report"""
        
        output = BytesIO()
        
        # Prepare dataframe
        inventory_records = []
        for product in products_data:
            inventory_records.append({
                'Product Name': product.get('name', ''),
                'SKU': product.get('sku', ''),
                'Category': product.get('category_name', 'Uncategorized'),
                'Current Stock': product.get('quantity', 0),
                'Unit Price': product.get('price', 0),
                'Total Value': product.get('quantity', 0) * product.get('price', 0),
                'Low Stock Alert': 'Yes' if product.get('quantity', 0) <= product.get('low_stock_threshold', 10) else 'No',
                'Status': 'Active' if product.get('is_active', True) else 'Inactive'
            })
        
        df = pd.DataFrame(inventory_records)
        
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, sheet_name='Inventory Report', index=False)
            
            workbook = writer.book
            worksheet = writer.sheets['Inventory Report']
            
            # Format styles
            header_format = workbook.add_format({
                'bold': True,
                'text_wrap': True,
                'valign': 'top',
                'fg_color': '#D7E4BC',
                'border': 1
            })
            
            money_format = workbook.add_format({'num_format': '$#,##0.00'})
            
            # Set column widths and formats
            worksheet.set_column('A:A', 25)  # Product Name
            worksheet.set_column('B:B', 15)  # SKU
            worksheet.set_column('C:C', 20)  # Category
            worksheet.set_column('D:D', 12)  # Stock
            worksheet.set_column('E:F', 12, money_format)  # Price columns
            worksheet.set_column('G:H', 15)  # Alert and Status
            
            # Apply header format
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
        
        output.seek(0)
        filename = f"inventory_report_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return output.getvalue(), filename
    
    async def _generate_inventory_pdf(self, products_data: List[Dict[str, Any]]) -> tuple[bytes, str]:
        """Generate PDF inventory report"""
        
        # Calculate summary
        total_products = len(products_data)
        total_value = sum(
            product.get('quantity', 0) * product.get('price', 0) 
            for product in products_data
        )
        low_stock_items = [
            product for product in products_data 
            if product.get('quantity', 0) <= product.get('low_stock_threshold', 10)
        ]
        
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; color: #333; margin-bottom: 30px; }
                .summary { background: #f5f5f5; padding: 20px; margin-bottom: 30px; border-radius: 5px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                th { background-color: #4CAF50; color: white; }
                .money { text-align: right; }
                .center { text-align: center; }
                .low-stock { background-color: #ffebcd; }
                .alert { color: #ff6b6b; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Inventory Report</h1>
                <p>Generated on {{ current_date }}</p>
            </div>
            
            <div class="summary">
                <h2>Inventory Summary</h2>
                <p><strong>Total Products:</strong> {{ total_products }}</p>
                <p><strong>Total Inventory Value:</strong> ${{ "%.2f"|format(total_value) }}</p>
                <p><strong>Low Stock Items:</strong> {{ low_stock_count }}</p>
            </div>
            
            {% if low_stock_items %}
            <div>
                <h2>Low Stock Alerts</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>SKU</th>
                            <th class="center">Current Stock</th>
                            <th class="money">Unit Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for product in low_stock_items %}
                        <tr class="low-stock">
                            <td>{{ product.name }}</td>
                            <td>{{ product.sku }}</td>
                            <td class="center alert">{{ product.quantity }}</td>
                            <td class="money">${{ "%.2f"|format(product.price) }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
            {% endif %}
            
            <div>
                <h2>Full Inventory</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>SKU</th>
                            <th>Category</th>
                            <th class="center">Stock</th>
                            <th class="money">Price</th>
                            <th class="money">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for product in products_data[:50] %}
                        <tr{% if product.quantity <= (product.low_stock_threshold or 10) %} class="low-stock"{% endif %}>
                            <td>{{ product.name }}</td>
                            <td>{{ product.sku }}</td>
                            <td>{{ product.category_name or 'Uncategorized' }}</td>
                            <td class="center">{{ product.quantity }}</td>
                            <td class="money">${{ "%.2f"|format(product.price) }}</td>
                            <td class="money">${{ "%.2f"|format(product.quantity * product.price) }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
        """
        
        template = Template(html_template)
        html_content = template.render(
            current_date=datetime.now().strftime('%Y-%m-%d %H:%M'),
            total_products=total_products,
            total_value=total_value,
            low_stock_count=len(low_stock_items),
            low_stock_items=low_stock_items,
            products_data=products_data
        )
        
        # Generate PDF
        try:
            # Temporary workaround for WeasyPrint compatibility issue
            raise Exception("PDF generation temporarily disabled due to system compatibility issues. Please use Excel format.")
        except Exception as e:
            logger.error(f"Error generating inventory PDF: {e}")
            raise

# Create singleton instance
reports_service = ReportsService()