import React, { useState, useEffect, useRef, useCallback } from 'react';
import { productsAPI, categoriesAPI, customersAPI, salesAPI, invoicesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import bluetoothPrinterService from '../../services/bluetoothPrinter';
import enhancedPrinterService from '../../services/printerService';
import { toast } from 'react-hot-toast';
import { 
  CubeIcon, 
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  PrinterIcon,
  DocumentTextIcon,
  XMarkIcon,
  BanknotesIcon,
  CreditCardIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const POSInterface = () => {
  const { business, user } = useAuth();
  const { formatAmount } = useCurrency();
  
  // Core state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Transaction state
  const [transactionMode, setTransactionMode] = useState('sale');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalPaymentMethod, setModalPaymentMethod] = useState('cash');
  const [modalReceivedAmount, setModalReceivedAmount] = useState('');
  const [modalDiscountAmount, setModalDiscountAmount] = useState('');
  const [modalDiscountType, setModalDiscountType] = useState('amount');
  const [modalNotes, setModalNotes] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  
  // Barcode state
  const [heldOrders, setHeldOrders] = useState([]);
  
  const barcodeInputRef = useRef(null);

  // Move function definitions before useEffect to avoid hoisting issues
  const fetchData = useCallback(async () => {
    try {
      // Build params object, only include category_id if it's not empty
      const params = {};
      if (selectedCategory) {
        params.category_id = selectedCategory;
      }
      
      const [productsResponse, categoriesResponse, customersResponse] = await Promise.all([
        productsAPI.getProducts(params),
        categoriesAPI.getCategories(),
        customersAPI.getCustomers()
      ]);
      setProducts(productsResponse.data);
      setCategories(categoriesResponse.data);
      setCustomers(customersResponse.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load POS data');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  const handleBarcodeScanned = useCallback(async (barcode) => {
    if (!barcode || barcode.length < 3) return; // Minimum barcode length
    
    try {
      const response = await productsAPI.getProductByBarcode(barcode.trim());
      addToCart(response.data);
      
      // Clear search field after successful scan
      setSearchTerm('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = '';
      }
      
      // Visual and audio feedback for successful scan
      toast.success(`✅ Scanned: ${response.data.name} added to cart`, {
        duration: 2000,
        position: 'top-center'
      });
      
      // Green flash effect for successful scan
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#c6f6d5'; // Light green
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.backgroundColor = '';
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      toast.error(`❌ Product not found: ${barcode}`, {
        duration: 3000,
        position: 'top-center'
      });
      
      // Visual error feedback
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#f8d7da';
        barcodeInputRef.current.value = `✗ Not found: ${barcode}`;
        setTimeout(() => {
          // Clear error styling and search field
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.backgroundColor = '';
            barcodeInputRef.current.value = '';
          }
          setSearchTerm('');
        }, 2000);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Load held orders from localStorage
    const saved = localStorage.getItem('pos-held-orders');
    if (saved) {
      setHeldOrders(JSON.parse(saved));
    }
  }, [fetchData]);

  useEffect(() => {
    if (business?.settings?.tax_rate) {
      setTaxRate(business.settings.tax_rate);
    }
  }, [business]);

  const handleProductSearch = async () => {
    if (!searchTerm && !selectedCategory) {
      fetchData();
      return;
    }
    
    try {
      // Build params object, only include non-empty values
      const params = {};
      if (searchTerm) {
        params.search = searchTerm;
      }
      if (selectedCategory) {
        params.category_id = selectedCategory;
      }
      
      const response = await productsAPI.getProducts(params);
      setProducts(response.data);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Failed to search products');
    }
  };

  const addToCart = (product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === product.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total_price: (item.quantity + 1) * item.unit_price
              }
            : item
        );
      } else {
        return [
          ...prevCart,
          {
            product_id: product.id,
            product_name: product.name,
            product_sku: product.sku,
            quantity: 1,
            unit_price: product.price,
            total_price: product.price,
            unit_cost_snapshot: product.product_cost || 0 // Capture cost at time of sale
          }
        ];
      }
    });
  };

  const updateCartQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.product_id === productId
          ? {
              ...item,
              quantity: newQuantity,
              total_price: newQuantity * item.unit_price
            }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountAmount('');
    setNotes('');
    setReceivedAmount('');
    setPaymentMethod('cash');
  };

  const holdOrder = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const order = {
      id: Date.now(),
      timestamp: new Date(),
      cart: [...cart],
      customer: selectedCustomer,
      discount: discountAmount,
      notes: notes
    };

    const updatedOrders = [...heldOrders, order];
    setHeldOrders(updatedOrders);
    localStorage.setItem('pos-held-orders', JSON.stringify(updatedOrders));
    
    clearCart();
    toast.success('Order held successfully');
  };

  const resumeHeldOrder = (heldOrder) => {
    setCart(heldOrder.cart);
    setSelectedCustomer(heldOrder.customer);
    setDiscountAmount(heldOrder.discount || '');
    setNotes(heldOrder.notes || '');

    const updated = heldOrders.filter(order => order.id !== heldOrder.id);
    setHeldOrders(updated);
    localStorage.setItem('pos-held-orders', JSON.stringify(updated));
    
    toast.success('Order resumed');
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const discount = parseFloat(discountAmount) || 0;
    const afterDiscount = subtotal - discount;
    const taxAmount = afterDiscount * (taxRate / 100);
    const total = afterDiscount + taxAmount;
    
    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const calculateModalTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    
    let discount = 0;
    const discountValue = parseFloat(modalDiscountAmount) || 0;
    
    if (discountValue > 0) {
      if (modalDiscountType === 'percentage') {
        discount = Math.min(subtotal * (discountValue / 100), subtotal);
      } else {
        discount = Math.min(discountValue, subtotal);
      }
    }
    
    const afterDiscount = subtotal - discount;
    const finalTax = afterDiscount * (taxRate / 100);
    const total = afterDiscount + finalTax;
    
    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      taxAmount: finalTax.toFixed(2),
      total: total.toFixed(2),
      change: modalPaymentMethod === 'cash' && modalReceivedAmount ? 
        Math.max(0, parseFloat(modalReceivedAmount) - parseFloat(total)).toFixed(2) : '0.00'
    };
  };

  const calculateModalChange = () => {
    if (modalPaymentMethod !== 'cash' || !modalReceivedAmount) return 0;
    const totals = calculateModalTotals();
    const received = parseFloat(modalReceivedAmount) || 0;
    const change = received - parseFloat(totals.total);
    return Math.max(0, change);
  };

  const confirmPayment = () => {
    const totals = calculateModalTotals();
    
    // HOTFIX 1: Fixed payment validation logic with proper rounding
    if (modalPaymentMethod === 'cash') {
      const received = parseFloat(modalReceivedAmount) || 0;
      const total = parseFloat(totals.total);
      
      // Round to 2 decimal places for proper comparison
      const roundedReceived = Math.round(received * 100) / 100;
      const roundedTotal = Math.round(total * 100) / 100;
      
      if (roundedReceived < roundedTotal) {
        toast.error(`Insufficient payment. Required: ${formatAmount(roundedTotal)}, Received: ${formatAmount(roundedReceived)}`);
        return;
      }
      setReceivedAmount(received);
    }
    
    // Apply modal values to main transaction
    setPaymentMethod(modalPaymentMethod);
    setDiscountAmount(parseFloat(totals.discount));
    setNotes(modalNotes);
    
    // Save discount type preference
    localStorage.setItem('pos-discount-type', modalDiscountType);
    
    setShowPaymentModal(false);
    
    // Proceed with the transaction
    handleTransaction();
  };



  const handleTransaction = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const totals = calculateTotals();
    
    // HOTFIX 7: Fixed payment validation logic
    // For sales, payment validation is already done in confirmPayment()
    // But double-check here for safety
    if (transactionMode === 'sale' && paymentMethod === 'cash') {
      const requiredAmount = parseFloat(totals.subtotal) - parseFloat(totals.discount) + parseFloat(totals.taxAmount);
      const receivedAmountNum = parseFloat(receivedAmount) || 0;
      
      if (receivedAmountNum < requiredAmount) {
        toast.error(`Insufficient payment. Required: ${formatAmount(requiredAmount)}, Received: ${formatAmount(receivedAmountNum)}`);
        return;
      }
    }

    setIsProcessing(true);

    try {
      // HOTFIX 6: Enhanced transaction data to ensure proper saving
      const transactionData = {
        customer_id: selectedCustomer?.id || null,
        cashier_id: user?.id || null,
        cashier_name: user?.email || user?.name || 'Unknown Cashier',
        items: cart.map(item => ({
          ...item,
          // Ensure all required fields are present
          sku: item.product_sku || item.sku, // Ensure SKU is included
          unit_price_snapshot: item.unit_price, // Required field: price at time of sale
          unit_cost_snapshot: item.unit_cost_snapshot || 0 // Ensure cost snapshot is captured
        })),
        subtotal: parseFloat(totals.subtotal),
        tax_amount: parseFloat(totals.taxAmount),
        discount_amount: parseFloat(totals.discount) || 0,
        total_amount: parseFloat(totals.total),
        payment_method: paymentMethod,
        received_amount: paymentMethod === 'cash' ? parseFloat(receivedAmount) : parseFloat(totals.total),
        change_amount: paymentMethod === 'cash' ? Math.max(0, parseFloat(receivedAmount) - parseFloat(totals.total)) : 0,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
        status: 'completed' // Ensure status is set for Sales History
      };

      let response;
      if (transactionMode === 'sale') {
        response = await salesAPI.createSale(transactionData);
        toast.success(`Sale completed! Sale #${response.data.sale_number}`);
        
        // Auto-print if enabled - no preview needed
        if (business?.settings?.printer_settings?.auto_print) {
          const receiptData = generateReceiptData(response.data, 'sale');
          await handleAutoPrint(response.data, 'sale');
        }
      } else {
        response = await invoicesAPI.createInvoice(transactionData);
        toast.success(`Invoice created! Invoice #${response.data.invoice_number}`);
      }

      // Clear cart and reset values
      clearCart();
      setReceivedAmount(''); // Reset payment values
      setPaymentMethod('cash');
      
      // Refresh product data to update stock
      fetchData();
      
    } catch (error) {
      console.error('Transaction error:', error);
      
      // Improved error handling to convert complex objects to strings
      let message;
      if (error.response?.data?.detail) {
        // Handle FastAPI validation errors that might be arrays or objects
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          message = detail;
        } else if (Array.isArray(detail)) {
          // Handle Pydantic validation errors array
          message = detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
        } else if (typeof detail === 'object') {
          // Handle object-based errors
          message = JSON.stringify(detail);
        } else {
          message = 'Validation error occurred';
        }
      } else {
        message = `Failed to ${transactionMode === 'sale' ? 'complete sale' : 'create invoice'}`;
      }
      
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoPrint = async (transactionData, transactionType) => {
    try {
      const printerType = business?.settings?.printer_type || 'local';
      const receiptData = generateReceiptData(transactionData, transactionType);
      
      if (printerType === 'bluetooth') {
        // Use Bluetooth printer service for direct ESC/POS printing
        const printerStatus = bluetoothPrinterService.getStatus();
        if (!printerStatus.isConnected) {
          toast.info('Auto-print skipped - Bluetooth printer not connected');
          return;
        }
        await bluetoothPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
        toast.success('Receipt auto-printed via Bluetooth');
      } else if (printerType === 'local') {
        // For local printer, try silent printing via configured service
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
          // Fallback to browser print with auto-close attempt
          console.log('Direct printing failed, using browser fallback:', printerError);
          await handleBrowserPrintFallback(receiptData);
        }
      } else {
        // Network printer
        await enhancedPrinterService.configurePrinter({
          id: 'network-printer',
          name: business?.settings?.selected_printer || 'Network Printer',
          type: printerType,
          settings: business?.settings?.printer_settings
        });
        await enhancedPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
        toast.success('Receipt auto-printed to network printer');
      }
      
    } catch (error) {
      console.error('Auto-print failed:', error);
      // Don't show error toast for auto-print to avoid disrupting the sale flow
      console.log('Auto-print failed silently, transaction still completed successfully');
    }
  };

  const handleBrowserPrintFallback = async (receiptData) => {
    try {
      const receiptHTML = generateReceiptHTML(receiptData);
      
      // Create a hidden iframe for printing
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.left = '-9999px';
      printFrame.style.top = '-9999px';
      printFrame.style.width = '1px';
      printFrame.style.height = '1px';
      document.body.appendChild(printFrame);
      
      const printDocument = printFrame.contentDocument || printFrame.contentWindow.document;
      printDocument.open();
      printDocument.write(receiptHTML);
      printDocument.close();
      
      // Wait for content to load
      await new Promise(resolve => {
        printFrame.onload = resolve;
        setTimeout(resolve, 1000); // Fallback timeout
      });
      
      // Attempt to print
      if (printFrame.contentWindow) {
        printFrame.contentWindow.print();
        
        // Clean up after printing
        setTimeout(() => {
          document.body.removeChild(printFrame);
        }, 2000);
        
        toast.success('Receipt sent to printer (browser fallback)');
      }
      
    } catch (error) {
      console.error('Browser print fallback failed:', error);
      toast.info('Auto-print not available - transaction completed successfully');
    }
  };

  const generateReceiptHTML = (receiptData) => {
    const businessName = business?.name || 'Business Name';
    const businessAddress = business?.address || '';
    const businessEmail = business?.contact_email || '';
    const businessPhone = business?.phone || '';
    const logoUrl = business?.logo_url || '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt</title>
          <style>
            @media print {
              @page { margin: 0; size: 80mm auto; }
              body { margin: 0; }
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.2;
              margin: 0;
              padding: 20px;
              width: 300px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 5px 0; }
            .flex { display: flex; justify-content: space-between; }
            .logo { max-width: 100px; max-height: 60px; margin-bottom: 10px; }
            .header { border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
            .total { border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header center">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : ''}
            <div class="bold" style="font-size: 14px;">${businessName}</div>
            ${businessAddress ? `<div>${businessAddress}</div>` : ''}
            ${businessPhone ? `<div>Phone: ${businessPhone}</div>` : ''}
            ${businessEmail ? `<div>Email: ${businessEmail}</div>` : ''}
          </div>

          <div>
            <div class="bold">${receiptData.transaction_type.toUpperCase()}: ${receiptData.transaction_number}</div>
            <div>Date: ${new Date(receiptData.timestamp).toLocaleString()}</div>
            <div>Cashier: ${receiptData.cashier_name}</div>
            ${receiptData.customer ? `<div>Customer: ${receiptData.customer.name}</div>` : ''}
          </div>

          <div class="line"></div>

          ${receiptData.items.map(item => `
            <div>
              <div class="bold">${item.product_name}</div>
              <div class="flex">
                <span>${item.quantity} x ${formatAmount(item.unit_price)}</span>
                <span>${formatAmount(item.total_price)}</span>
              </div>
            </div>
          `).join('')}

          <div class="line"></div>

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
              <span>-${formatAmount(receiptData.discount_amount)}</span>
            </div>
          ` : ''}
          
          <div class="flex total bold">
            <span>TOTAL:</span>
            <span>${formatAmount(receiptData.total_amount)}</span>
          </div>

          ${receiptData.payment_method === 'cash' ? `
            <div class="flex">
              <span>Cash Received:</span>
              <span>${formatAmount(receiptData.received_amount)}</span>
            </div>
            <div class="flex">
              <span>Change:</span>
              <span>${formatAmount(receiptData.change_amount)}</span>
            </div>
          ` : `
            <div class="flex">
              <span>Payment Method:</span>
              <span>${receiptData.payment_method}</span>
            </div>
          `}

          ${receiptData.notes ? `
            <div class="line"></div>
            <div>Notes: ${receiptData.notes}</div>
          ` : ''}

          <div class="line"></div>
          <div class="center">Thank you for your business!</div>
          <div class="center">${business?.settings?.receipt_footer || ''}</div>
        </body>
      </html>
    `;
  };

  const generateReceiptData = (transactionData, transactionType = 'sale') => {
    return {
      business: business,
      transaction_number: transactionData.sale_number || transactionData.invoice_number,
      transaction_type: transactionType.toUpperCase(),
      timestamp: new Date(transactionData.created_at || new Date()),
      customer: selectedCustomer,
      items: transactionData.items || cart,
      subtotal: transactionData.subtotal,
      tax_amount: transactionData.tax_amount,
      discount_amount: transactionData.discount_amount,
      total_amount: transactionData.total_amount,
      payment_method: transactionData.payment_method,
      received_amount: transactionData.received_amount,
      change_amount: transactionData.change_amount,
      notes: transactionData.notes
    };
  };

  // Filter products based on search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchTerm));
    
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    // Reset modal state
    setModalPaymentMethod('cash');
    setModalReceivedAmount('');
    setModalDiscountAmount(discountAmount);
    setModalDiscountType(localStorage.getItem('pos-discount-type') || 'amount');
    setModalNotes(notes);
    
    setShowPaymentModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Products */}
      <div className="w-2/3 bg-white border-r flex flex-col">
        {/* Header */}
        <div className="p-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Products</h2>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Search products or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProductSearch()}
                className="input pl-10 text-sm"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input text-sm min-w-0"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Tabs - HOTFIX 3: Category click functionality fixed */}
        <div className="p-3 border-b bg-gray-50 flex-shrink-0">
          <div className="flex space-x-1 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('')}
              className={`category-tab text-xs whitespace-nowrap ${!selectedCategory ? 'active' : ''}`}
            >
              All
            </button>
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`category-tab text-xs whitespace-nowrap ${selectedCategory === category.id ? 'active' : ''}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className="product-card cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <CubeIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 truncate">
                      {product.name}
                    </h4>
                    <p className="text-xs text-gray-500 truncate">
                      SKU: {product.sku}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-semibold text-blue-600">
                        {formatAmount(product.price)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Stock: {product.quantity}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <CubeIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Cart */}
      <div className="w-1/3 bg-white flex flex-col">
        {/* Cart Header */}
        <div className="p-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <ShoppingCartIcon className="h-5 w-5 mr-2" />
              Cart ({cart.length})
            </h2>
            <div className="flex space-x-1">
              <button
                onClick={() => setTransactionMode('sale')}
                className={`text-xs px-2 py-1 rounded ${
                  transactionMode === 'sale' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Sale
              </button>
              <button
                onClick={() => setTransactionMode('invoice')}
                className={`text-xs px-2 py-1 rounded ${
                  transactionMode === 'invoice' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Invoice
              </button>
            </div>
          </div>
        </div>

        {/* HOTFIX: Cart Items - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <ShoppingCartIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Cart is empty</p>
                <p className="text-xs">Add products to get started</p>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map(item => (
                <div key={item.product_id} className="cart-item">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">
                        {item.product_name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {formatAmount(item.unit_price)} each
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      >
                        <MinusIcon className="h-2 w-2" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      >
                        <PlusIcon className="h-2 w-2" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {formatAmount(item.total_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Action Area - Always Visible at Bottom */}
        <div className="border-t bg-white flex-shrink-0">
          {/* Customer Selection */}
          <div className="p-3 border-b">
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const customer = customers.find(c => c.id === e.target.value);
                setSelectedCustomer(customer || null);
              }}
              className="input text-sm w-full"
            >
              <option value="">Walk-in Customer</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cart Summary */}
          <div className="p-3 border-b">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatAmount(calculateTotals().subtotal)}</span>
              </div>
              {parseFloat(calculateTotals().discount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-{formatAmount(calculateTotals().discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax ({(taxRate * 100).toFixed(1)}%):</span>
                <span>{formatAmount(calculateTotals().taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-blue-600">{formatAmount(calculateTotals().total)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 space-y-2">
            <button
              onClick={openPaymentModal}
              disabled={cart.length === 0 || isProcessing}
              className="btn-primary w-full flex items-center justify-center"
            >
              <BanknotesIcon className="h-4 w-4 mr-2" />
              {isProcessing ? 'Processing...' : `Pay ${formatAmount(calculateTotals().total)}`}
            </button>
            
            <div className="flex space-x-2">
              <button
                onClick={holdOrder}
                disabled={cart.length === 0}
                className="btn-secondary flex-1 flex items-center justify-center text-sm"
              >
                <ClockIcon className="h-4 w-4 mr-1" />
                Hold
              </button>
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="btn-secondary flex-1 flex items-center justify-center text-sm"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Clear
              </button>
            </div>
          </div>

          {/* Held Orders */}
          {heldOrders.length > 0 && (
            <div className="p-3 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Held Orders ({heldOrders.length})</h4>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {heldOrders.map(order => (
                  <button
                    key={order.id}
                    onClick={() => resumeHeldOrder(order)}
                    className="w-full text-left p-2 text-xs bg-yellow-50 border border-yellow-200 rounded hover:bg-yellow-100"
                  >
                    <div className="flex justify-between">
                      <span>Order #{order.id}</span>
                      <span>{new Date(order.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-gray-600">
                      {order.cart.length} items • {order.customer?.name || 'Walk-in'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal - HOTFIX 6: Fixed overflow issue */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-6 flex-1 overflow-visible">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setModalPaymentMethod('cash')}
                      className={`flex-1 p-2 text-sm border rounded-md ${
                        modalPaymentMethod === 'cash'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <BanknotesIcon className="h-4 w-4 mx-auto mb-1" />
                      Cash
                    </button>
                    <button
                      onClick={() => setModalPaymentMethod('card')}
                      className={`flex-1 p-2 text-sm border rounded-md ${
                        modalPaymentMethod === 'card'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <CreditCardIcon className="h-4 w-4 mx-auto mb-1" />
                      Card
                    </button>
                  </div>
                </div>

                {/* Discount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={modalDiscountAmount}
                      onChange={(e) => setModalDiscountAmount(e.target.value)}
                      className="input flex-1 text-sm"
                      placeholder="0.00"
                    />
                    <select
                      value={modalDiscountType}
                      onChange={(e) => setModalDiscountType(e.target.value)}
                      className="input text-sm"
                    >
                      <option value="amount">Amount</option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                </div>

                {/* Cash Payment Fields */}
                {modalPaymentMethod === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount Received
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={modalReceivedAmount}
                      onChange={(e) => setModalReceivedAmount(e.target.value)}
                      className="input w-full text-sm"
                      placeholder="0.00"
                      autoFocus
                    />
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows="2"
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    className="input w-full text-sm"
                    placeholder="Order notes..."
                  />
                </div>

                {/* Payment Summary */}
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatAmount(calculateModalTotals().subtotal)}</span>
                    </div>
                    {parseFloat(calculateModalTotals().discount) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-{formatAmount(calculateModalTotals().discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatAmount(calculateModalTotals().taxAmount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base border-t pt-1">
                      <span>Total:</span>
                      <span className="text-blue-600">{formatAmount(calculateModalTotals().total)}</span>
                    </div>
                    {modalPaymentMethod === 'cash' && modalReceivedAmount && (
                      <div className="flex justify-between font-semibold text-green-600">
                        <span>Change:</span>
                        <span>{formatAmount(calculateModalChange())}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Action Buttons - Fixed at bottom */}
              <div className="border-t p-4 bg-white rounded-b-lg">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmPayment}
                    className="btn-primary flex-1"
                  >
                    Confirm Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSInterface;