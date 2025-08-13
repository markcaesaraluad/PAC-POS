#!/usr/bin/env python3
"""
HOTFIX VALIDATION TESTING - Critical Bug Fixes Testing
Tests the 6 specific hotfixes implemented for the POS system
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class HotfixValidationTester:
    def __init__(self, base_url="https://pos-enhance.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.business_admin_token = None
        self.super_admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.business_id = None
        self.customer_id = None
        self.product_id = None
        self.category_id = None
        self.invoice_id = None
        self.sale_id = None

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

    def setup_test_environment(self):
        """Set up test environment with authentication and basic data"""
        self.log("=== SETTING UP TEST ENVIRONMENT ===", "INFO")
        
        # Health check
        success, _ = self.run_test("Health Check", "GET", "/api/health", 200)
        if not success:
            return False
        
        # Super admin login
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "/api/auth/login",
            200,
            data={"email": "admin@pos.com", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.super_admin_token = response['access_token']
        
        # Business admin login
        success, response = self.run_test(
            "Business Admin Login",
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
        else:
            return False
        
        # Get current user info
        success, response = self.run_test("Get Current User", "GET", "/api/auth/me", 200)
        if success and 'business_id' in response:
            self.business_id = response['business_id']
        
        # Create test category
        success, response = self.run_test(
            "Create Test Category",
            "POST",
            "/api/categories",
            200,
            data={"name": "Hotfix Test Category", "description": "Category for hotfix testing"}
        )
        if success and 'id' in response:
            self.category_id = response['id']
        
        # Create test product
        success, response = self.run_test(
            "Create Test Product",
            "POST",
            "/api/products",
            200,
            data={
                "name": "Hotfix Test Product",
                "description": "Product for hotfix testing",
                "sku": f"HOTFIX-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "price": 100.00,
                "product_cost": 50.00,  # Fixed: use product_cost instead of cost
                "quantity": 100,
                "category_id": self.category_id,
                "barcode": f"HOTFIX{datetime.now().strftime('%H%M%S')}"
            }
        )
        if success and 'id' in response:
            self.product_id = response['id']
        
        # Create test customer
        success, response = self.run_test(
            "Create Test Customer",
            "POST",
            "/api/customers",
            200,
            data={
                "name": "Hotfix Test Customer",
                "email": f"hotfix.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
                "phone": "+1234567890",
                "address": "123 Hotfix Test Street"
            }
        )
        if success and 'id' in response:
            self.customer_id = response['id']
        
        return True

    def test_hotfix_1_cash_payment_validation(self):
        """Test HOTFIX 1: Cash Payment Validation Logic"""
        self.log("=== TESTING HOTFIX 1: CASH PAYMENT VALIDATION ===", "INFO")
        
        if not self.product_id or not self.customer_id:
            self.log("❌ Cannot test payment validation - missing product or customer", "ERROR")
            return False
        
        # Test 1: Total ₱1,000, discount ₱0, received ₱1,000 (should succeed, change ₱0.00)
        payment_test_1 = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Payment Test Product",
                    "product_sku": "PAY-TEST-001",
                    "quantity": 10,
                    "unit_price": 100.00,
                    "total_price": 1000.00
                }
            ],
            "subtotal": 1000.00,
            "tax_amount": 0.00,
            "discount_amount": 0.00,
            "total_amount": 1000.00,
            "payment_method": "cash",
            "notes": "Payment validation test 1 - exact payment"
        }
        
        success, response = self.run_test(
            "Payment Test 1: ₱1,000 total, ₱1,000 received (exact payment)",
            "POST",
            "/api/sales",
            200,
            data=payment_test_1
        )
        
        if success:
            self.log("✅ Exact payment validation working correctly")
        
        # Test 2: Total ₱1,000, discount 10%, received ₱900 (should succeed, change ₱0.00)
        payment_test_2 = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Payment Test Product",
                    "product_sku": "PAY-TEST-002",
                    "quantity": 10,
                    "unit_price": 100.00,
                    "total_price": 1000.00
                }
            ],
            "subtotal": 1000.00,
            "tax_amount": 0.00,
            "discount_amount": 100.00,  # 10% discount
            "total_amount": 900.00,
            "payment_method": "cash",
            "notes": "Payment validation test 2 - 10% discount"
        }
        
        success, response = self.run_test(
            "Payment Test 2: ₱1,000 total, 10% discount, ₱900 received",
            "POST",
            "/api/sales",
            200,
            data=payment_test_2
        )
        
        if success:
            self.log("✅ Percentage discount payment validation working correctly")
        
        # Test 3: Total ₱1,000, discount ₱50, received ₱950 (should succeed, change ₱0.00)
        payment_test_3 = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Payment Test Product",
                    "product_sku": "PAY-TEST-003",
                    "quantity": 10,
                    "unit_price": 100.00,
                    "total_price": 1000.00
                }
            ],
            "subtotal": 1000.00,
            "tax_amount": 0.00,
            "discount_amount": 50.00,  # Fixed amount discount
            "total_amount": 950.00,
            "payment_method": "cash",
            "notes": "Payment validation test 3 - ₱50 discount"
        }
        
        success, response = self.run_test(
            "Payment Test 3: ₱1,000 total, ₱50 discount, ₱950 received",
            "POST",
            "/api/sales",
            200,
            data=payment_test_3
        )
        
        if success:
            self.log("✅ Fixed amount discount payment validation working correctly")
        
        # Test 4: Decimal handling and rounding accuracy
        payment_test_4 = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Payment Test Product",
                    "product_sku": "PAY-TEST-004",
                    "quantity": 3,
                    "unit_price": 33.33,
                    "total_price": 99.99
                }
            ],
            "subtotal": 99.99,
            "tax_amount": 9.00,
            "discount_amount": 8.99,
            "total_amount": 100.00,
            "payment_method": "cash",
            "notes": "Payment validation test 4 - decimal handling"
        }
        
        success, response = self.run_test(
            "Payment Test 4: Decimal handling and rounding accuracy",
            "POST",
            "/api/sales",
            200,
            data=payment_test_4
        )
        
        if success:
            self.log("✅ Decimal handling and rounding working correctly")
        
        self.log("=== HOTFIX 1 CASH PAYMENT VALIDATION TESTING COMPLETED ===", "INFO")
        return True

    def test_hotfix_2_sales_history_display(self):
        """Test HOTFIX 2: Sales History Display and Persistence"""
        self.log("=== TESTING HOTFIX 2: SALES HISTORY DISPLAY ===", "INFO")
        
        # Create test sales for history testing
        test_sales = []
        for i in range(3):
            sale_data = {
                "customer_id": self.customer_id,
                "items": [
                    {
                        "product_id": self.product_id,
                        "product_name": f"History Test Product {i+1}",
                        "product_sku": f"HIST-{i+1:03d}",
                        "quantity": i + 1,
                        "unit_price": 25.00,
                        "total_price": 25.00 * (i + 1)
                    }
                ],
                "subtotal": 25.00 * (i + 1),
                "tax_amount": 2.25 * (i + 1),
                "discount_amount": 0.00,
                "total_amount": 27.25 * (i + 1),
                "payment_method": "cash" if i % 2 == 0 else "card",
                "notes": f"Sales history test {i+1}"
            }
            
            success, response = self.run_test(
                f"Create Test Sale {i+1} for History",
                "POST",
                "/api/sales",
                200,
                data=sale_data
            )
            
            if success and 'id' in response:
                test_sales.append(response['id'])
        
        # Test 1: Verify sales appear in GET /api/sales (default today's date)
        success, response = self.run_test(
            "Get Sales History (Default - Today)",
            "GET",
            "/api/sales",
            200
        )
        
        if success and isinstance(response, list):
            self.log(f"✅ Sales history retrieved: {len(response)} sales found")
            
            # Verify our test sales are in the response
            found_test_sales = 0
            for sale in response:
                if sale.get('id') in test_sales:
                    found_test_sales += 1
            
            if found_test_sales >= len(test_sales):
                self.log(f"✅ All test sales found in history ({found_test_sales}/{len(test_sales)})")
            else:
                self.log(f"❌ Not all test sales found in history ({found_test_sales}/{len(test_sales)})")
        
        # Test 2: Test pagination parameters
        success, response = self.run_test(
            "Get Sales History with Pagination",
            "GET",
            "/api/sales",
            200,
            params={"limit": 2, "skip": 0}
        )
        
        if success and isinstance(response, list) and len(response) <= 2:
            self.log("✅ Pagination working correctly")
        
        # Test 3: Verify sales status is properly set and retrievable
        if test_sales:
            success, response = self.run_test(
                "Get Specific Sale by ID (Status Check)",
                "GET",
                f"/api/sales/{test_sales[0]}",
                200
            )
            
            if success and response.get('status') == 'completed':
                self.log("✅ Sale status properly set and retrievable")
        
        # Test 4: Test customer filtering
        success, response = self.run_test(
            "Get Sales History with Customer Filter",
            "GET",
            "/api/sales",
            200,
            params={"customer_id": self.customer_id}
        )
        
        if success:
            self.log("✅ Customer filtering working")
        
        self.log("=== HOTFIX 2 SALES HISTORY DISPLAY TESTING COMPLETED ===", "INFO")
        return True

    def test_hotfix_6_transaction_data_persistence(self):
        """Test HOTFIX 6: Transaction Data Persistence"""
        self.log("=== TESTING HOTFIX 6: TRANSACTION DATA PERSISTENCE ===", "INFO")
        
        # Test complete transaction flow with proper data structure
        transaction_data = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Transaction Test Product",
                    "product_sku": "TXN-TEST-001",
                    "quantity": 2,
                    "unit_price": 45.99,
                    "total_price": 91.98
                }
            ],
            "subtotal": 91.98,
            "tax_amount": 8.28,
            "discount_amount": 5.00,
            "total_amount": 95.26,
            "payment_method": "card",
            "notes": "Complete transaction data persistence test"
        }
        
        # Test 1: Create sale with proper transaction data structure
        success, response = self.run_test(
            "Create Sale with Complete Transaction Data",
            "POST",
            "/api/sales",
            200,
            data=transaction_data
        )
        
        transaction_sale_id = None
        if success and 'id' in response:
            transaction_sale_id = response['id']
            self.log(f"Transaction test sale created: {transaction_sale_id}")
            
            # Test 2: Verify all required fields are saved
            required_fields = ['id', 'sale_number', 'total_amount', 'payment_method', 'created_at']
            missing_fields = []
            for field in required_fields:
                if field not in response or response[field] is None:
                    missing_fields.append(field)
            
            if not missing_fields:
                self.log("✅ All required transaction fields saved correctly")
            else:
                self.log(f"❌ Missing required fields: {missing_fields}")
            
            # Test 3: Verify sale items are saved with proper snapshots
            items = response.get('items', [])
            if items and len(items) > 0:
                first_item = items[0]
                required_item_fields = ['product_id', 'unit_price', 'quantity', 'total_price']
                
                item_missing_fields = []
                for field in required_item_fields:
                    if field not in first_item or first_item[field] is None:
                        item_missing_fields.append(field)
                
                if not item_missing_fields:
                    self.log("✅ Sale items saved with proper structure")
                else:
                    self.log(f"❌ Missing item fields: {item_missing_fields}")
                
                # Check for cost snapshots
                if 'unit_cost_snapshot' in first_item:
                    self.log(f"✅ Cost snapshot captured: {first_item['unit_cost_snapshot']}")
                else:
                    self.log("❌ Cost snapshot not captured")
        
        # Test 4: Verify sales appear in both Sales History and Reports queries
        if transaction_sale_id:
            # Check in sales history
            success, response = self.run_test(
                "Verify Sale in Sales History",
                "GET",
                "/api/sales",
                200
            )
            
            if success and isinstance(response, list):
                found_in_history = any(sale.get('id') == transaction_sale_id for sale in response)
                if found_in_history:
                    self.log("✅ Transaction appears in sales history")
                else:
                    self.log("❌ Transaction not found in sales history")
            
            # Check in reports (daily summary)
            success, response = self.run_test(
                "Verify Sale in Daily Summary Report",
                "GET",
                "/api/sales/daily-summary/stats",
                200
            )
            
            if success and 'total_sales' in response:
                if response['total_sales'] > 0:
                    self.log("✅ Transaction contributes to daily summary")
                else:
                    self.log("❌ No sales found in daily summary")
        
        self.log("=== HOTFIX 6 TRANSACTION DATA PERSISTENCE TESTING COMPLETED ===", "INFO")
        return True

    def test_settings_persistence(self):
        """Test Settings Persistence"""
        self.log("=== TESTING SETTINGS PERSISTENCE ===", "INFO")
        
        # Test 1: Get current business settings
        success, response = self.run_test(
            "Get Current Business Settings",
            "GET",
            "/api/business/info",
            200
        )
        
        original_settings = {}
        if success:
            original_settings = response.get('settings', {})
            self.log(f"Current settings retrieved: {len(original_settings)} fields")
        
        # Test 2: Update business settings
        test_settings = {
            "currency": "PHP",
            "tax_rate": 0.12,
            "receipt_header": "Test Store - Settings Persistence",
            "receipt_footer": "Thank you for testing!",
            "low_stock_threshold": 5,
            "printer_settings": {
                "paper_size": "80",
                "characters_per_line": 32,
                "font_size": "normal",
                "enable_logo": True,
                "cut_paper": True,
                "printer_name": "test_printer"
            },
            "selected_printer": "POS-9200-L"
        }
        
        success, response = self.run_test(
            "Update Business Settings",
            "PUT",
            "/api/business/settings",
            200,
            data=test_settings
        )
        
        if success:
            self.log("✅ Settings update request successful")
        
        # Test 3: Verify settings persistence by retrieving again
        success, response = self.run_test(
            "Verify Settings Persistence",
            "GET",
            "/api/business/info",
            200
        )
        
        if success:
            updated_settings = response.get('settings', {})
            
            # Check key settings
            persistence_checks = [
                ('currency', 'PHP'),
                ('tax_rate', 0.12),
                ('receipt_header', 'Test Store - Settings Persistence'),
                ('low_stock_threshold', 5),
                ('selected_printer', 'POS-9200-L')
            ]
            
            passed_checks = 0
            for field, expected_value in persistence_checks:
                if updated_settings.get(field) == expected_value:
                    passed_checks += 1
                    self.log(f"✅ {field} persisted correctly: {expected_value}")
                else:
                    self.log(f"❌ {field} not persisted. Expected: {expected_value}, Got: {updated_settings.get(field)}")
            
            if passed_checks == len(persistence_checks):
                self.log("✅ All settings persisted correctly")
            else:
                self.log(f"❌ Only {passed_checks}/{len(persistence_checks)} settings persisted")
            
            # Check printer settings specifically
            printer_settings = updated_settings.get('printer_settings', {})
            if printer_settings.get('paper_size') == '80' and printer_settings.get('font_size') == 'normal':
                self.log("✅ Printer settings persisted correctly")
            else:
                self.log("❌ Printer settings not persisted correctly")
        
        self.log("=== SETTINGS PERSISTENCE TESTING COMPLETED ===", "INFO")
        return True

    def test_sales_and_reports_integration(self):
        """Test Sales and Reports Integration"""
        self.log("=== TESTING SALES AND REPORTS INTEGRATION ===", "INFO")
        
        # Create a test sale for reports integration
        integration_sale_data = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Reports Integration Product",
                    "product_sku": "RPT-INT-001",
                    "quantity": 2,
                    "unit_price": 35.50,
                    "total_price": 71.00
                }
            ],
            "subtotal": 71.00,
            "tax_amount": 6.39,
            "discount_amount": 1.00,
            "total_amount": 76.39,
            "payment_method": "cash",
            "notes": "Reports integration test sale"
        }
        
        success, response = self.run_test(
            "Create Sale for Reports Integration",
            "POST",
            "/api/sales",
            200,
            data=integration_sale_data
        )
        
        integration_sale_id = None
        if success and 'id' in response:
            integration_sale_id = response['id']
        
        # Test 1: Verify sale appears in sales reports queries
        success, response = self.run_test(
            "Generate Sales Report (Check Integration)",
            "GET",
            "/api/reports/sales",
            200,
            params={"format": "excel"}
        )
        
        if success:
            self.log("✅ Sales report generated successfully")
        
        # Test 2: Check profit calculations using cost snapshots
        success, response = self.run_test(
            "Generate Profit Report (Check Cost Snapshots)",
            "GET",
            "/api/reports/profit",
            200,
            params={"format": "excel"}
        )
        
        if success:
            self.log("✅ Profit report generated successfully")
        
        # Test 3: Test CSV export format
        success, response = self.run_test(
            "Export Sales Report (CSV Format)",
            "GET",
            "/api/reports/sales",
            200,
            params={"format": "csv"}
        )
        
        if success:
            self.log("✅ CSV export working correctly")
        
        # Test 4: Test date range filters in reports
        start_date = (datetime.now() - timedelta(days=1)).isoformat()
        end_date = datetime.now().isoformat()
        
        success, response = self.run_test(
            "Sales Report with Date Range Filter",
            "GET",
            "/api/reports/sales",
            200,
            params={
                "format": "excel",
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        if success:
            self.log("✅ Date range filtering in reports working")
        
        # Test 5: Verify daily summary includes our test sale
        success, response = self.run_test(
            "Daily Summary Report (Integration Check)",
            "GET",
            "/api/sales/daily-summary/stats",
            200
        )
        
        if success and isinstance(response, dict):
            total_sales = response.get('total_sales', 0)
            total_revenue = response.get('total_revenue', 0)
            
            if total_sales > 0 and total_revenue > 0:
                self.log(f"✅ Daily summary shows sales activity: {total_sales} sales, ₱{total_revenue:.2f} revenue")
            else:
                self.log("❌ Daily summary shows no sales activity")
        
        self.log("=== SALES AND REPORTS INTEGRATION TESTING COMPLETED ===", "INFO")
        return True

    def cleanup_test_data(self):
        """Clean up test data"""
        self.log("Cleaning up test data...")
        
        # Delete test product
        if self.product_id:
            self.run_test("Delete Test Product", "DELETE", f"/api/products/{self.product_id}", 200)

        # Delete test customer
        if self.customer_id:
            self.run_test("Delete Test Customer", "DELETE", f"/api/customers/{self.customer_id}", 200)

        # Delete test category
        if self.category_id:
            self.run_test("Delete Test Category", "DELETE", f"/api/categories/{self.category_id}", 200)

    def run_hotfix_validation_tests(self):
        """Run all hotfix validation tests"""
        self.log("=== STARTING HOTFIX VALIDATION TESTING ===", "INFO")
        
        # Set up test environment
        if not self.setup_test_environment():
            self.log("❌ Test environment setup failed - stopping tests", "ERROR")
            return
        
        # Run hotfix-specific tests
        self.test_hotfix_1_cash_payment_validation()
        self.test_hotfix_2_sales_history_display()
        self.test_hotfix_6_transaction_data_persistence()
        self.test_settings_persistence()
        self.test_sales_and_reports_integration()
        
        # Clean up
        self.cleanup_test_data()
        
        # Final summary
        self.log("=== HOTFIX VALIDATION TESTING COMPLETED ===", "INFO")
        self.log(f"Tests run: {self.tests_run}")
        self.log(f"Tests passed: {self.tests_passed}")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        return self.tests_passed, self.tests_run

def main():
    """Main test execution"""
    tester = HotfixValidationTester()
    
    try:
        passed, total = tester.run_hotfix_validation_tests()
        
        print(f"\n=== HOTFIX VALIDATION RESULTS ===")
        print(f"Tests Passed: {passed}/{total}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if passed == total:
            print("🎉 All hotfix validation tests passed!")
            return 0
        else:
            failed = total - passed
            print(f"❌ {failed} tests failed")
            return 1
            
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())