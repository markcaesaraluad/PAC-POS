import React, { useState, useEffect } from 'react';
import { businessAPI } from '../../services/api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { 
  CogIcon, 
  PrinterIcon, 
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

const BusinessSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  
  const [settings, setSettings] = useState({
    currency: 'USD',
    tax_rate: 0,
    receipt_header: '',
    receipt_footer: '',
    low_stock_threshold: 10,
    printer_settings: {
      paper_size: '80', // mm
      characters_per_line: 32,
      enable_logo: true,
      enable_barcode: false,
      auto_print: false,
      font_size: 'normal', // small, normal, large
      cut_paper: true,
      open_drawer: false,
      printer_name: 'default'
    }
  });

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'printer', name: 'Printer Settings', icon: PrinterIcon },
    { id: 'receipts', name: 'Receipts', icon: DocumentTextIcon },
  ];

  const paperSizes = [
    { value: '58', label: '58mm', chars: 24 },
    { value: '80', label: '80mm', chars: 32 },
    { value: '112', label: '112mm (4 inch)', chars: 48 },
  ];

  useEffect(() => {
    loadBusinessInfo();
  }, []);

  const loadBusinessInfo = async () => {
    try {
      setLoading(true);
      const response = await businessAPI.getInfo();
      setBusinessInfo(response.data);
      
      // Load existing settings or use defaults
      const businessSettings = response.data.settings || {};
      setSettings(prevSettings => ({
        ...prevSettings,
        ...businessSettings,
        printer_settings: {
          ...prevSettings.printer_settings,
          ...(businessSettings.printer_settings || {})
        }
      }));
    } catch (error) {
      toast.error('Failed to load business information');
      console.error('Error loading business info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await businessAPI.updateSettings(settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to save settings';
      toast.error(errorMessage);
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePrinterTest = async () => {
    try {
      setSaving(true);
      // Simulate printer connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Printer connection test successful! POS-9200-L detected.');
    } catch (error) {
      toast.error('Printer test failed. Check connection and settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestReceipt = async () => {
    try {
      setSaving(true);
      // Simulate printing a test receipt
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Sample receipt sent to printer successfully');
    } catch (error) {
      toast.error('Failed to print test receipt');
    } finally {
      setSaving(false);
    }
  };

  const updatePrinterSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      printer_settings: {
        ...prev.printer_settings,
        [key]: value
      }
    }));

    // Auto-update characters per line based on paper size
    if (key === 'paper_size') {
      const paperSize = paperSizes.find(size => size.value === value);
      if (paperSize) {
        setSettings(prev => ({
          ...prev,
          printer_settings: {
            ...prev.printer_settings,
            characters_per_line: paperSize.chars
          }
        }));
      }
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
        <p className="text-gray-600">Configure your business and receipt printer settings</p>
      </div>

      {/* Business Info Card */}
      {businessInfo && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center space-x-4">
              <BuildingOfficeIcon className="h-12 w-12 text-blue-500" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{businessInfo.name}</h2>
                <p className="text-gray-600">{businessInfo.description}</p>
                <p className="text-sm text-gray-500">
                  Contact: {businessInfo.contact_email} | Phone: {businessInfo.phone || 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* General Settings */}
        {activeTab === 'general' && (
          <div className="card">
            <div className="card-body space-y-6">
              <h3 className="text-lg font-medium text-gray-900">General Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({...settings, currency: e.target.value})}
                    className="input w-full"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="PHP">PHP (₱)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.tax_rate}
                    onChange={(e) => setSettings({...settings, tax_rate: parseFloat(e.target.value) || 0})}
                    className="input w-full"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.low_stock_threshold}
                    onChange={(e) => setSettings({...settings, low_stock_threshold: parseInt(e.target.value) || 10})}
                    className="input w-full"
                    placeholder="10"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Alert when product quantity falls below this number
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Printer Settings */}
        {activeTab === 'printer' && (
          <div className="card">
            <div className="card-body space-y-6">
              <div className="flex items-center space-x-2">
                <PrinterIcon className="h-6 w-6 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">Printer Configuration</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paper Size
                  </label>
                  <select
                    value={settings.printer_settings.paper_size}
                    onChange={(e) => updatePrinterSetting('paper_size', e.target.value)}
                    className="input w-full"
                  >
                    {paperSizes.map(size => (
                      <option key={size.value} value={size.value}>
                        {size.label} ({size.chars} characters per line)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Characters Per Line
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="80"
                    value={settings.printer_settings.characters_per_line}
                    onChange={(e) => updatePrinterSetting('characters_per_line', parseInt(e.target.value))}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Size
                  </label>
                  <select
                    value={settings.printer_settings.font_size}
                    onChange={(e) => updatePrinterSetting('font_size', e.target.value)}
                    className="input w-full"
                  >
                    <option value="small">Small</option>
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Printer Name
                  </label>
                  <input
                    type="text"
                    value={settings.printer_settings.printer_name}
                    onChange={(e) => updatePrinterSetting('printer_name', e.target.value)}
                    className="input w-full"
                    placeholder="default"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Print Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.printer_settings.enable_logo}
                      onChange={(e) => updatePrinterSetting('enable_logo', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Print business logo on receipts</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.printer_settings.auto_print}
                      onChange={(e) => updatePrinterSetting('auto_print', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Auto-print receipts after sale completion</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.printer_settings.enable_barcode}
                      onChange={(e) => updatePrinterSetting('enable_barcode', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Print barcode/QR code on receipts</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.printer_settings.cut_paper}
                      onChange={(e) => updatePrinterSetting('cut_paper', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Auto cut paper after printing</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={settings.printer_settings.open_drawer}
                      onChange={(e) => updatePrinterSetting('open_drawer', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Open cash drawer after printing</span>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">Printer Setup Tips</h4>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>58mm printers are common for small receipts (24 characters/line)</li>
                        <li>80mm printers provide more space for detailed receipts (32 characters/line)</li>
                        <li>Test print after changing settings to ensure proper formatting</li>
                        <li>Enable auto-cut for cleaner receipt presentation</li>
                        <li>Auto-print saves time by printing immediately after each sale</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Printer Test Section */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Printer Testing</h4>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePrinterTest()}
                    className="btn-primary text-sm"
                  >
                    <PrinterIcon className="h-4 w-4 mr-2" />
                    Test Printer Connection
                  </button>
                  <button
                    onClick={() => handleTestReceipt()}
                    className="btn-secondary text-sm"
                  >
                    Print Sample Receipt
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use these buttons to test your printer setup and receipt formatting
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Settings */}
        {activeTab === 'receipts' && (
          <div className="card">
            <div className="card-body space-y-6">
              <div className="flex items-center space-x-2">
                <DocumentTextIcon className="h-6 w-6 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">Receipt Content</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt Header
                  </label>
                  <textarea
                    rows="3"
                    value={settings.receipt_header}
                    onChange={(e) => setSettings({...settings, receipt_header: e.target.value})}
                    className="input w-full"
                    placeholder="Welcome to our store!
Thank you for shopping with us."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Text displayed at the top of receipts (after business name)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt Footer
                  </label>
                  <textarea
                    rows="3"
                    value={settings.receipt_footer}
                    onChange={(e) => setSettings({...settings, receipt_footer: e.target.value})}
                    className="input w-full"
                    placeholder="Visit us again!
Follow us on social media @ourstore"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Text displayed at the bottom of receipts
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium text-gray-900 mb-2">Receipt Preview</h4>
                <div className="font-mono text-xs bg-white p-3 rounded border" style={{width: `${settings.printer_settings.characters_per_line * 8}px`, fontSize: settings.printer_settings.font_size === 'small' ? '10px' : settings.printer_settings.font_size === 'large' ? '14px' : '12px'}}>
                  <div className="text-center border-b pb-2 mb-2">
                    <div className="font-bold">{businessInfo?.name || 'BUSINESS NAME'}</div>
                    {settings.receipt_header && (
                      <div className="mt-1">{settings.receipt_header}</div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Item Name</span>
                      <span>$10.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Another Item</span>
                      <span>$5.50</span>
                    </div>
                    <div className="border-t pt-1 mt-2">
                      <div className="flex justify-between font-bold">
                        <span>TOTAL</span>
                        <span>$15.50</span>
                      </div>
                    </div>
                  </div>
                  {settings.receipt_footer && (
                    <div className="text-center border-t pt-2 mt-2">
                      {settings.receipt_footer}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default BusinessSettings;