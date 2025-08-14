import React, { useState, useEffect, useCallback, useRef } from 'react';
import { reportsAPI, categoriesAPI } from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import GlobalFilter from '../../components/GlobalFilter';
import useGlobalFilter from '../../hooks/useGlobalFilter';
import toast from 'react-hot-toast';
import { 
  ChartBarIcon, 
  DocumentArrowDownIcon, 
  CalendarIcon, 
  UsersIcon, 
  CubeIcon,
  ArrowDownTrayIcon 
} from '@heroicons/react/24/outline';

const Reports = () => {
  const { formatAmount } = useCurrency();
  const [dailySummary, setDailySummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [downloadLoading, setDownloadLoading] = useState({});
  const [currentFilters, setCurrentFilters] = useState({
    date_preset: 'last30days'
  });

  // Use ref to track if we're already loading to prevent multiple concurrent requests
  const loadingRef = useRef(false);

  // Filter configuration for GlobalFilter component
  const filterConfig = {
    category: {
      label: 'Category',
      placeholder: 'All categories',
      options: categories.map(cat => ({ value: cat.id, label: cat.name })),
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
    status: {
      label: 'Status',
      placeholder: 'All statuses',
      options: [
        { value: 'completed', label: 'Completed' },
        { value: 'pending', label: 'Pending' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
  };

  // Generate query parameters from current filters
  const generateQueryParams = useCallback(() => {
    const params = {};
    
    Object.entries(currentFilters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params[key] = value;
      }
    });
    
    return params;
  }, [currentFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters) => {
    setCurrentFilters(newFilters);
  }, []);

  // Check if there are active filters
  const hasActiveFilters = Object.keys(currentFilters).length > 1 || 
    (Object.keys(currentFilters).length === 1 && !currentFilters.date_preset);

  // Load initial data - only run once on mount
  useEffect(() => {
    loadCategories();
    
    // Load initial daily summary without filters
    const initialLoad = async () => {
      try {
        const response = await reportsAPI.getDailySummary();
        setDailySummary(response.data);
      } catch (error) {
        console.error('Failed to load initial daily summary:', error);
      }
    };
    
    initialLoad();
  }, []); // Empty dependency array - only run on mount

  // Only reload daily summary when filters actually change, not on every render
  useEffect(() => {
    if (loadingRef.current) return; // Prevent concurrent requests
    
    loadingRef.current = true;
    
    // Use a timeout to debounce rapid filter changes
    const timeoutId = setTimeout(async () => {
      try {
        // Get current filter parameters for the daily summary
        const params = generateQueryParams();
        
        // For daily summary, we need to handle date filtering differently
        let summaryParams = {};
        
        // If we have date filters, use them
        if (params.start_date && params.end_date && params.start_date === params.end_date) {
          // If start and end date are the same, use the date parameter
          summaryParams.date = params.start_date;
        } else if (params.date_preset === 'today') {
          // For today preset, don't pass any date parameter (defaults to today)
          summaryParams = {};
        }
        
        const response = await reportsAPI.getDailySummary(summaryParams);
        setDailySummary(response.data);
      } catch (error) {
        console.error('Failed to load daily summary:', error);
      } finally {
        loadingRef.current = false;
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      loadingRef.current = false;
    };
  }, [currentFilters, generateQueryParams]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await categoriesAPI.getCategories();
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const loadDailySummary = useCallback(async () => {
    try {
      // Get current filter parameters for the daily summary
      const params = generateQueryParams();
      
      // For daily summary, we need to handle date filtering differently
      let summaryParams = {};
      
      // If we have date filters, use them
      if (params.start_date && params.end_date && params.start_date === params.end_date) {
        // If start and end date are the same, use the date parameter
        summaryParams.date = params.start_date;
      } else if (params.date_preset === 'today') {
        // For today preset, don't pass any date parameter (defaults to today)
        summaryParams = {};
      }
      
      const response = await reportsAPI.getDailySummary(summaryParams);
      setDailySummary(response.data);
    } catch (error) {
      console.error('Failed to load daily summary:', error);
    }
  }, [generateQueryParams]);

  const downloadReport = async (reportType, format = 'excel') => {
    const loadingKey = `${reportType}-${format}`;
    
    try {
      setDownloadLoading(prev => ({ ...prev, [loadingKey]: true }));
      
      // Get current filter parameters
      const params = generateQueryParams();
      
      let response;
      let defaultFilename;
      
      switch (reportType) {
        case 'sales':
          response = await reportsAPI.getSalesReport({ format, ...params });
          defaultFilename = `sales_report.${format === 'excel' ? 'xlsx' : format}`;
          break;
        case 'inventory':
          response = await reportsAPI.getInventoryReport({ format, ...params });
          defaultFilename = `inventory_report.${format === 'excel' ? 'xlsx' : format}`;
          break;
        case 'customers':
          response = await reportsAPI.getCustomersReport({ format, ...params });
          defaultFilename = `customers_report.${format === 'excel' ? 'xlsx' : format}`;
          break;
        default:
          throw new Error('Invalid report type');
      }

      // Handle file download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report downloaded successfully with current filters applied`);
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
        <p className="text-gray-600">Generate and download business reports with advanced filtering</p>
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
                  <p className="text-2xl font-bold text-gray-900">{formatAmount(dailySummary.sales?.total_revenue || 0)}</p>
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

      {/* Global Filter Component */}
      <GlobalFilter
        filters={filterConfig}
        onFilterChange={setFilters}
        loading={filterLoading}
        initialFilters={filters}
        className="mb-6"
        searchPlaceholder="Search reports by customer, product, SKU..."
      />

      {/* Reports Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Sales Reports */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <ChartBarIcon className="h-6 w-6 text-blue-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Sales Reports</h3>
                  <p className="text-sm text-gray-500">Detailed sales transaction reports</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {hasActiveFilters ? 'Filtered sales data' : 'All sales data'} • Export with current filters applied
              </p>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadReport('sales', 'excel')}
                  disabled={isDownloading('sales', 'excel')}
                  className="btn-primary text-sm flex items-center"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  {isDownloading('sales', 'excel') ? 'Downloading...' : 'Download Excel'}
                </button>
                <button
                  onClick={() => downloadReport('sales', 'pdf')}
                  disabled={isDownloading('sales', 'pdf')}
                  className="btn-secondary text-sm flex items-center"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  {isDownloading('sales', 'pdf') ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Reports */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <CubeIcon className="h-6 w-6 text-green-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Inventory Reports</h3>
                  <p className="text-sm text-gray-500">Stock levels and product analytics</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {hasActiveFilters ? 'Filtered inventory data' : 'All inventory data'} • Export with current filters applied
              </p>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadReport('inventory', 'excel')}
                  disabled={isDownloading('inventory', 'excel')}
                  className="btn-primary text-sm flex items-center"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  {isDownloading('inventory', 'excel') ? 'Downloading...' : 'Download Excel'}
                </button>
                <button
                  onClick={() => downloadReport('inventory', 'pdf')}
                  disabled={isDownloading('inventory', 'pdf')}
                  className="btn-secondary text-sm flex items-center"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  {isDownloading('inventory', 'pdf') ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reports */}
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <UsersIcon className="h-6 w-6 text-purple-500 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Customer Reports</h3>
                  <p className="text-sm text-gray-500">Customer analytics and purchase history</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {hasActiveFilters ? 'Filtered customer data' : 'All customer data'} • Export with current filters applied
              </p>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadReport('customers', 'excel')}
                  disabled={isDownloading('customers', 'excel')}
                  className="btn-primary text-sm flex items-center"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  {isDownloading('customers', 'excel') ? 'Downloading...' : 'Download Excel'}
                </button>
                <button
                  onClick={() => downloadReport('customers', 'pdf')}
                  disabled={isDownloading('customers', 'pdf')}
                  className="btn-secondary text-sm flex items-center"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  {isDownloading('customers', 'pdf') ? 'Downloading...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Status */}
      {hasActiveFilters && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex items-center text-sm text-blue-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Filters are active - All exports will include filtered data only
                </div>
              </div>
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;