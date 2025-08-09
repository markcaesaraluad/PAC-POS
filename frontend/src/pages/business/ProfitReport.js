import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  ChartBarIcon, 
  DocumentArrowDownIcon, 
  CalendarIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';

const ProfitReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState({});
  const [selectedDateRange, setSelectedDateRange] = useState('last30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Check if user has admin access
  const hasAdminAccess = user && (user.role === 'business_admin' || user.role === 'super_admin');

  useEffect(() => {
    // Set default date range
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    setCustomStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setCustomEndDate(today.toISOString().split('T')[0]);
  }, []);

  const getDateRange = () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
    
    switch (selectedDateRange) {
      case 'today':
        return {
          start_date: today.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      case 'yesterday':
        return {
          start_date: yesterday.toISOString().split('T')[0],
          end_date: yesterday.toISOString().split('T')[0]
        };
      case 'last7days':
        const sevenDaysAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
        return {
          start_date: sevenDaysAgo.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      case 'thismonth':
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          start_date: firstDayOfMonth.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      case 'last30days':
        const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
        return {
          start_date: thirtyDaysAgo.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      case 'custom':
        return {
          start_date: customStartDate,
          end_date: customEndDate
        };
      default:
        return {
          start_date: customStartDate,
          end_date: customEndDate
        };
    }
  };

  const downloadReport = async (format) => {
    if (!hasAdminAccess) {
      toast.error("You don't have permission to access profit reports");
      return;
    }

    if (selectedDateRange === 'custom' && (!customStartDate || !customEndDate)) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      toast.error('Start date cannot be later than end date');
      return;
    }

    const loadingKey = `profit-${format}`;
    
    try {
      setDownloadLoading(prev => ({ ...prev, [loadingKey]: true }));
      
      const dateRange = getDateRange();
      const response = await reportsAPI.getProfitReport({
        format,
        ...dateRange
      });

      // Extract filename from response headers
      const contentDisposition = response.headers['content-disposition'];
      let filename = `profit-report.${format === 'excel' ? 'xlsx' : format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
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

      toast.success(`Profit report downloaded successfully (${format.toUpperCase()})`);
    } catch (error) {
      console.error('Download error:', error);
      let errorMessage = `Failed to download profit report`;
      
      if (error.response?.status === 403) {
        errorMessage = "You don't have permission to access profit reports";
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      toast.error(errorMessage);
    } finally {
      setDownloadLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const isDownloading = (format) => {
    return downloadLoading[`profit-${format}`];
  };

  const getDateRangeLabel = () => {
    switch (selectedDateRange) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'last7days': return 'Last 7 Days';
      case 'thismonth': return 'This Month';
      case 'last30days': return 'Last 30 Days';
      case 'custom': return `${customStartDate} to ${customEndDate}`;
      default: return 'Last 30 Days';
    }
  };

  // If user doesn't have admin access, show permission denied
  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have permission to view this section. Profit reports are only available to administrators.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner message="Loading profit report..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profit Report</h1>
        <p className="text-gray-600">Analyze your business profitability with detailed cost and revenue insights</p>
      </div>

      {/* Date Range Selection */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center mb-4">
            <CalendarIcon className="h-6 w-6 text-blue-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Date Range Filter</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Quick Presets</label>
              <select
                className="form-input"
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="thismonth">This Month</option>
                <option value="last30days">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {selectedDateRange === 'custom' && (
              <>
                <div>
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <ClockIcon className="inline h-4 w-4 mr-1" />
              Selected Range: <strong>{getDateRangeLabel()}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gross Sales</p>
                <p className="text-2xl font-bold text-green-600">Available in Export</p>
                <p className="text-xs text-gray-500">Total revenue from sales</p>
              </div>
              <CurrencyDollarIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cost of Goods Sold</p>
                <p className="text-2xl font-bold text-orange-600">Available in Export</p>
                <p className="text-xs text-gray-500">Total cost of sold items</p>
              </div>
              <ArrowTrendingDownIcon className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Profit</p>
                <p className="text-2xl font-bold text-blue-600">Available in Export</p>
                <p className="text-xs text-gray-500">Gross Sales - COGS</p>
              </div>
              <ArrowTrendingUpIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center mb-6">
            <DocumentArrowDownIcon className="h-6 w-6 text-purple-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Export Profit Report</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Detailed Profit Analysis</h3>
              <p className="text-sm text-gray-600 mb-4">
                Comprehensive profit report with line-by-line analysis including:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-6">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Date/Time of each transaction</li>
                  <li>Invoice/Transaction ID</li>
                  <li>Item name and SKU</li>
                  <li>Quantity sold</li>
                </ul>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Unit price and unit cost</li>
                  <li>Line profit calculations</li>
                  <li>KPIs: Gross Sales, COGS, Profit</li>
                  <li>Historical cost snapshots</li>
                </ul>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => downloadReport('excel')}
                  disabled={isDownloading('excel')}
                  className="btn-primary flex items-center"
                >
                  {isDownloading('excel') ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating Excel...
                    </>
                  ) : (
                    <>
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      Export to Excel
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => downloadReport('csv')}
                  disabled={isDownloading('csv')}
                  className="btn-secondary flex items-center"
                >
                  {isDownloading('csv') ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Generating CSV...
                    </>
                  ) : (
                    <>
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      Export to CSV
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => downloadReport('pdf')}
                  disabled={isDownloading('pdf')}
                  className="btn-outline flex items-center"
                >
                  {isDownloading('pdf') ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                      Export to PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Information */}
      <div className="bg-green-50 border border-green-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Profit Report Features</h3>
            <div className="mt-2 text-sm text-green-700">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Historical Accuracy:</strong> Uses cost snapshots from time of sale for precise profit calculations</li>
                <li><strong>Comprehensive Data:</strong> Includes line-by-line profit analysis with all transaction details</li>
                <li><strong>Multiple Formats:</strong> Excel (with formulas), CSV (data analysis), PDF (presentation)</li>
                <li><strong>Business Headers:</strong> All exports include your business information and logo</li>
                <li><strong>KPI Summary:</strong> Gross Sales, Cost of Goods Sold, and Net Profit totals</li>
                <li><strong>Date Filtering:</strong> Flexible date range selection with quick presets</li>
                <li><strong>Admin Only:</strong> Secure access restricted to business administrators</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitReport;