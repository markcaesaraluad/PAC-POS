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

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    // Don't show toast for expected errors
    const isExpectedError = [400, 401, 403, 404, 422].includes(error.response?.status);
    if (!isExpectedError) {
      toast.error('Something went wrong. Please try again.');
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
  getProfitReport: (params = {}) => {
    const config = { 
      params,
      responseType: 'blob'
    };
    return apiClient.get('/api/reports/profit', config);
  },
  getDailySummary: (params = {}) => apiClient.get('/api/reports/daily-summary', { params }),
};

export default apiClient;