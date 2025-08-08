import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  CubeIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

const POSLayout = ({ children }) => {
  const location = useLocation();
  const { user, business, logout } = useAuth();

  const navigation = [
    { name: 'POS', href: '/pos', icon: CubeIcon },
    { name: 'Sales History', href: '/pos/sales', icon: ClipboardDocumentListIcon },
  ];

  const isActive = (href) => {
    if (href === '/pos') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white shadow-sm border-b border-gray-200">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <BuildingOfficeIcon className="h-6 w-6 text-primary-600" />
              <h1 className="text-lg font-bold text-gray-900">
                {business?.name || 'POS System'}
              </h1>
            </div>
            
            {/* Navigation */}
            <nav className="flex space-x-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    isActive(item.href)
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Back to Admin (only for business admins) */}
            {user?.role === 'business_admin' && (
              <Link
                to="/business"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Back to Admin
              </Link>
            )}
            
            <div className="flex items-center space-x-2">
              <UserIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-700">{user?.full_name}</span>
              <span className="text-xs text-gray-500">({user?.role})</span>
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
  );
};

export default POSLayout;