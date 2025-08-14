import React, { useState, useEffect, useCallback } from 'react';
import { 
  MagnifyingGlassIcon, 
  CalendarIcon,
  XMarkIcon,
  FunnelIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

/**
 * Global Filter UX Standard Component
 * 
 * A comprehensive, reusable filtering component that provides:
 * - Date range picker with presets
 * - Text search with debouncing
 * - Dropdown filters (Category, Status, Staff, etc.)
 * - Active filter chips
 * - Clear all functionality
 * - Keyboard accessibility
 * - Responsive design
 * - Server-side filtering support
 */

const GlobalFilter = ({
  // Configuration
  filters = {},  // Available filter configurations
  onFilterChange,  // Callback when filters change
  loading = false,  // Loading state
  
  // Customization
  className = '',
  showDateRange = true,
  showSearch = true,
  searchPlaceholder = 'Search by name, SKU, ID...',
  
  // Initial values
  initialFilters = {},
  
  // Options
  debounceMs = 400,
  enablePersistence = true,
  persistenceKey = 'global-filter',
}) => {
  const [activeFilters, setActiveFilters] = useState(initialFilters);
  const [searchValue, setSearchValue] = useState(initialFilters.search || '');
  const [isExpanded, setIsExpanded] = useState(false);

  // Date presets
  const datePresets = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'last7days' },
    { label: 'This Month', value: 'thismonth' },
    { label: 'Last 30 Days', value: 'last30days' },
    { label: 'Custom Range', value: 'custom' },
  ];

  // Calculate date range based on preset
  const getDateRangeFromPreset = (preset) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'today':
        return {
          start_date: today.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return {
          start_date: yesterday.toISOString().split('T')[0],
          end_date: yesterday.toISOString().split('T')[0]
        };
      case 'last7days':
        const last7 = new Date(today);
        last7.setDate(today.getDate() - 7);
        return {
          start_date: last7.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      case 'thismonth':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          start_date: monthStart.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      case 'last30days':
        const last30 = new Date(today);
        last30.setDate(today.getDate() - 30);
        return {
          start_date: last30.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
      default:
        return { start_date: '', end_date: '' };
    }
  };

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      handleFilterChange('search', value);
    }, debounceMs),
    [debounceMs]
  );

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...activeFilters };
    
    if (value === '' || value === null || value === undefined) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    
    setActiveFilters(newFilters);
    
    // Save to localStorage if persistence is enabled
    if (enablePersistence) {
      localStorage.setItem(persistenceKey, JSON.stringify(newFilters));
    }
    
    // Notify parent component
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // Handle date preset change
  const handleDatePresetChange = (preset) => {
    if (preset === 'custom') {
      handleFilterChange('date_preset', preset);
      return;
    }
    
    const dateRange = getDateRangeFromPreset(preset);
    const newFilters = {
      ...activeFilters,
      date_preset: preset,
      start_date: dateRange.start_date,
      end_date: dateRange.end_date
    };
    
    setActiveFilters(newFilters);
    
    if (enablePersistence) {
      localStorage.setItem(persistenceKey, JSON.stringify(newFilters));
    }
    
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters({});
    setSearchValue('');
    
    if (enablePersistence) {
      localStorage.removeItem(persistenceKey);
    }
    
    if (onFilterChange) {
      onFilterChange({});
    }
  };

  // Remove individual filter
  const removeFilter = (key) => {
    if (key === 'search') {
      setSearchValue('');
    }
    handleFilterChange(key, null);
  };

  // Load saved filters on mount
  useEffect(() => {
    if (enablePersistence) {
      const saved = localStorage.getItem(persistenceKey);
      if (saved) {
        try {
          const parsedFilters = JSON.parse(saved);
          setActiveFilters(parsedFilters);
          setSearchValue(parsedFilters.search || '');
          
          // Use the callback in a timeout to prevent infinite loops
          if (onFilterChange) {
            setTimeout(() => {
              onFilterChange(parsedFilters);
            }, 0);
          }
        } catch (error) {
          console.error('Error loading saved filters:', error);
        }
      }
    }
  }, [enablePersistence, persistenceKey]); // Removed onFilterChange from dependencies

  // Count active filters
  const activeFilterCount = Object.keys(activeFilters).length;

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      {/* Filter Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-900">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="sm:hidden p-1 text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? <XMarkIcon className="h-5 w-5" /> : <FunnelIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className={`p-4 space-y-4 ${isExpanded ? 'block' : 'hidden sm:block'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          
          {/* Date Range Filter */}
          {showDateRange && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Date Range
              </label>
              <select
                value={activeFilters.date_preset || ''}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="">All time</option>
                {datePresets.map(preset => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date Range */}
          {activeFilters.date_preset === 'custom' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={activeFilters.start_date || ''}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={activeFilters.end_date || ''}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* Search Filter */}
          {showSearch && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Search
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-full pl-10 pr-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
                {searchValue && (
                  <button
                    onClick={() => {
                      setSearchValue('');
                      handleFilterChange('search', '');
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Dynamic Dropdown Filters */}
          {Object.entries(filters).map(([key, config]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {config.label}
              </label>
              <select
                value={activeFilters[key] || ''}
                onChange={(e) => handleFilterChange(key, e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                disabled={loading || config.loading}
              >
                <option value="">{config.placeholder || `All ${config.label.toLowerCase()}`}</option>
                {config.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {Object.entries(activeFilters).map(([key, value]) => {
              if (!value || key === 'start_date' || key === 'end_date') return null;
              
              let displayValue = value;
              
              // Format special cases
              if (key === 'date_preset') {
                const preset = datePresets.find(p => p.value === value);
                displayValue = preset ? preset.label : value;
              } else if (key === 'search') {
                displayValue = `"${value}"`;
              } else if (filters[key]?.options) {
                const option = filters[key].options.find(o => o.value === value);
                displayValue = option ? option.label : value;
              }

              return (
                <span
                  key={key}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  <span className="font-medium">{filters[key]?.label || key}:</span>
                  <span className="ml-1">{displayValue}</span>
                  <button
                    onClick={() => removeFilter(key)}
                    className="ml-2 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <XCircleIcon className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="px-4 py-2 border-t">
          <div className="flex items-center text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            Applying filters...
          </div>
        </div>
      )}
    </div>
  );
};

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default GlobalFilter;