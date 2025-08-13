import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI, categoriesAPI, customersAPI, salesAPI, invoicesAPI, businessAPI } from '../../services/api';
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
  ClockIcon,
  ClipboardDocumentListIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

const POSInterface = () => {
  const { business, user } = useAuth();
  const { formatAmount, currency } = useCurrency();
  const navigate = useNavigate();
  
  // Location and time state (FEATURE 9: Web App Date & Time)
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [locationInfo, setLocationInfo] = useState(null);
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
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
  
  // Feature 3: Price Inquiry Modal state
  const [showPriceInquiry, setShowPriceInquiry] = useState(false);
  const [priceInquiryTerm, setPriceInquiryTerm] = useState('');
  const [priceInquiryResults, setPriceInquiryResults] = useState([]);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [modalPaymentMethod, setModalPaymentMethod] = useState('cash');
  const [modalReceivedAmount, setModalReceivedAmount] = useState('');
  const [modalDiscountAmount, setModalDiscountAmount] = useState('');
  const [modalDiscountType, setModalDiscountType] = useState('amount');
  const [modalNotes, setModalNotes] = useState('');
  const [modalPaymentRef, setModalPaymentRef] = useState(''); // Feature 7: Reference code for EWallet/Bank
  const [receivedAmount, setReceivedAmount] = useState('');
  
  // Barcode state
  const [heldOrders, setHeldOrders] = useState([]);
  
  const barcodeInputRef = useRef(null);
  const receivedAmountInputRef = useRef(null);

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
      const product = response.data;
      
      // Auto-add product to cart (FEATURE 1: Barcode Scanner – Auto Add to Cart)
      addToCart(product);
      
      // Clear search field after successful scan and maintain focus
      setSearchTerm('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.value = '';
        barcodeInputRef.current.focus(); // Keep focus for next scan
      }
      
      // Enhanced visual feedback for successful scan
      toast.success(`✅ ${product.name} added to cart`, {
        duration: 2000,
        position: 'top-center'
      });
      
      // Green flash effect for successful scan
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#c6f6d5'; // Light green
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.backgroundColor = '';
            barcodeInputRef.current.focus(); // Ensure focus is maintained
          }
        }, 800); // Shorter duration for better UX
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      
      // Show "Item not found" as requested, but keep field focused
      toast.error(`Item not found`, {
        duration: 3000,
        position: 'top-center'
      });
      
      // Clear search field and maintain focus for next attempt
      setSearchTerm('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.style.backgroundColor = '#fed7d7'; // Light red
        barcodeInputRef.current.value = '';
        setTimeout(() => {
          if (barcodeInputRef.current) {
            barcodeInputRef.current.style.backgroundColor = '';
            barcodeInputRef.current.focus(); // Keep focus for next scan attempt
          }
        }, 1200); // Shorter duration
      }
    }
  }, []);

  // Debug business context on component mount
  useEffect(() => {
    console.log('🏢 POS Business Context Debug:', {
      businessExists: !!business,
      businessName: business?.name,
      hasSettings: !!business?.settings,
      settingsKeys: business?.settings ? Object.keys(business.settings) : [],
      receiptHeader: business?.settings?.receipt_header,
      receiptFooter: business?.settings?.receipt_footer,
      fullBusiness: business
    });
  }, [business]);

  useEffect(() => {
    fetchData();

    // Load held orders from localStorage
    const saved = localStorage.getItem('pos-held-orders');
    if (saved) {
      setHeldOrders(JSON.parse(saved));
    }

    // FEATURE 9: Initialize location-based date/time
    initializeLocationTime();
  }, [fetchData]);

  // FEATURE 9: Location-based date/time functionality
  const initializeLocationTime = async () => {
    try {
      // Request location permission
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Set location info
            setLocationInfo({ latitude, longitude });
            
            // Try to get timezone from location (using a free API)
            try {
              const response = await fetch(
                `https://api.timezonedb.com/v2.1/get-zone?key=demo&format=json&by=position&lat=${latitude}&lng=${longitude}`
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.zoneName) {
                  setTimeZone(data.zoneName);
                  toast.success(`📍 Location detected: ${data.zoneName}`, { duration: 3000 });
                }
              }
            } catch (error) {
              // Fallback to browser timezone
              console.log('Using browser timezone as fallback');
              toast('📍 Using browser timezone', { duration: 2000 });
            }
          },
          (error) => {
            console.log('Location access denied or failed:', error);
            toast('📍 Using system timezone (location access denied)', { duration: 3000 });
          },
          { timeout: 10000, enableHighAccuracy: true }
        );
      } else {
        toast('📍 Using system timezone (location not supported)', { duration: 3000 });
      }
    } catch (error) {
      console.error('Location initialization error:', error);
    }

    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  };

  useEffect(() => {
    if (business?.settings?.tax_rate) {
      setTaxRate(business.settings.tax_rate);
    }
  }, [business]);

  // Simplified barcode scanner focus management and auto-scan functionality
  useEffect(() => {
    const maintainFocus = () => {
      // Keep focus on barcode input when not in modal
      if (barcodeInputRef.current && !showPaymentModal && 
          document.activeElement !== barcodeInputRef.current &&
          !document.activeElement?.tagName?.toLowerCase().includes('input') &&
          !document.activeElement?.tagName?.toLowerCase().includes('select') &&
          !document.activeElement?.tagName?.toLowerCase().includes('textarea') &&
          !document.activeElement?.tagName?.toLowerCase().includes('button')) {
        barcodeInputRef.current.focus();
      }
    };

    // Focus maintenance interval
    const focusInterval = setInterval(maintainFocus, 500);

    // Cleanup
    return () => {
      clearInterval(focusInterval);
    };
  }, [showPaymentModal]);

  // Handle Enter key for barcode scanning
  useEffect(() => {
    const handleEnterKey = (e) => {
      if (e.key === 'Enter' && barcodeInputRef.current === document.activeElement && searchTerm.trim()) {
        e.preventDefault();
        const barcode = searchTerm.trim();
        handleBarcodeScanned(barcode);
      }
    };

    document.addEventListener('keydown', handleEnterKey);
    
    return () => {
      document.removeEventListener('keydown', handleEnterKey);
    };
  }, [searchTerm, handleBarcodeScanned]);

  // Feature 4: Global Hotkeys F6-F9
  useEffect(() => {
    const handleGlobalHotkeys = (e) => {
      // Skip if user is typing in input fields, textareas, or if modals are open
      const activeElement = document.activeElement;
      const isInputField = activeElement?.tagName?.toLowerCase() === 'input' || 
                          activeElement?.tagName?.toLowerCase() === 'textarea' ||
                          activeElement?.tagName?.toLowerCase() === 'select';
      
      // Skip if payment modal is open (except for input fields within the modal)
      if (showPaymentModal && !activeElement?.closest('.payment-modal')) return;
      if (showPriceInquiry) return;
      
      // Skip if typing in non-payment input fields
      if (isInputField && !showPaymentModal) return;

      switch (e.key) {
        case 'F6':
          e.preventDefault();
          if (cart.length === 0 || isProcessing) return;
          openPaymentModal();
          break;
        case 'F7':
          e.preventDefault();
          if (cart.length === 0) return;
          holdOrder();
          break;
        case 'F8':
          e.preventDefault();
          if (cart.length === 0) return;
          clearCart();
          break;
        case 'F9':
          e.preventDefault();
          setShowPriceInquiry(true);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleGlobalHotkeys);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalHotkeys);
    };
  }, [cart.length, isProcessing, showPaymentModal, showPriceInquiry]);

  // Initial focus on barcode input
  useEffect(() => {
    if (barcodeInputRef.current && !loading) {
      barcodeInputRef.current.focus();
    }
  }, [loading]);

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
    toast.success('Cart cleared');
  };

  // Feature 3: Price Inquiry functionality
  const searchPriceInquiry = async (term) => {
    if (!term || term.length < 2) {
      setPriceInquiryResults([]);
      return;
    }

    try {
      // Search by name, SKU, or barcode
      const response = await productsAPI.getProducts({
        search: term,
        status: 'active'
      });
      
      const results = response.data.map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        cost: product.cost,
        quantity: product.quantity,
        status: product.status
      }));
      
      setPriceInquiryResults(results);
    } catch (error) {
      console.error('Price inquiry search failed:', error);
      setPriceInquiryResults([]);
    }
  };

  const closePriceInquiry = () => {
    setShowPriceInquiry(false);
    setPriceInquiryTerm('');
    setPriceInquiryResults([]);
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
    
    // Get the current value from multiple sources to ensure we have the right amount
    const inputElement = receivedAmountInputRef.current;
    const inputValue = inputElement ? inputElement.value : '';
    const fallbackInputElement = document.querySelector('input[placeholder="0.00"]');
    const fallbackInputValue = fallbackInputElement ? fallbackInputElement.value : '';
    
    console.log('Payment validation - comprehensive debug:', {
      modalReceivedAmount: modalReceivedAmount,
      inputRefValue: inputValue,
      fallbackInputValue: fallbackInputValue,
      modalPaymentMethod: modalPaymentMethod,
      totals: totals
    });
    
    let receivedAmountForTransaction = null;
    
    // HOTFIX: Use multiple fallback sources for the received amount
    if (modalPaymentMethod === 'cash') {
      // Priority order: modalReceivedAmount state -> ref value -> DOM query -> fallback to 0
      const receivedStr = modalReceivedAmount || inputValue || fallbackInputValue || '0';
      const received = parseFloat(receivedStr) || 0;
      const total = parseFloat(totals.total);
      
      console.log('Payment validation final:', {
        receivedStr: receivedStr,
        received: received,
        total: total,
        comparison: received >= total,
        sources: {
          state: modalReceivedAmount,
          ref: inputValue,
          fallback: fallbackInputValue
        }
      });
      
      // Use epsilon comparison for floating point precision
      const epsilon = 0.01; // 1 cent tolerance
      
      if (received < (total - epsilon)) {
        toast.error(`Insufficient payment. Required: ${formatAmount(total)}, Received: ${formatAmount(received)}`);
        console.log('Payment failed - insufficient amount');
        return;
      }
      
      receivedAmountForTransaction = received;
      setReceivedAmount(received);
    }
    
    // Apply modal values to main transaction
    setPaymentMethod(modalPaymentMethod);
    setDiscountAmount(parseFloat(totals.discount));
    setNotes(modalNotes);
    
    // Save discount type preference
    localStorage.setItem('pos-discount-type', modalDiscountType);
    
    setShowPaymentModal(false);
    console.log('Payment confirmed successfully');
    
    // Proceed with the transaction, passing the validated received amount
    handleTransaction(receivedAmountForTransaction);
  };



  const handleTransaction = async (validatedReceivedAmount = null) => {
    console.log('handleTransaction called with:', {
      cartLength: cart.length,
      transactionMode: transactionMode,
      paymentMethod: paymentMethod,
      receivedAmount: receivedAmount,
      validatedReceivedAmount: validatedReceivedAmount,
      modalReceivedAmount: modalReceivedAmount,
      modalPaymentMethod: modalPaymentMethod
    });

    if (cart.length === 0) {
      toast.error('Cart is empty');
      console.log('Transaction failed: Cart is empty');
      return;
    }

    const totals = calculateTotals();
    console.log('Transaction totals calculated:', totals);
    
    // Use the validated amount from payment confirmation if available
    const finalReceivedAmount = validatedReceivedAmount || parseFloat(receivedAmount) || 0;
    
    // HOTFIX 7: Fixed payment validation logic with proper rounding
    // For sales, payment validation is already done in confirmPayment()
    // But double-check here for safety
    if (transactionMode === 'sale' && paymentMethod === 'cash') {
      const subtotal = parseFloat(totals.subtotal);
      const discount = parseFloat(totals.discount) || 0;
      const taxAmount = parseFloat(totals.taxAmount);
      const requiredAmount = subtotal - discount + taxAmount;
      
      console.log('Secondary payment validation:', {
        subtotal, 
        discount, 
        taxAmount, 
        requiredAmount, 
        finalReceivedAmount,
        originalReceivedAmount: receivedAmount,
        validatedReceivedAmount: validatedReceivedAmount
      });
      
      // Round to 2 decimal places for proper comparison
      const roundedRequired = Math.round(requiredAmount * 100) / 100;
      const roundedReceived = Math.round(finalReceivedAmount * 100) / 100;
      
      if (roundedReceived < roundedRequired) {
        console.log('Transaction failed: Secondary payment validation failed');
        toast.error(`Insufficient payment. Required: ${formatAmount(roundedRequired)}, Received: ${formatAmount(roundedReceived)}`);
        return;
      }
    }

    console.log('Starting transaction processing...');
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
        payment_ref_code: paymentMethod === 'ewallet' && modalPaymentRef?.trim() ? modalPaymentRef.trim() : null, // Feature 7
        received_amount: paymentMethod === 'cash' ? finalReceivedAmount : parseFloat(totals.total),
        change_amount: paymentMethod === 'cash' ? Math.max(0, finalReceivedAmount - parseFloat(totals.total)) : 0,
        notes: notes.trim() || null,
        created_at: new Date().toISOString(),
        status: 'completed' // Ensure status is set for Sales History
      };

      let response;
      if (transactionMode === 'sale') {
        response = await salesAPI.createSale(transactionData);
        toast.success(`Sale completed! Sale #${response.data.sale_number}`);
        
        // Auto-print if enabled - no preview needed
        console.log('Autoprint debug - Business settings structure:', {
          business: business,
          settings: business?.settings,
          printer_settings: business?.settings?.printer_settings,
          auto_print_path1: business?.settings?.printer_settings?.auto_print,
          auto_print_path2: business?.settings?.auto_print,
          condition1: business?.settings?.printer_settings?.auto_print,
          condition2: business?.settings?.auto_print,
          finalCondition: business?.settings?.printer_settings?.auto_print || business?.settings?.auto_print
        });
        
        if (business?.settings?.printer_settings?.auto_print || business?.settings?.auto_print) {
          console.log('Auto-print enabled, attempting to print...', business?.settings);
          const receiptData = generateReceiptData(response.data, 'sale');
          await handleAutoPrint(response.data, 'sale');
        } else {
          console.log('Auto-print disabled or setting not found', {
            businessSettings: business?.settings,
            printerSettings: business?.settings?.printer_settings,
            reason: 'Condition evaluated to false'
          });
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
      
      console.log('Auto-print attempt:', { 
        printerType, 
        attempt: new Date().toISOString(),
        transactionId: transactionData.sale_number || transactionData.invoice_number 
      });
      
      if (printerType === 'bluetooth') {
        // Use Bluetooth printer service for direct ESC/POS printing
        const printerStatus = bluetoothPrinterService.getStatus();
        if (!printerStatus.isConnected) {
          console.log('Auto-print skipped - Bluetooth printer not connected');
          toast('Auto-print skipped - Bluetooth printer not connected');
          return;
        }
        await bluetoothPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
        console.log('Auto-print success via Bluetooth');
        toast.success('Receipt auto-printed via Bluetooth');
      } else if (printerType === 'local') {
        // For local printer, try multiple approaches for reliability
        try {
          // Reset printer service state before each print attempt
          console.log('Configuring local printer for auto-print...');
          await enhancedPrinterService.configurePrinter({
            id: 'system-default',
            name: business?.settings?.selected_printer || 'Default System Printer',
            type: 'local',
            settings: business?.settings?.printer_settings
          });
          
          await enhancedPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
          console.log('Auto-print success via enhanced printer service');
          toast.success('Receipt auto-printed to system printer');
        } catch (printerError) {
          // Fallback to browser print with auto-close attempt
          console.log('Direct printing failed, using browser fallback:', printerError);
          await handleBrowserPrintFallback(receiptData);
          console.log('Auto-print fallback completed');
          toast.success('Receipt auto-printed (browser fallback)');
        }
      } else {
        // Network printer
        console.log('Configuring network printer for auto-print...');
        await enhancedPrinterService.configurePrinter({
          id: 'network-printer',
          name: business?.settings?.selected_printer || 'Network Printer',
          type: printerType,
          settings: business?.settings?.printer_settings
        });
        await enhancedPrinterService.printReceipt(receiptData, business?.settings?.printer_settings);
        console.log('Auto-print success via network printer');
        toast.success('Receipt auto-printed to network printer');
      }
      
    } catch (error) {
      console.error('Auto-print failed:', error);
      // Try fallback browser print as last resort
      try {
        console.log('Attempting emergency fallback print...');
        const receiptData = generateReceiptData(transactionData, transactionType);
        await handleBrowserPrintFallback(receiptData);
        console.log('Emergency fallback print completed');
        toast('Receipt printed (emergency fallback)');
      } catch (fallbackError) {
        console.error('All auto-print methods failed:', fallbackError);
        // Don't show error toast for auto-print to avoid disrupting the sale flow
        console.log('Auto-print failed silently, transaction still completed successfully');
      }
    }
  };

  const handleBrowserPrintFallback = async (receiptData) => {
    return new Promise((resolve, reject) => {
      try {
        const receiptHTML = generateReceiptHTML(receiptData);
        
        // Clean up any existing print frames first
        const existingFrames = document.querySelectorAll('iframe[data-print-frame="true"]');
        existingFrames.forEach(frame => {
          try {
            document.body.removeChild(frame);
          } catch (e) {
            console.log('Frame already removed:', e);
          }
        });
        
        // Create a fresh iframe for printing
        const printFrame = document.createElement('iframe');
        printFrame.setAttribute('data-print-frame', 'true');
        printFrame.style.position = 'absolute';
        printFrame.style.left = '-9999px';
        printFrame.style.top = '-9999px';
        printFrame.style.width = '1px';
        printFrame.style.height = '1px';
        printFrame.style.border = 'none';
        document.body.appendChild(printFrame);
        
        const printDocument = printFrame.contentDocument || printFrame.contentWindow.document;
        printDocument.open();
        printDocument.write(receiptHTML);
        printDocument.close();
        
        // Wait for content to load then print
        const handleLoad = () => {
          setTimeout(() => {
            try {
              if (printFrame.contentWindow && typeof printFrame.contentWindow.print === 'function') {
                printFrame.contentWindow.print();
                console.log('Browser print initiated successfully');
                
                // Clean up after a delay to ensure printing completes
                setTimeout(() => {
                  try {
                    if (printFrame && printFrame.parentNode) {
                      document.body.removeChild(printFrame);
                    }
                  } catch (cleanupError) {
                    console.log('Print frame cleanup error (non-critical):', cleanupError);
                  }
                }, 3000);
                
                resolve();
              } else {
                reject(new Error('Print function not available'));
              }
            } catch (printError) {
              console.error('Print execution error:', printError);
              // Clean up on error
              try {
                if (printFrame && printFrame.parentNode) {
                  document.body.removeChild(printFrame);
                }
              } catch (cleanupError) {
                console.log('Error cleanup failed:', cleanupError);
              }
              reject(printError);
            }
          }, 500); // Small delay to ensure content is ready
        };
        
        // Set up load handler with timeout fallback
        if (printFrame.contentDocument && printFrame.contentDocument.readyState === 'complete') {
          handleLoad();
        } else {
          printFrame.onload = handleLoad;
          // Fallback timeout
          setTimeout(handleLoad, 2000);
        }
        
      } catch (error) {
        console.error('Browser print fallback setup failed:', error);
        reject(error);
      }
    });
  };

  const generateReceiptHTML = (receiptData) => {
    const businessName = business?.name || 'Business Name';
    const businessAddress = business?.address || '';
    const businessEmail = business?.contact_email || '';
    const businessPhone = business?.phone || '';
    const businessLogo = business?.logo_url || '';
    const receiptHeader = business?.settings?.receipt_header || '';
    const receiptFooter = business?.settings?.receipt_footer || '';
    
    // Debug logging to check if business settings are available
    console.log('🧾 Receipt Generation Debug:', {
      businessExists: !!business,
      settingsExists: !!business?.settings,
      receiptHeader: receiptHeader,
      receiptFooter: receiptFooter,
      fullSettings: business?.settings
    });
    
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
              font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
              font-size: 10px;
              font-stretch: condensed;
              line-height: 1.1;
              margin: 0;
              padding: 15px;
              width: 280px;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-bottom: 1px dashed #000; margin: 4px 0; }
            .flex { display: flex; justify-content: space-between; }
            .logo { 
              max-width: 120px; 
              max-height: 80px; 
              margin: 0 auto 8px auto; 
              display: block;
            }
            .header { 
              border-bottom: 1px solid #000; 
              padding-bottom: 8px; 
              margin-bottom: 8px; 
            }
            .total { 
              border-top: 1px solid #000; 
              padding-top: 4px; 
              margin-top: 4px; 
            }
            .receipt-header {
              font-size: 9px;
              margin: 6px 0;
              white-space: pre-line;
            }
            .receipt-footer {
              font-size: 9px;
              margin: 6px 0;
              white-space: pre-line;
            }
            .business-info {
              font-size: 9px;
              margin: 2px 0;
            }
          </style>
        </head>
        <body>
          <div class="header center">
            ${businessLogo ? `<img src="${businessLogo}" alt="Logo" class="logo" />` : ''}
            <div class="bold" style="font-size: 14px;">${businessName}</div>
            ${businessAddress ? `<div class="business-info">${businessAddress}</div>` : ''}
            ${businessPhone ? `<div class="business-info">Tel: ${businessPhone}</div>` : ''}
            ${businessEmail ? `<div class="business-info">Email: ${businessEmail}</div>` : ''}
            <div class="business-info">TIN: ${business?.tin || 'N/A'}</div>
            ${receiptHeader ? `<div class="receipt-header">${receiptHeader}</div>` : ''}
          </div>

          <div>
            <div class="bold">${receiptData.transaction_type}: ${receiptData.transaction_number}</div>
            <div style="font-size: 9px;">Date: ${new Date(receiptData.timestamp).toLocaleString()}</div>
            <div style="font-size: 9px;">Cashier: ${receiptData.cashier_name || 'System'}</div>
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
          ${receiptFooter ? `<div class="center receipt-footer">${receiptFooter}</div>` : ''}
        </body>
      </html>
    `;
  };

  const generateReceiptData = (transactionData, transactionType = 'sale') => {
    // Use actual business context from database - no hardcoded fallbacks for header/footer
    console.log('🧾 Receipt Data Generation Debug:', {
      businessExists: !!business,
      hasSettings: !!business?.settings,
      receiptHeader: business?.settings?.receipt_header,
      receiptFooter: business?.settings?.receipt_footer
    });
    
    return {
      business: business, // Use actual business context - let header/footer be empty if not configured
      transaction_number: transactionData.sale_number || transactionData.invoice_number,
      transaction_type: transactionType.toUpperCase(),
      timestamp: new Date(transactionData.created_at || new Date()),
      customer: selectedCustomer,
      cashier_name: transactionData.cashier_name || user?.email || user?.name || 'System',
      items: transactionData.items || cart,
      subtotal: transactionData.subtotal,
      tax_amount: transactionData.tax_amount,
      discount_amount: transactionData.discount_amount,
      total_amount: transactionData.total_amount,
      payment_method: transactionData.payment_method,
      received_amount: transactionData.received_amount,
      change_amount: transactionData.change_amount,
      notes: transactionData.notes || notes // Include notes from transaction or modal
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
    setModalPaymentRef(''); // Feature 7: Reset reference code
    
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
            <div className="flex items-center space-x-4">
              {/* FEATURE 9: Location-based Date & Time Display */}
              <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg">
                <MapPinIcon className="h-4 w-4" />
                <span>
                  {currentDateTime.toLocaleDateString('en-US', { 
                    timeZone: timeZone,
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric'
                  })} • {currentDateTime.toLocaleTimeString('en-US', { 
                    timeZone: timeZone,
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigate('/pos/sales-history')}
                  className="flex items-center space-x-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm transition-colors"
                  title="View Sales History"
                >
                  <ClipboardDocumentListIcon className="h-4 w-4" />
                  <span>Sales History</span>
                </button>
                <button
                  onClick={() => setShowPriceInquiry(true)}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm transition-colors"
                  title="Price Inquiry (F9)"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <span>Price Inquiry</span>
                </button>
              </div>
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
                className="input pl-10 text-sm"
                autoFocus
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
        <div className="border-t bg-white flex-shrink-0" style={{overflow: 'visible'}}>
          {/* Customer Selection */}
          <div className="p-3 border-b" style={{overflow: 'visible'}}>
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
          <div className="p-3 border-b" style={{overflow: 'visible'}}>
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
          <div className="p-3 space-y-2" style={{overflow: 'visible'}}>
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
            
            {/* Feature 4: Shortcuts Legend */}
            <div className="text-xs text-gray-500 mt-2 text-center">
              <div className="grid grid-cols-2 gap-1">
                <span>F6 Pay</span>
                <span>F7 Hold</span>
                <span>F8 Clear</span>
                <span>F9 Price Inquiry</span>
              </div>
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
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setModalPaymentMethod('cash')}
                      className={`p-2 text-sm border rounded-md ${
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
                      className={`p-2 text-sm border rounded-md ${
                        modalPaymentMethod === 'card'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <CreditCardIcon className="h-4 w-4 mx-auto mb-1" />
                      Card
                    </button>
                    <button
                      onClick={() => setModalPaymentMethod('ewallet')}
                      className={`p-2 text-sm border rounded-md ${
                        modalPaymentMethod === 'ewallet'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <CreditCardIcon className="h-4 w-4 mx-auto mb-1" />
                      EWallet/Bank
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
                      ref={receivedAmountInputRef}
                      type="number"
                      min="0"
                      step="0.01"
                      value={modalReceivedAmount}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log('Amount input changed:', newValue, 'Previous:', modalReceivedAmount);
                        setModalReceivedAmount(newValue);
                        // Force immediate state update verification
                        setTimeout(() => {
                          console.log('State after onChange:', modalReceivedAmount, 'Input value:', e.target.value);
                        }, 0);
                      }}
                      onInput={(e) => {
                        // Additional handler to ensure state updates
                        console.log('onInput triggered:', e.target.value);
                        setModalReceivedAmount(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        // Feature 1: Enter-to-Confirm Payment
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          confirmPayment();
                        }
                      }}
                      className="input w-full text-sm"
                      placeholder="0.00"
                      autoFocus
                    />
                    {/* Quick amount buttons for easier input */}
                    <div className="flex space-x-2 mt-2">
                      {[10, 20, 50, 100].map(amount => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => {
                            console.log('Quick amount clicked:', amount);
                            const amountStr = amount.toString();
                            setModalReceivedAmount(amountStr);
                            
                            // Also update the input field directly to ensure consistency
                            const inputElement = document.querySelector('input[placeholder="0.00"]');
                            if (inputElement) {
                              inputElement.value = amountStr;
                            }
                          }}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          ₱{amount}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* EWallet/Bank Payment Fields */}
                {modalPaymentMethod === 'ewallet' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reference Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={modalPaymentRef}
                      onChange={(e) => setModalPaymentRef(e.target.value)}
                      className="input w-full text-sm"
                      placeholder="Enter reference code..."
                      onKeyDown={(e) => {
                        // Feature 1: Enter-to-Confirm Payment (also apply to ref code field)
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          confirmPayment();
                        }
                      }}
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