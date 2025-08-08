import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { productsAPI, categoriesAPI, salesAPI } from '../../services/api';
import { Link } from 'react-router-dom';
import { 
  CubeIcon, 
  TagIcon, 
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../../components/LoadingSpinner';

const BusinessDashboard = () => {
  const { business } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
    lowStockProducts: 0,
    todaySales: 0
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [productsResponse, categoriesResponse, lowStockResponse, salesResponse] = await Promise.all([
        productsAPI.getProducts(),
        categoriesAPI.getCategories(),
        productsAPI.getProducts({ low_stock: true }),
        salesAPI.getDailySummary()
      ]);

      setStats({
        totalProducts: productsResponse.data.length,
        totalCategories: categoriesResponse.data.length,
        lowStockProducts: lowStockResponse.data.length,
        todaySales: salesResponse.data.total_revenue || 0
      });

      setLowStockProducts(lowStockResponse.data.slice(0, 5)); // Show top 5 low stock items
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const quickStats = [
    { 
      name: 'Products', 
      value: stats.totalProducts, 
      icon: CubeIcon, 
      color: 'bg-blue-500',
      link: '/business/products'
    },
    { 
      name: 'Categories', 
      value: stats.totalCategories, 
      icon: TagIcon, 
      color: 'bg-green-500',
      link: '/business/categories'
    },
    { 
      name: 'Low Stock Items', 
      value: stats.lowStockProducts, 
      icon: ExclamationTriangleIcon, 
      color: 'bg-yellow-500',
      link: '/business/products?low_stock=true'
    },
    { 
      name: 'Today\'s Sales', 
      value: `$${stats.todaySales.toFixed(2)}`, 
      icon: ChartBarIcon, 
      color: 'bg-purple-500',
      link: '/pos/sales'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to {business?.name}!</h1>
        <p className="text-gray-600">Manage your business operations from this dashboard</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => (
          <Link key={stat.name} to={stat.link} className="card hover:shadow-md transition-shadow">
            <div className="card-body">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              <Link to="/business/products" className="w-full btn-primary text-left flex items-center">
                <CubeIcon className="h-5 w-5 mr-3" />
                <div>
                  <p className="font-medium">Add Product</p>
                  <p className="text-sm opacity-75">Create new products for your inventory</p>
                </div>
              </Link>
              
              <Link to="/business/categories" className="w-full btn-secondary text-left flex items-center">
                <TagIcon className="h-5 w-5 mr-3" />
                <div>
                  <p className="font-medium">Manage Categories</p>
                  <p className="text-sm opacity-75">Organize your products with categories</p>
                </div>
              </Link>
              
              <Link to="/pos" className="w-full btn-success text-left flex items-center">
                <ChartBarIcon className="h-5 w-5 mr-3" />
                <div>
                  <p className="font-medium">Open POS</p>
                  <p className="text-sm opacity-75">Start processing sales</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Low Stock Alerts</h3>
              {stats.lowStockProducts > 0 && (
                <Link to="/business/products?low_stock=true" className="text-sm text-primary-600 hover:text-primary-700">
                  View All
                </Link>
              )}
            </div>
          </div>
          <div className="card-body">
            {lowStockProducts.length > 0 ? (
              <div className="space-y-3">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center">
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-3" />
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-yellow-600">{product.quantity} left</p>
                      <p className="text-sm text-gray-500">${product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p>No low stock items</p>
                <p className="text-sm">All products have sufficient stock</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Getting Started */}
      {stats.totalProducts === 0 && (
        <div className="card border-primary-200 bg-primary-50">
          <div className="card-body">
            <div className="text-center">
              <CubeIcon className="mx-auto h-12 w-12 text-primary-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Get Started with Your Inventory</h3>
              <p className="text-gray-600 mb-6">
                Set up your product catalog to start using the POS system effectively.
              </p>
              <div className="flex justify-center space-x-4">
                <Link to="/business/categories" className="btn-secondary">
                  <TagIcon className="h-4 w-4 mr-2" />
                  Create Categories
                </Link>
                <Link to="/business/products" className="btn-primary">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Products
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessDashboard;