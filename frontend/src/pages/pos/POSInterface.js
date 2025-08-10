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
  const { business } = useAuth();
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
  
  // Receipt preview state with responsive defaults and session persistence
  const getInitialReceiptToggle = () => {
    const saved = sessionStorage.getItem('pos-receipt-preview-expanded');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Default: expanded on desktop (>= 768px), collapsed on mobile
    return window.innerWidth >= 768;
  };
  
  const [showReceiptPreview, setShowReceiptPreview] = useState(getInitialReceiptToggle());
  const [previewReceiptData, setPreviewReceiptData] = useState(null);
  const [receiptCollapsed, setReceiptCollapsed] = useState(() => {
    const saved = localStorage.getItem('pos-receipt-collapsed');
    return saved ? JSON.parse(saved) : (window.innerWidth < 768);
  });
  
  // Barcode state
  const [scannerActive, setScannerActive] = useState(true);
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastBarcodeTime, setLastBarcodeTime] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  
  // Held orders state
  const [heldOrders, setHeldOrders] = useState([]);
  
  const barcodeInputRef = useRef(null);

  // Move function definitions before useEffect to avoid hoisting issues
  const fetchData = useCallback(async () => {
    try {
      const [productsResponse, categoriesResponse, customersResponse] = await Promise.all([
        productsAPI.getProducts({ category_id: selectedCategory }),
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
      setIsScanning(false);
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

  // Separate useEffect for barcode scanner to avoid dependency issues
  useEffect(() => {
    if (!scannerActive) return;

    const handleKeyDown = (event) => {
      const currentTime = Date.now();
      
      // Regular character detection
      if (event.key.length === 1) {
        if (currentTime - lastBarcodeTime > 100) {
          setBarcodeBuffer(event.key);
          setLastBarcodeTime(currentTime);
          setIsScanning(true);
        } else {
          setBarcodeBuffer(prev => prev + event.key);
          setLastBarcodeTime(currentTime);
        }
      }
      
      // Enter key - process barcode
      if (event.key === 'Enter' && barcodeBuffer.length > 0) {
        event.preventDefault();
        handleBarcodeScanned(barcodeBuffer);
        setBarcodeBuffer('');
        setIsScanning(false);
      }
    };

    // Add global keydown listener for barcode scanner
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [scannerActive, lastBarcodeTime, barcodeBuffer, handleBarcodeScanned]);

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
      const response = await productsAPI.getProducts({
        search: searchTerm,
        category_id: selectedCategory
      });
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
    setPreviewReceiptData(null);
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
    
    // HOTFIX 1: Fixed payment validation logic
    if (modalPaymentMethod === 'cash') {
      const received = parseFloat(modalReceivedAmount) || 0;
      const total = parseFloat(totals.total);
      
      if (received < total) {
        toast.error(`Insufficient payment. Required: ${formatAmount(total)}, Received: ${formatAmount(received)}`);
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

  // Toggle receipt preview with session persistence
  const toggleReceiptPreview = () => {
    const newState = !showReceiptPreview;
    setShowReceiptPreview(newState);
    sessionStorage.setItem('pos-receipt-preview-expanded', JSON.stringify(newState));
  };

  // Receipt collapse toggle
  const toggleReceiptCollapse = () => {
    const newState = !receiptCollapsed;
    setReceiptCollapsed(newState);
    localStorage.setItem('pos-receipt-collapsed', JSON.stringify(newState));
  };

  const handleTransaction = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const totals = calculateTotals();
    
    // For sales, payment validation is already done in confirmPayment()
    // For invoices, no payment validation needed
    if (transactionMode === 'sale' && paymentMethod === 'cash' && receivedAmount < parseFloat(totals.total)) {
      toast.error('Insufficient payment amount');
      return;
    }

    setIsProcessing(true);

    try {
      // HOTFIX 6: Enhanced transaction data to ensure proper saving
      const transactionData = {
        customer_id: selectedCustomer?.id || null,
        items: cart.map(item => ({
          ...item,
          // Ensure cost snapshot is captured
          unit_cost_snapshot: item.unit_cost_snapshot || 0
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
        
        // Generate receipt data for preview and printing
        const receiptData = generateReceiptData(response.data, 'sale');
        setPreviewReceiptData(receiptData);
        setShowReceiptPreview(true);
        
        // Auto-print if enabled
        if (business?.settings?.printer_settings?.auto_print) {
          await handleAutoPrint(response.data, 'sale');
        }
      } else {
        response = await invoicesAPI.createInvoice(transactionData);
        toast.success(`Invoice created! Invoice #${response.data.invoice_number}`);
        
        // Generate receipt data for preview
        const receiptData = generateReceiptData(response.data, 'invoice');
        setPreviewReceiptData(receiptData);
        setShowReceiptPreview(true);
      }

      // Clear cart and reset values
      clearCart();
      setReceivedAmount(''); // Reset payment values
      setPaymentMethod('cash');
      
      // Refresh product data to update stock
      fetchData();
      
    } catch (error) {
      const message = error.response?.data?.detail || `Failed to ${transactionMode === 'sale' ? 'complete sale' : 'create invoice'}`;
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
        // Use Bluetooth printer service
        const printerStatus = bluetoothPrinterService.getStatus();
        if (!printerStatus.isConnected) {
          toast.info('Bluetooth printer not connected - auto-print skipped');
          return;
        }
        await bluetoothPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
      } else if (printerType === 'local') {
        // For local/system printer, use enhanced printer service
        await enhancedPrinterService.configurePrinter({
          id: 'system-default',
          name: business?.settings?.selected_printer || 'Default System Printer',
          type: 'local',
          settings: business?.settings?.printer_settings
        });
        await enhancedPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
      } else {
        // Network printer or other types
        await enhancedPrinterService.configurePrinter({
          id: 'network-printer',
          name: business?.settings?.selected_printer || 'Network Printer',
          type: printerType,
          settings: business?.settings?.printer_settings
        });
        await enhancedPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
      }
      
      toast.success('Receipt auto-printed successfully');
      
    } catch (error) {
      console.error('Auto-print failed:', error);
      toast.error('Auto-print failed: ' + error.message);
    }
  };

  const handlePrintReceipt = async () => {
    if (!previewReceiptData) {
      toast.error('No receipt to print');
      return;
    }

    try {
      const printerType = business?.settings?.printer_type || 'local';
      
      if (printerType === 'bluetooth') {
        // Use Bluetooth printer service
        const printerStatus = bluetoothPrinterService.getStatus();
        if (!printerStatus.isConnected) {
          if (!bluetoothPrinterService.isBluetoothSupported()) {
            toast.error('Bluetooth not supported in this browser');
            return;
          }
          
          toast.info('Connecting to POS-9200-L printer...');
          await bluetoothPrinterService.connect();
        }
        await bluetoothPrinterService.printReceipt(previewReceiptData, business?.settings?.printer_settings);
      } else if (printerType === 'local') {
        // For local/system printer, use enhanced printer service
        await enhancedPrinterService.configurePrinter({
          id: 'system-default',
          name: business?.settings?.selected_printer || 'Default System Printer',
          type: 'local',
          settings: business?.settings?.printer_settings
        });
        await enhancedPrinterService.printReceipt(previewReceiptData, business?.settings?.printer_settings);
      } else {
        // Network printer or other types
        await enhancedPrinterService.configurePrinter({
          id: 'network-printer',
          name: business?.settings?.selected_printer || 'Network Printer',
          type: printerType,
          settings: business?.settings?.printer_settings
        });
        await enhancedPrinterService.printReceipt(previewReceiptData, business?.settings?.printer_settings);
      }
      
      toast.success('Receipt printed successfully');
      
    } catch (error) {
      // HOTFIX 5: Fixed toast import/usage error
      toast.error('Print failed: ' + error.message);
    }
  };

  const handleSavePDF = async () => {
    if (!previewReceiptData) {
      toast.error('No receipt to save');
      return;
    }

    try {
      // Create PDF content (simplified version)
      const receiptHTML = generateReceiptHTML();
      const printWindow = window.open('', '_blank');
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 250);
      
      toast.success('Receipt PDF ready for download');
    } catch (error) {
      toast.error('Failed to generate PDF: ' + error.message);
    }
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

  const generateReceiptHTML = () => {
    if (!previewReceiptData) return '';

    const data = previewReceiptData;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            font-size: 12px;
            margin: 0;
            padding: 20px;
            width: 300px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .separator { border-bottom: 1px solid #000; margin: 5px 0; }
          .item-line { display: flex; justify-content: space-between; }
          @media print {
            body { width: auto; margin: 0; padding: 5mm; }
          }
        </style>
      </head>
      <body>
        <div class="center bold">
          ${data.business?.name || 'BUSINESS NAME'}
        </div>
        <div class="center">
          ${data.business?.address || ''}
        </div>
        <div class="center">
          ${data.business?.contact_email || ''}
        </div>
        <div class="separator"></div>
        <div><strong>${data.transaction_type}:</strong> ${data.transaction_number}</div>
        <div><strong>Date:</strong> ${new Date(data.timestamp).toLocaleString()}</div>
        ${data.customer ? `<div><strong>Customer:</strong> ${data.customer.name}</div>` : ''}
        <div class="separator"></div>
        ${data.items.map(item => `
          <div>${item.product_name}</div>
          <div class="item-line">
            <span>${item.quantity}x ${formatAmount(item.unit_price)}</span>
            <span>${formatAmount(item.total_price)}</span>
          </div>
        `).join('')}
        <div class="separator"></div>
        <div class="item-line">
          <span>Subtotal:</span>
          <span>${formatAmount(data.subtotal)}</span>
        </div>
        ${data.tax_amount > 0 ? `
          <div class="item-line">
            <span>Tax:</span>
            <span>${formatAmount(data.tax_amount)}</span>
          </div>
        ` : ''}
        ${data.discount_amount > 0 ? `
          <div class="item-line">
            <span>Discount:</span>
            <span>-${formatAmount(data.discount_amount)}</span>
          </div>
        ` : ''}
        <div class="separator"></div>
        <div class="item-line bold">
          <span>TOTAL:</span>
          <span>${formatAmount(data.total_amount)}</span>
        </div>
        ${data.payment_method === 'cash' ? `
          <div class="item-line">
            <span>Cash Received:</span>
            <span>${formatAmount(data.received_amount)}</span>
          </div>
          <div class="item-line">
            <span>Change:</span>
            <span>${formatAmount(data.change_amount)}</span>
          </div>
        ` : ''}
        <div class="center">
          Thank you for your business!
        </div>
      </body>
      </html>
    `;
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
      <div className="w-2/5 bg-white border-r flex flex-col">
        {/* Header */}
        <div className="p-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Products</h2>
            <div className="flex items-center space-x-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                scannerActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}>
                Scanner {scannerActive ? 'READY' : 'OFF'}
              </span>
              {isScanning && (
                <div className="flex items-center text-xs text-blue-600">
                  <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                  Scanning...
                </div>
              )}
            </div>
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

      {/* Middle Panel - Cart */}
      <div className="w-1/3 bg-white border-r flex flex-col">
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

      {/* Right Panel - Receipt Preview */}
      <div className="w-1/4 bg-gray-50 flex flex-col">
        {/* Receipt Header */}
        <div className="p-3 border-b bg-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Receipt Preview</h3>
            <button
              onClick={toggleReceiptCollapse}
              className="text-gray-500 hover:text-gray-700"
            >
              {receiptCollapsed ? <EyeIcon className="h-5 w-5" /> : <EyeSlashIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        {!receiptCollapsed && (
          <div className="flex-1 overflow-y-auto p-3">
            {previewReceiptData ? (
              <div className="bg-white p-4 rounded shadow-sm font-mono text-xs">
                <div className="text-center border-b pb-2 mb-2">
                  <div className="font-bold">{business?.name || 'BUSINESS NAME'}</div>
                  <div className="text-xs">{business?.address || ''}</div>
                  <div className="text-xs">{business?.contact_email || ''}</div>
                </div>

                <div className="mb-2">
                  <div><strong>{previewReceiptData.transaction_type}:</strong> {previewReceiptData.transaction_number}</div>
                  <div><strong>Date:</strong> {new Date(previewReceiptData.timestamp).toLocaleString()}</div>
                  {previewReceiptData.customer && (
                    <div><strong>Customer:</strong> {previewReceiptData.customer.name}</div>
                  )}
                </div>

                <div className="border-b pb-2 mb-2">
                  {previewReceiptData.items.map((item, index) => (
                    <div key={index} className="mb-1">
                      <div>{item.product_name}</div>
                      <div className="flex justify-between">
                        <span>{item.quantity}x {formatAmount(item.unit_price)}</span>
                        <span>{formatAmount(item.total_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatAmount(previewReceiptData.subtotal)}</span>
                  </div>
                  {previewReceiptData.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatAmount(previewReceiptData.tax_amount)}</span>
                    </div>
                  )}
                  {previewReceiptData.discount_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span>-{formatAmount(previewReceiptData.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>TOTAL:</span>
                    <span>{formatAmount(previewReceiptData.total_amount)}</span>
                  </div>
                  {previewReceiptData.payment_method === 'cash' && (
                    <>
                      <div className="flex justify-between">
                        <span>Cash Received:</span>
                        <span>{formatAmount(previewReceiptData.received_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Change:</span>
                        <span>{formatAmount(previewReceiptData.change_amount)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="text-center mt-4 pt-2 border-t">
                  <div className="text-xs">Thank you for your business!</div>
                </div>

                {/* Receipt Actions */}
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={handlePrintReceipt}
                    className="btn-primary text-xs flex-1 flex items-center justify-center"
                  >
                    <PrinterIcon className="h-3 w-3 mr-1" />
                    Print
                  </button>
                  <button
                    onClick={handleSavePDF}
                    className="btn-secondary text-xs flex-1 flex items-center justify-center"
                  >
                    <DocumentTextIcon className="h-3 w-3 mr-1" />
                    PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Complete a transaction to see receipt preview</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div className="p-6">
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

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
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