from fastapi import APIRouter, HTTPException, status, Depends, Query, Response
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from auth_utils import get_business_admin_or_super
from database import get_collection
from services.reports_service import reports_service
from models import ProfitReportFilter, ProfitReportSummary, ProfitReportData
from utils.currency import format_currency, get_business_currency
from bson import ObjectId
import json
from io import BytesIO, StringIO
import pandas as pd
import xlsxwriter
import csv

router = APIRouter()

@router.get("/profit")
async def get_profit_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    format: str = Query("excel", pattern="^(excel|csv|pdf)$"),
    current_user=Depends(get_business_admin_or_super)
):
    """Generate comprehensive profit report - Admin only"""
    
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
            # If end_date is date-only (no time component), set it to end of day
            if end_date and len(end_date) == 10:  # YYYY-MM-DD format (10 characters)
                end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid end_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)"
            )
    
    # Get sales data with profit calculations
    sales_collection = await get_collection("sales")
    businesses_collection = await get_collection("businesses")
    
    # Get business info for headers
    business = await businesses_collection.find_one({"_id": ObjectId(business_id)})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    # Build query
    query = {
        "business_id": ObjectId(business_id),
        "created_at": {
            "$gte": start_dt,
            "$lte": end_dt
        }
    }
    
    # Get sales data
    sales_cursor = sales_collection.find(query).sort("created_at", -1)
    sales = await sales_cursor.to_list(length=None)
    
    # Process sales data to calculate profit
    profit_data = []
    total_gross_sales = 0
    total_cogs = 0
    total_profit = 0
    total_items = 0
    
    for sale in sales:
        for item in sale.get("items", []):
            quantity = item.get("quantity", 0)
            unit_price = item.get("unit_price", 0)
            unit_cost = item.get("unit_cost_snapshot", 0)
            
            # If no cost snapshot, try to get cost from effective date or current cost
            if unit_cost is None or unit_cost == 0:
                unit_cost = await get_effective_cost(
                    item.get("product_id"),
                    sale.get("created_at"),
                    business_id
                )
            
            line_total = unit_price * quantity
            line_cost = unit_cost * quantity
            line_profit = line_total - line_cost
            
            total_gross_sales += line_total
            total_cogs += line_cost
            total_profit += line_profit
            total_items += quantity
            
            profit_data.append({
                "date_time": sale.get("created_at"),
                "invoice_id": sale.get("sale_number", str(sale.get("_id", ""))),
                "item_name": item.get("product_name", ""),
                "item_sku": item.get("product_sku", ""),
                "quantity": quantity,
                "unit_price": unit_price,
                "unit_cost": unit_cost,
                "line_profit": line_profit,
                "line_total": line_total,
                "cost_note": "(current cost used)" if unit_cost != item.get("unit_cost_snapshot") else None
            })
    
    try:
        # Generate report based on format
        if format == "excel":
            report_bytes, filename = await generate_profit_excel(
                profit_data, 
                business, 
                start_dt, 
                end_dt,
                {
                    "gross_sales": total_gross_sales,
                    "cost_of_goods_sold": total_cogs,
                    "profit": total_profit,
                    "total_items": total_items
                },
                get_business_currency(business)
            )
            return Response(
                content=report_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        elif format == "csv":
            report_bytes, filename = await generate_profit_csv(
                profit_data,
                business,
                start_dt,
                end_dt,
                {
                    "gross_sales": total_gross_sales,
                    "cost_of_goods_sold": total_cogs,
                    "profit": total_profit,
                    "total_items": total_items
                },
                get_business_currency(business)
            )
            return Response(
                content=report_bytes,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        else:  # PDF
            report_bytes, filename = await generate_profit_pdf(
                profit_data,
                business,
                start_dt,
                end_dt,
                {
                    "gross_sales": total_gross_sales,
                    "cost_of_goods_sold": total_cogs,
                    "profit": total_profit,
                    "total_items": total_items
                },
                get_business_currency(business)
            )
            return Response(
                content=report_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate profit report: {str(e)}"
        )

async def get_effective_cost(product_id: str, sale_date: datetime, business_id: str) -> float:
    """Get the effective cost for a product at a given date"""
    try:
        cost_history_collection = await get_collection("product_cost_history")
        products_collection = await get_collection("products")
        
        # Find the most recent cost history entry before or at the sale date
        cost_record = await cost_history_collection.find_one(
            {
                "product_id": ObjectId(product_id),
                "business_id": ObjectId(business_id),
                "effective_from": {"$lte": sale_date}
            },
            sort=[("effective_from", -1)]
        )
        
        if cost_record:
            return cost_record.get("cost", 0.0)
        
        # Fall back to current product cost
        product = await products_collection.find_one({
            "_id": ObjectId(product_id),
            "business_id": ObjectId(business_id)
        })
        
        if product:
            return product.get("product_cost", 0.0)
        
        return 0.0
    except:
        return 0.0

async def generate_profit_excel(profit_data: List[Dict], business: Dict, start_dt: datetime, end_dt: datetime, summary: Dict, currency: str = 'USD') -> tuple[bytes, str]:
    """Generate Excel profit report"""
    
    output = BytesIO()
    
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
        
        title_format = workbook.add_format({
            'bold': True,
            'font_size': 16,
            'align': 'center'
        })
        
        money_format = workbook.add_format({'num_format': '$#,##0.00'})
        date_format = workbook.add_format({'num_format': 'yyyy-mm-dd hh:mm'})
        
        # Create summary sheet
        summary_sheet = workbook.add_worksheet('Profit Summary')
        
        # Business header
        row = 0
        summary_sheet.write(row, 0, business.get('name', ''), title_format)
        summary_sheet.write(row + 1, 0, business.get('address', ''))
        summary_sheet.write(row + 2, 0, f"Report: Profit Report")
        summary_sheet.write(row + 3, 0, f"Period: {start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')}")
        
        row += 6
        
        # Summary KPIs
        summary_sheet.write(row, 0, 'Gross Sales:', header_format)
        summary_sheet.write(row, 1, summary['gross_sales'], money_format)
        summary_sheet.write(row, 2, f"({currency})")
        
        summary_sheet.write(row + 1, 0, 'Cost of Goods Sold:', header_format)
        summary_sheet.write(row + 1, 1, summary['cost_of_goods_sold'], money_format)
        summary_sheet.write(row + 1, 2, f"({currency})")
        
        summary_sheet.write(row + 2, 0, 'Profit:', header_format)
        summary_sheet.write(row + 2, 1, summary['profit'], money_format)
        summary_sheet.write(row + 2, 2, f"({currency})")
        
        summary_sheet.write(row + 3, 0, 'Total Items:', header_format)
        summary_sheet.write(row + 3, 1, summary['total_items'])
        summary_sheet.write(row + 3, 2, "units")
        
        # Detailed data sheet
        if profit_data:
            df_data = []
            for item in profit_data:
                df_data.append({
                    'Date/Time': item['date_time'],
                    'Invoice/Txn ID': item['invoice_id'],
                    'Item Name': item['item_name'],
                    'SKU': item['item_sku'],
                    'Qty': item['quantity'],
                    'Unit Price': item['unit_price'],
                    'Unit Cost': item['unit_cost'],
                    'Line Profit': item['line_profit'],
                    'Line Total': item['line_total'],
                    'Notes': item.get('cost_note', '')
                })
            
            df = pd.DataFrame(df_data)
            df.to_excel(writer, sheet_name='Detailed Profit Analysis', index=False)
            
            detail_sheet = writer.sheets['Detailed Profit Analysis']
            
            # Set column widths and formats
            detail_sheet.set_column('A:A', 18, date_format)  # Date/Time
            detail_sheet.set_column('B:B', 15)  # Invoice ID
            detail_sheet.set_column('C:C', 25)  # Item Name
            detail_sheet.set_column('D:D', 12)  # SKU
            detail_sheet.set_column('E:E', 8)   # Qty
            detail_sheet.set_column('F:I', 12, money_format)  # Money columns
            detail_sheet.set_column('J:J', 20)  # Notes
            
            # Apply header format
            for col_num, value in enumerate(df.columns.values):
                detail_sheet.write(0, col_num, value, header_format)
        
        # Set column widths for summary sheet
        summary_sheet.set_column('A:A', 25)
        summary_sheet.set_column('B:B', 15)
    
    output.seek(0)
    filename = f"profit-report_{start_dt.strftime('%Y-%m-%d')}_to_{end_dt.strftime('%Y-%m-%d')}.xlsx"
    
    return output.getvalue(), filename

async def generate_profit_csv(profit_data: List[Dict], business: Dict, start_dt: datetime, end_dt: datetime, summary: Dict, currency: str = 'USD') -> tuple[bytes, str]:
    """Generate CSV profit report"""
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Business header
    writer.writerow([business.get('name', '')])
    writer.writerow([business.get('address', '')])
    writer.writerow([business.get('logo_url', '')])  # Logo URL for CSV
    writer.writerow([f"Report: Profit Report"])
    writer.writerow([f"Period: {start_dt.strftime('%Y-%m-%d')} to {end_dt.strftime('%Y-%m-%d')}"])
    writer.writerow([])  # Empty row
    
    # Summary
    writer.writerow(['SUMMARY'])
    writer.writerow(['Gross Sales', format_currency(summary['gross_sales'], currency)])
    writer.writerow(['Cost of Goods Sold', format_currency(summary['cost_of_goods_sold'], currency)])
    writer.writerow(['Profit', format_currency(summary['profit'], currency)])
    writer.writerow(['Total Items', summary['total_items']])
    writer.writerow(['Currency', currency])
    writer.writerow([])  # Empty row
    
    # Detailed data
    writer.writerow(['DETAILED PROFIT ANALYSIS'])
    writer.writerow([
        'Date/Time', 'Invoice/Txn ID', 'Item Name', 'SKU', 'Qty', 
        'Unit Price', 'Unit Cost', 'Line Profit', 'Line Total', 'Notes'
    ])
    
    for item in profit_data:
        writer.writerow([
            item['date_time'].strftime('%Y-%m-%d %H:%M:%S'),
            item['invoice_id'],
            item['item_name'],
            item['item_sku'],
            item['quantity'],
            format_currency(item['unit_price'], currency),
            format_currency(item['unit_cost'], currency),
            format_currency(item['line_profit'], currency),
            format_currency(item['line_total'], currency),
            item.get('cost_note', '')
        ])
    
    # Add totals row
    writer.writerow([])
    writer.writerow([
        '', '', '', '', 'TOTALS:',
        '', '', 
        format_currency(summary['profit'], currency),
        format_currency(summary['gross_sales'], currency),
        ''
    ])
    
    output.seek(0)
    filename = f"profit-report_{start_dt.strftime('%Y-%m-%d')}_to_{end_dt.strftime('%Y-%m-%d')}.csv"
    
    return output.getvalue().encode('utf-8'), filename

async def generate_profit_pdf(profit_data: List[Dict], business: Dict, start_dt: datetime, end_dt: datetime, summary: Dict, currency: str = 'USD') -> tuple[bytes, str]:
    """Generate PDF profit report"""
    
    from jinja2 import Template
    import weasyprint
    from utils.currency import format_currency
    
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: Arial, sans-serif; margin: 0; }
            .header { text-align: center; color: #333; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 20px; }
            .business-info { text-align: center; margin-bottom: 20px; }
            .business-logo { max-width: 150px; max-height: 80px; margin: 0 auto 10px; }
            .summary { background: #f5f5f5; padding: 20px; margin-bottom: 30px; border-radius: 5px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
            .summary-item { text-align: center; padding: 10px; background: white; border-radius: 5px; }
            .summary-value { font-size: 24px; font-weight: bold; color: #2c5aa0; margin-bottom: 5px; }
            .summary-label { color: #666; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; text-align: center; }
            .money { text-align: right; }
            .center { text-align: center; }
            .profit-positive { color: #28a745; font-weight: bold; }
            .profit-negative { color: #dc3545; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f8f9fa; }
            .page-footer { position: fixed; bottom: 1cm; width: 100%; text-align: center; font-size: 10px; color: #666; }
        </style>
    </head>
    <body>
        <div class="business-info">
            {% if business.logo_url %}
            <img src="{{ business.logo_url }}" class="business-logo" alt="Business Logo">
            {% endif %}
            <h1>{{ business.name }}</h1>
            <p>{{ business.address or '' }}</p>
            <p>{{ business.phone or '' }} | {{ business.email or '' }}</p>
        </div>
        
        <div class="header">
            <h2>Profit Report</h2>
            <p><strong>Period:</strong> {{ start_date }} to {{ end_date }}</p>
            <p><strong>Currency:</strong> {{ currency }}</p>
        </div>
        
        <div class="summary">
            <h3>Executive Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">{{ format_currency(summary.gross_sales, currency) }}</div>
                    <div class="summary-label">Gross Sales</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ format_currency(summary.cost_of_goods_sold, currency) }}</div>
                    <div class="summary-label">Cost of Goods Sold</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value {% if summary.profit >= 0 %}profit-positive{% else %}profit-negative{% endif %}">{{ format_currency(summary.profit, currency) }}</div>
                    <div class="summary-label">Net Profit</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ summary.total_items }}</div>
                    <div class="summary-label">Total Items Sold</div>
                </div>
            </div>
        </div>
        
        {% if profit_data %}
        <div>
            <h3>Detailed Transaction Analysis</h3>
            {% if profit_data|length > 50 %}
            <p><em>Showing top 50 transactions (of {{ profit_data|length }} total)</em></p>
            {% endif %}
            <table>
                <thead>
                    <tr>
                        <th style="width: 12%;">Date/Time</th>
                        <th style="width: 10%;">Invoice ID</th>
                        <th style="width: 25%;">Item Name</th>
                        <th style="width: 10%;">SKU</th>
                        <th style="width: 8%;">Qty</th>
                        <th style="width: 10%;">Unit Price</th>
                        <th style="width: 10%;">Unit Cost</th>
                        <th style="width: 10%;">Line Profit</th>
                        <th style="width: 10%;">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    {% for item in profit_data[:50] %}
                    <tr>
                        <td>{{ item.date_time.strftime('%m/%d/%Y %H:%M') }}</td>
                        <td class="center">{{ item.invoice_id }}</td>
                        <td>{{ item.item_name }}</td>
                        <td class="center">{{ item.item_sku }}</td>
                        <td class="center">{{ item.quantity }}</td>
                        <td class="money">{{ format_currency(item.unit_price, currency) }}</td>
                        <td class="money">{{ format_currency(item.unit_cost, currency) }}</td>
                        <td class="money {% if item.line_profit >= 0 %}profit-positive{% else %}profit-negative{% endif %}">{{ format_currency(item.line_profit, currency) }}</td>
                        <td class="money">{{ format_currency(item.line_total, currency) }}</td>
                    </tr>
                    {% endfor %}
                    <tr class="totals-row">
                        <td colspan="7" style="text-align: right;"><strong>TOTALS:</strong></td>
                        <td class="money {% if summary.profit >= 0 %}profit-positive{% else %}profit-negative{% endif %}"><strong>{{ format_currency(summary.profit, currency) }}</strong></td>
                        <td class="money"><strong>{{ format_currency(summary.gross_sales, currency) }}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
        {% else %}
        <div style="text-align: center; padding: 40px; color: #666;">
            <h3>No Transaction Data</h3>
            <p>No sales data found for the selected date range.</p>
        </div>
        {% endif %}
        
        <div class="page-footer">
            <p>Generated on {{ generation_date }} | {{ business.name }} - Profit Report</p>
        </div>
    </body>
    </html>
    """
    
    try:
        template = Template(html_template)
        html_content = template.render(
            business=business,
            start_date=start_dt.strftime('%B %d, %Y'),
            end_date=end_dt.strftime('%B %d, %Y'),
            currency=currency,
            summary=summary,
            profit_data=profit_data,
            format_currency=lambda amount, curr: format_currency(amount, curr),
            generation_date=datetime.now().strftime('%B %d, %Y at %I:%M %p')
        )
        
        # Generate PDF using weasyprint
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
        filename = f"profit-report_{start_dt.strftime('%Y-%m-%d')}_to_{end_dt.strftime('%Y-%m-%d')}.pdf"
        
        return pdf_bytes, filename
        
    except ImportError:
        # Fallback if weasyprint is not available
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF generation service is temporarily unavailable. Please use Excel or CSV export instead."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {str(e)}"
        )