import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for unified error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle standardized error responses from our error handling middleware
    if (error.response?.data?.ok === false) {
      const errorData = error.response.data;
      
      // Store error details for diagnostics
      const errorDetails = {
        errorCode: errorData.errorCode,
        correlationId: errorData.correlationId,
        message: errorData.message,
        route: window.location.pathname,
        timestamp: new Date().toISOString(),
        statusCode: error.response.status
      };
      
      // Store in session storage for recent errors tracking (client-side)
      try {
        const recentErrors = JSON.parse(sessionStorage.getItem('pos-recent-errors') || '[]');
        recentErrors.unshift(errorDetails);
        // Keep only last 50 errors
        if (recentErrors.length > 50) {
          recentErrors.splice(50);
        }
        sessionStorage.setItem('pos-recent-errors', JSON.stringify(recentErrors));
      } catch (e) {
        console.warn('Failed to store error in session storage:', e);
      }
      
      // Trigger error display (will be handled by our error display system)
      window.dispatchEvent(new CustomEvent('pos-error', { 
        detail: errorDetails 
      }));
      
      // Don't show duplicate toasts for auth errors (handled by auth logic)
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      
      // Return enhanced error for component handling
      error.posErrorDetails = errorDetails;
      return Promise.reject(error);
    }
    
    // Handle legacy/non-standardized errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    // For non-standardized errors, show generic message
    const isExpectedError = [400, 401, 403, 404, 422].includes(error.response?.status);
    if (!isExpectedError) {
      // Generate a correlation ID for non-standardized errors
      const correlationId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const errorDetails = {
        errorCode: 'UNKNOWN-001',
        correlationId: correlationId,
        message: 'Something went wrong. Please try again.',
        route: window.location.pathname,
        timestamp: new Date().toISOString(),
        statusCode: error.response?.status || 0
      };
      
      window.dispatchEvent(new CustomEvent('pos-error', { 
        detail: errorDetails 
      }));
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  login: (credentials) => apiClient.post('/api/auth/login', credentials),
  getCurrentUser: () => apiClient.get('/api/auth/me'),
};

export const superAdminAPI = {
  getBusinesses: () => apiClient.get('/api/super-admin/businesses'),
  createBusiness: (businessData) => apiClient.post('/api/super-admin/businesses', businessData),
  updateBusinessStatus: (businessId, status) => apiClient.put(`/api/super-admin/businesses/${businessId}/status`, { status }),
  getBusinessUsers: (businessId) => apiClient.get(`/api/super-admin/businesses/${businessId}/users`),
};

export const businessAPI = {
  getInfo: () => apiClient.get('/api/business/info'),
  updateSettings: (settings) => apiClient.put('/api/business/settings', settings),
  updateDetails: (details) => apiClient.put('/api/business/details', details),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/business/logo-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  removeLogo: () => apiClient.delete('/api/business/logo'),
  getUsers: () => apiClient.get('/api/business/users'),
  createUser: (userData) => apiClient.post('/api/business/users', userData),
  updateUserStatus: (userId, status) => apiClient.put(`/api/business/users/${userId}/status`, { is_active: status }),
};

export const productsAPI = {
  getProducts: (params = {}) => apiClient.get('/api/products', { params }),
  getProduct: (id) => apiClient.get(`/api/products/${id}`),
  createProduct: (productData) => apiClient.post('/api/products', productData),
  updateProduct: (id, productData) => apiClient.put(`/api/products/${id}`, productData),
  deleteProduct: (id) => apiClient.delete(`/api/products/${id}`),
  getProductByBarcode: (barcode) => apiClient.get(`/api/products/barcode/${barcode}`),
  getProductCostHistory: (id) => apiClient.get(`/api/products/${id}/cost-history`),
  
  // Bulk Operations
  bulkImport: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/api/products/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  exportProducts: (params = {}) => {
    return apiClient.get('/api/products/export', { 
      params,
      responseType: 'blob'
    });
  },
  downloadTemplate: (format = 'csv') => {
    return apiClient.get('/api/products/download-template', {
      params: { format },
      responseType: 'blob'
    });
  },
  
  // Stock Management
  adjustStock: (id, adjustmentData) => apiClient.post(`/api/products/${id}/stock-adjustment`, adjustmentData),
  
  // Product Status & Duplication
  toggleStatus: (id, status) => apiClient.patch(`/api/products/${id}/status`, { status }),
  duplicateProduct: (id, options = {}) => apiClient.post(`/api/products/${id}/duplicate`, options),
  
  // Barcode & Label Features
  generateBarcodes: (productIds) => apiClient.post('/api/products/generate-barcodes', { product_ids: productIds }),
  printLabels: (options) => apiClient.post('/api/products/print-labels', options),
  
  // Quick Edit
  quickEdit: (id, fieldData) => apiClient.patch(`/api/products/${id}/quick-edit`, fieldData),
};

