import React, { useState, useEffect, useCallback } from 'react';
import { salesAPI, invoicesAPI, customersAPI, businessAPI } from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import { useAuth } from '../../context/AuthContext';
import enhancedPrinterService from '../../services/printerService';
import bluetoothPrinterService from '../../services/bluetoothPrinter';
import toast from 'react-hot-toast';
import { 
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner, { InlineSpinner } from '../../components/LoadingSpinner';

const SalesHistory = () => {
  const { formatAmount } = useCurrency();
  const { business, user } = useAuth();
  const [activeTab, setActiveTab] = useState('sales');
  const [sales, setSales] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  
  // Reprint receipt state
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintTransaction, setReprintTransaction] = useState(null);
  const [reprintPreview, setReprintPreview] = useState(null);

  // Simple date filter state (no complex global filter to avoid infinite loops)
  const [dateFilter, setDateFilter] = useState('today');

  // Simple data fetching without complex dependencies
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = { date_preset: dateFilter };
      console.log('Sales History simple fetch with params:', params);
      
      // Fetch data based on active tab and basic customers data
      const promises = [customersAPI.getCustomers()];
      
      if (activeTab === 'sales') {
        promises.push(salesAPI.getSales(params));
        promises.push(Promise.resolve({ data: [] })); // Empty invoices
      } else {
        promises.push(Promise.resolve({ data: [] })); // Empty sales
        promises.push(invoicesAPI.getInvoices(params));
      }
      
      const [customersResponse, salesResponse, invoicesResponse] = await Promise.all(promises);
      
      setCustomers(Array.isArray(customersResponse.data) ? customersResponse.data : []);
      setSales(Array.isArray(salesResponse.data) ? salesResponse.data : []);
      setInvoices(Array.isArray(invoicesResponse.data) ? invoicesResponse.data : []);
      
    } catch (error) {
      console.error('Failed to fetch sales history:', error);
      toast.error('Failed to load sales history');
      setSales([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFilter]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCustomerName = (customerId) => {
    if (!customerId) return 'Walk-in Customer';
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : 'Unknown Customer';
  };

  const generateReprintPreview = (transaction, transactionType) => {
    // Get customer info
    const customer = transaction.customer_id 
      ? customers.find(c => c.id === transaction.customer_id) 
      : null;

    // Generate receipt preview data - use ONLY actual business settings, no hardcoded values
    const receiptData = {
      business: business, // Use actual business context from database
      transaction_number: transactionType === 'sale' ? transaction.sale_number : transaction.invoice_number,
      transaction_type: transactionType.toUpperCase(),
      timestamp: new Date(transaction.created_at),
      customer: customer,
      items: transaction.items,
      subtotal: transaction.subtotal,
      tax_amount: transaction.tax_amount,
      discount_amount: transaction.discount_amount,
      total_amount: transaction.total_amount,
      payment_method: transaction.payment_method,
      received_amount: transaction.received_amount,
      change_amount: transaction.change_amount,
      notes: transaction.notes,
      reprint: true,
      reprint_timestamp: new Date()
    };
    
    return receiptData;
  };

  const handleReprintReceipt = (transaction, transactionType) => {
    const receiptData = generateReprintPreview(transaction, transactionType);
    setReprintTransaction({ ...transaction, type: transactionType });
    setReprintPreview(receiptData);
    setShowReprintModal(true);
  };

  // FEATURE 5: Auto Print from Sales Report + FEATURE 8: Enhanced reprint modal
  const printReceipt = async () => {
    try {
      setActionLoading('print');
      
      // Generate comprehensive receipt data with proper formatting
      const receiptData = generatePrintReceiptData();
      
      // FEATURE 5: Auto-print directly without dialog (skip print dialog where possible)
      const printerType = business?.settings?.printer_type || 'local';
      
      if (printerType === 'bluetooth') {
        // Use Bluetooth printer service for direct ESC/POS printing
        const printerStatus = bluetoothPrinterService.getStatus();
        if (!printerStatus.isConnected) {
          toast('Auto-print skipped - Bluetooth printer not connected');
          return;
        }
        await bluetoothPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
        toast.success('Receipt auto-printed via Bluetooth');
      } else {
        // For local/network printer, attempt direct printing with auto-close
        try {
          await enhancedPrinterService.configurePrinter({
            id: 'system-default',
            name: business?.settings?.selected_printer || 'Default System Printer',
            type: 'local',
            settings: business?.settings?.printer_settings
          });
          
          await enhancedPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
          toast.success('Receipt auto-printed to system printer');
        } catch (printerError) {
          // Fallback to browser print with attempted auto-close
          await handleBrowserPrintWithAutoClose(receiptData);
          toast.success('Receipt printed (browser)');
        }
      }
      
      setShowReprintModal(false);
      setReprintTransaction(null);
      setReprintPreview(null);
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print receipt');
    } finally {
      setActionLoading(null);
    }
  };

  // Helper function to generate print-ready receipt data
  const generatePrintReceiptData = () => {
    return {
      business: business, // Use actual business context from database - no hardcoded fallbacks
      transaction_number: reprintTransaction.type === 'sale' ? reprintTransaction.sale_number : reprintTransaction.invoice_number,
      transaction_type: reprintTransaction.type.toUpperCase(),
      timestamp: new Date(reprintTransaction.created_at),
      customer: reprintTransaction.customer_id 
        ? customers.find(c => c.id === reprintTransaction.customer_id) 
        : null,
      cashier_name: reprintTransaction.cashier_name || user?.email || 'Staff',
      items: reprintTransaction.items,
      subtotal: reprintTransaction.subtotal,
      tax_amount: reprintTransaction.tax_amount,
      discount_amount: reprintTransaction.discount_amount,
      total_amount: reprintTransaction.total_amount,
      payment_method: reprintTransaction.payment_method,
      received_amount: reprintTransaction.received_amount,
      change_amount: reprintTransaction.change_amount,
      notes: reprintTransaction.notes,
      reprint: true,
      reprint_timestamp: new Date()
    };
  };

  // Enhanced browser print with auto-close attempt
  const handleBrowserPrintWithAutoClose = async (receiptData) => {
    return new Promise((resolve) => {
      try {
        const receiptHTML = generateReceiptHTML(receiptData);
        
        // Create iframe for printing
        const printFrame = document.createElement('iframe');
        printFrame.style.position = 'absolute';
        printFrame.style.left = '-9999px';
        printFrame.style.width = '1px';
        printFrame.style.height = '1px';
        document.body.appendChild(printFrame);
        
        const printDocument = printFrame.contentDocument;
        printDocument.open();
        printDocument.write(receiptHTML);
        printDocument.close();
        
        // Attempt to print and auto-close dialog
        setTimeout(() => {
          try {
            printFrame.contentWindow.print();
            
            // Try to auto-close print dialog (may not work in all browsers)
            setTimeout(() => {
              if (printFrame.contentWindow) {
                printFrame.contentWindow.close();
              }
            }, 1000);
            
            // Clean up iframe
            setTimeout(() => {
              try {
                document.body.removeChild(printFrame);
              } catch (e) {
                console.log('Iframe cleanup error (non-critical)');
              }
              resolve();
            }, 2000);
            
          } catch (printError) {
            console.error('Print error:', printError);
            resolve();
          }
        }, 500);
        
      } catch (error) {
        console.error('Browser print setup failed:', error);
        resolve();
      }
    });
  };

  // Generate receipt HTML with enhanced formatting including logo, header, footer
  const generateReceiptHTML = (receiptData) => {
    const businessLogo = receiptData.business?.logo_url || '';
    const receiptHeader = receiptData.business?.settings?.receipt_header || business?.settings?.receipt_header || '';
    const receiptFooter = receiptData.business?.settings?.receipt_footer || business?.settings?.receipt_footer || '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt Reprint</title>
          <style>
            @media print {
              @page { margin: 0; size: 80mm auto; }
              body { margin: 0; }
            }
            body {
              font-family: 'Courier New', 'Consolas', monospace;
              font-size: 10px;
              line-height: 1.1;
              margin: 0;
              padding: 15px;
              width: 280px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 4px 0; }
            .flex { display: flex; justify-content: space-between; }
            .logo { max-width: 120px; max-height: 80px; margin: 0 auto 8px auto; display: block; }
            .header { border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
            .total { border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
            .reprint-notice { 
              background-color: #fee; 
              border: 1px solid #fcc; 
              padding: 4px; 
              margin: 8px 0; 
              font-size: 9px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header center">
            ${businessLogo ? `<img src="${businessLogo}" alt="Logo" class="logo" />` : ''}
            <div class="bold" style="font-size: 14px;">${receiptData.business.name}</div>
            ${receiptData.business.address ? `<div style="font-size: 9px;">${receiptData.business.address}</div>` : ''}
            ${receiptData.business.phone ? `<div style="font-size: 9px;">Tel: ${receiptData.business.phone}</div>` : ''}
            ${receiptData.business.contact_email ? `<div style="font-size: 9px;">Email: ${receiptData.business.contact_email}</div>` : ''}
            ${receiptHeader ? `<div style="font-size: 9px; margin: 6px 0; white-space: pre-line;">${receiptHeader}</div>` : ''}
          </div>

          <div class="reprint-notice center">
            *** REPRINT ***<br>
            ${receiptData.reprint_timestamp.toLocaleString()}
          </div>

          <div>
            <div class="bold">${receiptData.transaction_type}: ${receiptData.transaction_number}</div>
            <div style="font-size: 9px;">Date: ${receiptData.timestamp.toLocaleString()}</div>
            <div style="font-size: 9px;">Cashier: ${receiptData.cashier_name}</div>
            ${receiptData.customer ? `<div style="font-size: 9px;">Customer: ${receiptData.customer.name}</div>` : '<div style="font-size: 9px;">Customer: Walk-in</div>'}
          </div>

          <div class="line"></div>

          ${receiptData.items.map(item => `
            <div style="font-size: 9px; margin: 2px 0;">
              <div class="bold">${item.product_name}</div>
              <div class="flex">
                <span>${item.quantity} x ${formatAmount(item.unit_price)}</span>
                <span>${formatAmount(item.total_price)}</span>
              </div>
            </div>
          `).join('')}

          <div class="line"></div>

          <div class="flex" style="font-size: 9px;">
            <span>Subtotal:</span>
            <span>${formatAmount(receiptData.subtotal)}</span>
          </div>
          ${receiptData.tax_amount > 0 ? `
            <div class="flex" style="font-size: 9px;">
              <span>Tax:</span>
              <span>${formatAmount(receiptData.tax_amount)}</span>
            </div>
          ` : ''}
          ${receiptData.discount_amount > 0 ? `
            <div class="flex" style="font-size: 9px;">
              <span>Discount:</span>
              <span>-${formatAmount(receiptData.discount_amount)}</span>
            </div>
          ` : ''}
          
          <div class="flex total bold" style="font-size: 11px;">
            <span>TOTAL:</span>
            <span>${formatAmount(receiptData.total_amount)}</span>
          </div>

          ${receiptData.payment_method === 'cash' ? `
            <div class="flex" style="font-size: 9px;">
              <span>Cash Received:</span>
              <span>${formatAmount(receiptData.received_amount)}</span>
            </div>
            <div class="flex" style="font-size: 9px;">
              <span>Change:</span>
              <span>${formatAmount(receiptData.change_amount)}</span>
            </div>
          ` : `
            <div class="flex" style="font-size: 9px;">
              <span>Payment Method:</span>
              <span>${receiptData.payment_method}</span>
            </div>
          `}

          ${receiptData.notes ? `
            <div class="line"></div>
            <div style="font-size: 9px;">Notes: ${receiptData.notes}</div>
          ` : ''}

          <div class="line"></div>
          <div class="center" style="font-size: 9px;">Thank you for your business!</div>
          ${receiptFooter ? `<div class="center" style="font-size: 9px; margin: 6px 0; white-space: pre-line;">${receiptFooter}</div>` : ''}
        </body>
      </html>
    `;
  };

  // FEATURE 8: Enhanced PDF save functionality
  const saveReceiptAsPDF = async () => {
    try {
      setActionLoading('pdf');
      
      // Generate receipt data for PDF
      const receiptData = generatePrintReceiptData();
      
      // Create a clean HTML version for PDF generation
      const pdfHTML = generatePDFReceiptHTML(receiptData);
      
      // Create a temporary iframe for PDF generation
      const pdfFrame = document.createElement('iframe');
      pdfFrame.style.position = 'absolute';
      pdfFrame.style.left = '-9999px';
      pdfFrame.style.width = '800px';
      pdfFrame.style.height = '600px';
      document.body.appendChild(pdfFrame);
      
      const pdfDocument = pdfFrame.contentDocument;
      pdfDocument.open();
      pdfDocument.write(pdfHTML);
      pdfDocument.close();
      
      // Wait for content to load and trigger print as PDF
      setTimeout(() => {
        try {
          // Set up print options for PDF
          pdfFrame.contentWindow.focus();
          pdfFrame.contentWindow.print();
          
          // Clean up after delay
          setTimeout(() => {
            try {
              document.body.removeChild(pdfFrame);
            } catch (e) {
              console.log('PDF iframe cleanup error (non-critical)');
            }
          }, 3000);
          
          const filename = `${reprintTransaction.type}_${reprintTransaction.type === 'sale' ? reprintTransaction.sale_number : reprintTransaction.invoice_number}_reprint.pdf`;
          toast.success(`PDF ready for download: ${filename}`);
          
        } catch (pdfError) {
          console.error('PDF generation error:', pdfError);
          toast.error('PDF generation failed - try using browser print dialog');
        }
      }, 1000);
      
    } catch (error) {
      console.error('PDF save error:', error);
      toast.error('Failed to save PDF');
    } finally {
      setActionLoading(null);
    }
  };

  // Generate PDF-optimized HTML
  const generatePDFReceiptHTML = (receiptData) => {
    const businessLogo = receiptData.business?.logo_url || '';
    const receiptHeader = receiptData.business?.settings?.receipt_header || business?.settings?.receipt_header || '';
    const receiptFooter = receiptData.business?.settings?.receipt_footer || business?.settings?.receipt_footer || '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt PDF - ${receiptData.transaction_type} ${receiptData.transaction_number}</title>
          <style>
            @media print {
              @page { 
                size: A4; 
                margin: 20mm;
              }
              body { margin: 0; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              margin: 0;
              padding: 20px;
              max-width: 400px;
              margin: 0 auto;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .logo { 
              max-width: 150px; 
              max-height: 100px; 
              margin: 0 auto 10px auto; 
              display: block; 
            }
            .header { 
              border-bottom: 2px solid #000; 
              padding-bottom: 15px; 
              margin-bottom: 15px; 
            }
            .total { 
              border-top: 2px solid #000; 
              padding-top: 8px; 
              margin-top: 8px; 
              font-size: 14px;
              font-weight: bold;
            }
            .reprint-notice { 
              background-color: #ffe6e6; 
              border: 2px solid #ff9999; 
              padding: 10px; 
              margin: 15px 0; 
              font-weight: bold;
              text-align: center;
            }
            .item-row {
              margin: 5px 0;
              border-bottom: 1px dotted #ccc;
              padding-bottom: 3px;
            }
          </style>
        </head>
        <body>
          <div class="header center">
            ${businessLogo ? `<img src="${businessLogo}" alt="Business Logo" class="logo" />` : ''}
            <div class="bold" style="font-size: 18px;">${receiptData.business.name}</div>
            ${receiptData.business.address ? `<div>${receiptData.business.address}</div>` : ''}
            ${receiptData.business.phone ? `<div>Tel: ${receiptData.business.phone}</div>` : ''}
            ${receiptData.business.contact_email ? `<div>Email: ${receiptData.business.contact_email}</div>` : ''}
            ${receiptHeader ? `<div style="margin: 10px 0; white-space: pre-line; font-style: italic;">${receiptHeader}</div>` : ''}
          </div>

          <div class="reprint-notice">
            *** RECEIPT REPRINT ***<br>
            Printed: ${receiptData.reprint_timestamp.toLocaleString()}
          </div>

          <div style="margin: 15px 0;">
            <div class="bold" style="font-size: 16px;">${receiptData.transaction_type}: ${receiptData.transaction_number}</div>
            <div>Original Date: ${receiptData.timestamp.toLocaleString()}</div>
            <div>Cashier: ${receiptData.cashier_name}</div>
            ${receiptData.customer ? `<div>Customer: ${receiptData.customer.name}</div>` : '<div>Customer: Walk-in Customer</div>'}
          </div>

          <div class="line"></div>

          <div style="margin: 15px 0;">
            <div class="bold" style="margin-bottom: 10px;">ITEMS:</div>
            ${receiptData.items.map(item => `
              <div class="item-row">
                <div class="bold">${item.product_name}</div>
                <div class="flex" style="margin-top: 3px;">
                  <span>${item.quantity} x ${formatAmount(item.unit_price)}</span>
                  <span class="bold">${formatAmount(item.total_price)}</span>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="line"></div>

          <div style="margin: 15px 0;">
            <div class="flex">
              <span>Subtotal:</span>
              <span>${formatAmount(receiptData.subtotal)}</span>
            </div>
            ${receiptData.tax_amount > 0 ? `
              <div class="flex">
                <span>Tax:</span>
                <span>${formatAmount(receiptData.tax_amount)}</span>
              </div>
            ` : ''}
            ${receiptData.discount_amount > 0 ? `
              <div class="flex">
                <span>Discount:</span>
                <span style="color: green;">-${formatAmount(receiptData.discount_amount)}</span>
              </div>
            ` : ''}
            
            <div class="flex total">
              <span>TOTAL AMOUNT:</span>
              <span>${formatAmount(receiptData.total_amount)}</span>
            </div>

            ${receiptData.payment_method === 'cash' ? `
              <div style="margin-top: 10px;">
                <div class="flex">
                  <span>Cash Received:</span>
                  <span>${formatAmount(receiptData.received_amount)}</span>
                </div>
                <div class="flex">
                  <span>Change Given:</span>
                  <span>${formatAmount(receiptData.change_amount)}</span>
                </div>
              </div>
            ` : `
              <div style="margin-top: 10px;">
                <div class="flex">
                  <span>Payment Method:</span>
                  <span>${receiptData.payment_method.toUpperCase()}</span>
                </div>
              </div>
            `}
          </div>

          ${receiptData.notes ? `
            <div class="line"></div>
            <div style="margin: 15px 0;">
              <div class="bold">Notes:</div>
              <div style="margin-top: 5px; font-style: italic;">${receiptData.notes}</div>
            </div>
          ` : ''}

          <div class="line"></div>
          <div class="center" style="margin: 20px 0;">
            <div class="bold">Thank you for your business!</div>
            ${receiptFooter ? `<div style="margin-top: 10px; white-space: pre-line; font-style: italic;">${receiptFooter}</div>` : ''}
          </div>
          
          <div class="center" style="font-size: 10px; color: #666; margin-top: 30px;">
            <div>This is a computer-generated receipt reprint.</div>
            <div>Generated on: ${new Date().toLocaleString()}</div>
          </div>
        </body>
      </html>
    `;
  };

  if (loading) {
    return <LoadingSpinner message="Loading transaction history..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
        <p className="text-gray-600">View and manage your transaction history with advanced filtering</p>
      </div>

      {/* Simple Date Filter - Replaces complex GlobalFilter to prevent infinite loops */}
      <div className="mb-6 flex items-center space-x-4">
        <label className="block text-sm font-medium text-gray-700">
          Filter by Date:
        </label>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
        </select>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('sales')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sales'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sales ({sales.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invoices'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Invoices ({invoices.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="overflow-x-auto">
          {activeTab === 'sales' ? (
            sales.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sale #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {sale.sale_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(sale.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getCustomerName(sale.customer_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {sale.items.length} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatAmount(sale.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          sale.payment_method === 'cash' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sale.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleReprintReceipt(sale, 'sale')}
                          className="text-green-600 hover:text-green-900"
                          title="Reprint Receipt"
                        >
                          <PrinterIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement detail modal
                            toast('Detail view not yet implemented');
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No sales found</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by making your first sale.</p>
              </div>
            )
          ) : (
            invoices.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invoice.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getCustomerName(invoice.customer_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.items.length} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatAmount(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === 'draft' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : invoice.status === 'sent'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleReprintReceipt(invoice, 'invoice')}
                          className="text-green-600 hover:text-green-900"
                          title="Reprint Receipt"
                        >
                          <PrinterIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement detail modal
                            toast('Detail view not yet implemented');
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
                <p className="mt-1 text-sm text-gray-500">Create invoices from the POS interface.</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Reprint Receipt Modal */}
      {showReprintModal && reprintPreview && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Reprint Receipt - {reprintPreview.transaction_type} #{reprintPreview.transaction_number}
              </h3>
              <button
                onClick={() => setShowReprintModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Receipt Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Receipt Preview</h4>
                <div className="bg-white p-4 rounded border font-mono text-xs max-h-96 overflow-y-auto">
                  {/* Receipt Header */}
                  <div className="text-center border-b pb-2 mb-3">
                    {reprintPreview.business.settings?.receipt_header && (
                      <div className="text-xs mb-2 font-bold border-b pb-1">
                        {reprintPreview.business.settings.receipt_header.split('\n').map((line, index) => (
                          <div key={index}>{line}</div>
                        ))}
                      </div>
                    )}
                    <h2 className="font-bold text-sm">{reprintPreview.business.name}</h2>
                    <p className="text-xs">{reprintPreview.business.address}</p>
                    <p className="text-xs">{reprintPreview.business.contact_email}</p>
                    <p className="text-xs">{reprintPreview.business.phone}</p>
                  </div>

                  {/* Transaction Details */}
                  <div className="border-b pb-2 mb-2">
                    <p>{reprintPreview.transaction_type}: {reprintPreview.transaction_number}</p>
                    <p>Date: {reprintPreview.timestamp.toLocaleString()}</p>
                    {reprintPreview.customer && (
                      <p>Customer: {reprintPreview.customer.name}</p>
                    )}
                    <p>Cashier: Staff</p>
                    {reprintPreview.reprint && (
                      <p className="text-red-600 font-bold">REPRINT - {reprintPreview.reprint_timestamp.toLocaleString()}</p>
                    )}
                  </div>

                  {/* Items */}
                  <div className="border-b pb-2 mb-2">
                    {reprintPreview.items.map((item, index) => (
                      <div key={index} className="flex justify-between mb-1">
                        <div>
                          <p className="truncate">{item.product_name}</p>
                          <p className="text-xs text-gray-600">
                            {item.quantity} x {formatAmount(item.unit_price)}
                          </p>
                        </div>
                        <p>{formatAmount(item.total_price)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="border-b pb-2 mb-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatAmount(reprintPreview.subtotal)}</span>
                    </div>
                    {reprintPreview.tax_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatAmount(reprintPreview.tax_amount)}</span>
                      </div>
                    )}
                    {reprintPreview.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>-{formatAmount(reprintPreview.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>TOTAL:</span>
                      <span>{formatAmount(reprintPreview.total_amount)}</span>
                    </div>
                    {reprintPreview.payment_method && (
                      <>
                        <div className="flex justify-between">
                          <span>Payment:</span>
                          <span>{reprintPreview.payment_method.toUpperCase()}</span>
                        </div>
                        {reprintPreview.received_amount && (
                          <>
                            <div className="flex justify-between">
                              <span>Received:</span>
                              <span>{formatAmount(reprintPreview.received_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Change:</span>
                              <span>{formatAmount(reprintPreview.change_amount || 0)}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-center text-xs">
                    <p>Thank you for your business!</p>
                    {reprintPreview.business.settings?.receipt_footer && (
                      <div className="mt-2 border-t pt-2 font-bold">
                        {reprintPreview.business.settings.receipt_footer.split('\n').map((line, index) => (
                          <div key={index}>{line}</div>
                        ))}
                      </div>
                    )}
                    {reprintPreview.notes && (
                      <p className="mt-2 text-gray-600">Note: {reprintPreview.notes}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Reprint Options</h4>
                  <div className="space-y-3">
                    <button
                      onClick={printReceipt}
                      disabled={actionLoading === 'print'}
                      className="w-full btn-primary flex items-center justify-center"
                    >
                      {actionLoading === 'print' ? (
                        <InlineSpinner />
                      ) : (
                        <>
                          <PrinterIcon className="h-4 w-4 mr-2" />
                          Print Receipt
                        </>
                      )}
                    </button>

                    <button
                      onClick={saveReceiptAsPDF}
                      disabled={actionLoading === 'pdf'}
                      className="w-full btn-secondary flex items-center justify-center"
                    >
                      {actionLoading === 'pdf' ? (
                        <InlineSpinner />
                      ) : (
                        <>
                          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                          Save as PDF
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Transaction Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Transaction Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-medium">{reprintPreview.transaction_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Number:</span>
                      <span className="font-medium">{reprintPreview.transaction_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Original Date:</span>
                      <span>{reprintPreview.timestamp.toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Customer:</span>
                      <span>{reprintPreview.customer?.name || 'Walk-in'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Items:</span>
                      <span>{reprintPreview.items.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowReprintModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SalesHistory;