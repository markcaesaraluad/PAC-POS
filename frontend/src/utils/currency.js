// Currency utility functions for the POS system

// Currency symbol mapping
const CURRENCY_SYMBOLS = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'AUD': 'A$',
  'CAD': 'C$',
  'CHF': 'CHF ',
  'CNY': '¥',
  'SEK': 'kr ',
  'NZD': 'NZ$',
  'MXN': '$',
  'SGD': 'S$',
  'HKD': 'HK$',
  'NOK': 'kr ',
  'PHP': '₱',
  'THB': '฿',
  'TRY': '₺',
  'RUB': '₽',
  'INR': '₹',
  'KRW': '₩',
  'BRL': 'R$',
  'ZAR': 'R ',
  'PLN': 'zł ',
  'CZK': 'Kč ',
  'DKK': 'kr ',
  'HUF': 'Ft ',
  'BGN': 'лв ',
  'RON': 'lei ',
  'HRK': 'kn ',
  'ISK': 'kr ',
  'LTL': 'Lt ',
  'LVL': 'Ls ',
  'EEK': 'kr ',
  'MTL': 'Lm ',
  'CYP': '£'
};

// Currency locale mapping for number formatting
const CURRENCY_LOCALES = {
  'USD': 'en-US',
  'EUR': 'de-DE',
  'GBP': 'en-GB',
  'JPY': 'ja-JP',
  'AUD': 'en-AU',
  'CAD': 'en-CA',
  'CHF': 'de-CH',
  'CNY': 'zh-CN',
  'SEK': 'sv-SE',
  'NZD': 'en-NZ',
  'MXN': 'es-MX',
  'SGD': 'en-SG',
  'HKD': 'zh-HK',
  'NOK': 'no-NO',
  'PHP': 'en-PH',
  'THB': 'th-TH',
  'TRY': 'tr-TR',
  'RUB': 'ru-RU',
  'INR': 'en-IN',
  'KRW': 'ko-KR',
  'BRL': 'pt-BR',
  'ZAR': 'en-ZA',
  'PLN': 'pl-PL',
  'CZK': 'cs-CZ',
  'DKK': 'da-DK',
  'HUF': 'hu-HU',
  'BGN': 'bg-BG',
  'RON': 'ro-RO',
  'HRK': 'hr-HR',
  'ISK': 'is-IS',
  'LTL': 'lt-LT',
  'LVL': 'lv-LV',
  'EEK': 'et-EE',
  'MTL': 'mt-MT',
  'CYP': 'el-CY'
};

/**
 * Get currency symbol for a given currency code
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'EUR')
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (currencyCode = 'USD') => {
  return CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || currencyCode + ' ';
};

/**
 * Format amount with currency symbol
 * @param {number|string} amount - Amount to format
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'EUR')
 * @param {boolean} useSymbol - Whether to use currency symbol or code
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencyCode = 'USD', useSymbol = true) => {
  const numAmount = parseFloat(amount) || 0;
  
  if (useSymbol) {
    const symbol = getCurrencySymbol(currencyCode);
    
    // For currencies with symbol at the end (like NOK, SEK, PLN, CZK)
    if (['NOK', 'SEK', 'PLN', 'CZK', 'DKK', 'HUF', 'BGN', 'RON', 'HRK', 'ISK', 'LTL', 'LVL', 'EEK'].includes(currencyCode.toUpperCase())) {
      return `${numAmount.toFixed(2)} ${symbol.trim()}`;
    }
    
    // For most currencies with symbol at the beginning
    return `${symbol}${numAmount.toFixed(2)}`;
  } else {
    return `${numAmount.toFixed(2)} ${currencyCode.toUpperCase()}`;
  }
};

/**
 * Format amount using browser's Intl.NumberFormat with proper locale
 * @param {number|string} amount - Amount to format
 * @param {string} currencyCode - Currency code (e.g., 'USD', 'EUR')
 * @returns {string} Formatted currency string using locale formatting
 */
export const formatCurrencyLocalized = (amount, currencyCode = 'USD') => {
  const numAmount = parseFloat(amount) || 0;
  const locale = CURRENCY_LOCALES[currencyCode.toUpperCase()] || 'en-US';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numAmount);
  } catch (error) {
    // Fallback to simple format if Intl formatting fails
    console.warn(`Currency formatting failed for ${currencyCode}, using fallback`);
    return formatCurrency(amount, currencyCode);
  }
};

/**
 * Get available currencies list
 * @returns {Array} Array of currency objects with code, symbol, and name
 */
export const getAvailableCurrencies = () => {
  const currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
    { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    { code: 'THB', symbol: '฿', name: 'Thai Baht' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
    { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
    { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
    { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' }
  ];
  
  return currencies.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Validate currency code
 * @param {string} currencyCode - Currency code to validate
 * @returns {boolean} True if valid currency code
 */
export const isValidCurrency = (currencyCode) => {
  return Object.keys(CURRENCY_SYMBOLS).includes(currencyCode.toUpperCase());
};

const currencyUtils = {
  formatCurrency,
  formatCurrencyLocalized,
  getCurrencySymbol,
  getAvailableCurrencies,
  isValidCurrency
};

export default currencyUtils;