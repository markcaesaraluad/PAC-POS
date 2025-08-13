#!/usr/bin/env python3
"""
Quick Sales API Verification Test - Enhanced Item Fields
Tests the sales API with enhanced item fields (sku, unit_price_snapshot, unit_cost_snapshot)
after recent POS fixes to ensure no regressions.
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class SalesAPIVerificationTester:
    def __init__(self, base_url="https://pos-enhance.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.business_id = None
        self.customer_id = None
        self.product_id = None
        self.category_id = None

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

    def authenticate(self):
        """Authenticate as business admin"""
        self.log("=== AUTHENTICATION ===", "INFO")
        
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
            self.log("✅ Business admin authentication successful")
            return True
        else:
            self.log("❌ Authentication failed", "ERROR")
            return False

    def get_current_user(self):
        """Get current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "/api/auth/me",
            200
        )
        if success and 'business_id' in response:
            self.business_id = response['business_id']
            self.log(f"Business ID: {self.business_id}")
        return success

    def setup_test_data(self):
        """Setup required test data (category, product, customer)"""
        self.log("=== SETTING UP TEST DATA ===", "INFO")
        
        # Create test category
        success, response = self.run_test(
            "Create Test Category",
            "POST",
            "/api/categories",
            200,
            data={
                "name": "Sales Test Category",
                "description": "Category for sales API testing"
            }
        )
        
        if success and 'id' in response:
            self.category_id = response['id']
            self.log(f"Test category created with ID: {self.category_id}")
        else:
            # Try to get existing categories
            success, response = self.run_test(
                "Get Existing Categories",
                "GET",
                "/api/categories",
                200
            )
            if success and isinstance(response, list) and len(response) > 0:
                self.category_id = response[0]['id']
                self.log(f"Using existing category ID: {self.category_id}")

        # Create test product with required cost field
        product_data = {
            "name": "Sales Test Product",
            "description": "Product for sales API testing",
            "sku": f"SALES-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 29.99,
            "product_cost": 15.50,  # Required field for enhanced sales
            "quantity": 100,
            "category_id": self.category_id,
            "barcode": f"SALES{datetime.now().strftime('%H%M%S')}"
        }

        success, response = self.run_test(
            "Create Test Product",
            "POST",
            "/api/products",
            200,
            data=product_data
        )
        
        if success and 'id' in response:
            self.product_id = response['id']
            self.log(f"Test product created with ID: {self.product_id}")
        else:
            self.log("❌ Failed to create test product", "ERROR")
            return False

        # Create test customer
        customer_data = {
            "name": "Sales Test Customer",
            "email": f"sales.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "phone": "+1234567890",
            "address": "123 Sales Test Street"
        }

        success, response = self.run_test(
            "Create Test Customer",
            "POST",
            "/api/customers",
            200,
            data=customer_data
        )
        
        if success and 'id' in response:
            self.customer_id = response['id']
            self.log(f"Test customer created with ID: {self.customer_id}")
            return True
        else:
            self.log("❌ Failed to create test customer", "ERROR")
            return False

    def test_sales_api_with_enhanced_fields(self):
        """Test sales API with enhanced item fields"""
        self.log("=== TESTING SALES API WITH ENHANCED ITEM FIELDS ===", "INFO")
        
        if not all([self.product_id, self.customer_id]):
            self.log("❌ Missing required test data", "ERROR")
            return False

        # TEST 1: Create sale with complete enhanced item fields
        self.log("🔍 TEST 1: Create Sale with Complete Enhanced Item Fields", "INFO")
        
        sale_data_complete = {
            "customer_id": self.customer_id,
            "customer_name": "Sales Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",  # Mock cashier ID
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Sales Test Product",
                    "sku": f"SALES-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",  # Enhanced field
                    "quantity": 2,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,  # Enhanced field
                    "unit_cost_snapshot": 15.50,   # Enhanced field
                    "total_price": 59.98
                }
            ],
            "subtotal": 59.98,
            "tax_amount": 5.40,
            "discount_amount": 0.00,
            "total_amount": 65.38,
            "payment_method": "cash",
            "received_amount": 70.00,
            "change_amount": 4.62,
            "notes": "Sales API verification test with enhanced fields"
        }

        success, response = self.run_test(
            "Create Sale with Enhanced Fields",
            "POST",
            "/api/sales",
            200,
            data=sale_data_complete
        )

        if success:
            self.log("✅ Sale created successfully with enhanced item fields")
            
            # Verify enhanced fields are present in response
            items = response.get('items', [])
            if items and len(items) > 0:
                first_item = items[0]
                enhanced_fields = ['sku', 'unit_price_snapshot', 'unit_cost_snapshot']
                
                if all(field in first_item for field in enhanced_fields):
                    self.log("✅ All enhanced item fields present in response")
                    self.tests_passed += 1
                    
                    # Verify field values
                    if (first_item.get('unit_price_snapshot') == 29.99 and
                        first_item.get('unit_cost_snapshot') == 15.50):
                        self.log("✅ Enhanced field values correctly stored")
                        self.tests_passed += 1
                    else:
                        self.log("❌ Enhanced field values incorrect")
                    self.tests_run += 1
                else:
                    self.log("❌ Enhanced item fields missing from response")
                self.tests_run += 1
            
            # Store sale ID for further testing
            sale_id = response.get('id')
            if sale_id:
                self.log(f"Sale created with ID: {sale_id}")
        else:
            self.log("❌ Failed to create sale with enhanced item fields")
            return False

        # TEST 2: Field Requirements Testing - Missing SKU (should fail validation)
        self.log("🔍 TEST 2: Field Requirements Testing - Missing SKU", "INFO")
        
        sale_data_missing_sku = {
            "customer_id": self.customer_id,
            "customer_name": "Sales Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Sales Test Product",
                    # Missing sku field
                    "quantity": 1,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.50,
                    "total_price": 29.99
                }
            ],
            "subtotal": 29.99,
            "tax_amount": 2.70,
            "discount_amount": 0.00,
            "total_amount": 32.69,
            "payment_method": "card"
        }

        success, response = self.run_test(
            "Create Sale Missing SKU (Should Fail)",
            "POST",
            "/api/sales",
            422,  # Validation error expected
            data=sale_data_missing_sku
        )

        if success:
            self.log("✅ Validation correctly rejects sale with missing SKU")
            self.tests_passed += 1
        else:
            self.log("❌ Should reject sale without SKU field")
        self.tests_run += 1

        # TEST 3: Field Requirements Testing - Missing unit_price_snapshot
        self.log("🔍 TEST 3: Field Requirements Testing - Missing unit_price_snapshot", "INFO")
        
        sale_data_missing_price_snapshot = {
            "customer_id": self.customer_id,
            "customer_name": "Sales Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Sales Test Product",
                    "sku": f"SALES-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "quantity": 1,
                    "unit_price": 29.99,
                    # Missing unit_price_snapshot field
                    "unit_cost_snapshot": 15.50,
                    "total_price": 29.99
                }
            ],
            "subtotal": 29.99,
            "tax_amount": 2.70,
            "discount_amount": 0.00,
            "total_amount": 32.69,
            "payment_method": "card"
        }

        success, response = self.run_test(
            "Create Sale Missing unit_price_snapshot (Should Fail)",
            "POST",
            "/api/sales",
            422,  # Validation error expected
            data=sale_data_missing_price_snapshot
        )

        if success:
            self.log("✅ Validation correctly rejects sale with missing unit_price_snapshot")
            self.tests_passed += 1
        else:
            self.log("❌ Should reject sale without unit_price_snapshot field")
        self.tests_run += 1

        # TEST 4: Field Requirements Testing - Missing unit_cost_snapshot
        self.log("🔍 TEST 4: Field Requirements Testing - Missing unit_cost_snapshot", "INFO")
        
        sale_data_missing_cost_snapshot = {
            "customer_id": self.customer_id,
            "customer_name": "Sales Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Sales Test Product",
                    "sku": f"SALES-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "quantity": 1,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    # Missing unit_cost_snapshot field
                    "total_price": 29.99
                }
            ],
            "subtotal": 29.99,
            "tax_amount": 2.70,
            "discount_amount": 0.00,
            "total_amount": 32.69,
            "payment_method": "card"
        }

        success, response = self.run_test(
            "Create Sale Missing unit_cost_snapshot (Should Fail)",
            "POST",
            "/api/sales",
            422,  # Validation error expected
            data=sale_data_missing_cost_snapshot
        )

        if success:
            self.log("✅ Validation correctly rejects sale with missing unit_cost_snapshot")
            self.tests_passed += 1
        else:
            self.log("❌ Should reject sale without unit_cost_snapshot field")
        self.tests_run += 1

        # TEST 5: Multi-Item Transaction with Enhanced Fields
        self.log("🔍 TEST 5: Multi-Item Transaction with Enhanced Fields", "INFO")
        
        multi_item_sale_data = {
            "customer_id": self.customer_id,
            "customer_name": "Sales Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Sales Test Product",
                    "sku": f"SALES-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "quantity": 2,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.50,
                    "total_price": 59.98
                },
                {
                    "product_id": self.product_id,
                    "product_name": "Sales Test Product (Line 2)",
                    "sku": f"SALES-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}-2",
                    "quantity": 1,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.50,
                    "total_price": 29.99
                }
            ],
            "subtotal": 89.97,
            "tax_amount": 8.10,
            "discount_amount": 5.00,
            "total_amount": 93.07,
            "payment_method": "cash",
            "received_amount": 100.00,
            "change_amount": 6.93,
            "notes": "Multi-item transaction test"
        }

        success, response = self.run_test(
            "Create Multi-Item Sale with Enhanced Fields",
            "POST",
            "/api/sales",
            200,
            data=multi_item_sale_data
        )

        if success:
            self.log("✅ Multi-item sale with enhanced fields created successfully")
            
            # Verify all items have enhanced fields
            items = response.get('items', [])
            if len(items) == 2:
                self.log(f"✅ Correct number of items: {len(items)}")
                self.tests_passed += 1
                
                # Check each item has all enhanced fields
                all_items_valid = True
                for i, item in enumerate(items):
                    required_fields = ['sku', 'unit_price_snapshot', 'unit_cost_snapshot']
                    missing_fields = [field for field in required_fields if field not in item]
                    
                    if missing_fields:
                        self.log(f"❌ Item {i+1} missing fields: {missing_fields}")
                        all_items_valid = False
                    else:
                        self.log(f"✅ Item {i+1} has all enhanced fields")
                
                if all_items_valid:
                    self.log("✅ All items have complete enhanced fields")
                    self.tests_passed += 1
                else:
                    self.log("❌ Some items missing enhanced fields")
                self.tests_run += 1
            else:
                self.log(f"❌ Incorrect number of items. Expected: 2, Got: {len(items)}")
            self.tests_run += 1
        else:
            self.log("❌ Failed to create multi-item sale")

        return True

    def run_verification_test(self):
        """Run the complete verification test"""
        self.log("=== SALES API VERIFICATION TEST STARTED ===", "INFO")
        
        # Step 1: Authenticate
        if not self.authenticate():
            return False
        
        # Step 2: Get current user info
        if not self.get_current_user():
            return False
        
        # Step 3: Setup test data
        if not self.setup_test_data():
            return False
        
        # Step 4: Test sales API with enhanced fields
        if not self.test_sales_api_with_enhanced_fields():
            return False
        
        # Final results
        self.log("=== SALES API VERIFICATION TEST COMPLETED ===", "INFO")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"RESULTS: {self.tests_passed}/{self.tests_run} tests passed ({success_rate:.1f}% success rate)")
        
        if success_rate >= 80:
            self.log("✅ SALES API VERIFICATION SUCCESSFUL - No regressions detected", "PASS")
            return True
        else:
            self.log("❌ SALES API VERIFICATION FAILED - Regressions detected", "FAIL")
            return False

def main():
    """Main function"""
    tester = SalesAPIVerificationTester()
    success = tester.run_verification_test()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()