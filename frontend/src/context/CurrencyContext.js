import React, { createContext, useContext, useState, useEffect } from 'react';
import { businessAPI } from '../services/api';
import { formatCurrency, formatCurrencyLocalized } from '../utils/currency';

const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  // Load currency from business settings
  const loadCurrency = async () => {
    try {
      const response = await businessAPI.getInfo();
      const businessCurrency = response.data?.settings?.currency || 'USD';
      setCurrency(businessCurrency);
    } catch (error) {
      console.error('Failed to load currency settings:', error);
      // Keep default USD if loading fails
      setCurrency('USD');
    } finally {
      setLoading(false);
    }
  };

  // Refresh currency (called when settings are updated)
  const refreshCurrency = async () => {
    await loadCurrency();
  };

  // Format currency amount with current business currency
  const formatAmount = (amount, useLocalized = false) => {
    if (useLocalized) {
      return formatCurrencyLocalized(amount, currency);
    }
    return formatCurrency(amount, currency);
  };

  // Format currency amount with custom currency
  const formatAmountWithCurrency = (amount, currencyCode, useLocalized = false) => {
    if (useLocalized) {
      return formatCurrencyLocalized(amount, currencyCode);
    }
    return formatCurrency(amount, currencyCode);
  };

  useEffect(() => {
    loadCurrency();
  }, []);

  const value = {
    currency,
    setCurrency,
    loading,
    formatAmount,
    formatAmountWithCurrency,
    refreshCurrency
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export default CurrencyContext;