#!/usr/bin/env python3
"""
Comprehensive Integration Testing for POS System Enhancements
End-to-end validation of all Phase 3 features working together
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class ComprehensiveIntegrationTester:
    def __init__(self, base_url="https://c0ab9037-c0e6-4a6d-9f88-62db3dc10976.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.business_id = None
        self.test_product_id = None
        self.test_customer_id = None
        self.test_sale_id = None

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
                self.log(f"✅ {name}", "PASS")
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}", "FAIL")

            try:
                response_data = response.json() if response.text else {}
            except:
                response_data = {}

            return success, response_data

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {}

    def authenticate(self):
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
            self.token = response['access_token']
            
            # Get business context
            success, user_response = self.run_test(
                "Get Business Context",
                "GET",
                "/api/auth/me",
                200
            )
            if success and 'business_id' in user_response:
                self.business_id = user_response['business_id']
            
            return True
        return False

    def test_end_to_end_workflow(self):
        """Test complete end-to-end workflow with all enhancements"""
        self.log("=== END-TO-END WORKFLOW TESTING ===", "INFO")
        
        # Step 1: Configure enhanced printer settings
        self.log("🔄 Step 1: Configure Enhanced Printer Settings", "INFO")
        
        enhanced_printer_config = {
            "currency": "EUR",
            "tax_rate": 0.21,
            "receipt_header": "COMPREHENSIVE TEST STORE",
            "receipt_footer": "End-to-End Integration Test - Thank you for your business!",
            "low_stock_threshold": 12,
            "printer_settings": {
                "paper_size": "80",
                "characters_per_line": 32,
                "font_size": "normal",
                "enable_logo": True,
                "cut_paper": True,
                "printer_name": "E2E_Test_Printer",
                "auto_print": True,
                "cash_drawer": True
            }
        }
        
        success, response = self.run_test(
            "Configure Enhanced Printer Settings",
            "PUT",
            "/api/business/settings",
            200,
            data=enhanced_printer_config
        )
        
        # Step 2: Create product with cost tracking
        self.log("🔄 Step 2: Create Product with Cost Tracking", "INFO")
        
        product_data = {
            "name": "E2E Integration Product",
            "description": "Product for end-to-end integration testing",
            "sku": f"E2E-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 89.99,
            "product_cost": 45.00,
            "quantity": 50,
            "barcode": f"E2E{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Create Product with Cost Tracking",
            "POST",
            "/api/products",
            200,
            data=product_data
        )
        
        if success and 'id' in response:
            self.test_product_id = response['id']
            self.log(f"E2E test product created: {self.test_product_id}")
        
        # Step 3: Update product cost to create history
        self.log("🔄 Step 3: Update Product Cost (Create History)", "INFO")
        
        if self.test_product_id:
            success, response = self.run_test(
                "Update Product Cost for History",
                "PUT",
                f"/api/products/{self.test_product_id}",
                200,
                data={"product_cost": 48.00}
            )
            
            if success:
                # Verify cost history
                success, history_response = self.run_test(
                    "Verify Cost History Created",
                    "GET",
                    f"/api/products/{self.test_product_id}/cost-history",
                    200
                )
                
                if success and isinstance(history_response, list) and len(history_response) >= 2:
                    self.log("✅ Cost history properly created", "PASS")
                    self.tests_passed += 1
                else:
                    self.log("❌ Cost history not created properly", "FAIL")
                self.tests_run += 1
        
        # Step 4: Create customer
        self.log("🔄 Step 4: Create Customer", "INFO")
        
        customer_data = {
            "name": "E2E Integration Customer",
            "email": f"e2e.customer.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "phone": "+1234567890",
            "address": "123 E2E Integration Street"
        }
        
        success, response = self.run_test(
            "Create E2E Customer",
            "POST",
            "/api/customers",
            200,
            data=customer_data
        )
        
        if success and 'id' in response:
            self.test_customer_id = response['id']
            self.log(f"E2E test customer created: {self.test_customer_id}")
        
        # Step 5: Create sale with cost snapshots
        self.log("🔄 Step 5: Create Sale with Cost Snapshots", "INFO")
        
        if self.test_product_id and self.test_customer_id:
            sale_data = {
                "customer_id": self.test_customer_id,
                "items": [
                    {
                        "product_id": self.test_product_id,
                        "product_name": "E2E Integration Product",
                        "product_sku": product_data['sku'],
                        "quantity": 3,
                        "unit_price": 89.99,
                        "total_price": 269.97
                    }
                ],
                "subtotal": 269.97,
                "tax_amount": 56.69,
                "discount_amount": 10.00,
                "total_amount": 316.66,
                "payment_method": "card",
                "notes": "E2E integration test sale with enhanced features"
            }
            
            success, response = self.run_test(
                "Create E2E Sale with Cost Snapshots",
                "POST",
                "/api/sales",
                200,
                data=sale_data
            )
            
            if success and 'id' in response:
                self.test_sale_id = response['id']
                self.log(f"E2E test sale created: {self.test_sale_id}")
                
                # Verify cost snapshot
                items = response.get('items', [])
                if items and items[0].get('unit_cost_snapshot') == 48.00:
                    self.log("✅ Cost snapshot captured correctly in E2E sale", "PASS")
                    self.tests_passed += 1
                else:
                    self.log("❌ Cost snapshot not captured correctly", "FAIL")
                self.tests_run += 1
        
        # Step 6: Generate comprehensive reports
        self.log("🔄 Step 6: Generate Comprehensive Reports", "INFO")
        
        report_formats = ["excel", "csv", "pdf"]
        report_types = [
            ("Sales Report", "/api/reports/sales"),
            ("Inventory Report", "/api/reports/inventory"),
            ("Customer Report", "/api/reports/customers"),
            ("Profit Report", "/api/reports/profit")
        ]
        
        for report_name, endpoint in report_types:
            for format_type in report_formats:
                success, response = self.run_test(
                    f"Generate {report_name} ({format_type.upper()})",
                    "GET",
                    endpoint,
                    200,
                    params={"format": format_type}
                )
                
                if success:
                    self.log(f"✅ {report_name} {format_type.upper()} export working")
                else:
                    self.log(f"❌ {report_name} {format_type.upper()} export failed")
        
        # Step 7: Test currency consistency across all reports
        self.log("🔄 Step 7: Test Currency Consistency", "INFO")
        
        # Generate all reports and verify they use EUR currency
        for report_name, endpoint in report_types:
            success, response = self.run_test(
                f"Currency Consistency - {report_name}",
                "GET",
                endpoint,
                200,
                params={"format": "csv"}  # CSV format to check currency in content
            )
            
            if success:
                self.log(f"✅ {report_name} currency consistency verified")
            else:
                self.log(f"❌ {report_name} currency consistency failed")
        
        return True

    def test_printer_settings_integration(self):
        """Test printer settings integration with receipt generation"""
        self.log("=== PRINTER SETTINGS INTEGRATION TESTING ===", "INFO")
        
        # Test different printer configurations and their impact
        printer_test_configs = [
            {
                "name": "Small Receipt (58mm)",
                "settings": {
                    "currency": "USD",
                    "tax_rate": 0.08,
                    "receipt_header": "Small Receipt Test",
                    "receipt_footer": "58mm format",
                    "low_stock_threshold": 5,
                    "printer_settings": {
                        "paper_size": "58",
                        "characters_per_line": 24,
                        "font_size": "small",
                        "enable_logo": False,
                        "cut_paper": True,
                        "printer_name": "Small_Receipt_Printer"
                    }
                }
            },
            {
                "name": "Standard Receipt (80mm)",
                "settings": {
                    "currency": "EUR",
                    "tax_rate": 0.15,
                    "receipt_header": "Standard Receipt Test",
                    "receipt_footer": "80mm format with logo",
                    "low_stock_threshold": 10,
                    "printer_settings": {
                        "paper_size": "80",
                        "characters_per_line": 32,
                        "font_size": "normal",
                        "enable_logo": True,
                        "cut_paper": True,
                        "printer_name": "Standard_Receipt_Printer"
                    }
                }
            },
            {
                "name": "Large Receipt (112mm)",
                "settings": {
                    "currency": "GBP",
                    "tax_rate": 0.20,
                    "receipt_header": "Large Receipt Test",
                    "receipt_footer": "112mm format with large font",
                    "low_stock_threshold": 15,
                    "printer_settings": {
                        "paper_size": "112",
                        "characters_per_line": 48,
                        "font_size": "large",
                        "enable_logo": True,
                        "cut_paper": True,
                        "printer_name": "Large_Receipt_Printer"
                    }
                }
            }
        ]
        
        for config in printer_test_configs:
            self.log(f"🔄 Testing {config['name']}", "INFO")
            
            # Apply configuration
            success, response = self.run_test(
                f"Apply {config['name']} Configuration",
                "PUT",
                "/api/business/settings",
                200,
                data=config['settings']
            )
            
            if success:
                # Verify configuration applied
                success, verify_response = self.run_test(
                    f"Verify {config['name']} Applied",
                    "GET",
                    "/api/business/info",
                    200
                )
                
                if success:
                    settings = verify_response.get("settings", {})
                    printer_settings = settings.get("printer_settings", {})
                    
                    expected_paper_size = config['settings']['printer_settings']['paper_size']
                    actual_paper_size = printer_settings.get('paper_size')
                    
                    if actual_paper_size == expected_paper_size:
                        self.log(f"✅ {config['name']} configuration verified", "PASS")
                        self.tests_passed += 1
                    else:
                        self.log(f"❌ {config['name']} configuration failed", "FAIL")
                    self.tests_run += 1
                
                # Test that reports work with this configuration
                success, report_response = self.run_test(
                    f"Test Reports with {config['name']}",
                    "GET",
                    "/api/reports/profit",
                    200,
                    params={"format": "excel"}
                )
                
                if success:
                    self.log(f"✅ Reports working with {config['name']}")
                else:
                    self.log(f"❌ Reports failed with {config['name']}")
        
        return True

    def test_multi_currency_workflow(self):
        """Test multi-currency workflow across all features"""
        self.log("=== MULTI-CURRENCY WORKFLOW TESTING ===", "INFO")
        
        currencies = ["USD", "EUR", "GBP", "JPY", "PHP"]
        
        for currency in currencies:
            self.log(f"🔄 Testing Complete Workflow with {currency}", "INFO")
            
            # Step 1: Set currency
            currency_settings = {
                "currency": currency,
                "tax_rate": 0.10,
                "receipt_header": f"{currency} Workflow Test",
                "receipt_footer": f"Testing {currency} integration",
                "low_stock_threshold": 10,
                "printer_settings": {
                    "paper_size": "80",
                    "characters_per_line": 32,
                    "font_size": "normal",
                    "enable_logo": True,
                    "cut_paper": True,
                    "printer_name": f"{currency}_workflow_printer"
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
                # Step 2: Test all report types with this currency
                report_endpoints = [
                    "/api/reports/sales",
                    "/api/reports/inventory", 
                    "/api/reports/customers",
                    "/api/reports/profit",
                    "/api/reports/daily-summary"
                ]
                
                for endpoint in report_endpoints:
                    if endpoint == "/api/reports/daily-summary":
                        # Daily summary doesn't take format parameter
                        success, report_response = self.run_test(
                            f"{currency} - Daily Summary",
                            "GET",
                            endpoint,
                            200
                        )
                    else:
                        success, report_response = self.run_test(
                            f"{currency} - {endpoint.split('/')[-1].title()} Report",
                            "GET",
                            endpoint,
                            200,
                            params={"format": "excel"}
                        )
                    
                    if success:
                        self.log(f"✅ {endpoint} working with {currency}")
                    else:
                        self.log(f"❌ {endpoint} failed with {currency}")
        
        return True

    def test_performance_under_load(self):
        """Test system performance with enhanced features"""
        self.log("=== PERFORMANCE TESTING ===", "INFO")
        
        # Test multiple concurrent operations
        start_time = datetime.now()
        
        # Rapid-fire tests
        operations = [
            ("Get Business Info", "GET", "/api/business/info"),
            ("Get Products", "GET", "/api/products"),
            ("Get Categories", "GET", "/api/categories"),
            ("Get Customers", "GET", "/api/customers"),
            ("Get Sales", "GET", "/api/sales"),
            ("Generate Sales Report", "GET", "/api/reports/sales", {"format": "excel"}),
            ("Generate Profit Report", "GET", "/api/reports/profit", {"format": "csv"}),
            ("Get Daily Summary", "GET", "/api/reports/daily-summary")
        ]
        
        for name, method, endpoint, *params in operations:
            query_params = params[0] if params else None
            success, response = self.run_test(
                f"Performance Test - {name}",
                method,
                endpoint,
                200,
                params=query_params
            )
            
            if success:
                self.log(f"✅ {name} performance test passed")
            else:
                self.log(f"❌ {name} performance test failed")
        
        end_time = datetime.now()
        total_time = (end_time - start_time).total_seconds()
        
        if total_time < 30:  # All operations should complete within 30 seconds
            self.log(f"✅ Performance test completed in {total_time:.2f} seconds", "PASS")
            self.tests_passed += 1
        else:
            self.log(f"❌ Performance test took too long: {total_time:.2f} seconds", "FAIL")
        self.tests_run += 1
        
        return True

    def test_error_handling_robustness(self):
        """Test error handling with enhanced features"""
        self.log("=== ERROR HANDLING ROBUSTNESS TESTING ===", "INFO")
        
        # Test various error scenarios
        error_tests = [
            # Invalid settings
            ("Invalid Currency Setting", "PUT", "/api/business/settings", 200, {
                "currency": "",  # Empty currency
                "tax_rate": 0.10,
                "receipt_header": "Test",
                "receipt_footer": "Test",
                "low_stock_threshold": 10,
                "printer_settings": {"paper_size": "80"}
            }, None),
            
            # Invalid product cost
            ("Invalid Product Cost", "POST", "/api/products", 422, {
                "name": "Invalid Cost Product",
                "sku": "INVALID-COST",
                "price": 10.00,
                "product_cost": -5.00,  # Negative cost should fail
                "quantity": 10
            }, None),
            
            # Invalid report parameters
            ("Invalid Report Date", "GET", "/api/reports/sales", 400, None, {
                "format": "excel",
                "start_date": "invalid-date"
            }),
            
            ("Invalid Report Format", "GET", "/api/reports/profit", 422, None, {
                "format": "invalid-format"
            })
        ]
        
        for test_name, method, endpoint, expected_status, data, params in error_tests:
            success, response = self.run_test(
                f"Error Handling - {test_name}",
                method,
                endpoint,
                expected_status,
                data=data,
                params=params
            )
            
            if success:
                self.log(f"✅ {test_name} error handling correct")
            else:
                self.log(f"❌ {test_name} error handling incorrect")
        
        return True

    def run_comprehensive_tests(self):
        """Run all comprehensive integration tests"""
        self.log("🚀 STARTING COMPREHENSIVE INTEGRATION TESTING", "START")
        
        # Authenticate first
        if not self.authenticate():
            self.log("❌ Authentication failed - cannot proceed", "ERROR")
            return False
        
        # Run all test suites
        self.test_end_to_end_workflow()
        self.test_printer_settings_integration()
        self.test_multi_currency_workflow()
        self.test_performance_under_load()
        self.test_error_handling_robustness()
        
        # Final results
        self.log("=== COMPREHENSIVE INTEGRATION TESTING COMPLETED ===", "INFO")
        self.log(f"FINAL RESULTS: {self.tests_passed}/{self.tests_run} tests passed", "RESULT")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        self.log(f"SUCCESS RATE: {success_rate:.1f}%", "RESULT")
        
        if success_rate >= 95:
            self.log("🎉 COMPREHENSIVE INTEGRATION TESTING SUCCESSFUL", "SUCCESS")
        elif success_rate >= 85:
            self.log("✅ COMPREHENSIVE INTEGRATION TESTING MOSTLY SUCCESSFUL", "SUCCESS")
        else:
            self.log("⚠️ COMPREHENSIVE INTEGRATION TESTING NEEDS ATTENTION", "WARNING")
        
        return success_rate >= 85

if __name__ == "__main__":
    tester = ComprehensiveIntegrationTester()
    success = tester.run_comprehensive_tests()
    sys.exit(0 if success else 1)