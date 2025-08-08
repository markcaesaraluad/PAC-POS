import React, { useState, useEffect, useRef } from 'react';
import { productsAPI, categoriesAPI, customersAPI, salesAPI, invoicesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
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
  CreditCardIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner, { InlineSpinner } from '../../components/LoadingSpinner';

const POSInterface = () => {
  const { business } = useAuth();
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
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  
  // Transaction state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [transactionMode, setTransactionMode] = useState('sale'); // 'sale' or 'invoice'
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [notes, setNotes] = useState('');
  
  // Tax and discount
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    fetchData();
    
    // Focus barcode input on load
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (business?.settings?.tax_rate) {
      setTaxRate(business.settings.tax_rate);
    }
  }, [business]);

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
      setShowCustomerModal(false);
      setNewCustomer({ name: '', email: '', phone: '' });
      toast.success('Customer created successfully');
    } catch (error) {
      toast.error('Failed to create customer');
    }
  };

  const handleTransaction = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const totals = calculateTotals();
    
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
      } else {
        response = await invoicesAPI.createInvoice(transactionData);
        toast.success(`Invoice created! Invoice #${response.data.invoice_number}`);
      }

      // Clear cart and close modal
      clearCart();
      setShowCheckoutModal(false);
      
      // Refresh product data to update stock
      fetchData();
      
    } catch (error) {
      const message = error.response?.data?.detail || `Failed to ${transactionMode === 'sale' ? 'complete sale' : 'create invoice'}`;
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const totals = calculateTotals();

  if (loading) {
    return <LoadingSpinner message="Loading POS..." />;
  }

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Left Panel - Products */}
      <div className="flex-1 flex flex-col bg-white border-r">
        {/* Search and Barcode */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                className="form-input pl-10"
                placeholder="Scan barcode or search..."
                value={barcodeInput || searchTerm}
                onChange={(e) => {
                  if (barcodeInput) {
                    setBarcodeInput(e.target.value);
                  } else {
                    setSearchTerm(e.target.value);
                  }
                }}
                onKeyDown={handleBarcodeInput}
                onBlur={() => setBarcodeInput('')}
                onFocus={() => {
                  if (searchTerm) {
                    setBarcodeInput(searchTerm);
                    setSearchTerm('');
                  }
                }}
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            <select
              className="form-input"
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
            
            <button onClick={handleProductSearch} className="btn-primary">
              Search
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="p-4 border-b">
          <div className="flex space-x-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('')}
              className={`category-tab whitespace-nowrap ${!selectedCategory ? 'active' : ''}`}
            >
              All Products
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`category-tab whitespace-nowrap ${selectedCategory === category.id ? 'active' : ''}`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          {products.length > 0 ? (
            <div className="pos-grid">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="product-card"
                  onClick={() => addToCart(product)}
                >
                  <div className="flex items-center mb-2">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-8 h-8 rounded mr-2" />
                    ) : (
                      <CubeIcon className="w-8 h-8 text-gray-400 mr-2" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium text-sm text-gray-900 truncate">{product.name}</h3>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-primary-600">${product.price}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      product.quantity > 10 ? 'bg-green-100 text-green-600' : 
                      product.quantity > 0 ? 'bg-yellow-100 text-yellow-600' : 
                      'bg-red-100 text-red-600'
                    }`}>
                      {product.quantity > 0 ? `${product.quantity} left` : 'Out of stock'}
                    </span>
                  </div>
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

      {/* Right Panel - Cart */}
      <div className="w-96 bg-white flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Cart ({cart.length})</h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-red-600 hover:text-red-700">
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Customer Selection */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Customer:</label>
            <button
              onClick={() => setShowCustomerModal(true)}
              className="text-primary-600 hover:text-primary-700"
            >
              <UserPlusIcon className="h-5 w-5" />
            </button>
          </div>
          <select
            className="form-input mt-1"
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
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length > 0 ? (
            <div className="p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-sm text-gray-900">{item.product_name}</h3>
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCartItemQuantity(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      >
                        <MinusIcon className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartItemQuantity(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      >
                        <PlusIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${item.total_price.toFixed(2)}</div>
                      <div className="text-xs text-gray-500">${item.unit_price}/each</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <CubeIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p className="text-gray-500">Cart is empty</p>
                <p className="text-sm text-gray-400">Add products to start</p>
              </div>
            </div>
          )}
        </div>

        {/* Cart Summary */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-4">
            {/* Discount */}
            <div className="flex justify-between items-center">
              <label className="text-sm text-gray-600">Discount ($):</label>
              <input
                type="number"
                className="w-20 px-2 py-1 border rounded text-sm text-right"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
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
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total:</span>
                <span>${totals.total}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTransactionMode('invoice');
                  setShowCheckoutModal(true);
                }}
                className="btn-secondary flex items-center justify-center text-sm"
              >
                <DocumentTextIcon className="h-4 w-4 mr-1" />
                Invoice
              </button>
              <button
                onClick={() => {
                  setTransactionMode('sale');
                  setShowCheckoutModal(true);
                }}
                className="btn-primary flex items-center justify-center text-sm"
              >
                <BanknotesIcon className="h-4 w-4 mr-1" />
                Pay Now
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Customer</h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({...prev, name: e.target.value}))}
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({...prev, email: e.target.value}))}
                />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({...prev, phone: e.target.value}))}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                className="btn-primary"
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {transactionMode === 'sale' ? 'Complete Sale' : 'Create Invoice'}
              </h3>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Order Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Order Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Items ({cart.length}):</span>
                    <span>${totals.subtotal}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>${totals.taxAmount}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>${totals.total}</span>
                  </div>
                </div>
              </div>

              {transactionMode === 'sale' && (
                <>
                  {/* Payment Method */}
                  <div>
                    <label className="form-label">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`p-3 border rounded-lg flex items-center justify-center ${
                          paymentMethod === 'cash' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                        }`}
                      >
                        <BanknotesIcon className="h-5 w-5 mr-2" />
                        Cash
                      </button>
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={`p-3 border rounded-lg flex items-center justify-center ${
                          paymentMethod === 'card' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
                        }`}
                      >
                        <CreditCardIcon className="h-5 w-5 mr-2" />
                        Card
                      </button>
                    </div>
                  </div>

                  {/* Cash Payment */}
                  {paymentMethod === 'cash' && (
                    <div>
                      <label className="form-label">Amount Received</label>
                      <input
                        type="number"
                        className="form-input text-right"
                        placeholder="0.00"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || '')}
                        step="0.01"
                        min="0"
                      />
                      {receivedAmount && (
                        <div className="mt-2 text-right">
                          <span className="text-lg font-bold text-green-600">
                            Change: ${totals.change}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              <div>
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Order notes or special instructions"
                />
              </div>

              {selectedCustomer && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-900">Customer:</h4>
                  <p className="text-blue-800">{selectedCustomer.name}</p>
                  {selectedCustomer.email && (
                    <p className="text-blue-600 text-sm">{selectedCustomer.email}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleTransaction}
                disabled={isProcessing}
                className="btn-primary flex items-center"
              >
                {isProcessing ? (
                  <>
                    <InlineSpinner />
                    <span className="ml-2">Processing...</span>
                  </>
                ) : (
                  <>
                    {transactionMode === 'sale' ? (
                      <>
                        <BanknotesIcon className="h-4 w-4 mr-2" />
                        Complete Sale
                      </>
                    ) : (
                      <>
                        <DocumentTextIcon className="h-4 w-4 mr-2" />
                        Create Invoice
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSInterface;