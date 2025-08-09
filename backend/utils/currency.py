"""
Currency utility functions for backend
"""

# Currency symbol mapping
CURRENCY_SYMBOLS = {
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
}

def get_currency_symbol(currency_code: str = 'USD') -> str:
    """Get currency symbol for a given currency code"""
    return CURRENCY_SYMBOLS.get(currency_code.upper(), currency_code + ' ')

def format_currency(amount: float, currency_code: str = 'USD') -> str:
    """Format amount with currency symbol"""
    symbol = get_currency_symbol(currency_code)
    
    # For currencies with symbol at the end (like NOK, SEK, PLN, CZK)
    if currency_code.upper() in ['NOK', 'SEK', 'PLN', 'CZK', 'DKK', 'HUF', 'BGN', 'RON', 'HRK', 'ISK', 'LTL', 'LVL', 'EEK']:
        return f"{amount:.2f} {symbol.strip()}"
    
    # For most currencies with symbol at the beginning
    return f"{symbol}{amount:.2f}"

def get_business_currency(business_dict: dict) -> str:
    """Get currency from business settings"""
    return business_dict.get('settings', {}).get('currency', 'USD')