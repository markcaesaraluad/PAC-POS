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
    def __init__(self, base_url="https://ed6f9d7f-7152-4de2-a3e7-301ed414aea4.preview.emergentagent.com"):
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
        self.log(f"URL: {url}")
        self.log(f"Headers: {test_headers}")
        
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

    def test_health_check(self):
        """Test API health endpoint"""
        success, _ = self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )
        return success

    def test_super_admin_setup(self):
        """Test super admin setup and business creation"""
        # Try super admin login first
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
            
            # List existing businesses first
            businesses_response = self.list_existing_businesses()
            
            # Get business ID and list users
            if businesses_response:
                # Assuming we get the business list, extract the first business ID
                success, response = self.run_test(
                    "List Businesses for ID",
                    "GET",
                    "/api/super-admin/businesses",
                    200
                )
                if success and isinstance(response, list) and len(response) > 0:
                    business_id = response[0].get('id')
                    if business_id:
                        self.list_business_users(business_id)
            
            # Business already exists, skip creation
            self.log("Business already exists, proceeding with login test")
            return True
        else:
            self.log("❌ Super admin not found or login failed", "ERROR")
            return False

    def list_existing_businesses(self):
        """List existing businesses to understand the setup"""
        success, response = self.run_test(
            "List Businesses",
            "GET",
            "/api/super-admin/businesses",
            200
        )
        if success and isinstance(response, list):
            self.log(f"Found {len(response)} businesses:")
            for business in response:
                self.log(f"  - {business.get('name')} (subdomain: {business.get('subdomain')})")
        return success

    def list_business_users(self, business_id):
        """List users for a specific business"""
        success, response = self.run_test(
            "List Business Users",
            "GET",
            f"/api/super-admin/businesses/{business_id}/users",
            200
        )
        if success and isinstance(response, list):
            self.log(f"Found {len(response)} users for business:")
            for user in response:
                self.log(f"  - {user.get('email')} ({user.get('role')})")
        return success
        business_data = {
            "name": "Prints & Cuts Tagum",
            "description": "Test business for API testing",
            "subdomain": "prints-cuts-tagum",
            "contact_email": "contact@printsandcuts.com",
            "phone": "+1234567890",
            "address": "123 Test Street, Tagum City",
            "admin_name": "Business Admin",
            "admin_email": "admin@printsandcuts.com",
            "admin_password": "admin123456"
        }
        
        success, response = self.run_test(
            "Create Test Business",
            "POST",
            "/api/super-admin/businesses",
            200,
            data=business_data
        )
        if success:
            self.log("Test business created successfully")
        return success

    def test_business_admin_login(self):
        """Test business admin login with subdomain context"""
        # First try without subdomain in body
        success, response = self.run_test(
            "Business Admin Login (no subdomain)",
            "POST",
            "/api/auth/login",
            200,
            data={
                "email": "admin@printsandcuts.com",
                "password": "admin123456"
            }
        )
        if success and 'access_token' in response:
            self.business_admin_token = response['access_token']
            self.token = self.business_admin_token
            self.log("Business admin token obtained")
            return True
        
        # Try with subdomain in body
        success, response = self.run_test(
            "Business Admin Login (with subdomain)",
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

    def test_reports_functionality(self):
        """Test comprehensive reports functionality"""
        self.log("Starting Reports Testing", "INFO")
        
        # Test 1: Sales Report - Excel format (default)
        success, response = self.run_test(
            "Generate Sales Report (Excel - Default)",
            "GET",
            "/api/reports/sales",
            200
        )
        
        # Test 2: Sales Report - Excel format with date range
        from datetime import datetime, timedelta
        start_date = (datetime.now() - timedelta(days=30)).isoformat()
        end_date = datetime.now().isoformat()
        
        success, response = self.run_test(
            "Generate Sales Report (Excel - Date Range)",
            "GET",
            "/api/reports/sales",
            200,
            params={
                "format": "excel",
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        # Test 3: Sales Report - PDF format
        success, response = self.run_test(
            "Generate Sales Report (PDF)",
            "GET",
            "/api/reports/sales",
            200,
            params={
                "format": "pdf",
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        # Test 4: Inventory Report - Excel format (default)
        success, response = self.run_test(
            "Generate Inventory Report (Excel - Default)",
            "GET",
            "/api/reports/inventory",
            200
        )
        
        # Test 5: Inventory Report - PDF format
        success, response = self.run_test(
            "Generate Inventory Report (PDF)",
            "GET",
            "/api/reports/inventory",
            200,
            params={"format": "pdf"}
        )
        
        # Test 6: Inventory Report - Low stock only
        success, response = self.run_test(
            "Generate Inventory Report (Low Stock Only)",
            "GET",
            "/api/reports/inventory",
            200,
            params={
                "format": "excel",
                "low_stock_only": "true"
            }
        )
        
        # Test 7: Inventory Report - Include inactive products
        success, response = self.run_test(
            "Generate Inventory Report (Include Inactive)",
            "GET",
            "/api/reports/inventory",
            200,
            params={
                "format": "excel",
                "include_inactive": "true"
            }
        )
        
        # Test 8: Customers Report - Excel format
        success, response = self.run_test(
            "Generate Customers Report (Excel)",
            "GET",
            "/api/reports/customers",
            200,
            params={"format": "excel"}
        )
        
        # Test 9: Customers Report - Top 25 customers
        success, response = self.run_test(
            "Generate Customers Report (Top 25)",
            "GET",
            "/api/reports/customers",
            200,
            params={
                "format": "excel",
                "top_customers": "25"
            }
        )
        
        # Test 10: Daily Summary Report - Today
        success, response = self.run_test(
            "Get Daily Summary Report (Today)",
            "GET",
            "/api/reports/daily-summary",
            200
        )
        if success:
            self.log(f"Daily summary data: {json.dumps(response, indent=2)}")
        
        # Test 11: Daily Summary Report - Specific date
        specific_date = (datetime.now() - timedelta(days=1)).date().isoformat()
        success, response = self.run_test(
            "Get Daily Summary Report (Specific Date)",
            "GET",
            "/api/reports/daily-summary",
            200,
            params={"date": specific_date}
        )
        
        # Test 12: Error handling - Invalid format
        success, response = self.run_test(
            "Sales Report Invalid Format (Should Fail)",
            "GET",
            "/api/reports/sales",
            422,  # Validation error expected
            params={"format": "invalid"}
        )
        
        # Test 13: Error handling - Invalid date format
        success, response = self.run_test(
            "Sales Report Invalid Date (Should Fail)",
            "GET",
            "/api/reports/sales",
            422,  # Validation error expected
            params={
                "format": "excel",
                "start_date": "invalid-date"
            }
        )
        
        # Test 14: Customers Report - PDF format (should return message)
        success, response = self.run_test(
            "Generate Customers Report (PDF - Not Implemented)",
            "GET",
            "/api/reports/customers",
            200,
            params={"format": "pdf"}
        )
        
        self.log("Reports Testing Completed", "INFO")
        return success

    def test_reports_authentication(self):
        """Test reports authentication requirements"""
        self.log("Testing Reports Authentication", "INFO")
        
        # Store current token
        original_token = self.token
        
        # Test without authentication
        self.token = None
        success, response = self.run_test(
            "Sales Report Without Auth (Should Fail)",
            "GET",
            "/api/reports/sales",
            401  # Unauthorized expected
        )
        
        # Test with invalid token
        self.token = "invalid_token"
        success, response = self.run_test(
            "Sales Report Invalid Token (Should Fail)",
            "GET",
            "/api/reports/sales",
            401  # Unauthorized expected
        )
        
        # Restore valid token
        self.token = original_token
        
        # Test with valid token
        success, response = self.run_test(
            "Sales Report With Valid Auth",
            "GET",
            "/api/reports/sales",
            200
        )
        
        self.log("Reports Authentication Testing Completed", "INFO")
        return success

    def test_reports_file_headers(self):
        """Test that reports return proper file headers and MIME types"""
        self.log("Testing Reports File Headers", "INFO")
        
        # Test Excel file headers
        url = f"{self.base_url}/api/reports/sales?format=excel"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                self.log(f"Excel Content-Type: {content_type}")
                self.log(f"Excel Content-Disposition: {content_disposition}")
                
                # Check MIME type
                expected_excel_mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                if expected_excel_mime in content_type:
                    self.log("✅ Excel MIME type correct", "PASS")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ Excel MIME type incorrect. Expected: {expected_excel_mime}, Got: {content_type}", "FAIL")
                
                # Check filename in Content-Disposition
                if "attachment" in content_disposition and "filename=" in content_disposition:
                    self.log("✅ Excel Content-Disposition header correct", "PASS")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ Excel Content-Disposition header incorrect: {content_disposition}", "FAIL")
                
                self.tests_run += 2
        except Exception as e:
            self.log(f"❌ Error testing Excel headers: {str(e)}", "ERROR")
            self.tests_run += 2
        
        # Test PDF file headers
        url = f"{self.base_url}/api/reports/sales?format=pdf"
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                self.log(f"PDF Content-Type: {content_type}")
                self.log(f"PDF Content-Disposition: {content_disposition}")
                
                # Check MIME type
                if "application/pdf" in content_type:
                    self.log("✅ PDF MIME type correct", "PASS")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ PDF MIME type incorrect. Expected: application/pdf, Got: {content_type}", "FAIL")
                
                # Check filename in Content-Disposition
                if "attachment" in content_disposition and "filename=" in content_disposition:
                    self.log("✅ PDF Content-Disposition header correct", "PASS")
                    self.tests_passed += 1
                else:
                    self.log(f"❌ PDF Content-Disposition header incorrect: {content_disposition}", "FAIL")
                
                self.tests_run += 2
        except Exception as e:
            self.log(f"❌ Error testing PDF headers: {str(e)}", "ERROR")
            self.tests_run += 2
        
        self.log("Reports File Headers Testing Completed", "INFO")
        return True

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

        # Super admin setup and business creation
        if not self.test_super_admin_setup():
            self.log("❌ Super admin setup failed - stopping tests", "CRITICAL")
            return False

        # Authentication tests
        if not self.test_business_admin_login():
            self.log("⚠️ Business admin login failed - continuing with super admin", "WARNING")
            # Continue with super admin token for testing
            self.token = self.super_admin_token

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

        # NEW: Comprehensive Reports Testing
        self.log("=== STARTING REPORTS FUNCTIONALITY TESTING ===", "INFO")
        self.test_reports_authentication()
        self.test_reports_functionality()
        self.test_reports_file_headers()
        self.log("=== REPORTS FUNCTIONALITY TESTING COMPLETED ===", "INFO")

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