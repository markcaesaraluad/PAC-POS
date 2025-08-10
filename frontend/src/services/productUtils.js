/**
 * Product Utility Functions
 * Handles SKU generation, barcode operations, import/export, and label printing
 */

import { toast } from 'react-hot-toast';

/**
 * Generate unique SKU for products
 */
export const generateUniqueSKU = async (productName = '', existingProducts = []) => {
  // Create base SKU from product name or use generic prefix
  const cleanName = productName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const basePrefix = cleanName.slice(0, 4) || 'PROD';
  
  // Generate timestamp-based unique identifier
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
  
  let uniqueSKU = `${basePrefix}-${timestamp}-${randomSuffix}`;
  
  // Ensure uniqueness by checking against existing products
  let counter = 1;
  while (existingProducts.some(p => p.sku === uniqueSKU)) {
    uniqueSKU = `${basePrefix}-${timestamp}-${randomSuffix}-${counter}`;
    counter++;
  }
  
  return uniqueSKU;
};

/**
 * Generate barcode from SKU or create new barcode
 */
export const generateBarcode = (sku, type = 'EAN13') => {
  if (!sku) return '';
  
  // Create numeric barcode from SKU
  let numericCode = '';
  for (let i = 0; i < sku.length; i++) {
    numericCode += sku.charCodeAt(i).toString().slice(-1);
  }
  
  // Ensure proper length for barcode type
  if (type === 'EAN13') {
    numericCode = numericCode.padEnd(12, '0').slice(0, 12);
    // Add check digit (simplified implementation)
    const checkDigit = calculateEAN13CheckDigit(numericCode);
    return numericCode + checkDigit;
  } else if (type === 'CODE128') {
    return sku.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  
  return numericCode.slice(0, 10);
};

/**
 * Calculate EAN13 check digit
 */
const calculateEAN13CheckDigit = (code12) => {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return ((10 - (sum % 10)) % 10).toString();
};

/**
 * Validate import data
 */
export const validateImportData = (data) => {
  const errors = [];
  const validatedData = [];
  const skuSet = new Set();
  const barcodeSet = new Set();
  
  data.forEach((row, index) => {
    const rowErrors = [];
    const rowData = {
      ...row,
      line: index + 1
    };
    
    // Required fields validation
    if (!row.name || row.name.trim() === '') {
      rowErrors.push('Name is required');
    }
    
    if (!row.price || isNaN(parseFloat(row.price)) || parseFloat(row.price) <= 0) {
      rowErrors.push('Valid price is required');
    } else {
      rowData.price = parseFloat(row.price);
    }
    
    if (!row.product_cost || isNaN(parseFloat(row.product_cost)) || parseFloat(row.product_cost) < 0) {
      rowErrors.push('Valid product cost is required');
    } else {
      rowData.product_cost = parseFloat(row.product_cost);
    }
    
    if (!row.quantity || isNaN(parseInt(row.quantity)) || parseInt(row.quantity) < 0) {
      rowErrors.push('Valid quantity is required');
    } else {
      rowData.quantity = parseInt(row.quantity);
    }
    
    // SKU validation and auto-generation
    if (!row.sku || row.sku.trim() === '') {
      rowData.sku = generateUniqueSKU(row.name);
    } else {
      rowData.sku = row.sku.trim();
    }
    
    // Check for duplicate SKUs in import data
    if (skuSet.has(rowData.sku)) {
      rowErrors.push('Duplicate SKU in import data');
    } else {
      skuSet.add(rowData.sku);
    }
    
    // Barcode validation (optional but must be unique if provided)
    if (row.barcode && row.barcode.trim() !== '') {
      rowData.barcode = row.barcode.trim();
      if (barcodeSet.has(rowData.barcode)) {
        rowErrors.push('Duplicate barcode in import data');
      } else {
        barcodeSet.add(rowData.barcode);
      }
    }
    
    // Status validation
    if (row.status && !['active', 'inactive'].includes(row.status.toLowerCase())) {
      rowErrors.push('Status must be "active" or "inactive"');
    }
    rowData.status = row.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active';
    
    if (rowErrors.length > 0) {
      errors.push({
        line: index + 1,
        errors: rowErrors,
        data: row
      });
    } else {
      validatedData.push(rowData);
    }
  });
  
  return { validatedData, errors };
};

/**
 * Parse CSV content
 */
export const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    
    headers.forEach((header, index) => {
      row[header.toLowerCase().replace(/\s+/g, '_')] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return data;
};

/**
 * Generate CSV content from products
 */
export const generateCSV = (products) => {
  const headers = [
    'Name', 'SKU', 'Barcode', 'Category', 'Product_Cost', 'Price', 
    'Quantity', 'Status', 'Description', 'Brand', 'Supplier'
  ];
  
  const csvLines = [headers.join(',')];
  
  products.forEach(product => {
    const row = [
      `"${product.name || ''}"`,
      `"${product.sku || ''}"`,
      `"${product.barcode || ''}"`,
      `"${product.category_name || ''}"`,
      product.product_cost || 0,
      product.price || 0,
      product.quantity || 0,
      `"${product.status || 'active'}"`,
      `"${product.description || ''}"`,
      `"${product.brand || ''}"`,
      `"${product.supplier || ''}"`
    ];
    csvLines.push(row.join(','));
  });
  
  return csvLines.join('\n');
};

/**
 * Download file helper
 */
export const downloadFile = (content, filename, type = 'text/csv') => {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Generate label template for printing
 */
export const generateLabelTemplate = (product, options = {}) => {
  const {
    format = '80mm',
    layout = 'barcode_top', // barcode_top, barcode_bottom
    includeLogo = false,
    fontSize = 'normal'
  } = options;
  
  const width = format === '58mm' ? '58mm' : '80mm';
  const fontSizeClass = fontSize === 'small' ? '8px' : fontSize === 'large' ? '12px' : '10px';
  
  const barcodeElement = product.barcode ? `
    <div class="barcode" style="text-align: center; margin: 5px 0;">
      <div style="font-family: 'Libre Barcode 128', monospace; font-size: 24px; line-height: 1;">
        ${product.barcode}
      </div>
      <div style="font-size: 8px; margin-top: 2px;">${product.barcode}</div>
    </div>
  ` : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Product Label</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap');
        body { 
          margin: 0; 
          padding: 5mm; 
          font-family: monospace; 
          font-size: ${fontSizeClass};
          width: ${width};
        }
        .label { 
          border: 1px solid #000; 
          padding: 3mm; 
          width: 100%;
          text-align: center;
        }
        .product-name { 
          font-weight: bold; 
          margin: 3px 0; 
          word-wrap: break-word;
        }
        .sku { 
          font-size: 8px; 
          margin: 2px 0; 
        }
        .price { 
          font-size: 12px; 
          font-weight: bold; 
          margin: 3px 0; 
        }
        @media print {
          body { margin: 0; padding: 2mm; }
          .label { border: 1px solid #000; }
        }
      </style>
    </head>
    <body>
      <div class="label">
        ${layout === 'barcode_top' ? barcodeElement : ''}
        <div class="product-name">${product.name}</div>
        <div class="sku">SKU: ${product.sku}</div>
        <div class="price">₱${parseFloat(product.price).toFixed(2)}</div>
        ${layout === 'barcode_bottom' ? barcodeElement : ''}
      </div>
    </body>
    </html>
  `;
};

/**
 * Print label
 */
export const printLabel = (product, options = {}) => {
  const labelHTML = generateLabelTemplate(product, options);
  const printWindow = window.open('', '_blank', 'width=400,height=300');
  
  printWindow.document.write(labelHTML);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
    setTimeout(() => {
      printWindow.close();
    }, 1000);
  }, 500);
};

/**
 * Stock adjustment reasons
 */
export const STOCK_ADJUSTMENT_REASONS = [
  { value: 'restock', label: 'Inventory Restock' },
  { value: 'sale_return', label: 'Sale Return' },
  { value: 'damage', label: 'Damaged Items' },
  { value: 'theft', label: 'Theft/Loss' },
  { value: 'count_correction', label: 'Count Correction' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'promotion', label: 'Promotional Adjustment' },
  { value: 'other', label: 'Other' }
];

export default {
  generateUniqueSKU,
  generateBarcode,
  validateImportData,
  parseCSV,
  generateCSV,
  downloadFile,
  generateLabelTemplate,
  printLabel,
  STOCK_ADJUSTMENT_REASONS
};