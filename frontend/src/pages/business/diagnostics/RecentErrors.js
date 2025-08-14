import React, { useState, useEffect } from 'react';
import { diagnosticsAPI } from '../../../services/api';
import { 
  ClockIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const RecentErrors = () => {
  const [recentErrors, setRecentErrors] = useState([]);
  const [clientErrors, setClientErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClientErrors, setShowClientErrors] = useState(false);

  const severityColors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };

  useEffect(() => {
    fetchRecentErrors();
    loadClientErrors();
  }, []);

  const fetchRecentErrors = async () => {
    try {
      setLoading(true);
      const response = await diagnosticsAPI.getRecentErrors({ limit: 50 });
      setRecentErrors(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch recent errors:', error);
      toast.error('Failed to load recent errors');
    } finally {
      setLoading(false);
    }
  };

  const loadClientErrors = () => {
    try {
      const stored = sessionStorage.getItem('pos-recent-errors');
      if (stored) {
        const errors = JSON.parse(stored);
        setClientErrors(errors);
      }
    } catch (error) {
      console.warn('Failed to load client errors:', error);
    }
  };

  const clearClientErrors = () => {
    sessionStorage.removeItem('pos-recent-errors');
    setClientErrors([]);
    toast.success('Client-side error history cleared');
  };

  const exportErrors = async (format = 'json') => {
    try {
      const response = await diagnosticsAPI.exportRecentErrors({ 
        format: format,
        limit: 50 
      });
      
      const data = response.data.data;
      const filename = response.data.filename;
      
      // Create blob and download
      const blob = new Blob([format === 'csv' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Errors exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Failed to export errors:', error);
      toast.error('Failed to export errors');
    }
  };

  const copyErrorDetails = async (error) => {
    const details = {
      errorCode: error.errorCode,
      correlationId: error.correlationId || 'N/A',
      message: error.message,
      route: error.route,
      timestamp: error.timestamp || error.lastSeenAt,
      area: error.area,
      severity: error.severity
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(details, null, 2));
      toast.success('Error details copied to clipboard');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(details, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Error details copied to clipboard');
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const ErrorCard = ({ error, isClientError = false }) => (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {error.errorCode}
            </span>
            {error.severity && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[error.severity]}`}>
                {error.severity.toUpperCase()}
              </span>
            )}
            {error.area && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {error.area}
              </span>
            )}
            {isClientError && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                CLIENT-SIDE
              </span>
            )}
          </div>
          
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            {error.title || error.message}
          </h4>
          
          <div className="text-sm text-gray-600 space-y-1">
            {error.message && error.title && (
              <p><span className="font-medium">Message:</span> {error.message}</p>
            )}
            {error.route && (
              <p><span className="font-medium">Route:</span> {error.route}</p>
            )}
            {error.correlationId && (
              <p><span className="font-medium">Correlation ID:</span> {error.correlationId}</p>
            )}
            {!isClientError && error.occurrenceCount && (
              <p><span className="font-medium">Occurrences:</span> {error.occurrenceCount}</p>
            )}
          </div>
          
          <div className="mt-3 flex items-center space-x-3">
            <button
              onClick={() => copyErrorDetails(error)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Copy Details
            </button>
          </div>
        </div>
        
        <div className="ml-6 text-right">
          <div className="text-xs text-gray-500">
            {formatTimeAgo(error.timestamp || error.lastSeenAt)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(error.timestamp || error.lastSeenAt).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading recent errors...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ClockIcon className="h-6 w-6 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Recent Errors</h3>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowClientErrors(!showClientErrors)}
            className={`px-3 py-2 border border-gray-300 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              showClientErrors 
                ? 'bg-blue-100 text-blue-700 border-blue-300' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {showClientErrors ? 'Hide' : 'Show'} Client Errors ({clientErrors.length})
          </button>
          
          <button
            onClick={() => exportErrors('json')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export JSON
          </button>
          
          <button
            onClick={() => exportErrors('csv')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Client Errors Section */}
      {showClientErrors && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900">Client-Side Errors ({clientErrors.length})</h4>
              {clientErrors.length > 0 && (
                <button
                  onClick={clearClientErrors}
                  className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Clear History
                </button>
              )}
            </div>
            
            {clientErrors.length === 0 ? (
              <div className="text-center py-8">
                <InformationCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No client errors recorded</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Client-side errors will appear here when they occur during your session.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {clientErrors.map((error, index) => (
                  <ErrorCard key={`client-${index}`} error={error} isClientError={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Server Errors Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Server-Side Errors ({recentErrors.length})</h4>
          
          {recentErrors.length === 0 ? (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No recent errors</h3>
              <p className="mt-1 text-sm text-gray-500">
                Server-side errors will appear here when they occur. This is a good sign!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentErrors.map((error, index) => (
                <ErrorCard key={`server-${index}`} error={error} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentErrors;