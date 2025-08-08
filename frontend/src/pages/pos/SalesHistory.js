import React, { useState, useEffect } from 'react';
import { salesAPI, invoicesAPI, customersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  ArrowDownTrayIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner, { InlineSpinner } from '../../components/LoadingSpinner';

const SalesHistory = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [sales, setSales] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salesResponse, invoicesResponse, customersResponse] = await Promise.all([
        salesAPI.getSales(),
        invoicesAPI.getInvoices(),
        customersAPI.getCustomers()
      ]);
      setSales(salesResponse.data);
      setInvoices(invoicesResponse.data);
      setCustomers(customersResponse.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customerId) => {
    if (!customerId) return 'Walk-in Customer';
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : 'Unknown Customer';
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      completed: 'bg-green-100 text-green-800',
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      converted: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[status] || statusStyles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleConvertInvoice = async (invoiceId) => {
    setActionLoading(invoiceId);
    try {
      await invoicesAPI.convertToSale(invoiceId);
      toast.success('Invoice converted to sale successfully!');
      fetchData(); // Refresh data
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to convert invoice';
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    setActionLoading(invoiceId);
    try {
      await invoicesAPI.sendInvoice(invoiceId);
      toast.success('Invoice sent successfully!');
      fetchData(); // Refresh data
    } catch (error) {
      toast.error('Failed to send invoice');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportInvoice = async (invoiceId, format = 'pdf') => {
    setActionLoading(invoiceId);
    try {
      const response = await invoicesAPI.exportInvoice(invoiceId, { format });
      toast.success(response.data.message);
      // In a real app, this would trigger a download
    } catch (error) {
      toast.error('Failed to export invoice');
    } finally {
      setActionLoading(null);
    }
  };

  const showDetails = (item, type) => {
    setSelectedItem({ ...item, type });
    setShowDetailModal(true);
  };

  if (loading) {
    return <LoadingSpinner message="Loading transaction history..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
        <p className="text-gray-600">View and manage sales and invoices</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('sales')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sales'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardDocumentListIcon className="h-5 w-5 inline mr-2" />
            Sales ({sales.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invoices'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DocumentTextIcon className="h-5 w-5 inline mr-2" />
            Invoices ({invoices.length})
          </button>
        </div>
      </div>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="card">
          <div className="card-body p-0">
            {sales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sale Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{sale.sale_number}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(sale.created_at).toLocaleString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{getCustomerName(sale.customer_id)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{sale.items.length} items</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">${sale.total_amount}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => showDetails(sale, 'sale')}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No sales yet</h3>
                <p className="mt-1 text-sm text-gray-500">Sales will appear here once you make them.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="card">
          <div className="card-body p-0">
            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{invoice.invoice_number}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(invoice.created_at).toLocaleString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{getCustomerName(invoice.customer_id)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{invoice.items.length} items</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">${invoice.total_amount}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(invoice.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => showDetails(invoice, 'invoice')}
                              className="text-gray-600 hover:text-gray-900"
                              title="View Details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            
                            {invoice.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => handleSendInvoice(invoice.id)}
                                  disabled={actionLoading === invoice.id}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Send Invoice"
                                >
                                  {actionLoading === invoice.id ? (
                                    <InlineSpinner />
                                  ) : (
                                    <PaperAirplaneIcon className="h-4 w-4" />
                                  )}
                                </button>
                                
                                <button
                                  onClick={() => handleConvertInvoice(invoice.id)}
                                  disabled={actionLoading === invoice.id}
                                  className="text-green-600 hover:text-green-900"
                                  title="Convert to Sale"
                                >
                                  {actionLoading === invoice.id ? (
                                    <InlineSpinner />
                                  ) : (
                                    <BanknotesIcon className="h-4 w-4" />
                                  )}
                                </button>
                              </>
                            )}
                            
                            {(invoice.status === 'sent' || invoice.status === 'draft') && (
                              <button
                                onClick={() => handleExportInvoice(invoice.id)}
                                disabled={actionLoading === invoice.id}
                                className="text-purple-600 hover:text-purple-900"
                                title="Export as PDF"
                              >
                                {actionLoading === invoice.id ? (
                                  <InlineSpinner />
                                ) : (
                                  <ArrowDownTrayIcon className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices yet</h3>
                <p className="mt-1 text-sm text-gray-500">Invoices will appear here when you create them.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedItem.type === 'sale' ? 'Sale Details' : 'Invoice Details'}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {selectedItem.type === 'sale' ? 'Sale Number' : 'Invoice Number'}
                  </h4>
                  <p className="text-gray-600">
                    {selectedItem.type === 'sale' ? selectedItem.sale_number : selectedItem.invoice_number}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Date</h4>
                  <p className="text-gray-600">{new Date(selectedItem.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Customer</h4>
                  <p className="text-gray-600">{getCustomerName(selectedItem.customer_id)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Status</h4>
                  <div className="mt-1">
                    {selectedItem.type === 'sale' 
                      ? getStatusBadge('completed')
                      : getStatusBadge(selectedItem.status)
                    }
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Items</h4>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Price
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItem.items.map((item, index) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="px-4 py-2">
                            <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                            <div className="text-xs text-gray-500">SKU: {item.product_sku}</div>
                          </td>
                          <td className="px-4 py-2 text-center">{item.quantity}</td>
                          <td className="px-4 py-2 text-right">${item.unit_price}</td>
                          <td className="px-4 py-2 text-right font-medium">${item.total_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${selectedItem.subtotal}</span>
                  </div>
                  {selectedItem.tax_amount > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>${selectedItem.tax_amount}</span>
                    </div>
                  )}
                  {selectedItem.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount:</span>
                      <span>-${selectedItem.discount_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300">
                    <span>Total:</span>
                    <span>${selectedItem.total_amount}</span>
                  </div>
                </div>
              </div>

              {selectedItem.notes && (
                <div>
                  <h4 className="font-medium text-gray-900">Notes</h4>
                  <p className="text-gray-600 bg-gray-50 p-3 rounded">{selectedItem.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
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