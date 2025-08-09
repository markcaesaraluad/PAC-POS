import { useState, useEffect, useCallback } from 'react';

/**
 * Global Filter Hook
 * 
 * A React hook that provides consistent filter state management
 * across different pages and components. Handles:
 * - Filter state management
 * - URL parameter synchronization
 * - Local storage persistence
 * - API query generation
 * - Loading states
 */

const useGlobalFilter = ({
  // Configuration
  defaultFilters = {},
  persistenceKey = 'global-filter',
  enableUrlSync = false,
  enablePersistence = true,
  
  // API integration
  onFilterChange,
  apiEndpoint,
  apiParams = {},
  
  // Options
  debounceMs = 400,
}) => {
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Generate API query parameters from filters
  const generateQueryParams = useCallback((filterState = filters) => {
    const params = { ...apiParams };
    
    Object.entries(filterState).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params[key] = value;
      }
    });
    
    return params;
  }, [filters, apiParams]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setError(null);
    
    // Save to localStorage
    if (enablePersistence) {
      try {
        localStorage.setItem(persistenceKey, JSON.stringify(newFilters));
      } catch (error) {
        console.warn('Failed to save filters to localStorage:', error);
      }
    }
    
    // Update URL parameters
    if (enableUrlSync && typeof window !== 'undefined') {
      const url = new URL(window.location);
      const params = generateQueryParams(newFilters);
      
      // Clear existing filter params
      Array.from(url.searchParams.keys()).forEach(key => {
        if (Object.keys(defaultFilters).includes(key) || 
            ['search', 'start_date', 'end_date', 'date_preset'].includes(key)) {
          url.searchParams.delete(key);
        }
      });
      
      // Add new filter params
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
      
      window.history.replaceState({}, '', url);
    }
    
    // Notify parent component
    if (onFilterChange) {
      onFilterChange(newFilters, generateQueryParams(newFilters));
    }
  }, [
    enablePersistence, 
    persistenceKey, 
    enableUrlSync, 
    generateQueryParams, 
    onFilterChange, 
    defaultFilters
  ]);

  // Fetch data based on current filters
  const fetchData = useCallback(async (customFilters = null) => {
    if (!apiEndpoint) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = generateQueryParams(customFilters || filters);
      const url = new URL(apiEndpoint, window.location.origin);
      
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      });
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      
    } catch (error) {
      console.error('Filter data fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, filters, generateQueryParams]);

  // Initialize filters from various sources
  useEffect(() => {
    let initialFilters = { ...defaultFilters };
    
    // Load from localStorage
    if (enablePersistence) {
      try {
        const saved = localStorage.getItem(persistenceKey);
        if (saved) {
          const parsedFilters = JSON.parse(saved);
          initialFilters = { ...initialFilters, ...parsedFilters };
        }
      } catch (error) {
        console.warn('Failed to load filters from localStorage:', error);
      }
    }
    
    // Load from URL parameters
    if (enableUrlSync && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlFilters = {};
      
      for (const [key, value] of urlParams.entries()) {
        if (Object.keys(defaultFilters).includes(key) || 
            ['search', 'start_date', 'end_date', 'date_preset'].includes(key)) {
          urlFilters[key] = value;
        }
      }
      
      initialFilters = { ...initialFilters, ...urlFilters };
    }
    
    setFilters(initialFilters);
  }, [defaultFilters, enablePersistence, enableUrlSync, persistenceKey]);

  // Fetch data when filters change
  useEffect(() => {
    if (apiEndpoint) {
      const timer = setTimeout(() => {
        fetchData();
      }, debounceMs);
      
      return () => clearTimeout(timer);
    }
  }, [fetchData, apiEndpoint, debounceMs]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    handleFiltersChange({});
  }, [handleFiltersChange]);

  // Update specific filter
  const updateFilter = useCallback((key, value) => {
    const newFilters = { ...filters };
    
    if (value === null || value === undefined || value === '') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    
    handleFiltersChange(newFilters);
  }, [filters, handleFiltersChange]);

  // Get filter configuration for GlobalFilter component
  const getFilterConfig = useCallback((options = {}) => {
    return {
      filters,
      onFilterChange: handleFiltersChange,
      loading,
      error,
      clearFilters,
      updateFilter,
      generateQueryParams,
      ...options,
    };
  }, [
    filters, 
    handleFiltersChange, 
    loading, 
    error, 
    clearFilters, 
    updateFilter, 
    generateQueryParams
  ]);

  // Refresh data
  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Export data with current filters applied
  const exportData = useCallback(async (format = 'excel', customEndpoint = null) => {
    if (!apiEndpoint && !customEndpoint) return;
    
    try {
      setLoading(true);
      const queryParams = generateQueryParams();
      const exportUrl = customEndpoint || `${apiEndpoint}/export`;
      const url = new URL(exportUrl, window.location.origin);
      
      url.searchParams.append('format', format);
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          url.searchParams.append(key, value);
        }
      });
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      // Handle file download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `export_${Date.now()}.${format === 'excel' ? 'xlsx' : format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Export error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint, generateQueryParams]);

  return {
    // State
    filters,
    loading,
    error,
    data,
    
    // Actions
    setFilters: handleFiltersChange,
    clearFilters,
    updateFilter,
    refresh,
    exportData,
    
    // Utilities
    generateQueryParams,
    getFilterConfig,
    
    // Statistics
    hasActiveFilters: Object.keys(filters).length > 0,
    activeFilterCount: Object.keys(filters).length,
  };
};

export default useGlobalFilter;