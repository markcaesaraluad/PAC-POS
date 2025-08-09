import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { productsAPI, categoriesAPI } from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import toast from 'react-hot-toast';
import { 
  CubeIcon, 
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  EyeIcon,
  ClockIcon
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    resolver: yupResolver(schema),
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        productsAPI.getProducts({ search: searchTerm, category_id: selectedCategory, low_stock: showLowStock }),
        categoriesAPI.getCategories()
      ]);
      setProducts(productsResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await productsAPI.getProducts({ 
        search: searchTerm, 
        category_id: selectedCategory,
        low_stock: showLowStock 
      });
      setProducts(response.data);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (data) => {
    setIsSubmitting(true);
    try {
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
    setValue('name', product.name);
    setValue('sku', product.sku);
    setValue('price', product.price);
    setValue('quantity', product.quantity);
    setValue('product_cost', product.product_cost || '');
    setValue('description', product.description || '');
    setValue('barcode', product.barcode || '');
    setValue('category_id', product.category_id || '');
  };

  const openProductDetailModal = async (product) => {
    setViewingProduct(product);
    setLoadingCostHistory(true);
    try {
      const response = await productsAPI.getProductCostHistory(product.id);
      setCostHistory(response.data);
    } catch (error) {
      console.error('Failed to load cost history:', error);
      if (error.response?.status === 403) {
        toast.error('You need admin access to view cost history');
      } else {
        toast.error('Failed to load cost history');
      }
      setCostHistory([]);
    } finally {
      setLoadingCostHistory(false);
    }
  };

  const closeProductDetailModal = () => {
    setViewingProduct(null);
    setCostHistory([]);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Uncategorized';
  };

  const getStockStatus = (quantity) => {
    if (quantity === 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-100' };
    if (quantity <= 10) return { label: 'Low Stock', color: 'text-yellow-600 bg-yellow-100' };
    return { label: 'In Stock', color: 'text-green-600 bg-green-100' };
  };

  if (loading) {
    return <LoadingSpinner message="Loading products..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
          <p className="text-gray-600">Manage your products and inventory</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Product
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Search Products</label>
              <div className="relative">
                <input
                  type="text"
                  className="form-input pl-10"
                  placeholder="Search by name, SKU, or barcode"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="form-label">Category</label>
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
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                  checked={showLowStock}
                  onChange={(e) => setShowLowStock(e.target.checked)}
                />
                <span className="ml-2 text-sm text-gray-700">Low stock only</span>
              </label>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                className="btn-primary w-full"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <div className="card-body p-0">
          {products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU / Barcode
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock
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
                  {products.map((product) => {
                    const stockStatus = getStockStatus(product.quantity);
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center mr-3">
                              {product.image_url ? (
                                <img 
                                  src={product.image_url} 
                                  alt={product.name}
                                  className="h-10 w-10 rounded-lg object-cover"
                                />
                              ) : (
                                <CubeIcon className="h-6 w-6 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              {product.description && (
                                <div className="text-sm text-gray-500">{product.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{product.sku}</div>
                          {product.barcode && (
                            <div className="text-sm text-gray-500">{product.barcode}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getCategoryName(product.category_id)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{formatAmount(product.price)}</div>
                          {product.product_cost && (
                            <div className="text-sm text-gray-500">Cost: {formatAmount(product.product_cost)}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{product.quantity}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                            {stockStatus.label === 'Low Stock' && (
                              <ExclamationTriangleIcon className="mr-1 h-3 w-3" />
                            )}
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openProductDetailModal(product)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details & Cost History"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(product)}
                              className="text-primary-600 hover:text-primary-900"
                              title="Edit Product"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No products</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new product.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Product
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Product Modal */}
      {(showCreateModal || editingProduct) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingProduct ? 'Edit Product' : 'Create New Product'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingProduct(null);
                  reset();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form 
              onSubmit={handleSubmit(editingProduct ? handleUpdateProduct : handleCreateProduct)} 
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Product Name</label>
                  <input
                    type="text"
                    className="form-input"
                    {...register('name')}
                  />
                  {errors.name && <p className="form-error">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="form-label">SKU</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="PROD-001"
                    {...register('sku')}
                  />
                  {errors.sku && <p className="form-error">{errors.sku.message}</p>}
                </div>

                <div>
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    {...register('category_id')}
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {errors.category_id && <p className="form-error">{errors.category_id.message}</p>}
                </div>

                <div>
                  <label className="form-label">Barcode (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    {...register('barcode')}
                  />
                  {errors.barcode && <p className="form-error">{errors.barcode.message}</p>}
                </div>

                <div>
                  <label className="form-label">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    {...register('price')}
                  />
                  {errors.price && <p className="form-error">{errors.price.message}</p>}
                </div>

                <div>
                  <label className="form-label">Product Cost ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    {...register('product_cost')}
                  />
                  {errors.product_cost && <p className="form-error">{errors.product_cost.message}</p>}
                  <p className="text-xs text-gray-500 mt-1">Required for profit tracking and reporting</p>
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-input"
                    {...register('quantity')}
                  />
                  {errors.quantity && <p className="form-error">{errors.quantity.message}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="form-label">Description (Optional)</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    {...register('description')}
                  />
                  {errors.description && <p className="form-error">{errors.description.message}</p>}
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingProduct(null);
                    reset();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <InlineSpinner />
                      <span className="ml-2">
                        {editingProduct ? 'Updating...' : 'Creating...'}
                      </span>
                    </>
                  ) : (
                    editingProduct ? 'Update Product' : 'Create Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Modal with Cost History */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Product Details - {viewingProduct.name}
              </h3>
              <button
                onClick={closeProductDetailModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2">Product Information</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="text-sm text-gray-900">{viewingProduct.name}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">SKU</label>
                      <p className="text-sm text-gray-900">{viewingProduct.sku}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Barcode</label>
                      <p className="text-sm text-gray-900">{viewingProduct.barcode || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Category</label>
                    <p className="text-sm text-gray-900">{getCategoryName(viewingProduct.category_id)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Sale Price</label>
                      <p className="text-lg font-bold text-green-600">{formatAmount(viewingProduct.price)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Current Cost</label>
                      <p className="text-lg font-bold text-orange-600">{formatAmount(viewingProduct.product_cost || 0)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Stock Quantity</label>
                      <p className="text-sm text-gray-900">{viewingProduct.quantity}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Profit Margin</label>
                      <p className="text-sm font-bold text-blue-600">
                        {formatAmount(viewingProduct.price - (viewingProduct.product_cost || 0))} 
                        ({(((viewingProduct.price - (viewingProduct.product_cost || 0)) / viewingProduct.price) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  
                  {viewingProduct.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Description</label>
                      <p className="text-sm text-gray-900">{viewingProduct.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Cost History */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 border-b pb-2 flex items-center">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Cost History (Admin Only)
                </h4>
                
                {loadingCostHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <InlineSpinner />
                    <span className="ml-2 text-sm text-gray-600">Loading cost history...</span>
                  </div>
                ) : costHistory.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto">
                    <div className="space-y-2">
                      {costHistory.map((record, index) => (
                        <div key={record.id} className={`p-3 rounded-lg border ${
                          index === 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center">
                                <span className="font-medium text-gray-900">
                                  {formatAmount(record.cost)}
                                </span>
                                {index === 0 && (
                                  <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {new Date(record.effective_from).toLocaleString()}
                              </p>
                              {record.notes && (
                                <p className="text-xs text-gray-500 mt-1">{record.notes}</p>
                              )}
                            </div>
                            {index < costHistory.length - 1 && (
                              <div className="text-xs">
                                {record.cost > costHistory[index + 1].cost ? (
                                  <span className="text-red-600">↑ +{formatAmount(record.cost - costHistory[index + 1].cost)}</span>
                                ) : record.cost < costHistory[index + 1].cost ? (
                                  <span className="text-green-600">↓ -{formatAmount(costHistory[index + 1].cost - record.cost)}</span>
                                ) : (
                                  <span className="text-gray-500">No change</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ClockIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="text-sm text-gray-600 mt-2">
                      {costHistory.length === 0 && !loadingCostHistory ? 
                        'No cost history available or insufficient permissions' : 
                        'No cost changes recorded'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={closeProductDetailModal}
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

export default ProductManagement;