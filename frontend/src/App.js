import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Components
import LoadingSpinner from './components/LoadingSpinner';
import Login from './components/auth/Login';
import SuperAdminLayout from './components/layouts/SuperAdminLayout';
import BusinessLayout from './components/layouts/BusinessLayout';
import POSLayout from './components/layouts/POSLayout';

// Super Admin Pages
import SuperAdminDashboard from './pages/super-admin/Dashboard';
import BusinessManagement from './pages/super-admin/BusinessManagement';

// Business Admin Pages
import BusinessDashboard from './pages/business/Dashboard';
import ProductManagement from './pages/business/ProductManagement';
import CategoryManagement from './pages/business/CategoryManagement';
import CustomerManagement from './pages/business/CustomerManagement';
import UserManagement from './pages/business/UserManagement';
import BusinessSettings from './pages/business/Settings';

// POS Pages
import POSInterface from './pages/pos/POSInterface';
import SalesHistory from './pages/pos/SalesHistory';

// Route protection component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" replace />}
        />
        
        {/* Default redirect based on user role */}
        <Route
          path="/"
          element={
            user ? (
              user.role === 'super_admin' ? (
                <Navigate to="/super-admin" replace />
              ) : user.role === 'business_admin' ? (
                <Navigate to="/business" replace />
              ) : (
                <Navigate to="/pos" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Super Admin Routes */}
        <Route
          path="/super-admin/*"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <SuperAdminLayout>
                <Routes>
                  <Route index element={<SuperAdminDashboard />} />
                  <Route path="businesses" element={<BusinessManagement />} />
                </Routes>
              </SuperAdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Business Admin Routes */}
        <Route
          path="/business/*"
          element={
            <ProtectedRoute allowedRoles={['business_admin']}>
              <BusinessLayout>
                <Routes>
                  <Route index element={<BusinessDashboard />} />
                  <Route path="products" element={<ProductManagement />} />
                  <Route path="categories" element={<CategoryManagement />} />
                  <Route path="customers" element={<CustomerManagement />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="settings" element={<BusinessSettings />} />
                </Routes>
              </BusinessLayout>
            </ProtectedRoute>
          }
        />

        {/* POS Routes (for cashiers and business admins) */}
        <Route
          path="/pos/*"
          element={
            <ProtectedRoute allowedRoles={['business_admin', 'cashier']}>
              <POSLayout>
                <Routes>
                  <Route index element={<POSInterface />} />
                  <Route path="sales" element={<SalesHistory />} />
                </Routes>
              </POSLayout>
            </ProtectedRoute>
          }
        />

        {/* Unauthorized page */}
        <Route
          path="/unauthorized"
          element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">403</h1>
                <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
                <button
                  onClick={() => window.history.back()}
                  className="btn-primary"
                >
                  Go Back
                </button>
              </div>
            </div>
          }
        />

        {/* 404 page */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-gray-600 mb-4">Page not found.</p>
                <button
                  onClick={() => window.history.back()}
                  className="btn-primary"
                >
                  Go Back
                </button>
              </div>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;