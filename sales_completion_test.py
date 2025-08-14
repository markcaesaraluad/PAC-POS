#!/usr/bin/env python3
"""
URGENT: Sales Completion Failure Investigation
Test the sales creation API to identify why users are getting "failed to complete sales" error messages.
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class SalesCompletionTester:
    def __init__(self, base_url="https://pos-upgrade-1.preview.emergentagent.com"):
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

    def setup_authentication(self):
        """Setup authentication and get required IDs"""
        # Login as business admin
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
        
        if not success or 'access_token' not in response:
            self.log("❌ Failed to authenticate", "ERROR")
            return False
        
        self.token = response['access_token']
        
        # Get current user info
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "/api/auth/me",
            200
        )
        
        if success and 'business_id' in response:
            self.business_id = response['business_id']
        
        # Get existing products and customers
        success, response = self.run_test(
            "Get Products",
            "GET",
            "/api/products",
            200
        )
        
        if success and len(response) > 0:
            self.product_id = response[0]['id']
            self.log(f"Using existing product ID: {self.product_id}")
        
        success, response = self.run_test(
            "Get Customers",
            "GET",
            "/api/customers",
            200
        )
        
        if success and len(response) > 0:
            self.customer_id = response[0]['id']
            self.log(f"Using existing customer ID: {self.customer_id}")
        
        return True

    def test_sales_completion_failure_investigation(self):
        """
        URGENT: Investigate Sales Completion Failure
        Test the sales creation API to identify why users are getting "failed to complete sales" error messages.
        """
        self.log("=== URGENT: SALES COMPLETION FAILURE INVESTIGATION ===", "INFO")
        
        if not self.product_id or not self.customer_id:
            self.log("❌ Cannot test - missing product or customer data", "ERROR")
            return False
        
        # TEST 1: Basic Sales Creation API Test
        self.log("🔍 TEST 1: Basic Sales Creation API Test", "INFO")
        
        basic_sale_data = {
            "customer_id": self.customer_id,
            "customer_name": "Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",  # Mock cashier ID
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-SKU-001",
                    "quantity": 1,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.00,
                    "total_price": 29.99
                }
            ],
            "subtotal": 29.99,
            "tax_amount": 2.70,
            "discount_amount": 0.00,
            "total_amount": 32.69,
            "payment_method": "cash",
            "received_amount": 35.00,
            "change_amount": 2.31,
            "notes": "Basic sale test"
        }

        success, response = self.run_test(
            "Basic Sales Creation",
            "POST",
            "/api/sales",
            200,
            data=basic_sale_data
        )

        if not success:
            self.log("❌ CRITICAL: Basic sales creation failed", "ERROR")
            return False
        else:
            self.log("✅ Basic sales creation successful", "PASS")
        
        # TEST 2: Test with Enhanced Fields (payment_ref_code, downpayment_amount, balance_due)
        self.log("🔍 TEST 2: Sales with Enhanced Fields", "INFO")
        
        enhanced_sale_data = {
            "customer_id": self.customer_id,
            "customer_name": "Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-SKU-002",
                    "quantity": 2,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.00,
                    "total_price": 59.98
                }
            ],
            "subtotal": 59.98,
            "tax_amount": 5.40,
            "discount_amount": 0.00,
            "total_amount": 65.38,
            "payment_method": "ewallet",
            "payment_ref_code": "EWALLET-REF-123456789",
            "received_amount": 65.38,
            "change_amount": 0.00,
            "notes": "Enhanced fields test"
        }

        success, response = self.run_test(
            "Sales with Enhanced Fields (payment_ref_code)",
            "POST",
            "/api/sales",
            200,
            data=enhanced_sale_data
        )

        if success:
            self.log("✅ Sales with enhanced fields successful", "PASS")
            # Verify payment_ref_code is stored
            if response.get("payment_ref_code") == "EWALLET-REF-123456789":
                self.log("✅ Payment reference code correctly stored", "PASS")
                self.tests_passed += 1
            else:
                self.log("❌ Payment reference code not stored correctly", "FAIL")
            self.tests_run += 1
        else:
            self.log("❌ Sales with enhanced fields failed", "FAIL")
        
        # TEST 3: Test Ongoing Sale with Downpayment
        self.log("🔍 TEST 3: Ongoing Sale with Downpayment", "INFO")
        
        ongoing_sale_data = {
            "customer_id": self.customer_id,
            "customer_name": "Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-SKU-003",
                    "quantity": 3,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.00,
                    "total_price": 89.97
                }
            ],
            "subtotal": 89.97,
            "tax_amount": 8.10,
            "discount_amount": 0.00,
            "total_amount": 98.07,
            "payment_method": "cash",
            "status": "ongoing",
            "downpayment_amount": 50.00,
            "balance_due": 48.07,
            "received_amount": 50.00,
            "change_amount": 0.00,
            "notes": "Ongoing sale with downpayment"
        }

        success, response = self.run_test(
            "Ongoing Sale with Downpayment",
            "POST",
            "/api/sales",
            200,
            data=ongoing_sale_data
        )

        if success:
            self.log("✅ Ongoing sale with downpayment successful", "PASS")
            # Verify downpayment fields are stored
            if (response.get("status") == "ongoing" and 
                response.get("downpayment_amount") == 50.00 and
                response.get("balance_due") == 48.07):
                self.log("✅ Downpayment fields correctly stored", "PASS")
                self.tests_passed += 1
            else:
                self.log("❌ Downpayment fields not stored correctly", "FAIL")
            self.tests_run += 1
        else:
            self.log("❌ Ongoing sale with downpayment failed", "FAIL")
        
        # TEST 4: Test Different Sale Types
        self.log("🔍 TEST 4: Different Sale Types", "INFO")
        
        sale_types = [
            ("cash", "Regular Cash Sale"),
            ("card", "Card Payment Sale"),
            ("digital_wallet", "Digital Wallet Sale"),
            ("bank_transfer", "Bank Transfer Sale")
        ]
        
        for payment_method, description in sale_types:
            sale_data = {
                "customer_id": self.customer_id,
                "customer_name": "Test Customer",
                "cashier_id": "507f1f77bcf86cd799439011",
                "cashier_name": "admin@printsandcuts.com",
                "items": [
                    {
                        "product_id": self.product_id,
                        "product_name": "Test Product",
                        "sku": f"TEST-{payment_method.upper()}-001",
                        "quantity": 1,
                        "unit_price": 19.99,
                        "unit_price_snapshot": 19.99,
                        "unit_cost_snapshot": 10.00,
                        "total_price": 19.99
                    }
                ],
                "subtotal": 19.99,
                "tax_amount": 1.80,
                "discount_amount": 0.00,
                "total_amount": 21.79,
                "payment_method": payment_method,
                "received_amount": 25.00 if payment_method == "cash" else 21.79,
                "change_amount": 3.21 if payment_method == "cash" else 0.00,
                "notes": f"Test {description}"
            }
            
            if payment_method in ["digital_wallet", "bank_transfer"]:
                sale_data["payment_ref_code"] = f"{payment_method.upper()}-REF-{datetime.now().strftime('%Y%m%d%H%M%S')}"

            success, response = self.run_test(
                f"{description}",
                "POST",
                "/api/sales",
                200,
                data=sale_data
            )

            if success:
                self.log(f"✅ {description} successful", "PASS")
            else:
                self.log(f"❌ {description} failed", "FAIL")
        
        # TEST 5: Check Validation Errors
        self.log("🔍 TEST 5: Validation Error Testing", "INFO")
        
        # Test missing required fields
        invalid_sale_data = {
            "customer_id": self.customer_id,
            "customer_name": "Test Customer",
            # Missing cashier_id and cashier_name
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-INVALID-001",
                    "quantity": 1,
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.00,
                    "total_price": 29.99
                }
            ],
            "subtotal": 29.99,
            "tax_amount": 2.70,
            "total_amount": 32.69,
            "payment_method": "cash"
        }

        success, response = self.run_test(
            "Sales with Missing Required Fields (Should Fail)",
            "POST",
            "/api/sales",
            422,  # Validation error expected
            data=invalid_sale_data
        )

        if success:
            self.log("✅ Validation correctly rejects invalid sale data", "PASS")
            self.tests_passed += 1
        else:
            self.log("❌ Validation should reject invalid sale data", "FAIL")
        self.tests_run += 1
        
        # TEST 6: Test Product Stock Validation
        self.log("🔍 TEST 6: Product Stock Validation", "INFO")
        
        # Try to sell more than available stock
        stock_test_sale_data = {
            "customer_id": self.customer_id,
            "customer_name": "Test Customer",
            "cashier_id": "507f1f77bcf86cd799439011",
            "cashier_name": "admin@printsandcuts.com",
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "sku": "TEST-STOCK-001",
                    "quantity": 9999,  # Excessive quantity
                    "unit_price": 29.99,
                    "unit_price_snapshot": 29.99,
                    "unit_cost_snapshot": 15.00,
                    "total_price": 299990.01
                }
            ],
            "subtotal": 299990.01,
            "tax_amount": 26999.10,
            "total_amount": 326989.11,
            "payment_method": "cash",
            "received_amount": 330000.00,
            "change_amount": 3010.89,
            "notes": "Stock validation test"
        }

        success, response = self.run_test(
            "Sales with Insufficient Stock (Should Fail)",
            "POST",
            "/api/sales",
            400,  # Bad request expected for insufficient stock
            data=stock_test_sale_data
        )

        if success:
            self.log("✅ Stock validation correctly prevents overselling", "PASS")
            self.tests_passed += 1
        else:
            self.log("❌ Stock validation should prevent overselling", "FAIL")
        self.tests_run += 1
        
        # TEST 7: Test Authentication Issues
        self.log("🔍 TEST 7: Authentication Testing", "INFO")
        
        # Store current token
        original_token = self.token
        
        # Test without authentication
        self.token = None
        success, response = self.run_test(
            "Sales Creation Without Auth (Should Fail)",
            "POST",
            "/api/sales",
            401,  # Unauthorized expected
            data=basic_sale_data
        )
        
        if success:
            self.log("✅ Authentication correctly required for sales creation", "PASS")
            self.tests_passed += 1
        else:
            self.log("❌ Authentication should be required for sales creation", "FAIL")
        self.tests_run += 1
        
        # Restore token
        self.token = original_token
        
        self.log("=== SALES COMPLETION FAILURE INVESTIGATION COMPLETED ===", "INFO")
        return True

    def print_summary(self):
        """Print test summary"""
        self.log("=" * 50, "INFO")
        self.log("SALES COMPLETION FAILURE INVESTIGATION SUMMARY", "INFO")
        self.log("=" * 50, "INFO")
        self.log(f"Total tests run: {self.tests_run}", "INFO")
        self.log(f"Tests passed: {self.tests_passed}", "INFO")
        self.log(f"Tests failed: {self.tests_run - self.tests_passed}", "INFO")
        self.log(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0.0%", "INFO")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 ALL TESTS PASSED - Sales API is working correctly!", "INFO")
            self.log("The 'failed to complete sales' error is likely a frontend issue or user input validation problem.", "INFO")
        else:
            self.log("⚠️ SOME TESTS FAILED - Issues found in Sales API", "INFO")
            self.log("Review the failed tests above to identify the root cause of sales completion failures.", "INFO")
        
        self.log("=" * 50, "INFO")

    def run_investigation(self):
        """Run the complete sales completion failure investigation"""
        self.log("Starting Sales Completion Failure Investigation", "INFO")
        
        if not self.setup_authentication():
            self.log("Failed to setup authentication - stopping investigation", "ERROR")
            return
        
        self.test_sales_completion_failure_investigation()
        self.print_summary()

if __name__ == "__main__":
    tester = SalesCompletionTester()
    tester.run_investigation()