export const categoriesAPI = {
  getCategories: () => apiClient.get('/api/categories'),
  getCategory: (id) => apiClient.get(`/api/categories/${id}`),
  createCategory: (categoryData) => apiClient.post('/api/categories', categoryData),
  updateCategory: (id, categoryData) => apiClient.put(`/api/categories/${id}`, categoryData),
  deleteCategory: (id) => apiClient.delete(`/api/categories/${id}`),
};

export const customersAPI = {
  getCustomers: (params = {}) => apiClient.get('/api/customers', { params }),
  getCustomer: (id) => apiClient.get(`/api/customers/${id}`),
  createCustomer: (customerData) => apiClient.post('/api/customers', customerData),
  updateCustomer: (id, customerData) => apiClient.put(`/api/customers/${id}`, customerData),
  deleteCustomer: (id) => apiClient.delete(`/api/customers/${id}`),
};

export const salesAPI = {
  getSales: (params = {}) => apiClient.get('/api/sales', { params }),
  getSale: (id) => apiClient.get(`/api/sales/${id}`),
  createSale: (saleData) => apiClient.post('/api/sales', saleData),
  updateSale: (id, updateData) => apiClient.put(`/api/sales/${id}`, updateData), // Feature 5: Update sale for settlements
  getDailySummary: (date) => apiClient.get('/api/sales/daily-summary/stats', { params: { date } }),
};

export const invoicesAPI = {
  getInvoices: (params = {}) => apiClient.get('/api/invoices', { params }),
  getInvoice: (id) => apiClient.get(`/api/invoices/${id}`),
  createInvoice: (invoiceData) => apiClient.post('/api/invoices', invoiceData),
  updateInvoice: (id, invoiceData) => apiClient.put(`/api/invoices/${id}`, invoiceData),
  deleteInvoice: (id) => apiClient.delete(`/api/invoices/${id}`),
  convertToSale: (id, paymentMethod = 'cash') => apiClient.post(`/api/invoices/${id}/convert-to-sale`, { payment_method: paymentMethod }),
  sendInvoice: (id) => apiClient.post(`/api/invoices/${id}/send`),
  exportInvoice: (id, options) => apiClient.post(`/api/invoices/${id}/export`, options),
};

export const staffAPI = {
  getUsers: (params = {}) => apiClient.get('/api/staff/users', { params }),
  getUser: (id) => apiClient.get(`/api/staff/users/${id}`),
  createUser: (userData) => apiClient.post('/api/staff/users', userData),
  updateUser: (id, userData) => apiClient.put(`/api/staff/users/${id}`, userData),
  deleteUser: (id) => apiClient.delete(`/api/staff/users/${id}`),
  resetPassword: (id, passwordData) => apiClient.post(`/api/staff/users/${id}/reset-password`, passwordData),
};

export const reportsAPI = {
  getSalesReport: (params = {}) => {
    const config = { 
      params,
      responseType: 'blob' // Important for file downloads
    };
    return apiClient.get('/api/reports/sales', config);
  },
  getInventoryReport: (params = {}) => {
    const config = { 
      params,
      responseType: 'blob'
    };
    return apiClient.get('/api/reports/inventory', config);
  },
  getCustomersReport: (params = {}) => {
    const config = { 
      params,
      responseType: 'blob'
    };
    return apiClient.get('/api/reports/customers', config);
  },
  getDailySummary: (params = {}) => apiClient.get('/api/reports/daily-summary', { params }),
  getProfitReport: (params = {}) => {
    const config = { 
      params,
      responseType: 'blob'
    };
    return apiClient.get('/api/reports/profit', config);
  },
};

export const profitReportsAPI = {
  getProfitReport: (params = {}) => apiClient.get('/api/reports/profit', { params }),
  exportProfitReport: (params = {}) => apiClient.get('/api/reports/profit/export', { params }),
};

// Diagnostics API (Admin only)
export const diagnosticsAPI = {
  getErrorCodes: (params = {}) => apiClient.get('/api/diagnostics/error-codes', { params }),
  getRecentErrors: (params = {}) => apiClient.get('/api/diagnostics/recent-errors', { params }),
  getErrorCodeDetails: (errorCode) => apiClient.get(`/api/diagnostics/error-codes/${errorCode}`),
  exportRecentErrors: (params = {}) => apiClient.get('/api/diagnostics/export-recent-errors', { params })
};

export default apiClient;