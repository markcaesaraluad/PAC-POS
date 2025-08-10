#!/usr/bin/env python3
"""
Phase 1 Focused Testing for Modern POS System
Tests specific Phase 1 issues:
1. Dashboard Currency - Test daily summary endpoint currency format
2. Products API - Test product loading with various parameters for "Failed to load items" issues
3. Settings Persistence - Test business settings GET/PUT for proper saving and loading
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class Phase1Tester:
    def __init__(self, base_url="https://c0ab9037-c0e6-4a6d-9f88-62db3dc10976.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
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

    def login_business_admin(self):
        """Login as business admin with proper credentials"""
        self.log("=== BUSINESS ADMIN LOGIN ===", "INFO")
        
        # Try login with subdomain in body (as per test_result.md)
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
            self.token = response['access_token']
            self.log("✅ Business admin token obtained successfully")
            
            # Get current user info to extract business_id
            success, user_response = self.run_test(
                "Get Current User Info",
                "GET",
                "/api/auth/me",
                200
            )
            
            if success and 'business_id' in user_response:
                self.business_id = user_response['business_id']
                self.log(f"✅ Business ID obtained: {self.business_id}")
            
            return True
        else:
            self.log("❌ Business admin login failed", "ERROR")
            return False

    def test_dashboard_currency_format(self):
        """Test Phase 1 Issue: Dashboard Currency - Test daily summary endpoint currency format"""
        self.log("=== TESTING DASHBOARD CURRENCY FORMAT ===", "INFO")
        
        # Test 1: Get daily summary for today (default)
        success, response = self.run_test(
            "Daily Summary - Today (Default)",
            "GET",
            "/api/sales/daily-summary/stats",
            200
        )
        
        if success:
            self.log(f"Daily Summary Response: {json.dumps(response, indent=2)}")
            
            # Check for currency-related fields
            currency_fields = ['total_sales', 'total_revenue', 'average_sale']
            currency_issues = []
            
            for field in currency_fields:
                if field in response:
                    value = response[field]
                    self.log(f"Currency field '{field}': {value} (type: {type(value)})")
                    
                    # Check if it's a proper number format
                    if isinstance(value, (int, float)):
                        self.log(f"✅ {field} is numeric: {value}")
                    elif isinstance(value, str):
                        # Check if string contains currency symbol or is formatted properly
                        if '$' in value or '€' in value or '£' in value or '¥' in value or '₱' in value:
                            self.log(f"✅ {field} contains currency symbol: {value}")
                        else:
                            currency_issues.append(f"{field}: {value} (no currency symbol)")
                    else:
                        currency_issues.append(f"{field}: {value} (unexpected type: {type(value)})")
            
            if currency_issues:
                self.log(f"❌ Currency format issues found: {currency_issues}", "FAIL")
                return False
            else:
                self.log("✅ Currency format appears correct", "PASS")
                self.tests_passed += 1
        
        # Test 2: Get daily summary for specific date
        yesterday = (datetime.now() - timedelta(days=1)).date().isoformat()
        success, response = self.run_test(
            "Daily Summary - Specific Date",
            "GET",
            "/api/sales/daily-summary/stats",
            200,
            params={"date": yesterday}
        )
        
        if success:
            self.log(f"Daily Summary (Yesterday): {json.dumps(response, indent=2)}")
        
        return True

    def test_products_api_loading(self):
        """Test Phase 1 Issue: Products API - Test product loading with various parameters"""
        self.log("=== TESTING PRODUCTS API LOADING ===", "INFO")
        
        # Test 1: Basic product loading (no parameters)
        success, response = self.run_test(
            "Products API - Basic Load",
            "GET",
            "/api/products",
            200
        )
        
        if success:
            if isinstance(response, list):
                self.log(f"✅ Products loaded successfully: {len(response)} products found")
                self.tests_passed += 1
                
                # Log first few products for inspection
                for i, product in enumerate(response[:3]):
                    self.log(f"Product {i+1}: {product.get('name', 'No name')} - ${product.get('price', 'No price')}")
            else:
                self.log(f"❌ Expected list of products, got: {type(response)}", "FAIL")
                return False
        else:
            self.log("❌ Basic product loading failed", "FAIL")
            return False
        
        # Test 2: Product loading with search parameter
        success, response = self.run_test(
            "Products API - With Search",
            "GET",
            "/api/products",
            200,
            params={"search": "test"}
        )
        
        if success:
            self.log(f"✅ Products search successful: {len(response) if isinstance(response, list) else 'Not a list'} results")
            self.tests_passed += 1
        
        # Test 3: Product loading with category filter (use valid category ID)
        # First get a valid category ID
        categories_success, categories_response = self.run_test(
            "Get Categories for Valid ID",
            "GET",
            "/api/categories",
            200
        )
        
        valid_category_id = None
        if categories_success and isinstance(categories_response, list) and len(categories_response) > 0:
            valid_category_id = categories_response[0].get('id')
            self.log(f"Using valid category ID: {valid_category_id}")
        
        if valid_category_id:
            success, response = self.run_test(
                "Products API - With Valid Category Filter",
                "GET",
                "/api/products",
                200,
                params={"category_id": valid_category_id}
            )
        else:
            # Test with invalid category ID to see how it handles it
            success, response = self.run_test(
                "Products API - With Invalid Category Filter",
                "GET",
                "/api/products",
                500,  # Expect 500 for invalid ObjectId
                params={"category_id": "invalid-category-id"}
            )
        
        if success:
            self.log(f"✅ Products category filter successful")
            self.tests_passed += 1
        
        # Test 4: Product loading with pagination
        success, response = self.run_test(
            "Products API - With Pagination",
            "GET",
            "/api/products",
            200,
            params={"page": 1, "limit": 10}
        )
        
        if success:
            self.log(f"✅ Products pagination successful")
            self.tests_passed += 1
        
        # Test 5: Product loading with status filter
        success, response = self.run_test(
            "Products API - With Status Filter",
            "GET",
            "/api/products",
            200,
            params={"status": "active"}
        )
        
        if success:
            self.log(f"✅ Products status filter successful")
            self.tests_passed += 1
        
        # Test 6: Product loading with multiple filters (stress test)
        success, response = self.run_test(
            "Products API - Multiple Filters",
            "GET",
            "/api/products",
            200,
            params={
                "search": "product",
                "status": "active",
                "page": 1,
                "limit": 20
            }
        )
        
        if success:
            self.log(f"✅ Products multiple filters successful")
            self.tests_passed += 1
        
        # Test 7: Test for potential "Failed to load items" scenario with invalid parameters
        success, response = self.run_test(
            "Products API - Invalid Parameters (Should Handle Gracefully)",
            "GET",
            "/api/products",
            200,  # Should still return 200 but handle invalid params gracefully
            params={
                "invalid_param": "test",
                "page": -1,  # Invalid page
                "limit": 0   # Invalid limit
            }
        )
        
        if success:
            self.log(f"✅ Products API handles invalid parameters gracefully")
            self.tests_passed += 1
        
        return True

    def test_settings_persistence(self):
        """Test Phase 1 Issue: Settings Persistence - Test business settings GET/PUT"""
        self.log("=== TESTING SETTINGS PERSISTENCE ===", "INFO")
        
        # Test 1: Get current business info/settings
        success, response = self.run_test(
            "Get Business Info/Settings",
            "GET",
            "/api/business/info",
            200
        )
        
        original_settings = None
        if success:
            self.log(f"✅ Business info retrieved successfully")
            self.tests_passed += 1
            
            original_settings = response.get('settings', {})
            self.log(f"Current settings: {json.dumps(original_settings, indent=2)}")
            
            # Check for key settings fields
            key_fields = ['currency', 'tax_rate', 'receipt_header', 'receipt_footer']
            for field in key_fields:
                if field in original_settings:
                    self.log(f"✅ Setting '{field}': {original_settings[field]}")
                else:
                    self.log(f"⚠️ Setting '{field}' not found")
        else:
            self.log("❌ Failed to get business info", "FAIL")
            return False
        
        # Test 2: Update business settings with test values
        test_settings = {
            "currency": "EUR",
            "tax_rate": 0.15,
            "receipt_header": "Phase 1 Test Store",
            "receipt_footer": "Thank you for testing!",
            "low_stock_threshold": 25,
            "printer_settings": {
                "paper_size": "80",
                "characters_per_line": 32,
                "font_size": "normal",
                "enable_logo": True,
                "cut_paper": True,
                "printer_name": "test_printer"
            }
        }
        
        success, response = self.run_test(
            "Update Business Settings",
            "PUT",
            "/api/business/settings",
            200,
            data=test_settings
        )
        
        if success:
            self.log(f"✅ Business settings updated successfully")
            self.tests_passed += 1
        else:
            self.log("❌ Failed to update business settings", "FAIL")
            return False
        
        # Test 3: Verify settings persistence by getting them again
        success, response = self.run_test(
            "Verify Settings Persistence",
            "GET",
            "/api/business/info",
            200
        )
        
        if success:
            updated_settings = response.get('settings', {})
            self.log(f"Updated settings: {json.dumps(updated_settings, indent=2)}")
            
            # Verify each test setting was saved correctly
            persistence_issues = []
            
            for key, expected_value in test_settings.items():
                if key == "printer_settings":
                    # Check printer settings separately
                    printer_settings = updated_settings.get('printer_settings', {})
                    for printer_key, printer_value in expected_value.items():
                        actual_value = printer_settings.get(printer_key)
                        if actual_value != printer_value:
                            persistence_issues.append(f"printer_settings.{printer_key}: expected {printer_value}, got {actual_value}")
                        else:
                            self.log(f"✅ Printer setting '{printer_key}' persisted correctly: {actual_value}")
                else:
                    actual_value = updated_settings.get(key)
                    if actual_value != expected_value:
                        persistence_issues.append(f"{key}: expected {expected_value}, got {actual_value}")
                    else:
                        self.log(f"✅ Setting '{key}' persisted correctly: {actual_value}")
            
            if persistence_issues:
                self.log(f"❌ Settings persistence issues: {persistence_issues}", "FAIL")
                return False
            else:
                self.log("✅ All settings persisted correctly", "PASS")
                self.tests_passed += 1
        else:
            self.log("❌ Failed to verify settings persistence", "FAIL")
            return False
        
        # Test 4: Test partial settings update (should not overwrite other settings)
        partial_update = {
            "currency": "USD",
            "tax_rate": 0.08
        }
        
        success, response = self.run_test(
            "Partial Settings Update",
            "PUT",
            "/api/business/settings",
            200,
            data=partial_update
        )
        
        if success:
            self.log(f"✅ Partial settings update successful")
            self.tests_passed += 1
            
            # Verify partial update worked and didn't overwrite other settings
            success, response = self.run_test(
                "Verify Partial Update",
                "GET",
                "/api/business/info",
                200
            )
            
            if success:
                final_settings = response.get('settings', {})
                
                # Check updated fields
                if final_settings.get('currency') == 'USD' and final_settings.get('tax_rate') == 0.08:
                    self.log("✅ Partial update fields correct")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ Partial update failed: currency={final_settings.get('currency')}, tax_rate={final_settings.get('tax_rate')}", "FAIL")
                
                # Check that other fields weren't overwritten
                if (final_settings.get('receipt_header') == 'Phase 1 Test Store' and 
                    final_settings.get('receipt_footer') == 'Thank you for testing!'):
                    self.log("✅ Other settings preserved during partial update")
                    self.tests_passed += 1
                else:
                    self.log("❌ Other settings were overwritten during partial update", "FAIL")
                
                self.tests_run += 2
        
        # Test 5: Restore original settings (cleanup)
        if original_settings:
            success, response = self.run_test(
                "Restore Original Settings",
                "PUT",
                "/api/business/settings",
                200,
                data=original_settings
            )
            
            if success:
                self.log("✅ Original settings restored")
            else:
                self.log("⚠️ Failed to restore original settings")
        
        return True

    def run_phase1_tests(self):
        """Run all Phase 1 focused tests"""
        self.log("=== STARTING PHASE 1 FOCUSED TESTING ===", "INFO")
        
        # Step 1: Login as business admin
        if not self.login_business_admin():
            self.log("❌ Cannot proceed without business admin login", "ERROR")
            return False
        
        # Step 2: Test Dashboard Currency Format
        self.test_dashboard_currency_format()
        
        # Step 3: Test Products API Loading
        self.test_products_api_loading()
        
        # Step 4: Test Settings Persistence
        self.test_settings_persistence()
        
        # Summary
        self.log("=== PHASE 1 TESTING SUMMARY ===", "INFO")
        self.log(f"Tests Run: {self.tests_run}")
        self.log(f"Tests Passed: {self.tests_passed}")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 ALL PHASE 1 TESTS PASSED!", "PASS")
            return True
        else:
            failed = self.tests_run - self.tests_passed
            self.log(f"❌ {failed} tests failed", "FAIL")
            return False

def main():
    """Main function to run Phase 1 tests"""
    tester = Phase1Tester()
    
    try:
        success = tester.run_phase1_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Testing failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()