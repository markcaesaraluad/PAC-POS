#!/usr/bin/env python3
"""
Phase 3 Validation Testing - Enhanced Printer System
Focus on Settings Page Functionality, Printer Configuration, and Backend API Compatibility
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class Phase3ValidationTester:
    def __init__(self, base_url="https://pos-enhance.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.business_admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.business_id = None

    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None, 
                 params: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, params=params)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}", "PASS")
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")
                if response.text:
                    self.log(f"Response: {response.text[:500]}", "ERROR")

            try:
                response_data = response.json() if response.text else {}
            except:
                response_data = {}

            return success, response_data

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {}

    def authenticate_business_admin(self):
        """Authenticate as business admin"""
        success, response = self.run_test(
            "Business Admin Authentication",
            "POST",
            "/api/auth/login",
            200,
            data={
                "email": "admin@printsandcuts.com",
                "password": "admin123456",
                "business_subdomain": "prints-cuts-tagum"
            }
        )
        if success and 'access_token' in response:
            self.business_admin_token = response['access_token']
            self.token = self.business_admin_token
            self.log("Business admin authenticated successfully")
            
            # Get business context
            success, user_response = self.run_test(
                "Get Current User Context",
                "GET",
                "/api/auth/me",
                200
            )
            if success and 'business_id' in user_response:
                self.business_id = user_response['business_id']
                self.log(f"Business ID: {self.business_id}")
            
            return True
        return False

    def test_phase3_settings_page_functionality(self):
        """Test Phase 3 Settings Page Functionality"""
        self.log("=== PHASE 3 SETTINGS PAGE FUNCTIONALITY TESTING ===", "INFO")
        
        # Test 1: Get current business settings
        success, response = self.run_test(
            "Get Business Settings (Current State)",
            "GET",
            "/api/business/info",
            200
        )
        
        if success:
            current_settings = response.get("settings", {})
            self.log(f"Current settings retrieved: {json.dumps(current_settings, indent=2)}")
            
            # Verify settings structure
            required_fields = ["currency", "tax_rate", "receipt_header", "receipt_footer", "low_stock_threshold"]
            for field in required_fields:
                if field in current_settings:
                    self.log(f"✅ Required field '{field}' present", "PASS")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ Required field '{field}' missing", "FAIL")
                self.tests_run += 1
        
        # Test 2: Update comprehensive business settings
        enhanced_settings = {
            "currency": "USD",
            "tax_rate": 0.12,
            "receipt_header": "PHASE 3 ENHANCED STORE",
            "receipt_footer": "Enhanced Printer System - Thank you!",
            "low_stock_threshold": 15,
            "printer_settings": {
                "paper_size": "80",
                "characters_per_line": 32,
                "font_size": "normal",
                "enable_logo": True,
                "cut_paper": True,
                "printer_name": "Enhanced_Thermal_Printer",
                "auto_print": True,
                "cash_drawer": True
            }
        }
        
        success, response = self.run_test(
            "Update Enhanced Business Settings",
            "PUT",
            "/api/business/settings",
            200,
            data=enhanced_settings
        )
        
        if success:
            self.log("✅ Enhanced settings updated successfully")
        
        # Test 3: Verify settings persistence
        success, response = self.run_test(
            "Verify Enhanced Settings Persistence",
            "GET",
            "/api/business/info",
            200
        )
        
        if success:
            updated_settings = response.get("settings", {})
            printer_settings = updated_settings.get("printer_settings", {})
            
            # Verify all enhanced settings
            validations = [
                ("currency", "USD", updated_settings.get("currency")),
                ("tax_rate", 0.12, updated_settings.get("tax_rate")),
                ("receipt_header", "PHASE 3 ENHANCED STORE", updated_settings.get("receipt_header")),
                ("low_stock_threshold", 15, updated_settings.get("low_stock_threshold")),
                ("paper_size", "80", printer_settings.get("paper_size")),
                ("characters_per_line", 32, printer_settings.get("characters_per_line")),
                ("font_size", "normal", printer_settings.get("font_size")),
                ("printer_name", "Enhanced_Thermal_Printer", printer_settings.get("printer_name")),
                ("auto_print", True, printer_settings.get("auto_print")),
                ("cash_drawer", True, printer_settings.get("cash_drawer"))
            ]
            
            for field_name, expected, actual in validations:
                if actual == expected:
                    self.log(f"✅ {field_name} correctly set to {expected}", "PASS")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ {field_name} incorrect. Expected: {expected}, Got: {actual}", "FAIL")
                self.tests_run += 1
        
        return True

    def test_phase3_printer_configuration(self):
        """Test Phase 3 Enhanced Printer Configuration"""
        self.log("=== PHASE 3 PRINTER CONFIGURATION TESTING ===", "INFO")
        
        # Test different printer configurations
        printer_configs = [
            {
                "name": "58mm Thermal Printer",
                "config": {
                    "currency": "EUR",
                    "tax_rate": 0.10,
                    "receipt_header": "58mm Printer Test",
                    "receipt_footer": "Small format receipt",
                    "low_stock_threshold": 5,
                    "printer_settings": {
                        "paper_size": "58",
                        "characters_per_line": 24,
                        "font_size": "small",
                        "enable_logo": False,
                        "cut_paper": True,
                        "printer_name": "POS_58mm_Printer",
                        "auto_print": False,
                        "cash_drawer": False
                    }
                }
            },
            {
                "name": "80mm Thermal Printer",
                "config": {
                    "currency": "GBP",
                    "tax_rate": 0.20,
                    "receipt_header": "80mm Printer Test",
                    "receipt_footer": "Standard format receipt",
                    "low_stock_threshold": 10,
                    "printer_settings": {
                        "paper_size": "80",
                        "characters_per_line": 32,
                        "font_size": "normal",
                        "enable_logo": True,
                        "cut_paper": True,
                        "printer_name": "POS_80mm_Printer",
                        "auto_print": True,
                        "cash_drawer": True
                    }
                }
            },
            {
                "name": "112mm Large Format Printer",
                "config": {
                    "currency": "JPY",
                    "tax_rate": 0.08,
                    "receipt_header": "112mm Large Format Test",
                    "receipt_footer": "Large format receipt with extended details",
                    "low_stock_threshold": 20,
                    "printer_settings": {
                        "paper_size": "112",
                        "characters_per_line": 48,
                        "font_size": "large",
                        "enable_logo": True,
                        "cut_paper": True,
                        "printer_name": "POS_112mm_Large_Printer",
                        "auto_print": True,
                        "cash_drawer": True
                    }
                }
            }
        ]
        
        for config_test in printer_configs:
            self.log(f"🔄 Testing {config_test['name']} Configuration", "INFO")
            
            # Update to this configuration
            success, response = self.run_test(
                f"Update {config_test['name']} Settings",
                "PUT",
                "/api/business/settings",
                200,
                data=config_test['config']
            )
            
            if success:
                self.log(f"✅ {config_test['name']} settings updated")
                
                # Verify the configuration
                success, verify_response = self.run_test(
                    f"Verify {config_test['name']} Configuration",
                    "GET",
                    "/api/business/info",
                    200
                )
                
                if success:
                    settings = verify_response.get("settings", {})
                    printer_settings = settings.get("printer_settings", {})
                    
                    # Key validations for this printer type
                    paper_size = printer_settings.get("paper_size")
                    chars_per_line = printer_settings.get("characters_per_line")
                    font_size = printer_settings.get("font_size")
                    
                    expected_paper = config_test['config']['printer_settings']['paper_size']
                    expected_chars = config_test['config']['printer_settings']['characters_per_line']
                    expected_font = config_test['config']['printer_settings']['font_size']
                    
                    if paper_size == expected_paper and chars_per_line == expected_chars and font_size == expected_font:
                        self.log(f"✅ {config_test['name']} configuration verified", "PASS")
                        self.tests_passed += 1
                    else:
                        self.log(f"❌ {config_test['name']} configuration mismatch", "FAIL")
                    self.tests_run += 1
        
        return True

    def test_phase3_backend_api_compatibility(self):
        """Test Backend API Compatibility with Enhanced Settings"""
        self.log("=== PHASE 3 BACKEND API COMPATIBILITY TESTING ===", "INFO")
        
        # Test 1: Verify all existing endpoints still work with enhanced settings
        api_endpoints = [
            ("Products API", "GET", "/api/products"),
            ("Categories API", "GET", "/api/categories"),
            ("Customers API", "GET", "/api/customers"),
            ("Sales API", "GET", "/api/sales"),
            ("Business Info API", "GET", "/api/business/info"),
            ("Sales Reports API", "GET", "/api/reports/sales"),
            ("Inventory Reports API", "GET", "/api/reports/inventory"),
            ("Customer Reports API", "GET", "/api/reports/customers"),
            ("Daily Summary API", "GET", "/api/reports/daily-summary"),
            ("Profit Reports API", "GET", "/api/reports/profit")
        ]
        
        for name, method, endpoint in api_endpoints:
            success, response = self.run_test(
                f"Compatibility Test - {name}",
                method,
                endpoint,
                200
            )
            
            if success:
                self.log(f"✅ {name} compatible with enhanced settings")
            else:
                self.log(f"❌ {name} compatibility issue with enhanced settings")
        
        # Test 2: Test settings API with various data types
        test_settings_variations = [
            {
                "name": "Boolean Settings Test",
                "data": {
                    "currency": "USD",
                    "tax_rate": 0.0,
                    "receipt_header": "Boolean Test",
                    "receipt_footer": "Testing boolean values",
                    "low_stock_threshold": 1,
                    "printer_settings": {
                        "paper_size": "58",
                        "characters_per_line": 24,
                        "font_size": "small",
                        "enable_logo": False,
                        "cut_paper": False,
                        "printer_name": "test_printer",
                        "auto_print": False,
                        "cash_drawer": False
                    }
                }
            },
            {
                "name": "Maximum Values Test",
                "data": {
                    "currency": "EUR",
                    "tax_rate": 0.99,
                    "receipt_header": "Maximum Values Test - Very Long Header Text That Should Be Handled Properly",
                    "receipt_footer": "Maximum Values Test - Very Long Footer Text That Should Be Handled Properly",
                    "low_stock_threshold": 999,
                    "printer_settings": {
                        "paper_size": "112",
                        "characters_per_line": 48,
                        "font_size": "large",
                        "enable_logo": True,
                        "cut_paper": True,
                        "printer_name": "Very_Long_Printer_Name_For_Testing_Maximum_Length",
                        "auto_print": True,
                        "cash_drawer": True
                    }
                }
            }
        ]
        
        for test_case in test_settings_variations:
            success, response = self.run_test(
                f"Settings API - {test_case['name']}",
                "PUT",
                "/api/business/settings",
                200,
                data=test_case['data']
            )
            
            if success:
                # Verify the settings were saved correctly
                success, verify_response = self.run_test(
                    f"Verify {test_case['name']}",
                    "GET",
                    "/api/business/info",
                    200
                )
                
                if success:
                    saved_settings = verify_response.get("settings", {})
                    if saved_settings.get("currency") == test_case['data']['currency']:
                        self.log(f"✅ {test_case['name']} settings saved correctly", "PASS")
                        self.tests_passed += 1
                    else:
                        self.log(f"❌ {test_case['name']} settings not saved correctly", "FAIL")
                    self.tests_run += 1
        
        return True

    def test_comprehensive_system_functionality(self):
        """Test Comprehensive System Functionality"""
        self.log("=== COMPREHENSIVE SYSTEM FUNCTIONALITY TESTING ===", "INFO")
        
        # Test 1: Core Business Operations
        self.log("🔄 Testing Core Business Operations", "INFO")
        
        # Create a test product with cost (Phase 3 requirement)
        product_data = {
            "name": "Phase 3 Test Product",
            "description": "Product for Phase 3 comprehensive testing",
            "sku": f"P3-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 49.99,
            "product_cost": 25.00,  # Required in Phase 3
            "quantity": 100,
            "barcode": f"P3{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Create Product with Cost (Phase 3)",
            "POST",
            "/api/products",
            200,
            data=product_data
        )
        
        product_id = None
        if success and 'id' in response:
            product_id = response['id']
            self.log(f"Phase 3 test product created: {product_id}")
        
        # Create a test customer
        customer_data = {
            "name": "Phase 3 Test Customer",
            "email": f"phase3.customer.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "phone": "+1234567890",
            "address": "123 Phase 3 Test Street"
        }
        
        success, response = self.run_test(
            "Create Customer (Phase 3)",
            "POST",
            "/api/customers",
            200,
            data=customer_data
        )
        
        customer_id = None
        if success and 'id' in response:
            customer_id = response['id']
            self.log(f"Phase 3 test customer created: {customer_id}")
        
        # Test 2: Enhanced Reports System with Global Filtering
        self.log("🔄 Testing Enhanced Reports System", "INFO")
        
        # Test reports with various filters
        report_tests = [
            ("Sales Report with Date Range", "/api/reports/sales", {
                "format": "excel",
                "start_date": (datetime.now() - timedelta(days=7)).isoformat(),
                "end_date": datetime.now().isoformat()
            }),
            ("Inventory Report with Low Stock Filter", "/api/reports/inventory", {
                "format": "excel",
                "low_stock_only": "true"
            }),
            ("Customer Report with Top 10 Filter", "/api/reports/customers", {
                "format": "excel",
                "top_customers": "10"
            }),
            ("Profit Report with Date Range", "/api/reports/profit", {
                "format": "excel",
                "start_date": (datetime.now() - timedelta(days=30)).isoformat(),
                "end_date": datetime.now().isoformat()
            })
        ]
        
        for test_name, endpoint, params in report_tests:
            success, response = self.run_test(
                test_name,
                "GET",
                endpoint,
                200,
                params=params
            )
            
            if success:
                self.log(f"✅ {test_name} working with filters")
            else:
                self.log(f"❌ {test_name} failed with filters")
        
        # Test 3: Sales and Transaction Processing
        self.log("🔄 Testing Sales and Transaction Processing", "INFO")
        
        if product_id and customer_id:
            # Create a sale to test the complete workflow
            sale_data = {
                "customer_id": customer_id,
                "items": [
                    {
                        "product_id": product_id,
                        "product_name": "Phase 3 Test Product",
                        "product_sku": product_data['sku'],
                        "quantity": 2,
                        "unit_price": 49.99,
                        "total_price": 99.98
                    }
                ],
                "subtotal": 99.98,
                "tax_amount": 12.00,
                "discount_amount": 0.00,
                "total_amount": 111.98,
                "payment_method": "card",
                "notes": "Phase 3 comprehensive test sale"
            }
            
            success, response = self.run_test(
                "Create Sale (Phase 3 Workflow)",
                "POST",
                "/api/sales",
                200,
                data=sale_data
            )
            
            if success and 'id' in response:
                sale_id = response['id']
                self.log(f"Phase 3 test sale created: {sale_id}")
                
                # Verify cost snapshot was captured
                items = response.get('items', [])
                if items and items[0].get('unit_cost_snapshot') == 25.00:
                    self.log("✅ Cost snapshot captured in Phase 3 sale", "PASS")
                    self.tests_passed += 1
                else:
                    self.log("❌ Cost snapshot not captured correctly", "FAIL")
                self.tests_run += 1
        
        return True

    def test_integration_testing(self):
        """Test Integration of Phase 3 Enhancements"""
        self.log("=== PHASE 3 INTEGRATION TESTING ===", "INFO")
        
        # Test 1: Printer Settings Integration with Receipt Generation
        self.log("🔄 Testing Printer Settings Integration", "INFO")
        
        # Set specific printer configuration
        receipt_test_settings = {
            "currency": "PHP",
            "tax_rate": 0.12,
            "receipt_header": "INTEGRATION TEST STORE",
            "receipt_footer": "Printer Integration Test - Thank you!",
            "low_stock_threshold": 8,
            "printer_settings": {
                "paper_size": "80",
                "characters_per_line": 32,
                "font_size": "normal",
                "enable_logo": True,
                "cut_paper": True,
                "printer_name": "Integration_Test_Printer",
                "auto_print": True,
                "cash_drawer": True
            }
        }
        
        success, response = self.run_test(
            "Set Receipt Integration Test Settings",
            "PUT",
            "/api/business/settings",
            200,
            data=receipt_test_settings
        )
        
        # Test 2: Currency Formatting Integration
        self.log("🔄 Testing Currency Formatting Integration", "INFO")
        
        # Test different currencies and verify they work across all systems
        currencies_to_test = ["USD", "EUR", "GBP", "JPY", "PHP"]
        
        for currency in currencies_to_test:
            # Update currency
            currency_settings = {
                "currency": currency,
                "tax_rate": 0.10,
                "receipt_header": f"{currency} Currency Test",
                "receipt_footer": f"Testing {currency} formatting",
                "low_stock_threshold": 10,
                "printer_settings": {
                    "paper_size": "80",
                    "characters_per_line": 32,
                    "font_size": "normal",
                    "enable_logo": True,
                    "cut_paper": True,
                    "printer_name": f"{currency}_test_printer"
                }
            }
            
            success, response = self.run_test(
                f"Set Currency to {currency}",
                "PUT",
                "/api/business/settings",
                200,
                data=currency_settings
            )
            
            if success:
                # Test that reports work with this currency
                success, report_response = self.run_test(
                    f"Generate Profit Report with {currency}",
                    "GET",
                    "/api/reports/profit",
                    200,
                    params={"format": "csv"}
                )
                
                if success:
                    self.log(f"✅ {currency} currency integration working", "PASS")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ {currency} currency integration failed", "FAIL")
                self.tests_run += 1
        
        # Test 3: Global Filters Integration
        self.log("🔄 Testing Global Filters Integration", "INFO")
        
        # Test that filters work properly across all reports
        filter_tests = [
            ("Sales Report Date Filter", "/api/reports/sales", {
                "format": "excel",
                "start_date": (datetime.now() - timedelta(days=1)).isoformat(),
                "end_date": datetime.now().isoformat()
            }),
            ("Inventory Low Stock Filter", "/api/reports/inventory", {
                "format": "excel",
                "low_stock_only": "true"
            }),
            ("Customer Top 5 Filter", "/api/reports/customers", {
                "format": "excel",
                "top_customers": "5"
            }),
            ("Profit Report Date Range Filter", "/api/reports/profit", {
                "format": "csv",
                "start_date": (datetime.now() - timedelta(days=14)).isoformat(),
                "end_date": datetime.now().isoformat()
            })
        ]
        
        for test_name, endpoint, params in filter_tests:
            success, response = self.run_test(
                f"Global Filter - {test_name}",
                "GET",
                endpoint,
                200,
                params=params
            )
            
            if success:
                self.log(f"✅ {test_name} global filter working")
            else:
                self.log(f"❌ {test_name} global filter failed")
        
        # Test 4: Backward Compatibility
        self.log("🔄 Testing Backward Compatibility", "INFO")
        
        # Test that old data structures still work
        success, response = self.run_test(
            "Backward Compatibility - Existing Sales Data",
            "GET",
            "/api/sales",
            200
        )
        
        if success:
            sales_data = response
            if isinstance(sales_data, list) and len(sales_data) > 0:
                # Check if old sales without cost snapshots still work
                old_sale = sales_data[0]
                if 'items' in old_sale:
                    self.log("✅ Backward compatibility - old sales data accessible", "PASS")
                    self.tests_passed += 1
                else:
                    self.log("❌ Backward compatibility issue with old sales data", "FAIL")
                self.tests_run += 1
        
        return True

    def test_pdf_export_functionality(self):
        """Test PDF Export Functionality"""
        self.log("=== PDF EXPORT FUNCTIONALITY TESTING ===", "INFO")
        
        # Test PDF exports for different report types
        pdf_tests = [
            ("Sales Report PDF", "/api/reports/sales", {"format": "pdf"}),
            ("Inventory Report PDF", "/api/reports/inventory", {"format": "pdf"}),
            ("Profit Report PDF", "/api/reports/profit", {"format": "pdf"})
        ]
        
        for test_name, endpoint, params in pdf_tests:
            success, response = self.run_test(
                test_name,
                "GET",
                endpoint,
                200,  # Expecting 200 since PDF should work
                params=params
            )
            
            if success:
                self.log(f"✅ {test_name} PDF export working")
            else:
                self.log(f"❌ {test_name} PDF export failed")
        
        return True

    def run_all_tests(self):
        """Run all Phase 3 validation tests"""
        self.log("🚀 STARTING PHASE 3 VALIDATION TESTING", "START")
        
        # Authenticate first
        if not self.authenticate_business_admin():
            self.log("❌ Authentication failed - cannot proceed", "ERROR")
            return False
        
        # Run all test suites
        self.test_phase3_settings_page_functionality()
        self.test_phase3_printer_configuration()
        self.test_phase3_backend_api_compatibility()
        self.test_comprehensive_system_functionality()
        self.test_integration_testing()
        self.test_pdf_export_functionality()
        
        # Final results
        self.log("=== PHASE 3 VALIDATION TESTING COMPLETED ===", "INFO")
        self.log(f"RESULTS: {self.tests_passed}/{self.tests_run} tests passed", "RESULT")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 ALL PHASE 3 VALIDATION TESTS PASSED", "SUCCESS")
        else:
            failed_tests = self.tests_run - self.tests_passed
            self.log(f"⚠️ {failed_tests} tests failed", "WARNING")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = Phase3ValidationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)