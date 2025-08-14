import React, { useState } from 'react';
import ErrorCodes from './diagnostics/ErrorCodes';
import RecentErrors from './diagnostics/RecentErrors';
import { 
  CodeBracketIcon, 
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const Diagnostics = () => {
  const [activeTab, setActiveTab] = useState('error-codes');

  const tabs = [
    {
      id: 'error-codes',
      name: 'Error Codes',
      icon: CodeBracketIcon,
      description: 'View and search error code registry'
    },
    {
      id: 'recent-errors',
      name: 'Recent Errors',
      icon: ClockIcon,
      description: 'View recent system errors and issues'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <ChartBarIcon className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Diagnostics</h1>
            <p className="text-sm text-gray-500">
              Monitor system errors and troubleshoot issues
            </p>
          </div>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">
              Admin Access Required
            </h3>
            <div className="mt-2 text-sm text-amber-700">
              <p>
                This section contains sensitive system information and is only accessible to administrators.
                Error codes and diagnostics data should not be shared with unauthorized users.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'error-codes' && <ErrorCodes />}
        {activeTab === 'recent-errors' && <RecentErrors />}
      </div>
    </div>
  );
};

export default Diagnostics;