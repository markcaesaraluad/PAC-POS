import React from 'react';
import { ExclamationTriangleIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

const SuspendedBusinessNotice = ({ businessName }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 p-3 rounded-full">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Business Suspended
        </h2>
        
        <div className="flex items-center justify-center mb-4">
          <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
          <span className="text-gray-600">{businessName}</span>
        </div>
        
        <p className="text-gray-600 mb-6">
          This business account has been suspended. Access to the POS system, 
          customer dashboard, and settings is temporarily unavailable.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>For business owners:</strong> Please contact support to resolve 
            any issues and reactivate your account.
          </p>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Need help? Contact support:
          </p>
          <div className="text-sm text-gray-600">
            <p>Email: support@pos.com</p>
            <p>Phone: 1-800-POS-HELP</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuspendedBusinessNotice;