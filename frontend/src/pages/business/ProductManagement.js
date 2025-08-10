import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { productsAPI, categoriesAPI } from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import { toast } from 'react-hot-toast';
import GlobalFilter from '../../components/GlobalFilter';
import useGlobalFilter from '../../hooks/useGlobalFilter';
import { 
  generateUniqueSKU, 
  generateBarcode, 
  validateImportData, 
  parseCSV, 
  generateCSV, 
  downloadFile, 
  printLabel,
  STOCK_ADJUSTMENT_REASONS 
} from '../../services/productUtils';
import { 
  CubeIcon, 
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  EyeIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  PrinterIcon,
  PhotoIcon,
  DocumentDuplicateIcon,
  AdjustmentsHorizontalIcon,
  CheckCircleIcon,
  BeakerIcon,
  TagIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner, { InlineSpinner } from '../../components/LoadingSpinner';

const schema = yup.object({
  name: yup.string().required('Product name is required'),
  sku: yup.string().required('SKU is required'),
  price: yup.number().positive('Price must be positive').required('Price is required'),
  product_cost: yup.number().min(0, 'Product cost cannot be negative').required('Product cost is required'),
  quantity: yup.number().min(0, 'Quantity cannot be negative').required('Quantity is required'),
  description: yup.string(),
  barcode: yup.string(),
  category_id: yup.string(),
  brand: yup.string(),
  supplier: yup.string(),
  low_stock_threshold: yup.number().min(1, 'Threshold must be at least 1').required('Low stock threshold is required'),
});

const ProductManagement = () => {
  const { formatAmount } = useCurrency();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [costHistory, setCostHistory] = useState([]);
  const [loadingCostHistory, setLoadingCostHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Enhanced state for new features
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedProductsForLabel, setSelectedProductsForLabel] = useState([]);
  const [inlineEditField, setInlineEditField] = useState(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedProductForImage, setSelectedProductForImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Filter configuration for GlobalFilter component
  const filterConfig = {
    category: {
      label: 'Category',
      placeholder: 'All categories',
      options: categories.map(cat => ({ value: cat.id, label: cat.name })),
    },
    status: {
      label: 'Status',
      placeholder: 'All statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'low_stock', label: 'Low Stock' },
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
    defaultFilters: {},
    persistenceKey: 'products-filter',
    enablePersistence: true
  });

  const fetchData = useCallback(async (customFilters = null) => {
    try {
      setLoading(true);
      const queryParams = generateQueryParams(customFilters || filters);
      
      // Handle special filter cases
      const params = { ...queryParams };
      if (params.status === 'low_stock') {
        params.low_stock = true;
        delete params.status;
      }
      
      const response = await productsAPI.getProducts(params);
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setProducts([]);
      toast.error(`Failed to load data: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [generateQueryParams, filters]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(schema),
  });

  const watchName = watch('name');

  useEffect(() => {
    loadCategories();
    fetchData();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories();
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleCreateProduct = async (data) => {
    setIsSubmitting(true);
    try {
      // Auto-generate SKU if empty
      if (!data.sku || data.sku.trim() === '') {
        data.sku = await generateUniqueSKU(data.name, products);
      }
      
      // Auto-generate barcode if empty and SKU exists
      if (!data.barcode && data.sku) {
        data.barcode = generateBarcode(data.sku);
      }
      
      await productsAPI.createProduct(data);
      toast.success('Product created successfully!');
      setShowCreateModal(false);
      reset();
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create product';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProduct = async (data) => {
    setIsSubmitting(true);
    try {
      await productsAPI.updateProduct(editingProduct.id, data);
      toast.success('Product updated successfully!');
      setEditingProduct(null);
      reset();
      fetchData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update product';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    if (window.confirm(`Are you sure you want to delete "${productName}"?`)) {
      try {
        await productsAPI.deleteProduct(productId);
        toast.success('Product deleted successfully!');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    reset(product);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingProduct(null);
    setViewingProduct(null);
    reset();
  };

  const viewCostHistory = async (product) => {
    setViewingProduct(product);
    setLoadingCostHistory(true);
    
    try {
      const response = await productsAPI.getProductCostHistory(product.id);
      setCostHistory(response.data);
    } catch (error) {
      toast.error('Failed to load cost history');
      setCostHistory([]);
    } finally {
      setLoadingCostHistory(false);
    }
  };

  // NEW FEATURES IMPLEMENTATION

  // 1. Bulk Import/Export Functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(csv|xlsx|xls)$/)) {
      toast.error('Please select a CSV or Excel file');
      return;
    }

    setImportFile(file);
    processImportFile(file);
  };

  const processImportFile = async (file) => {
    setImportLoading(true);
    try {
      const text = await file.text();
      let data;

      if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else {
        // For Excel files, we'd need a library like xlsx
        toast.error('Excel import not yet implemented. Please use CSV format.');
        return;
      }

      const { validatedData, errors } = validateImportData(data);
      setImportPreview(validatedData);
      setImportErrors(errors);
      setShowImportModal(true);
    } catch (error) {
      toast.error('Failed to process file: ' + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const executeImport = async () => {
    if (importPreview.length === 0) return;

    setImportLoading(true);
    try {
      const result = await productsAPI.bulkImport(importFile);
      
      toast.success(`Import completed! ${result.data.imported_count} products imported.`);
      if (result.data.error_count > 0) {
        toast.error(`${result.data.error_count} products had errors.`);
      }
      setShowImportModal(false);
      fetchData();
    } catch (error) {
      toast.error('Import failed: ' + (error.response?.data?.detail || error.message));
    } finally {
      setImportLoading(false);
    }
  };

  const handleExport = async (format = 'csv') => {
    try {
      const queryParams = generateQueryParams();
      const response = await productsAPI.exportProducts({ ...queryParams, format });
      
      const filename = `products_export_${new Date().toISOString().slice(0, 10)}.${format}`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Products exported successfully!`);
    } catch (error) {
      toast.error('Export failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  const downloadTemplate = async (format = 'csv') => {
    try {
      const response = await productsAPI.downloadTemplate(format);
      const filename = `products_template.${format}`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded successfully!');
    } catch (error) {
      toast.error('Template download failed');
    }
  };

  // 2. Stock Adjustment Functions
  const openStockModal = (product) => {
    setSelectedProductForStock(product);
    setShowStockModal(true);
  };

  const handleStockAdjustment = async (adjustmentData) => {
    if (!selectedProductForStock) return;

    try {
      const result = await productsAPI.adjustStock(selectedProductForStock.id, adjustmentData);
      toast.success(`Stock adjusted: ${result.data.old_quantity} → ${result.data.new_quantity}`);
      setShowStockModal(false);
      fetchData();
    } catch (error) {
      toast.error('Stock adjustment failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 3. Inline Edit Functions
  const startInlineEdit = (productId, field, currentValue) => {
    setInlineEditField(`${productId}-${field}`);
    setInlineEditValue(currentValue);
  };

  const saveInlineEdit = async (productId, field) => {
    try {
      await productsAPI.quickEdit(productId, { field, value: inlineEditValue });
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully`);
      setInlineEditField(null);
      fetchData();
    } catch (error) {
      toast.error(`Failed to update ${field}`);
    }
  };

  const cancelInlineEdit = () => {
    setInlineEditField(null);
    setInlineEditValue('');
  };

  // 4. Product Status Toggle
  const toggleProductStatus = async (productId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await productsAPI.toggleStatus(productId, newStatus);
      toast.success(`Product ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update product status');
    }
  };

  // 5. Product Duplication
  const duplicateProduct = async (productId) => {
    try {
      const result = await productsAPI.duplicateProduct(productId, {
        copy_barcode: false,
        copy_quantity: false
      });
      toast.success(`Product duplicated: ${result.data.duplicate_name}`);
      fetchData();
    } catch (error) {
      toast.error('Product duplication failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 6. Label Printing Functions
  const openLabelModal = (products = []) => {
    setSelectedProductsForLabel(Array.isArray(products) ? products : [products]);
    setShowLabelModal(true);
  };

  const printProductLabels = (labelOptions = {}) => {
    selectedProductsForLabel.forEach(product => {
      printLabel(product, labelOptions);
    });
    
    toast.success(`Printing ${selectedProductsForLabel.length} label(s)`);
    setShowLabelModal(false);
  };

  // 7. Image Upload Functions
  const openImageModal = (product) => {
    setSelectedProductForImage(product);
    setShowImageModal(true);
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedProductForImage) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/products/${selectedProductForImage.id}/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        toast.success('Product image updated successfully');
        setShowImageModal(false);
        fetchData();
      } else {
        throw new Error('Image upload failed');
      }
    } catch (error) {
      toast.error('Image upload failed: ' + error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Check if product is low stock
  const isLowStock = (product) => {
    return product.quantity <= (product.low_stock_threshold || 10);
  };

  // Get stock status badge
  const getStockBadge = (product) => {
    if (product.quantity === 0) {
      return <span className="badge badge-error text-xs">Out of Stock</span>;
    } else if (isLowStock(product)) {
      return <span className="badge badge-warning text-xs">Low Stock</span>;
    } else {
      return <span className="badge badge-success text-xs">In Stock</span>;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-600">Manage your product inventory with advanced features</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-sm flex items-center"
            disabled={importLoading}
          >
            <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
            {importLoading ? 'Processing...' : 'Import'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => handleExport('csv')}
            className="btn-secondary text-sm flex items-center"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="btn-secondary text-sm flex items-center"
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            Export Excel
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      {/* Global Filter */}
      <GlobalFilter
        filters={filterConfig}
        onFilterChange={setFilters}
        loading={filterLoading}
        initialFilters={filters}
        searchPlaceholder="Search products by name, SKU, barcode..."
      />

      {/* Products Table */}
      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU/Barcode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price/Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {product.image_url ? (
                          <img 
                            className="h-10 w-10 rounded object-cover" 
                            src={product.image_url} 
                            alt={product.name}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                            <CubeIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {product.category_name || 'No category'}
                        </div>
                        {product.brand && (
                          <div className="text-xs text-gray-400">
                            Brand: {product.brand}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{product.sku}</div>
                    {product.barcode && (
                      <div className="text-xs text-gray-500">{product.barcode}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {/* Inline editable price */}
                      {inlineEditField === `${product.id}-price` ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.01"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            className="w-20 px-2 py-1 text-xs border rounded"
                            onBlur={() => saveInlineEdit(product.id, 'price')}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') saveInlineEdit(product.id, 'price');
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div 
                          className="text-sm font-medium text-blue-600 cursor-pointer hover:text-blue-800"
                          onClick={() => startInlineEdit(product.id, 'price', product.price)}
                        >
                          {formatAmount(product.price)}
                        </div>
                      )}
                      
                      {/* Inline editable cost */}
                      {inlineEditField === `${product.id}-product_cost` ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.01"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            className="w-20 px-2 py-1 text-xs border rounded"
                            onBlur={() => saveInlineEdit(product.id, 'product_cost')}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') saveInlineEdit(product.id, 'product_cost');
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div 
                          className="text-xs text-gray-500 cursor-pointer hover:text-gray-700"
                          onClick={() => startInlineEdit(product.id, 'product_cost', product.product_cost)}
                        >
                          Cost: {formatAmount(product.product_cost || 0)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {/* Inline editable quantity */}
                      {inlineEditField === `${product.id}-quantity` ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            value={inlineEditValue}
                            onChange={(e) => setInlineEditValue(e.target.value)}
                            className="w-20 px-2 py-1 text-xs border rounded"
                            onBlur={() => saveInlineEdit(product.id, 'quantity')}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') saveInlineEdit(product.id, 'quantity');
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <div 
                          className="text-sm text-gray-900 cursor-pointer hover:text-gray-700"
                          onClick={() => startInlineEdit(product.id, 'quantity', product.quantity)}
                        >
                          {product.quantity}
                        </div>
                      )}
                      {getStockBadge(product)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleProductStatus(product.id, product.status)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit Product"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => viewCostHistory(product)}
                        className="text-green-600 hover:text-green-900"
                        title="View Cost History"
                      >
                        <ClockIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openStockModal(product)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Adjust Stock"
                      >
                        <AdjustmentsHorizontalIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openLabelModal(product)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Print Label"
                      >
                        <PrinterIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openImageModal(product)}
                        className="text-yellow-600 hover:text-yellow-900"
                        title="Upload Image"
                      >
                        <PhotoIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => duplicateProduct(product.id)}
                        className="text-cyan-600 hover:text-cyan-900"
                        title="Duplicate Product"
                      >
                        <DocumentDuplicateIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id, product.name)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Product"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {products.length === 0 && (
            <div className="text-center py-8">
              <CubeIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No products found</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="btn-secondary text-sm mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Product Modal */}
      {(showCreateModal || editingProduct) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Create Product'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit(editingProduct ? handleUpdateProduct : handleCreateProduct)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      {...register('name')}
                      className="input w-full"
                    />
                    {errors.name && (
                      <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SKU *
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        {...register('sku')}
                        className="input flex-1"
                        placeholder="Leave empty to auto-generate"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const newSKU = await generateUniqueSKU(watchName || 'Product', products);
                          setValue('sku', newSKU);
                        }}
                        className="btn-secondary text-xs px-3 py-2"
                      >
                        Generate
                      </button>
                    </div>
                    {errors.sku && (
                      <p className="text-red-500 text-xs mt-1">{errors.sku.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('price')}
                      className="input w-full"
                    />
                    {errors.price && (
                      <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Cost *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register('product_cost')}
                      className="input w-full"
                    />
                    {errors.product_cost && (
                      <p className="text-red-500 text-xs mt-1">{errors.product_cost.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="0"
                      {...register('quantity')}
                      className="input w-full"
                    />
                    {errors.quantity && (
                      <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Low Stock Alert
                    </label>
                    <input
                      type="number"
                      min="1"
                      {...register('low_stock_threshold')}
                      className="input w-full"
                      defaultValue={10}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Barcode
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        {...register('barcode')}
                        className="input flex-1"
                        placeholder="Optional"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const sku = watch('sku');
                          if (sku) {
                            setValue('barcode', generateBarcode(sku));
                          }
                        }}
                        className="btn-secondary text-xs px-3 py-2"
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      {...register('category_id')}
                      className="input w-full"
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brand
                    </label>
                    <input
                      type="text"
                      {...register('brand')}
                      className="input w-full"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier
                    </label>
                    <input
                      type="text"
                      {...register('supplier')}
                      className="input w-full"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows="3"
                    {...register('description')}
                    className="input w-full"
                    placeholder="Product description..."
                  />
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary"
                  >
                    {isSubmitting ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Import Preview</h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {importErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                  <h4 className="font-medium text-red-800 mb-2">Import Errors:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {importErrors.slice(0, 10).map((error, index) => (
                      <li key={index}>
                        Line {error.line}: {error.errors.join(', ')}
                      </li>
                    ))}
                  </ul>
                  {importErrors.length > 10 && (
                    <p className="text-sm text-red-600 mt-2">
                      ...and {importErrors.length - 10} more errors
                    </p>
                  )}
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Ready to import: <strong>{importPreview.length}</strong> products
                  {importErrors.length > 0 && (
                    <span className="text-red-600 ml-2">
                      ({importErrors.length} errors to fix)
                    </span>
                  )}
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {importPreview.slice(0, 20).map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2">{item.sku}</td>
                        <td className="px-4 py-2">{formatAmount(item.price)}</td>
                        <td className="px-4 py-2">{formatAmount(item.product_cost)}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={executeImport}
                  disabled={importLoading || importPreview.length === 0}
                  className="btn-primary"
                >
                  {importLoading ? 'Importing...' : `Import ${importPreview.length} Products`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && selectedProductForStock && (
        <StockAdjustmentModal
          product={selectedProductForStock}
          onClose={() => setShowStockModal(false)}
          onAdjust={handleStockAdjustment}
        />
      )}

      {/* Label Printing Modal */}
      {showLabelModal && (
        <LabelPrintModal
          products={selectedProductsForLabel}
          onClose={() => setShowLabelModal(false)}
          onPrint={printProductLabels}
        />
      )}

      {/* Image Upload Modal */}
      {showImageModal && selectedProductForImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Upload Product Image</h3>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="text-center">
                <div className="mb-4">
                  <div className="mx-auto h-32 w-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    {selectedProductForImage.image_url ? (
                      <img 
                        src={selectedProductForImage.image_url} 
                        alt={selectedProductForImage.name}
                        className="h-full w-full object-cover rounded-lg"
                      />
                    ) : (
                      <PhotoIcon className="h-16 w-16 text-gray-400" />
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Upload an image for <strong>{selectedProductForImage.name}</strong>
                </p>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <div className="flex space-x-3">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="btn-primary flex-1"
                  >
                    {uploadingImage ? 'Uploading...' : 'Choose Image'}
                  </button>
                  <button
                    onClick={() => setShowImageModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost History Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Cost History - {viewingProduct.name}
                </h3>
                <button
                  onClick={() => setViewingProduct(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {loadingCostHistory ? (
                <div className="flex justify-center py-8">
                  <InlineSpinner />
                </div>
              ) : (
                <div className="space-y-4">
                  {costHistory.length > 0 ? (
                    costHistory.map((entry, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-lg">{formatAmount(entry.cost)}</p>
                            <p className="text-sm text-gray-600">
                              {new Date(entry.effective_from).toLocaleDateString()}
                            </p>
                            {entry.notes && (
                              <p className="text-xs text-gray-500 mt-1">{entry.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No cost history available</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Stock Adjustment Modal Component
const StockAdjustmentModal = ({ product, onClose, onAdjust }) => {
  const [adjustmentType, setAdjustmentType] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setLoading(true);
    try {
      await onAdjust({
        type: adjustmentType,
        quantity: parseFloat(quantity),
        reason,
        notes
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Stock Adjustment</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              <strong>{product.name}</strong> - Current stock: <strong>{product.quantity}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adjustment Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="add"
                    checked={adjustmentType === 'add'}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="mr-2"
                  />
                  Add Stock
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="subtract"
                    checked={adjustmentType === 'subtract'}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                    className="mr-2"
                  />
                  Remove Stock
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input w-full"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input w-full"
                required
              >
                <option value="">Select reason...</option>
                {STOCK_ADJUSTMENT_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input w-full"
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Processing...' : 'Adjust Stock'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Label Print Modal Component
const LabelPrintModal = ({ products, onClose, onPrint }) => {
  const [labelOptions, setLabelOptions] = useState({
    format: '80mm',
    layout: 'barcode_top',
    fontSize: 'normal'
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Print Labels</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Printing labels for <strong>{products.length}</strong> product(s)
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paper Format
              </label>
              <select
                value={labelOptions.format}
                onChange={(e) => setLabelOptions(prev => ({ ...prev, format: e.target.value }))}
                className="input w-full"
              >
                <option value="58mm">58mm Receipt Paper</option>
                <option value="80mm">80mm Receipt Paper</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Layout
              </label>
              <select
                value={labelOptions.layout}
                onChange={(e) => setLabelOptions(prev => ({ ...prev, layout: e.target.value }))}
                className="input w-full"
              >
                <option value="barcode_top">Barcode Above Product Name</option>
                <option value="barcode_bottom">Barcode Below Product Name</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Size
              </label>
              <select
                value={labelOptions.fontSize}
                onChange={(e) => setLabelOptions(prev => ({ ...prev, fontSize: e.target.value }))}
                className="input w-full"
              >
                <option value="small">Small</option>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => onPrint(labelOptions)}
              className="btn-primary"
            >
              Print Labels
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;