import React, { useState, useEffect } from 'react';
import { diagnosticsAPI } from '../../../services/api';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ErrorCodes = () => {
  const [errorCodes, setErrorCodes] = useState({});
  const [filteredCodes, setFilteredCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [metadata, setMetadata] = useState({});

  const areas = ['POS', 'SETTINGS', 'REPORT', 'DB', 'AUTH', 'PRINT', 'INVENTORY', 'CUSTOMER', 'UNKNOWN'];
  const severities = ['low', 'medium', 'high'];

  const severityColors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };

  const severityIcons = {
    low: InformationCircleIcon,
    medium: ExclamationTriangleIcon,
    high: ExclamationTriangleIcon
  };

  useEffect(() => {
    fetchErrorCodes();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [errorCodes, searchTerm, selectedArea, selectedSeverity]);

  const fetchErrorCodes = async () => {
    try {
      setLoading(true);
      const response = await diagnosticsAPI.getErrorCodes();
      setErrorCodes(response.data.data || {});
      setMetadata(response.data.metadata || {});
    } catch (error) {
      console.error('Failed to fetch error codes:', error);
      toast.error('Failed to load error codes');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = { ...errorCodes };

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = Object.fromEntries(
        Object.entries(filtered).filter(([code, details]) => {
          const searchableText = `${code} ${details.title} ${details.userMessage}`.toLowerCase();
          return searchableText.includes(searchLower);
        })
      );
    }

    // Apply area filter
    if (selectedArea) {
      filtered = Object.fromEntries(
        Object.entries(filtered).filter(([_, details]) => 
          details.area === selectedArea
        )
      );
    }

    // Apply severity filter
    if (selectedSeverity) {
      filtered = Object.fromEntries(
        Object.entries(filtered).filter(([_, details]) => 
          details.severity === selectedSeverity
        )
      );
    }

    setFilteredCodes(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedArea('');
    setSelectedSeverity('');
  };

  const getOccurrenceColor = (count) => {
    if (count === 0) return 'text-gray-500';
    if (count <= 5) return 'text-green-600';
    if (count <= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading error codes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Codes
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {Object.keys(errorCodes).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Errors
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {Object.values(errorCodes).filter(code => code.occurrenceCount > 0).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Registry Version
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {metadata.version || 'N/A'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center space-x-4 mb-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search codes, titles, messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          {/* Area Filter */}
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Areas</option>
            {areas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Severities</option>
            {severities.map(severity => (
              <option key={severity} value={severity}>
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error Codes List */}
      <div className="bg-white shadow overflow-hidden rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Error Codes Registry ({Object.keys(filteredCodes).length} of {Object.keys(errorCodes).length})
          </h3>
          
          {Object.keys(filteredCodes).length === 0 ? (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No error codes found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {Object.keys(errorCodes).length === 0 
                  ? 'No error codes are registered in the system.'
                  : 'Try adjusting your search criteria or clearing filters.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(filteredCodes).map(([code, details]) => {
                const SeverityIcon = severityIcons[details.severity] || InformationCircleIcon;
                
                return (
                  <div key={code} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {code}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[details.severity]}`}>
                            <SeverityIcon className="h-3 w-3 mr-1" />
                            {details.severity.toUpperCase()}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {details.area}
                          </span>
                          {details.autoGenerated && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              AUTO-GENERATED
                            </span>
                          )}
                        </div>
                        
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          {details.title}
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <dt className="font-medium text-gray-700">User Message:</dt>
                            <dd className="text-gray-600 mt-1">{details.userMessage}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-700">Developer Cause:</dt>
                            <dd className="text-gray-600 mt-1">{details.devCause}</dd>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <dt className="font-medium text-gray-700">Common Fix:</dt>
                          <dd className="text-gray-600 mt-1">{details.commonFix}</dd>
                        </div>
                      </div>
                      
                      <div className="ml-6 text-right">
                        <div className="text-sm text-gray-500 mb-1">Occurrences</div>
                        <div className={`text-2xl font-bold ${getOccurrenceColor(details.occurrenceCount || 0)}`}>
                          {details.occurrenceCount || 0}
                        </div>
                        {details.lastSeenAt && (
                          <div className="text-xs text-gray-400 mt-1">
                            Last: {new Date(details.lastSeenAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorCodes;