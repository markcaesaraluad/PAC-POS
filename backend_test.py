#!/usr/bin/env python3
"""
Backend API Testing for Modern POS System
Tests all CRUD operations, authentication, and invoice functionality
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class POSAPITester:
    def __init__(self, base_url="http://localhost:8001"):
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
                    self.log(f"Response: {response.text[:200]}", "ERROR")

            try:
                response_data = response.json() if response.text else {}
            except:
                response_data = {}

            return success, response_data

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}", "ERROR")
            return False, {}

    def test_health_check(self):
        """Test API health endpoint"""
        success, _ = self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )
        return success

    def test_super_admin_login(self):
        """Test super admin login"""
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "/api/auth/login",
            200,
            data={
                "email": "admin@pos.com",
                "password": "admin123"
            }
        )
        if success and 'access_token' in response:
            self.super_admin_token = response['access_token']
            self.token = self.super_admin_token
            self.log("Super admin token obtained")
            return True
        return False

    def test_business_admin_login(self):
        """Test business admin login with subdomain context"""
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
            self.log("Business admin token obtained")
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
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

    def test_categories_crud(self):
        """Test category CRUD operations"""
        # Create category
        success, response = self.run_test(
            "Create Category",
            "POST",
            "/api/categories",
            200,  # Backend returns 200, not 201
            data={
                "name": "Test Category",
                "description": "Test category for API testing"
            }
        )
        if success and 'id' in response:
            self.category_id = response['id']
            self.log(f"Category created with ID: {self.category_id}")

        # Get categories
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "/api/categories",
            200
        )

        # Update category
        if self.category_id:
            success, _ = self.run_test(
                "Update Category",
                "PUT",
                f"/api/categories/{self.category_id}",
                200,
                data={
                    "name": "Updated Test Category",
                    "description": "Updated description"
                }
            )

        return success

    def test_products_crud(self):
        """Test product CRUD operations"""
        # Create product
        product_data = {
            "name": "Test Product",
            "description": "Test product for API testing",
            "sku": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 29.99,
            "cost": 15.00,
            "quantity": 100,
            "category_id": self.category_id,
            "barcode": f"123456789{datetime.now().strftime('%H%M%S')}"
        }

        success, response = self.run_test(
            "Create Product",
            "POST",
            "/api/products",
            200,  # Backend returns 200, not 201
            data=product_data
        )
        if success and 'id' in response:
            self.product_id = response['id']
            self.log(f"Product created with ID: {self.product_id}")

        # Get products
        success, _ = self.run_test(
            "Get Products",
            "GET",
            "/api/products",
            200
        )

        # Get product by barcode
        if product_data['barcode']:
            success, _ = self.run_test(
                "Get Product by Barcode",
                "GET",
                f"/api/products/barcode/{product_data['barcode']}",
                200
            )

        # Update product
        if self.product_id:
            success, _ = self.run_test(
                "Update Product",
                "PUT",
                f"/api/products/{self.product_id}",
                200,
                data={
                    "name": "Updated Test Product",
                    "price": 39.99,
                    "quantity": 95
                }
            )

        return success

    def test_customers_crud(self):
        """Test customer CRUD operations"""
        # Create customer
        customer_data = {
            "name": "Test Customer",
            "email": f"test.customer.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "phone": "+1234567890",
            "address": "123 Test Street, Test City"
        }

        success, response = self.run_test(
            "Create Customer",
            "POST",
            "/api/customers",
            200,  # Backend returns 200, not 201
            data=customer_data
        )
        if success and 'id' in response:
            self.customer_id = response['id']
            self.log(f"Customer created with ID: {self.customer_id}")

        # Get customers
        success, _ = self.run_test(
            "Get Customers",
            "GET",
            "/api/customers",
            200
        )

        # Update customer
        if self.customer_id:
            success, _ = self.run_test(
                "Update Customer",
                "PUT",
                f"/api/customers/{self.customer_id}",
                200,
                data={
                    "name": "Updated Test Customer",
                    "phone": "+1987654321"
                }
            )

        return success

    def test_invoice_workflow(self):
        """Test complete invoice workflow"""
        if not self.product_id or not self.customer_id:
            self.log("❌ Cannot test invoices - missing product or customer", "ERROR")
            return False

        # Create invoice
        invoice_data = {
            "customer_id": self.customer_id,
            "items": [
                {
                    "product_id": self.product_id,
                    "product_name": "Test Product",
                    "product_sku": "TEST-SKU",
                    "quantity": 2,
                    "unit_price": 29.99,
                    "total_price": 59.98
                }
            ],
            "subtotal": 59.98,
            "tax_amount": 5.40,
            "discount_amount": 0.00,
            "total_amount": 65.38,
            "notes": "Test invoice from API testing",
            "due_date": (datetime.now() + timedelta(days=30)).isoformat()
        }

        success, response = self.run_test(
            "Create Invoice",
            "POST",
            "/api/invoices",
            200,  # Backend returns 200, not 201
            data=invoice_data
        )
        if success and 'id' in response:
            self.invoice_id = response['id']
            self.log(f"Invoice created with ID: {self.invoice_id}")

        # Get invoices
        success, _ = self.run_test(
            "Get Invoices",
            "GET",
            "/api/invoices",
            200
        )

        # Get specific invoice
        if self.invoice_id:
            success, _ = self.run_test(
                "Get Invoice by ID",
                "GET",
                f"/api/invoices/{self.invoice_id}",
                200
            )

        # Send invoice (mock)
        if self.invoice_id:
            success, _ = self.run_test(
                "Send Invoice",
                "POST",
                f"/api/invoices/{self.invoice_id}/send",
                200
            )

        # Export invoice (mock)
        if self.invoice_id:
            success, _ = self.run_test(
                "Export Invoice",
                "POST",
                f"/api/invoices/{self.invoice_id}/export",
                200,
                data={"format": "pdf"}
            )

        # Convert invoice to sale
        if self.invoice_id:
            success, response = self.run_test(
                "Convert Invoice to Sale",
                "POST",
                f"/api/invoices/{self.invoice_id}/convert-to-sale",
                200,
                data={"payment_method": "cash"}
            )
            if success and 'id' in response:
                self.sale_id = response['id']
                self.log(f"Invoice converted to sale with ID: {self.sale_id}")

        return success

    def test_sales_operations(self):
        """Test sales operations"""
        # Get sales
        success, _ = self.run_test(
            "Get Sales",
            "GET",
            "/api/sales",
            200
        )

        # Get specific sale (if we have one from invoice conversion)
        if self.sale_id:
            success, _ = self.run_test(
                "Get Sale by ID",
                "GET",
                f"/api/sales/{self.sale_id}",
                200
            )

        # Create direct sale
        if self.product_id:
            sale_data = {
                "customer_id": self.customer_id,
                "items": [
                    {
                        "product_id": self.product_id,
                        "product_name": "Test Product",
                        "product_sku": "TEST-SKU",
                        "quantity": 1,
                        "unit_price": 29.99,
                        "total_price": 29.99
                    }
                ],
                "subtotal": 29.99,
                "tax_amount": 2.70,
                "discount_amount": 0.00,
                "total_amount": 32.69,
                "payment_method": "card",
                "notes": "Direct sale from API testing"
            }

            success, response = self.run_test(
                "Create Direct Sale",
                "POST",
                "/api/sales",
                200,  # Backend returns 200, not 201
                data=sale_data
            )

        return success

    def test_business_operations(self):
        """Test business-related operations"""
        # Get business info
        success, _ = self.run_test(
            "Get Business Info",
            "GET",
            "/api/business/info",
            200
        )

        # Get business users
        success, _ = self.run_test(
            "Get Business Users",
            "GET",
            "/api/business/users",
            200
        )

        return success

    def cleanup_test_data(self):
        """Clean up test data"""
        self.log("Cleaning up test data...")
        
        # Delete test product
        if self.product_id:
            self.run_test(
                "Delete Test Product",
                "DELETE",
                f"/api/products/{self.product_id}",
                200
            )

        # Delete test customer
        if self.customer_id:
            self.run_test(
                "Delete Test Customer",
                "DELETE",
                f"/api/customers/{self.customer_id}",
                200
            )

        # Delete test category
        if self.category_id:
            self.run_test(
                "Delete Test Category",
                "DELETE",
                f"/api/categories/{self.category_id}",
                200
            )

    def run_all_tests(self):
        """Run all API tests"""
        self.log("Starting POS System API Tests", "START")
        self.log(f"Testing against: {self.base_url}")
        
        # Basic connectivity
        if not self.test_health_check():
            self.log("❌ Health check failed - stopping tests", "CRITICAL")
            return False

        # Authentication tests
        if not self.test_business_admin_login():
            self.log("❌ Business admin login failed - stopping tests", "CRITICAL")
            return False

        if not self.test_get_current_user():
            self.log("❌ Get current user failed", "ERROR")

        # CRUD operations
        self.test_categories_crud()
        self.test_products_crud()
        self.test_customers_crud()
        
        # Core POS functionality
        self.test_invoice_workflow()
        self.test_sales_operations()
        self.test_business_operations()

        # Cleanup
        self.cleanup_test_data()

        # Results
        self.log(f"Tests completed: {self.tests_passed}/{self.tests_run} passed", "RESULT")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!", "SUCCESS")
            return True
        else:
            failed = self.tests_run - self.tests_passed
            self.log(f"❌ {failed} tests failed", "FAILURE")
            return False

def main():
    """Main test execution"""
    tester = POSAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"💥 Unexpected error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())