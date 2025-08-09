import React, { useState, useEffect, useRef } from 'react';
import { productsAPI, categoriesAPI, customersAPI, salesAPI, invoicesAPI } from '../../services/api';
import bluetoothPrinterService from '../../services/bluetoothPrinter';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';
import { 
  CubeIcon, 
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  UserPlusIcon,
  PrinterIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  BanknotesIcon,
  CreditCardIcon,
  EyeIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner, { InlineSpinner } from '../../components/LoadingSpinner';

const POSInterface = () => {
  const { business } = useAuth();
  const { formatAmount } = useCurrency();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Cart state
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalPaymentMethod, setModalPaymentMethod] = useState('cash');
  const [modalReceivedAmount, setModalReceivedAmount] = useState('');
  
  // Transaction state
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionMode, setTransactionMode] = useState('sale'); // 'sale' or 'invoice'
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  // Tax and discount
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  
  // Receipt preview state
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [previewReceiptData, setPreviewReceiptData] = useState(null);
  
  // Hold orders state
  const [heldOrders, setHeldOrders] = useState([]);
  const [selectedHeldOrder, setSelectedHeldOrder] = useState(null);
  
  // Barcode scanner state
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const [lastBarcodeTime, setLastBarcodeTime] = useState(0);
  const [scannerActive, setScannerActive] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  
  const barcodeInputRef = useRef(null);

  // Auto-focus management
  const focusSearchInput = () => {
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
        barcodeInputRef.current.select(); // Select any existing text
      }
    }, 100);
  };

  useEffect(() => {
    fetchData();
    
    // Auto-focus search input on load
    focusSearchInput();

    // Load held orders from localStorage
    const saved = localStorage.getItem('pos-held-orders');
    if (saved) {
      setHeldOrders(JSON.parse(saved));
    }

    // Enhanced barcode scanner listener
    const handleKeyDown = (event) => {
      if (!scannerActive) return;
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastBarcodeTime;
      
      // If it's been more than 50ms since last input, reset buffer (faster detection)
      if (timeDiff > 50) {
        setBarcodeBuffer('');
        setIsScanning(false);
      }
      
      // Handle Enter key or sufficient gap (end of barcode)
      if (event.key === 'Enter' || (barcodeBuffer.length >= 8 && timeDiff > 100)) {
        event.preventDefault();
        if (barcodeBuffer.length > 0) {
          handleBarcodeScanned(barcodeBuffer);
          setBarcodeBuffer('');
          setIsScanning(false);
        }
        return;
      }
      
      // Handle regular characters (alphanumeric and common barcode characters)
      if (event.key.length === 1 && /[A-Za-z0-9\-_]/.test(event.key)) {
        setIsScanning(true);
        setBarcodeBuffer(prev => prev + event.key);
        setLastBarcodeTime(currentTime);
        
        // Auto-submit after reasonable barcode length with timing
        if (barcodeBuffer.length >= 7) {
          setTimeout(() => {
            const now = Date.now();
            if (now - currentTime > 200) { // If no new input for 200ms
              if (barcodeBuffer.length > 0) {
                handleBarcodeScanned(barcodeBuffer + event.key);
                setBarcodeBuffer('');
                setIsScanning(false);
              }
            }
          }, 250);
        }
      }
    };

    // Add global keydown listener for barcode scanner
    document.addEventListener('keydown', handleKeyDown);
    
    // Focus management - refocus when clicking away
    const handleWindowClick = (event) => {
      if (!event.target.closest('input') && !event.target.closest('button') && !event.target.closest('select')) {
        focusSearchInput();
      }
    };
    
    document.addEventListener('click', handleWindowClick);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleWindowClick);
    };
  }, [scannerActive, lastBarcodeTime, barcodeBuffer]);

  // Auto-focus after transactions
  useEffect(() => {
    if (!isProcessing) {
      focusSearchInput();
    }
  }, [isProcessing]);

  useEffect(() => {
    if (business?.settings?.tax_rate) {
      setTaxRate(business.settings.tax_rate);
    }
  }, [business]);

  const handleBarcodeScanned = async (barcode) => {
    if (!barcode || barcode.length < 3) return; // Minimum barcode length
    
    try {
      setIsScanning(false);
      const response = await productsAPI.getProductByBarcode(barcode.trim());
      addToCart(response.data);
      
      // Visual and audio feedback for successful scan
      toast.success(`✅ Scanned: ${response.data.name} added to cart`, {
        duration: 2000,
        position: 'top-center'
      });
      
      // Visual feedback on input
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#d4edda';
        barcodeInputRef.current.value = `✓ ${response.data.name}`;
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.backgroundColor = '';
            barcodeInputRef.current.value = '';
            focusSearchInput();
          }
        }, 1500);
      }
      
    } catch (error) {
      setIsScanning(false);
      
      // Clear error message with specific barcode info
      toast.error(`❌ Product not found: ${barcode}`, {
        duration: 3000,
        position: 'top-center'
      });
      
      // Visual error feedback
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#f8d7da';
        barcodeInputRef.current.value = `✗ Not found: ${barcode}`;
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.backgroundColor = '';
            barcodeInputRef.current.value = '';
            focusSearchInput();
          }
        }, 2000);
      }
    }
  };

  const fetchData = async () => {
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
  };

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
      toast.error('Search failed');
    }
  };

  const handleBarcodeInput = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      try {
        const response = await productsAPI.getProductByBarcode(barcodeInput.trim());
        addToCart(response.data);
        setBarcodeInput('');
        toast.success(`Added ${response.data.name} to cart`);
      } catch (error) {
        toast.error('Product not found');
        setBarcodeInput('');
      }
    }
  };

  const addToCart = (product) => {
    if (product.quantity <= 0) {
      toast.error('Product out of stock');
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product_id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.quantity) {
          toast.error(`Only ${product.quantity} items available`);
          return prevCart;
        }
        return prevCart.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total_price: (item.quantity + 1) * item.unit_price }
            : item
        );
      } else {
        return [...prevCart, {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: 1,
          unit_price: product.price,
          total_price: product.price
        }];
      }
    });
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.quantity) {
      toast.error(`Only ${product.quantity} items available`);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity, total_price: newQuantity * item.unit_price }
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
    setDiscountAmount(0);
    setNotes('');
    setReceivedAmount('');
    setShowNewCustomerForm(false);
    setNewCustomer({ name: '', email: '', phone: '' });
    
    // Auto-focus search input after clearing cart
    focusSearchInput();
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discountAmount;
    
    return {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
      change: receivedAmount ? Math.max(0, receivedAmount - total).toFixed(2) : '0.00'
    };
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    try {
      const response = await customersAPI.createCustomer(newCustomer);
      setSelectedCustomer(response.data);
      setCustomers(prev => [...prev, response.data]);
      setShowNewCustomerForm(false);
      setNewCustomer({ name: '', email: '', phone: '' });
      toast.success('Customer created successfully');
    } catch (error) {
      toast.error('Failed to create customer');
    }
  };

  const holdOrder = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const heldOrder = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      cart: [...cart],
      customer: selectedCustomer,
      discountAmount,
      notes,
      totals: calculateTotals()
    };

    const updated = [...heldOrders, heldOrder];
    setHeldOrders(updated);
    localStorage.setItem('pos-held-orders', JSON.stringify(updated));
    
    clearCart();
    toast.success('Order held successfully');
  };

  const resumeHeldOrder = (heldOrder) => {
    setCart(heldOrder.cart);
    setSelectedCustomer(heldOrder.customer);
    setDiscountAmount(heldOrder.discountAmount);
    setNotes(heldOrder.notes);
    
    // Remove from held orders
    const updated = heldOrders.filter(order => order.id !== heldOrder.id);
    setHeldOrders(updated);
    localStorage.setItem('pos-held-orders', JSON.stringify(updated));
    
    setSelectedHeldOrder(null);
    toast.success('Order resumed');
  };

  const generateReceiptPreview = () => {
    const totals = calculateTotals();
    const receiptData = {
      business: business,
      transaction_number: `PREVIEW-${Date.now()}`,
      timestamp: new Date(),
      customer: selectedCustomer,
      items: cart,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      discount_amount: discountAmount,
      total_amount: totals.total,
      payment_method: paymentMethod,
      received_amount: receivedAmount,
      change_amount: totals.change,
      notes: notes
    };
    
    setPreviewReceiptData(receiptData);
    setShowReceiptPreview(true);
  };

  // Payment Modal Functions
  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    setModalPaymentMethod(paymentMethod);
    setModalReceivedAmount('');
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setModalReceivedAmount('');
    // Return focus to barcode input after closing modal
    focusSearchInput();
  };

  const calculateModalChange = () => {
    if (modalPaymentMethod !== 'cash' || !modalReceivedAmount) return 0;
    const totals = calculateTotals();
    const received = parseFloat(modalReceivedAmount) || 0;
    const change = received - parseFloat(totals.total);
    return Math.max(0, change);
  };

  const confirmPayment = () => {
    const totals = calculateTotals();
    
    if (modalPaymentMethod === 'cash') {
      const received = parseFloat(modalReceivedAmount) || 0;
      if (received < parseFloat(totals.total)) {
        toast.error('Insufficient payment amount');
        return;
      }
      setReceivedAmount(received);
    }
    
    setPaymentMethod(modalPaymentMethod);
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
    
    // For sales, payment validation is already done in confirmPayment()
    // For invoices, no payment validation needed
    if (transactionMode === 'sale' && paymentMethod === 'cash' && receivedAmount < parseFloat(totals.total)) {
      toast.error('Insufficient payment amount');
      return;
    }

    setIsProcessing(true);

    try {
      const transactionData = {
        customer_id: selectedCustomer?.id || null,
        items: cart,
        subtotal: parseFloat(totals.subtotal),
        tax_amount: parseFloat(totals.taxAmount),
        discount_amount: discountAmount,
        total_amount: parseFloat(totals.total),
        notes: notes.trim() || null
      };

      let response;
      if (transactionMode === 'sale') {
        response = await salesAPI.createSale({
          ...transactionData,
          payment_method: paymentMethod
        });
        toast.success(`Sale completed! Sale #${response.data.sale_number}`);
        
        // Auto-print if enabled
        if (business?.settings?.printer_settings?.auto_print) {
          await handleAutoPrint(response.data, 'sale');
        }
      } else {
        response = await invoicesAPI.createInvoice(transactionData);
        toast.success(`Invoice created! Invoice #${response.data.invoice_number}`);
      }

      // Clear cart and reset values
      clearCart();
      setShowReceiptPreview(false);
      setReceivedAmount(''); // Reset payment values
      setPaymentMethod('cash');
      
      // Auto-focus search input after transaction
      setTimeout(() => {
        focusSearchInput();
      }, 1000);
      
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
      const printerStatus = bluetoothPrinterService.getStatus();
      if (!printerStatus.isConnected) {
        toast.info('Printer not connected - auto-print skipped');
        return;
      }

      const receiptData = generateReceiptData(transactionData, transactionType);
      await bluetoothPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
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
      toast.success('Receipt printed successfully');
      
    } catch (error) {
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
      const pdfContent = generatePDFContent(previewReceiptData);
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt_${previewReceiptData.transaction_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Receipt saved as PDF');
      
    } catch (error) {
      toast.error('Failed to save PDF');
    }
  };

  const generateReceiptData = (transactionData, transactionType) => {
    return {
      business: business,
      transaction_number: transactionType === 'sale' ? transactionData.sale_number : transactionData.invoice_number,
      transaction_type: transactionType.toUpperCase(),
      timestamp: new Date(transactionData.created_at || new Date()),
      customer: selectedCustomer,
      items: transactionData.items,
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

  const generatePDFContent = (receiptData) => {
    // Simplified PDF generation (in production, use a proper PDF library)
    return `Receipt: ${receiptData.transaction_number}\nDate: ${receiptData.timestamp.toLocaleString()}\nTotal: $${receiptData.total_amount.toFixed(2)}`;
  };

  const totals = calculateTotals();

  if (loading) {
    return <LoadingSpinner message="Loading POS..." />;
  }

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* Left Panel - Products (40%) */}
      <div className="w-2/5 flex flex-col bg-white border-r">
        {/* Search and Barcode */}
        <div className="p-3 border-b bg-gray-50 flex-shrink-0">
          <div className="space-y-2">
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                className="form-input text-sm pl-8 pr-20"
                placeholder={scannerActive ? "🔍 READY TO SCAN - Focus here for barcode scanner" : "Manual search only..."}
                value={barcodeInput || searchTerm}
                onChange={(e) => {
                  if (barcodeInput) {
                    setBarcodeInput(e.target.value);
                  } else {
                    setSearchTerm(e.target.value);
                  }
                }}
                onKeyDown={handleBarcodeInput}
                onBlur={() => {
                  setBarcodeInput('');
                  // Don't lose focus completely, refocus after a short delay
                  setTimeout(() => {
                    if (document.activeElement !== barcodeInputRef.current) {
                      focusSearchInput();
                    }
                  }, 100);
                }}
                onFocus={() => {
                  if (searchTerm) {
                    setBarcodeInput(searchTerm);
                    setSearchTerm('');
                  }
                }}
                autoComplete="off"
                autoFocus
              />
              <MagnifyingGlassIcon className="absolute left-2 top-2 h-4 w-4 text-gray-400" />
              <div className="absolute right-2 top-1">
                <button
                  onClick={() => setScannerActive(!scannerActive)}
                  className={`text-xs px-2 py-1 rounded ${
                    scannerActive 
                      ? 'bg-green-100 text-green-700 border border-green-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                  title={scannerActive ? "Barcode scanner active - Ready to scan" : "Barcode scanner disabled"}
                >
                  {scannerActive ? '🔍 ON' : '🔍 OFF'}
                </button>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <select
                className="form-input text-sm flex-1"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              
              <button onClick={handleProductSearch} className="btn-primary text-sm px-3">
                Search
              </button>
            </div>
            
            {/* Scanner Status */}
            <div className="flex items-center justify-between text-xs">
              <span className={`flex items-center ${scannerActive ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`w-2 h-2 rounded-full mr-1 ${scannerActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                Scanner {scannerActive ? 'READY' : 'OFF'}
                {isScanning && <span className="ml-2 text-blue-600 animate-pulse">📡 Scanning...</span>}
              </span>
              {barcodeBuffer && (
                <span className="text-blue-600 font-mono text-xs">
                  Buffer: {barcodeBuffer} ({barcodeBuffer.length})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="p-2 border-b flex-shrink-0">
          <div className="flex space-x-1 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('')}
              className={`category-tab text-xs whitespace-nowrap ${!selectedCategory ? 'active' : ''}`}
            >
              All
            </button>
            {categories.slice(0, 4).map((category) => (
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
        <div className="flex-1 p-3 overflow-y-auto">
          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="product-card text-center p-2 cursor-pointer"
                  onClick={() => addToCart(product)}
                >
                  <div className="mb-1">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-12 h-12 mx-auto rounded" />
                    ) : (
                      <CubeIcon className="w-12 h-12 mx-auto text-gray-400" />
                    )}
                  </div>
                  <h3 className="font-medium text-xs text-gray-900 truncate">{product.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{product.sku}</p>
                  <div className="mt-1">
                    <span className="text-sm font-bold text-primary-600">${product.price}</span>
                  </div>
                  <span className={`text-xs px-1 py-0.5 rounded ${
                    product.quantity > 10 ? 'bg-green-100 text-green-600' : 
                    product.quantity > 0 ? 'bg-yellow-100 text-yellow-600' : 
                    'bg-red-100 text-red-600'
                  }`}>
                    {product.quantity > 0 ? `${product.quantity} left` : 'Out'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <CubeIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">No products found</p>
            </div>
          )}
        </div>
      </div>

      {/* Middle Panel - Cart & Checkout (35%) */}
      <div className="w-1/3 bg-white flex flex-col border-r">
        {/* Cart Header */}
        <div className="p-3 border-b bg-gray-50 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold">Cart ({cart.length})</h2>
            <div className="flex space-x-1">
              {cart.length > 0 && (
                <>
                  <button onClick={holdOrder} className="text-blue-600 hover:text-blue-700 p-1" title="Hold Order">
                    <ClockIcon className="h-4 w-4" />
                  </button>
                  <button onClick={clearCart} className="text-red-600 hover:text-red-700 p-1" title="Clear Cart">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Held Orders */}
          {heldOrders.length > 0 && (
            <div className="mt-2">
              <select
                className="form-input text-xs w-full"
                value=""
                onChange={(e) => {
                  const order = heldOrders.find(o => o.id.toString() === e.target.value);
                  if (order) resumeHeldOrder(order);
                }}
              >
                <option value="">Resume held order ({heldOrders.length})</option>
                {heldOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {new Date(order.timestamp).toLocaleTimeString()} - ${order.totals.total}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Customer Selection */}
        <div className="p-3 border-b bg-gray-50 flex-shrink-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">Customer:</label>
              <button
                onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                className="text-primary-600 hover:text-primary-700"
              >
                <UserPlusIcon className="h-4 w-4" />
              </button>
            </div>
            
            {!showNewCustomerForm ? (
              <select
                className="form-input text-xs"
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers.find(c => c.id === e.target.value);
                  setSelectedCustomer(customer || null);
                }}
              >
                <option value="">Walk-in Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.email && `(${customer.email})`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  className="form-input text-xs"
                  placeholder="Customer name*"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({...prev, name: e.target.value}))}
                />
                <div className="flex space-x-1">
                  <input
                    type="email"
                    className="form-input text-xs flex-1"
                    placeholder="Email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(prev => ({...prev, email: e.target.value}))}
                  />
                  <input
                    type="tel"
                    className="form-input text-xs flex-1"
                    placeholder="Phone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({...prev, phone: e.target.value}))}
                  />
                </div>
                <div className="flex space-x-1">
                  <button onClick={handleCreateCustomer} className="btn-primary text-xs px-2 py-1 flex-1">
                    Add
                  </button>
                  <button onClick={() => setShowNewCustomerForm(false)} className="btn-secondary text-xs px-2 py-1">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length > 0 ? (
            <div className="p-3 space-y-2">
              {cart.map((item) => (
                <div key={item.product_id} className="bg-gray-50 rounded p-2">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium text-xs text-gray-900 truncate flex-1">{item.product_name}</h3>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-red-500 hover:text-red-700 ml-1"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => updateCartItemQuantity(item.product_id, item.quantity - 1)}
                        className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      >
                        <MinusIcon className="h-2 w-2" />
                      </button>
                      <span className="w-6 text-center text-xs">{item.quantity}</span>
                      <button
                        onClick={() => updateCartItemQuantity(item.product_id, item.quantity + 1)}
                        className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      >
                        <PlusIcon className="h-2 w-2" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold">{formatAmount(item.total_price)}</div>
                      <div className="text-xs text-gray-500">{formatAmount(item.unit_price)}/each</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <CubeIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-500 text-xs">Cart is empty</p>
                <p className="text-xs text-gray-400">Add products to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Cart Summary & Payment */}
        {cart.length > 0 && (
          <div className="border-t p-3 space-y-3 bg-gray-50 flex-shrink-0">
            {/* Discount & Notes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">Discount ($):</label>
                <input
                  type="number"
                  className="w-16 px-1 py-0.5 border rounded text-xs text-right"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                />
              </div>
              <textarea
                className="form-input text-xs w-full h-8 resize-none"
                placeholder="Notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs border-t pt-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${totals.subtotal}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span>Tax ({taxRate}%):</span>
                  <span>${totals.taxAmount}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t">
                <span>Total:</span>
                <span>${totals.total}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setTransactionMode('sale')}
                  className={`text-xs py-1 px-2 rounded border ${
                    transactionMode === 'sale' ? 'bg-green-100 border-green-500 text-green-700' : 'border-gray-300'
                  }`}
                >
                  Sale
                </button>
                <button
                  onClick={() => setTransactionMode('invoice')}
                  className={`text-xs py-1 px-2 rounded border ${
                    transactionMode === 'invoice' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-gray-300'
                  }`}
                >
                  Invoice
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={generateReceiptPreview}
                className="btn-secondary flex items-center justify-center text-xs py-2"
                disabled={cart.length === 0}
              >
                <EyeIcon className="h-3 w-3 mr-1" />
                Preview
              </button>
              <button
                onClick={holdOrder}
                className="btn-secondary flex items-center justify-center text-xs py-2"
                disabled={cart.length === 0}
              >
                <ClockIcon className="h-3 w-3 mr-1" />
                Hold
              </button>
              <button
                onClick={transactionMode === 'sale' ? openPaymentModal : handleTransaction}
                disabled={isProcessing || cart.length === 0}
                className="btn-primary flex items-center justify-center text-xs py-2"
              >
                {isProcessing ? (
                  <InlineSpinner />
                ) : (
                  <>
                    {transactionMode === 'sale' ? (
                      <>
                        <BanknotesIcon className="h-3 w-3 mr-1" />
                        Pay
                      </>
                    ) : (
                      <>
                        <DocumentTextIcon className="h-3 w-3 mr-1" />
                        Invoice
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Receipt Preview (25%) */}
      <div className="w-1/4 bg-gray-50 flex flex-col">
        <div className="p-3 border-b bg-white flex-shrink-0">
          <h3 className="text-sm font-semibold flex items-center">
            <PrinterIcon className="h-4 w-4 mr-2" />
            Receipt Preview
          </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {showReceiptPreview && previewReceiptData ? (
            <div className="bg-white border rounded-lg p-4 font-mono text-xs">
              {/* Receipt Header */}
              <div className="text-center border-b pb-2 mb-3">
                <h2 className="font-bold text-sm">{previewReceiptData.business?.name || 'BUSINESS NAME'}</h2>
                <p className="text-xs">{previewReceiptData.business?.address || 'Business Address'}</p>
                <p className="text-xs">{previewReceiptData.business?.contact_email}</p>
                <p className="text-xs">{previewReceiptData.business?.phone}</p>
              </div>

              {/* Transaction Details */}
              <div className="border-b pb-2 mb-2">
                <p>Receipt: {previewReceiptData.transaction_number}</p>
                <p>Date: {previewReceiptData.timestamp.toLocaleString()}</p>
                {previewReceiptData.customer && (
                  <p>Customer: {previewReceiptData.customer.name}</p>
                )}
                <p>Cashier: Staff</p>
              </div>

              {/* Items */}
              <div className="border-b pb-2 mb-2">
                {previewReceiptData.items.map((item, index) => (
                  <div key={index} className="flex justify-between mb-1">
                    <div>
                      <p className="truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-600">
                        {item.quantity} x ${item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <p>${item.total_price.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-b pb-2 mb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${previewReceiptData.subtotal}</span>
                </div>
                {parseFloat(previewReceiptData.tax_amount) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>${previewReceiptData.tax_amount}</span>
                  </div>
                )}
                {parseFloat(previewReceiptData.discount_amount) > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-${previewReceiptData.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>TOTAL:</span>
                  <span>${previewReceiptData.total_amount}</span>
                </div>
                {transactionMode === 'sale' && paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between">
                      <span>Paid:</span>
                      <span>${previewReceiptData.received_amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Change:</span>
                      <span>${previewReceiptData.change_amount}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="text-center text-xs">
                <p>Thank you for your business!</p>
                {previewReceiptData.notes && (
                  <p className="mt-2 text-gray-600">Note: {previewReceiptData.notes}</p>
                )}
              </div>

              {/* Print Actions */}
              <div className="mt-4 pt-4 border-t space-y-2">
                <button 
                  onClick={() => handlePrintReceipt()}
                  className="w-full btn-primary text-xs py-2"
                >
                  <PrinterIcon className="h-3 w-3 mr-1 inline" />
                  Print to POS-9200-L
                </button>
                <button 
                  onClick={() => handleSavePDF()}
                  className="w-full btn-secondary text-xs py-1"
                >
                  Save as PDF
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <PrinterIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-xs">Receipt preview will appear here</p>
              <p className="text-xs text-gray-400">Add items and click Preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Complete Payment</h3>
              <button
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Transaction Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center text-sm text-gray-600 mb-1">
                  <span>Subtotal:</span>
                  <span>${totals.subtotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-600 mb-1">
                    <span>Discount:</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg font-bold text-gray-900 pt-2 border-t">
                  <span>Total:</span>
                  <span>${totals.total}</span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setModalPaymentMethod('cash')}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      modalPaymentMethod === 'cash' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <BanknotesIcon className="h-5 w-5 mr-2" />
                    Cash
                  </button>
                  <button
                    onClick={() => setModalPaymentMethod('card')}
                    className={`p-3 rounded-lg border-2 flex items-center justify-center transition-colors ${
                      modalPaymentMethod === 'card' 
                        ? 'border-primary-500 bg-primary-50 text-primary-700' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CreditCardIcon className="h-5 w-5 mr-2" />
                    Card
                  </button>
                </div>
              </div>

              {/* Cash Payment Input */}
              {modalPaymentMethod === 'cash' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Amount Received</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-right text-lg"
                    placeholder="0.00"
                    value={modalReceivedAmount}
                    onChange={(e) => setModalReceivedAmount(e.target.value)}
                    step="0.01"
                    min="0"
                    autoFocus
                  />
                  
                  {/* Change Calculation */}
                  {modalReceivedAmount && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-800">Change Due:</span>
                        <span className="text-lg font-bold text-green-800">
                          ${calculateModalChange().toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 20, 50, 100].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setModalReceivedAmount(amount.toString())}
                        className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                      >
                        ${amount}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Card Payment Message */}
              {modalPaymentMethod === 'card' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <CreditCardIcon className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="text-sm text-blue-800">Card payment - no change required</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex space-x-3 p-4 border-t">
              <button
                onClick={closePaymentModal}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmPayment}
                disabled={modalPaymentMethod === 'cash' && (!modalReceivedAmount || parseFloat(modalReceivedAmount) < parseFloat(totals.total))}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {modalPaymentMethod === 'cash' 
                  ? `Confirm Payment - $${modalReceivedAmount || '0.00'}` 
                  : `Confirm Card Payment - $${totals.total}`
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSInterface;