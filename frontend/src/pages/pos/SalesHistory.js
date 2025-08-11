import React, { useState, useEffect, useCallback } from 'react';
import { salesAPI, invoicesAPI, customersAPI } from '../../services/api';
import GlobalFilter from '../../components/GlobalFilter';
import useGlobalFilter from '../../hooks/useGlobalFilter';
import { useCurrency } from '../../context/CurrencyContext';
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

  // Filter configuration for GlobalFilter component
  const filterConfig = {
    status: {
      label: 'Status',
      placeholder: 'All statuses',
      options: [
        { value: 'completed', label: 'Completed' },
        { value: 'pending', label: 'Pending' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    payment_method: {
      label: 'Payment Method',
      placeholder: 'All payment methods',
      options: [
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
      ],
    },
  };

  // Global filter hook for managing filter state
  const {
    filters,
    setFilters,
    loading: filterLoading,
    generateQueryParams,
    clearFilters,
    hasActiveFilters
  } = useGlobalFilter({
    defaultFilters: {
      date_preset: 'today' // HOTFIX 2: Default to today instead of last7days
    },
    persistenceKey: 'sales-history-filter',
    enablePersistence: true,
    onFilterChange: handleFilterChange
  });

  // Handle filter changes and refresh data - memoized to prevent infinite loops
  const handleFilterChange = useCallback((newFilters) => {
    fetchDataWithFilters(newFilters);
  }, []);

  const fetchDataWithFilters = useCallback(async (customFilters = null) => {
    try {
      setLoading(true);
      
      // Get filter parameters
      const queryParams = generateQueryParams(customFilters || filters);
      
      // HOTFIX 2: Ensure we're fetching with proper parameters
      const params = {
        ...queryParams,
        // Don't force status to 'completed' as it might filter out valid transactions
        // status: queryParams.status || 'completed' // Default to completed transactions
      };
      
      console.log('Sales History fetchDataWithFilters with params:', params);
      
      // Fetch data based on active tab
      if (activeTab === 'sales') {
        const salesResponse = await salesAPI.getSales(params);
        setSales(salesResponse.data);
      } else {
        const invoicesResponse = await invoicesAPI.getInvoices(params);
        setInvoices(invoicesResponse.data);
      }
      
      // HOTFIX 2: Always fetch customers data for filter dropdowns if not already loaded
      if (customers.length === 0) {
        try {
          const customersResponse = await customersAPI.getCustomers();
          setCustomers(customersResponse.data);
        } catch (error) {
          console.error('Failed to load customers for filters:', error);
        }
      }
      
    } catch (error) {
      console.error('Failed to fetch sales history:', error);
      toast.error('Failed to load sales history');
      setSales([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, generateQueryParams, filters, customers.length]);

  // Initial fetch - separate from filter-based fetch to avoid dependency issues
  const initialFetch = useCallback(async () => {
    await fetchDataWithFilters();
  }, [fetchDataWithFilters]);

  useEffect(() => {
    initialFetch();
  }, []);

  // Tab change effect - separate from filter effects
  useEffect(() => {
    if (!loading) {
      fetchDataWithFilters();
    }
  }, [activeTab, fetchDataWithFilters]);

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

    // Generate receipt preview data
    const receiptData = {
      business: { name: 'Prints & Cuts Tagum', address: '123 Business St', contact_email: 'contact@printsandcuts.com', phone: '+1234567890' },
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

  const printReceipt = async () => {
    try {
      setActionLoading('print');
      
      // In a real implementation, this would send to the printer
      // For now, we'll simulate the print action
      toast.success(`Receipt reprinted for ${reprintTransaction.type === 'sale' ? 'Sale' : 'Invoice'} #${reprintTransaction.type === 'sale' ? reprintTransaction.sale_number : reprintTransaction.invoice_number}`);
      
      setShowReprintModal(false);
      setReprintTransaction(null);
      setReprintPreview(null);
      
    } catch (error) {
      toast.error('Failed to reprint receipt');
    } finally {
      setActionLoading(null);
    }
  };

  const saveReceiptAsPDF = async () => {
    try {
      setActionLoading('pdf');
      
      // Simulate PDF generation and download
      const filename = `${reprintTransaction.type}_${reprintTransaction.type === 'sale' ? reprintTransaction.sale_number : reprintTransaction.invoice_number}_reprint.pdf`;
      toast.success(`PDF saved as ${filename}`);
      
    } catch (error) {
      toast.error('Failed to save PDF');
    } finally {
      setActionLoading(null);
    }
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

      {/* Global Filter Component */}
      <GlobalFilter
        filters={filterConfig}
        onFilterChange={setFilters}
        loading={filterLoading}
        initialFilters={filters}
        className="mb-6"
        searchPlaceholder="Search by sale #, customer name, product..."
      />

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
                            toast.info('Detail view not yet implemented');
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
                            toast.info('Detail view not yet implemented');
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
                      <span>${reprintPreview.subtotal.toFixed(2)}</span>
                    </div>
                    {reprintPreview.tax_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>${reprintPreview.tax_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {reprintPreview.discount_amount > 0 && (
                      <div className="flex justify-between">
                        <span>Discount:</span>
                        <span>-${reprintPreview.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>TOTAL:</span>
                      <span>${reprintPreview.total_amount.toFixed(2)}</span>
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
                              <span>${reprintPreview.received_amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Change:</span>
                              <span>${reprintPreview.change_amount?.toFixed(2) || '0.00'}</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-center text-xs">
                    <p>Thank you for your business!</p>
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