#!/usr/bin/env python3
"""
URGENT: Payment Network Error Reproduction Test
Focused test to reproduce the exact "Network Error: Check connection and try again" after payment
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class UrgentPaymentTester:
    def __init__(self, base_url="https://pos-upgrade-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

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
        self.log(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, params=params)
            elif method == 'OPTIONS':
                response = requests.options(url, headers=test_headers)

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
                response_data = {"raw_response": response.text}

            return success, response_data

        except Exception as e:
            self.log(f"❌ {name} - Network Error: {str(e)}", "ERROR")
            return False, {"error": str(e)}

    def test_urgent_payment_network_error_reproduction(self):
        """URGENT: Debug Network Error After Payment - Reproduce exact error from user report"""
        self.log("=== URGENT: PAYMENT NETWORK ERROR REPRODUCTION ===", "INFO")
        self.log("Simulating exact POS payment transaction to capture network error", "INFO")
        
        # STEP 1: Login as business admin (simulate user login)
        self.log("🔍 STEP 1: Business Admin Login", "INFO")
        success, response = self.run_test(
            "Business Admin Login for Payment Flow",
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
            self.log("❌ CRITICAL: Cannot reproduce payment error - login failed", "ERROR")
            return False
        
        self.token = response['access_token']
        self.log("✅ Business admin login successful")
        
        # STEP 2: Get available products (simulate POS loading)
        self.log("🔍 STEP 2: Get Available Products", "INFO")
        success, products_response = self.run_test(
            "Get Available Products for POS",
            "GET",
            "/api/products",
            200
        )
        
        if not success or not isinstance(products_response, list) or len(products_response) == 0:
            self.log("❌ CRITICAL: No products available for payment testing", "ERROR")
            return False
        
        # Get first available product for testing
        test_product = products_response[0]
        product_id = test_product.get('id')
        product_name = test_product.get('name', 'Test Product')
        product_price = test_product.get('price', 29.99)
        product_sku = test_product.get('sku', 'UNKNOWN-SKU')
        product_cost = test_product.get('product_cost', 15.00)
        
        self.log(f"✅ Using product: {product_name} (ID: {product_id}, Price: ${product_price})")
        
        # STEP 3: Get customers (simulate customer selection)
        self.log("🔍 STEP 3: Get Customers for Transaction", "INFO")
        success, customers_response = self.run_test(
            "Get Customers for POS",
            "GET",
            "/api/customers",
            200
        )
        
        customer_id = None
        customer_name = "Walk-in Customer"
        
        if success and isinstance(customers_response, list) and len(customers_response) > 0:
            test_customer = customers_response[0]
            customer_id = test_customer.get('id')
            customer_name = test_customer.get('name', 'Test Customer')
            self.log(f"✅ Using customer: {customer_name} (ID: {customer_id})")
        else:
            self.log("⚠️ No customers found, using walk-in customer")
        
        # STEP 4: Create realistic sales transaction payload (exact frontend structure)
        self.log("🔍 STEP 4: Create Realistic Payment Transaction", "INFO")
        
        # Simulate exact data structure that frontend would send
        realistic_payment_data = {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "cashier_id": "507f1f77bcf86cd799439011",  # Simulate current user ID
            "cashier_name": "admin@printsandcuts.com",  # Simulate current user name
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "sku": product_sku,
                    "quantity": 2,
                    "unit_price": product_price,
                    "unit_price_snapshot": product_price,
                    "unit_cost_snapshot": product_cost,
                    "total_price": product_price * 2
                }
            ],
            "subtotal": product_price * 2,
            "tax_amount": round((product_price * 2) * 0.09, 2),  # 9% tax
            "discount_amount": 0.00,
            "total_amount": round((product_price * 2) * 1.09, 2),
            "payment_method": "cash",
            "received_amount": round((product_price * 2) * 1.09 + 10, 2),  # Extra $10
            "change_amount": 10.00,
            "notes": "URGENT TEST: Reproducing payment network error"
        }
        
        self.log(f"Payment data prepared: Total ${realistic_payment_data['total_amount']}")
        self.log(f"Payment data: {json.dumps(realistic_payment_data, indent=2)}")
        
        # STEP 5: Attempt to POST the sale (this is where the error should occur)
        self.log("🔍 STEP 5: POST Sale Transaction (Critical Test)", "INFO")
        self.log("This is where the 'Network Error: Check connection and try again' should occur", "WARN")
        
        success, sale_response = self.run_test(
            "POST Sale Transaction (Payment Completion)",
            "POST",
            "/api/sales",
            200,  # Expected success
            data=realistic_payment_data
        )
        
        if success:
            self.log("✅ UNEXPECTED: Payment transaction completed successfully", "INFO")
            self.log("This suggests the network error has been resolved", "INFO")
            sale_id = sale_response.get('id')
            if sale_id:
                self.log(f"Sale created with ID: {sale_id}")
                self.log(f"Sale response: {json.dumps(sale_response, indent=2)}")
        else:
            self.log("❌ REPRODUCED: Payment transaction failed", "ERROR")
            self.log("This matches the user's reported 'Network Error' issue", "ERROR")
            self.log(f"Error response: {json.dumps(sale_response, indent=2)}")
        
        # STEP 6: Test with exact frontend data structure (potential null values)
        self.log("🔍 STEP 6: Test with Frontend-like Data (Potential Issue)", "INFO")
        
        # Simulate data that might come from React frontend with potential issues
        frontend_like_data = {
            "customer_id": customer_id or None,
            "customer_name": customer_name or "",
            "cashier_id": None,  # This might be null from frontend
            "cashier_name": None,  # This might be null from frontend
            "items": [
                {
                    "product_id": product_id,
                    "product_name": product_name,
                    "sku": None,  # This might be null from frontend
                    "quantity": 1,
                    "unit_price": product_price,
                    "unit_price_snapshot": None,  # This might be null from frontend
                    "unit_cost_snapshot": None,  # This might be null from frontend
                    "total_price": product_price
                }
            ],
            "subtotal": product_price,
            "tax_amount": 0,
            "discount_amount": 0,
            "total_amount": product_price,
            "payment_method": "cash",
            "received_amount": product_price + 5,
            "change_amount": 5,
            "notes": "Frontend-like data with potential null values"
        }
        
        self.log(f"Frontend-like data: {json.dumps(frontend_like_data, indent=2)}")
        
        success, frontend_response = self.run_test(
            "Payment with Frontend-like Null Values",
            "POST",
            "/api/sales",
            422,  # Expected validation error due to null values
            data=frontend_like_data
        )
        
        if not success:
            self.log("❌ Frontend null values cause validation errors", "ERROR")
            self.log("This could be the root cause of the 'Network Error' message", "ERROR")
            self.log(f"Validation error response: {json.dumps(frontend_response, indent=2)}")
        else:
            self.log("✅ Frontend null values properly handled with validation errors", "INFO")
        
        # STEP 7: Test CORS headers
        self.log("🔍 STEP 7: CORS Headers Test", "INFO")
        
        try:
            url = f"{self.base_url}/api/sales"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.token}',
                'Origin': 'https://pos-upgrade-1.preview.emergentagent.com'
            }
            
            response = requests.options(url, headers=headers)
            self.log(f"CORS preflight response: {response.status_code}")
            
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            }
            
            self.log(f"CORS headers: {cors_headers}")
            
            if cors_headers['Access-Control-Allow-Origin']:
                self.log("✅ CORS headers are present")
            else:
                self.log("❌ CORS headers missing - potential cause of network error", "ERROR")
                
        except Exception as e:
            self.log(f"❌ CORS test failed: {str(e)}", "ERROR")
        
        # STEP 8: Test network connectivity
        self.log("🔍 STEP 8: Network Connectivity Test", "INFO")
        
        success, health_response = self.run_test(
            "Health Check (Network Connectivity)",
            "GET",
            "/api/health",
            200
        )
        
        if success:
            self.log("✅ Network connectivity is working")
        else:
            self.log("❌ Network connectivity issues detected", "ERROR")
        
        # STEP 9: Test with invalid data that might cause network errors
        self.log("🔍 STEP 9: Test Error Conditions", "INFO")
        
        # Test with invalid product ID (common cause of network errors)
        invalid_payment_data = realistic_payment_data.copy()
        invalid_payment_data['items'][0]['product_id'] = "invalid-product-id"
        
        success, error_response = self.run_test(
            "Payment with Invalid Product ID",
            "POST",
            "/api/sales",
            400,  # Expected error
            data=invalid_payment_data
        )
        
        if not success:
            self.log("❌ Invalid product ID causes network error", "ERROR")
            self.log(f"Invalid product ID error: {json.dumps(error_response, indent=2)}")
        else:
            self.log("✅ Invalid product ID properly handled with error response", "INFO")
        
        self.log("=== PAYMENT NETWORK ERROR REPRODUCTION COMPLETED ===", "INFO")
        
        # Print summary
        self.log(f"\n=== TEST SUMMARY ===", "INFO")
        self.log(f"Tests Run: {self.tests_run}", "INFO")
        self.log(f"Tests Passed: {self.tests_passed}", "INFO")
        self.log(f"Tests Failed: {self.tests_run - self.tests_passed}", "INFO")
        self.log(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%", "INFO")
        
        return True

if __name__ == "__main__":
    tester = UrgentPaymentTester()
    tester.test_urgent_payment_network_error_reproduction()