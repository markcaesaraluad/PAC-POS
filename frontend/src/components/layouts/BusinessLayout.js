import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  HomeIcon,
  CubeIcon,
  TagIcon,
  UserGroupIcon,
  UsersIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

const BusinessLayout = ({ children }) => {
  const location = useLocation();
  const { user, business, logout } = useAuth();

  // Define base navigation items
  const baseNavigation = [
    { name: 'Dashboard', href: '/business', icon: HomeIcon },
    { name: 'Products', href: '/business/products', icon: CubeIcon },
    { name: 'Categories', href: '/business/categories', icon: TagIcon },
    { name: 'Customers', href: '/business/customers', icon: UserGroupIcon },
    { 
      name: 'Reports', 
      href: '/business/reports', 
      icon: ChartBarIcon,
      submenu: [
        { name: 'Sales Reports', href: '/business/reports' },
        { name: 'Profit Report', href: '/business/profit-report', adminOnly: true }
      ]
    },
  ];

  // Add admin-only navigation items (no longer needed as Profit Report is in Reports submenu)
  const adminOnlyNavigation = [];

  const generalNavigation = [
    { name: 'Staff', href: '/business/users', icon: UsersIcon },
    { name: 'Settings', href: '/business/settings', icon: CogIcon },
  ];

  // Check if user is admin
  const isAdmin = user && (user.role === 'business_admin' || user.role === 'super_admin');

  // Combine navigation based on user role
  const navigation = [
    ...baseNavigation,
    ...(isAdmin ? adminOnlyNavigation : []),
    ...generalNavigation
  ];

  const isActive = (href) => {
    if (href === '/business') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <BuildingOfficeIcon className="h-6 w-6 text-primary-600" />
            <h1 className="text-lg font-bold text-gray-900">
              {business?.name || 'Business Admin'}
            </h1>
          </div>
        </div>
        
        <nav className="mt-8 px-4">
          <div className="space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                  isActive(item.href)
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>
          
          {/* POS Link */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <Link
              to="/pos"
              className="flex items-center px-4 py-2 text-sm font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200"
            >
              <CubeIcon className="mr-3 h-5 w-5" />
              Open POS
            </Link>
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {navigation.find(item => isActive(item.href))?.name || 'Business Admin'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user?.full_name}</span>
              </div>
              
              <button
                onClick={logout}
                className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default BusinessLayout;