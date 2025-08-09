import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';
import { ChartBarIcon, DocumentArrowDownIcon, CalendarIcon, UsersIcon, CubeIcon } from '@heroicons/react/24/outline';

const Reports = () => {
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState({});

  // Load daily summary on component mount
  useEffect(() => {
    loadDailySummary();
  }, []);

  const loadDailySummary = async () => {
    try {
      const response = await reportsAPI.getDailySummary();
      setDailySummary(response.data);
    } catch (error) {
      console.error('Failed to load daily summary:', error);
    }
  };

  const downloadReport = async (reportType, format = 'excel', params = {}) => {
    const loadingKey = `${reportType}-${format}`;
    
    try {
      setDownloadLoading(prev => ({ ...prev, [loadingKey]: true }));
      
      let response;
      let defaultFilename;
      
      switch (reportType) {
        case 'sales':
          response = await reportsAPI.getSalesReport({ format, ...params });
          defaultFilename = `sales_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'inventory':
          response = await reportsAPI.getInventoryReport({ format, ...params });
          defaultFilename = `inventory_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        case 'customers':
          response = await reportsAPI.getCustomersReport({ format, ...params });
          defaultFilename = `customers_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
          break;
        default:
          throw new Error('Invalid report type');
      }

      // Extract filename from response headers
      const contentDisposition = response.headers['content-disposition'];
      let filename = defaultFilename;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create download link
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report downloaded successfully`);
    } catch (error) {
      console.error('Download error:', error);
      const errorMessage = error.response?.data?.detail || `Failed to download ${reportType} report`;
      toast.error(errorMessage);
    } finally {
      setDownloadLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const isDownloading = (reportType, format) => {
    return downloadLoading[`${reportType}-${format}`];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600">Generate and download business reports</p>
      </div>

      {/* Daily Summary */}
      {dailySummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                  <p className="text-2xl font-bold text-gray-900">{dailySummary.sales?.total_sales || 0}</p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${dailySummary.sales?.total_revenue?.toFixed(2) || '0.00'}</p>
                </div>
                <DocumentArrowDownIcon className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Items Sold</p>
                  <p className="text-2xl font-bold text-gray-900">{dailySummary.products?.total_items_sold || 0}</p>
                </div>
                <CubeIcon className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Customers Served</p>
                  <p className="text-2xl font-bold text-gray-900">{dailySummary.customers?.unique_customers_served || 0}</p>
                </div>
                <UsersIcon className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Reports */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center mb-6">
            <ChartBarIcon className="h-6 w-6 text-blue-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Sales Reports</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 mb-2">Sales Analysis</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Comprehensive sales report with product performance, revenue analysis, and customer insights.
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => downloadReport('sales', 'excel')}
                    disabled={isDownloading('sales', 'excel')}
                    className="btn-primary text-sm"
                  >
                    {isDownloading('sales', 'excel') ? 'Generating...' : 'Download Excel'}
                  </button>
                  <button
                    onClick={() => downloadReport('sales', 'pdf')}
                    disabled={isDownloading('sales', 'pdf')}
                    className="btn-secondary text-sm"
                  >
                    {isDownloading('sales', 'pdf') ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-2">Custom Date Range</h4>
              <div className="flex space-x-2 items-end">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    id="sales-start-date"
                    className="input text-sm"
                    defaultValue={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">End Date</label>
                  <input
                    type="date"
                    id="sales-end-date"
                    className="input text-sm"
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <button
                  onClick={() => {
                    const startDate = document.getElementById('sales-start-date').value;
                    const endDate = document.getElementById('sales-end-date').value;
                    if (startDate && endDate) {
                      downloadReport('sales', 'excel', { start_date: startDate, end_date: endDate });
                    } else {
                      toast.error('Please select both start and end dates');
                    }
                  }}
                  className="btn-primary text-sm"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Reports */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center mb-6">
            <CubeIcon className="h-6 w-6 text-purple-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Inventory Reports</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Stock Overview</h3>
              <p className="text-sm text-gray-600 mb-4">
                Complete inventory report with current stock levels, values, and low stock alerts.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadReport('inventory', 'excel')}
                  disabled={isDownloading('inventory', 'excel')}
                  className="btn-primary text-sm"
                >
                  {isDownloading('inventory', 'excel') ? 'Generating...' : 'Download Excel'}
                </button>
                <button
                  onClick={() => downloadReport('inventory', 'pdf')}
                  disabled={isDownloading('inventory', 'pdf')}
                  className="btn-secondary text-sm"
                >
                  {isDownloading('inventory', 'pdf') ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-2">Filtered Reports</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadReport('inventory', 'excel', { low_stock_only: true })}
                  disabled={isDownloading('inventory', 'excel')}
                  className="btn-outline text-sm"
                >
                  Low Stock Only
                </button>
                <button
                  onClick={() => downloadReport('inventory', 'excel', { include_inactive: true })}
                  disabled={isDownloading('inventory', 'excel')}
                  className="btn-outline text-sm"
                >
                  Include Inactive
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reports */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center mb-6">
            <UsersIcon className="h-6 w-6 text-orange-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Customer Reports</h2>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Customer Analysis</h3>
            <p className="text-sm text-gray-600 mb-4">
              Customer database with purchase history, spending patterns, and loyalty metrics.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => downloadReport('customers', 'excel')}
                disabled={isDownloading('customers', 'excel')}
                className="btn-primary text-sm"
              >
                {isDownloading('customers', 'excel') ? 'Generating...' : 'Download Excel'}
              </button>
              <button
                onClick={() => downloadReport('customers', 'excel', { top_customers: 25 })}
                disabled={isDownloading('customers', 'excel')}
                className="btn-outline text-sm"
              >
                Top 25 Customers
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Report Information</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Excel reports include multiple sheets with detailed analysis and charts</li>
                <li>PDF reports provide formatted summaries ideal for printing and sharing</li>
                <li>All reports are generated with your current business data</li>
                <li>Date ranges can be customized for sales reports</li>
                <li>Inventory reports include low stock alerts and product valuations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;