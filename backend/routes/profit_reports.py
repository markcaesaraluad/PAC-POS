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

async def generate_profit_csv(profit_data: List[Dict], business: Dict, start_dt: datetime, end_dt: datetime, summary: Dict) -> tuple[bytes, str]:
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
    writer.writerow(['Gross Sales', f"${summary['gross_sales']:.2f}"])
    writer.writerow(['Cost of Goods Sold', f"${summary['cost_of_goods_sold']:.2f}"])
    writer.writerow(['Profit', f"${summary['profit']:.2f}"])
    writer.writerow(['Total Items', summary['total_items']])
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
            f"${item['unit_price']:.2f}",
            f"${item['unit_cost']:.2f}",
            f"${item['line_profit']:.2f}",
            f"${item['line_total']:.2f}",
            item.get('cost_note', '')
        ])
    
    # Add totals row
    writer.writerow([])
    writer.writerow([
        '', '', '', '', 'TOTALS:',
        '', '', 
        f"${summary['profit']:.2f}",
        f"${summary['gross_sales']:.2f}",
        ''
    ])
    
    output.seek(0)
    filename = f"profit-report_{start_dt.strftime('%Y-%m-%d')}_to_{end_dt.strftime('%Y-%m-%d')}.csv"
    
    return output.getvalue().encode('utf-8'), filename

async def generate_profit_pdf(profit_data: List[Dict], business: Dict, start_dt: datetime, end_dt: datetime, summary: Dict) -> tuple[bytes, str]:
    """Generate PDF profit report"""
    
    from jinja2 import Template
    
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; color: #333; margin-bottom: 30px; }
            .business-info { text-align: center; margin-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 20px; margin-bottom: 30px; border-radius: 5px; }
            .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .summary-item { text-align: center; }
            .summary-value { font-size: 20px; font-weight: bold; color: #2c5aa0; }
            .summary-label { color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            .money { text-align: right; }
            .center { text-align: center; }
            .profit-positive { color: #28a745; font-weight: bold; }
            .profit-negative { color: #dc3545; font-weight: bold; }
            .totals-row { font-weight: bold; background-color: #f8f9fa; }
        </style>
    </head>
    <body>
        <div class="business-info">
            <h1>{{ business.name }}</h1>
            <p>{{ business.address }}</p>
        </div>
        
        <div class="header">
            <h2>Profit Report</h2>
            <p>{{ start_date }} to {{ end_date }}</p>
        </div>
        
        <div class="summary">
            <h3>Summary</h3>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">${{ "%.2f"|format(summary.gross_sales) }}</div>
                    <div class="summary-label">Gross Sales</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${{ "%.2f"|format(summary.cost_of_goods_sold) }}</div>
                    <div class="summary-label">Cost of Goods Sold</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value {% if summary.profit >= 0 %}profit-positive{% else %}profit-negative{% endif %}">${{ "%.2f"|format(summary.profit) }}</div>
                    <div class="summary-label">Profit</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{{ summary.total_items }}</div>
                    <div class="summary-label">Total Items</div>
                </div>
            </div>
        </div>
        
        {% if profit_data %}
        <div>
            <h3>Detailed Analysis (Top 50 Transactions)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date/Time</th>
                        <th>Invoice ID</th>
                        <th>Item Name</th>
                        <th>SKU</th>
                        <th class="center">Qty</th>
                        <th class="money">Unit Price</th>
                        <th class="money">Unit Cost</th>
                        <th class="money">Line Profit</th>
                        <th class="money">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    {% for item in profit_data[:50] %}
                    <tr>
                        <td>{{ item.date_time.strftime('%Y-%m-%d %H:%M') }}</td>
                        <td>{{ item.invoice_id }}</td>
                        <td>{{ item.item_name }}</td>
                        <td>{{ item.item_sku }}</td>
                        <td class="center">{{ item.quantity }}</td>
                        <td class="money">${{ "%.2f"|format(item.unit_price) }}</td>
                        <td class="money">${{ "%.2f"|format(item.unit_cost) }}</td>
                        <td class="money {% if item.line_profit >= 0 %}profit-positive{% else %}profit-negative{% endif %}">${{ "%.2f"|format(item.line_profit) }}</td>
                        <td class="money">${{ "%.2f"|format(item.line_total) }}</td>
                    </tr>
                    {% endfor %}
                    <tr class="totals-row">
                        <td colspan="7"><strong>TOTALS:</strong></td>
                        <td class="money {% if summary.profit >= 0 %}profit-positive{% else %}profit-negative{% endif %}"><strong>${{ "%.2f"|format(summary.profit) }}</strong></td>
                        <td class="money"><strong>${{ "%.2f"|format(summary.gross_sales) }}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
        {% endif %}
        
        <div style="margin-top: 30px; font-size: 10px; color: #666;">
            <p><strong>Note:</strong> Items marked with "(current cost used)" indicate historical cost data was not available and current product cost was used for calculation.</p>
        </div>
    </body>
    </html>
    """
    
    template = Template(html_template)
    html_content = template.render(
        business=business,
        start_date=start_dt.strftime('%Y-%m-%d'),
        end_date=end_dt.strftime('%Y-%m-%d'),
        summary=summary,
        profit_data=profit_data
    )
    
    try:
        # For now, return a simple message since WeasyPrint has compatibility issues
        raise Exception("PDF generation temporarily disabled due to system compatibility issues. Please use Excel or CSV format.")
    except Exception as e:
        raise Exception(f"PDF generation error: {str(e)}")