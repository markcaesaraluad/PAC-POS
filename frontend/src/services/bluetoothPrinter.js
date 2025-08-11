/**
 * Bluetooth Printer Service for POS-9200-L Thermal Printer
 * Handles connection, printing, and device management
 */

class BluetoothPrinterService {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristic = null;
    this.isConnected = false;
    this.printerModel = 'POS-9200-L';
    
    // POS-9200-L specific commands
    this.commands = {
      // ESC/POS commands for thermal printer
      INIT: [0x1B, 0x40], // Initialize printer
      CUT: [0x1D, 0x56, 0x42, 0x00], // Full cut
      FEED_LINE: [0x0A], // Line feed
      CENTER: [0x1B, 0x61, 0x01], // Center alignment
      LEFT: [0x1B, 0x61, 0x00], // Left alignment
      BOLD_ON: [0x1B, 0x45, 0x01], // Bold on
      BOLD_OFF: [0x1B, 0x45, 0x00], // Bold off
      SMALL_FONT: [0x1B, 0x4D, 0x01], // Small font
      NORMAL_FONT: [0x1B, 0x4D, 0x00], // Normal font
      LARGE_FONT: [0x1D, 0x21, 0x11], // Large font
    };
  }

  /**
   * Check if Web Bluetooth API is supported
   */
  isBluetoothSupported() {
    return typeof navigator !== 'undefined' && 
           navigator.bluetooth !== undefined;
  }

  /**
   * Connect to POS-9200-L printer
   */
  async connect() {
    if (!this.isBluetoothSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser');
    }

    try {
      // Request device with printer service UUID
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: 'POS-9200-L' },
          { namePrefix: 'POS-' },
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] } // Common printer service
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });

      // Connect to GATT server
      this.server = await this.device.gatt.connect();
      
      // Get printer service
      this.service = await this.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      
      // Get write characteristic
      this.characteristic = await this.service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
      
      this.isConnected = true;
      
      // Initialize printer
      await this.sendCommand(this.commands.INIT);
      
      return {
        success: true,
        deviceName: this.device.name || 'POS-9200-L',
        deviceId: this.device.id,
        message: 'Successfully connected to POS-9200-L printer'
      };
      
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to printer: ${error.message}`);
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect() {
    try {
      if (this.server && this.server.connected) {
        await this.server.disconnect();
      }
      
      this.device = null;
      this.server = null;
      this.service = null;
      this.characteristic = null;
      this.isConnected = false;
      
      return { success: true, message: 'Printer disconnected successfully' };
      
    } catch (error) {
      throw new Error(`Failed to disconnect: ${error.message}`);
    }
  }

  /**
   * Send raw command to printer
   */
  async sendCommand(command) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Printer not connected');
    }
    
    try {
      const buffer = new Uint8Array(command);
      await this.characteristic.writeValue(buffer);
    } catch (error) {
      throw new Error(`Failed to send command: ${error.message}`);
    }
  }

  /**
   * Print text with formatting
   */
  async printText(text, options = {}) {
    if (!this.isConnected) {
      throw new Error('Printer not connected');
    }

    try {
      const { 
        align = 'left', 
        bold = false, 
        fontSize = 'normal',
        lineFeed = true 
      } = options;

      // Set alignment
      if (align === 'center') {
        await this.sendCommand(this.commands.CENTER);
      } else {
        await this.sendCommand(this.commands.LEFT);
      }

      // Set font size
      switch (fontSize) {
        case 'small':
          await this.sendCommand(this.commands.SMALL_FONT);
          break;
        case 'large':
          await this.sendCommand(this.commands.LARGE_FONT);
          break;
        default:
          await this.sendCommand(this.commands.NORMAL_FONT);
      }

      // Set bold
      if (bold) {
        await this.sendCommand(this.commands.BOLD_ON);
      }

      // Send text
      const encoder = new TextEncoder();
      const textData = encoder.encode(text);
      await this.characteristic.writeValue(textData);

      // Reset formatting
      if (bold) {
        await this.sendCommand(this.commands.BOLD_OFF);
      }
      await this.sendCommand(this.commands.NORMAL_FONT);
      await this.sendCommand(this.commands.LEFT);

      // Line feed
      if (lineFeed) {
        await this.sendCommand(this.commands.FEED_LINE);
      }

    } catch (error) {
      throw new Error(`Failed to print text: ${error.message}`);
    }
  }

  /**
   * Print receipt
   */
  async printReceipt(receiptData, printerSettings = {}) {
    if (!this.isConnected) {
      throw new Error('Printer not connected');
    }

    try {
      const {
        paper_size = '80',
        characters_per_line = 32,
        cut_paper = true,
        open_drawer = false
      } = printerSettings;
      
      // Get currency formatting from business settings or default to USD
      const currency = receiptData.business?.settings?.currency || 'USD';
      const currencySymbols = {
        'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'AUD': 'A$', 'CAD': 'C$',
        'CHF': 'CHF ', 'CNY': '¥', 'SEK': 'kr', 'NZD': 'NZ$', 'MXN': '$',
        'SGD': 'S$', 'HKD': 'HK$', 'NOK': 'kr', 'PHP': '₱', 'THB': '฿',
        'TRY': '₺', 'RUB': '₽', 'INR': '₹', 'KRW': '₩', 'BRL': 'R$'
      };
      const currencySymbol = currencySymbols[currency] || currency + ' ';
      
      // Format currency amounts with proper symbol
      const formatCurrencyAmount = (amount) => {
        const numAmount = parseFloat(amount) || 0;
        // For currencies with symbol at the end
        if (['NOK', 'SEK', 'CHF'].includes(currency)) {
          return `${numAmount.toFixed(2)} ${currencySymbol.trim()}`;
        }
        // For most currencies with symbol at the beginning
        return `${currencySymbol}${numAmount.toFixed(2)}`;
      };

      // Initialize
      await this.sendCommand(this.commands.INIT);

      // Business header
      if (receiptData.business) {
        await this.printText(receiptData.business.name, { 
          align: 'center', 
          bold: true, 
          fontSize: 'large' 
        });
        
        if (receiptData.business.address) {
          await this.printText(receiptData.business.address, { align: 'center' });
        }
        if (receiptData.business.contact_email) {
          await this.printText(receiptData.business.contact_email, { align: 'center' });
        }
        if (receiptData.business.phone) {
          await this.printText(receiptData.business.phone, { align: 'center' });
        }
        
        // Receipt header if configured
        if (receiptData.business.settings?.receipt_header) {
          await this.printText('');
          const headerLines = receiptData.business.settings.receipt_header.split('\n');
          for (const line of headerLines) {
            if (line.trim()) {
              await this.printText(line.trim(), { align: 'center' });
            }
          }
        }
        
        await this.printText('-'.repeat(characters_per_line), { align: 'center' });
      }

      // Transaction details
      await this.printText(`${receiptData.transaction_type || 'SALE'}: ${receiptData.transaction_number}`, { bold: true });
      await this.printText(`Date: ${new Date(receiptData.timestamp).toLocaleString()}`);
      
      if (receiptData.customer) {
        await this.printText(`Customer: ${receiptData.customer.name}`);
      }
      
      await this.printText('-'.repeat(characters_per_line));

      // Items
      for (const item of receiptData.items) {
        const line1 = item.product_name.substring(0, characters_per_line);
        await this.printText(line1);
        
        const qty = `${item.quantity}x`;
        const price = formatCurrencyAmount(item.unit_price);
        const total = formatCurrencyAmount(item.total_price);
        const line2 = `${qty} ${price}`.padEnd(characters_per_line - total.length) + total;
        await this.printText(line2);
      }

      await this.printText('-'.repeat(characters_per_line));

      // Totals
      const subtotal = `Subtotal:`.padEnd(characters_per_line - 12) + formatCurrencyAmount(receiptData.subtotal).padStart(12);
      await this.printText(subtotal);

      if (receiptData.tax_amount > 0) {
        const tax = `Tax:`.padEnd(characters_per_line - 12) + formatCurrencyAmount(receiptData.tax_amount).padStart(12);
        await this.printText(tax);
      }

      if (receiptData.discount_amount > 0) {
        const discount = `Discount:`.padEnd(characters_per_line - 12) + `-${formatCurrencyAmount(receiptData.discount_amount)}`.padStart(12);
        await this.printText(discount);
      }

      await this.printText('='.repeat(characters_per_line));
      const total = `TOTAL:`.padEnd(characters_per_line - 12) + formatCurrencyAmount(receiptData.total_amount).padStart(12);
      await this.printText(total, { bold: true, fontSize: 'large' });

      if (receiptData.payment_method && receiptData.received_amount) {
        await this.printText(`Payment: ${receiptData.payment_method.toUpperCase()}`);
        const paid = `Paid:`.padEnd(characters_per_line - 12) + formatCurrencyAmount(receiptData.received_amount).padStart(12);
        await this.printText(paid);
        const change = `Change:`.padEnd(characters_per_line - 12) + formatCurrencyAmount(receiptData.change_amount || 0).padStart(12);
        await this.printText(change);
      }

      // Footer
      await this.printText('');
      await this.printText('Thank you for your business!', { align: 'center' });
      
      // Receipt footer if configured
      if (receiptData.business?.settings?.receipt_footer) {
        await this.printText('');
        const footerLines = receiptData.business.settings.receipt_footer.split('\n');
        for (const line of footerLines) {
          if (line.trim()) {
            await this.printText(line.trim(), { align: 'center' });
          }
        }
      }
      
      if (receiptData.notes) {
        await this.printText('');
        await this.printText(`Note: ${receiptData.notes}`, { align: 'center' });
      }

      if (receiptData.reprint) {
        await this.printText('');
        await this.printText(`REPRINT - ${new Date().toLocaleString()}`, { align: 'center', fontSize: 'small' });
      }

      // Feed and cut
      await this.sendCommand(this.commands.FEED_LINE);
      await this.sendCommand(this.commands.FEED_LINE);
      
      if (cut_paper) {
        await this.sendCommand(this.commands.CUT);
      }

      // Open cash drawer if enabled
      if (open_drawer) {
        await this.openCashDrawer();
      }

      return { 
        success: true, 
        message: 'Receipt printed successfully',
        charactersPerLine: characters_per_line,
        paperSize: paper_size
      };

    } catch (error) {
      throw new Error(`Failed to print receipt: ${error.message}`);
    }
  }

  /**
   * Open cash drawer
   */
  async openCashDrawer() {
    try {
      // Cash drawer open command for POS-9200-L
      const drawerCommand = [0x1B, 0x70, 0x00, 0x19, 0xFA];
      await this.sendCommand(drawerCommand);
    } catch (error) {
      console.error('Failed to open cash drawer:', error);
    }
  }

  /**
   * Test printer connection and capabilities
   */
  async testPrinter() {
    if (!this.isConnected) {
      throw new Error('Printer not connected');
    }

    try {
      await this.printText('='.repeat(32), { align: 'center' });
      await this.printText('PRINTER TEST', { align: 'center', bold: true, fontSize: 'large' });
      await this.printText('POS-9200-L Thermal Printer', { align: 'center' });
      await this.printText('='.repeat(32), { align: 'center' });
      await this.printText('');
      await this.printText('Connection: OK', { bold: true });
      await this.printText(`Device: ${this.device.name || 'POS-9200-L'}`);
      await this.printText(`Status: Connected`);
      await this.printText(`Test Time: ${new Date().toLocaleString()}`);
      await this.printText('');
      await this.printText('Font Sizes:', { bold: true });
      await this.printText('Small font size', { fontSize: 'small' });
      await this.printText('Normal font size', { fontSize: 'normal' });
      await this.printText('Large font size', { fontSize: 'large' });
      await this.printText('');
      await this.printText('Test completed successfully!', { align: 'center', bold: true });
      await this.sendCommand(this.commands.FEED_LINE);
      await this.sendCommand(this.commands.CUT);

      return { 
        success: true, 
        message: 'Printer test completed successfully',
        device: this.device.name || 'POS-9200-L'
      };

    } catch (error) {
      throw new Error(`Printer test failed: ${error.message}`);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      device: this.device ? {
        name: this.device.name || 'POS-9200-L',
        id: this.device.id,
        connected: this.server?.connected || false
      } : null,
      printerModel: this.printerModel
    };
  }
}

// Create singleton instance
const bluetoothPrinterService = new BluetoothPrinterService();

export default bluetoothPrinterService;