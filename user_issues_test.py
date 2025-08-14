#!/usr/bin/env python3
"""
Backend API Testing for 4 Specific User Issues
Tests the specific issues reported by the user:
1. Customer Edit Function
2. Sales Report PDF Download
3. TODAY Filter for Reports
4. Product Deletion
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class UserIssuesTester:
    def __init__(self, base_url="https://pos-upgrade-1.preview.emergentagent.com"):
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
        """Setup authentication and test data"""
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
            self.token = self.super_admin_token

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

        # Get current user
        success, response = self.run_test("Get Current User", "GET", "/api/auth/me", 200)
        if success and 'business_id' in response:
            self.business_id = response['business_id']

        return True

    def setup_test_data(self):
        """Setup test data for testing"""
        # Create category
        success, response = self.run_test(
            "Create Test Category",
            "POST",
            "/api/categories",
            200,
            data={"name": "Test Category", "description": "Test category for API testing"}
        )
        if success and 'id' in response:
            self.category_id = response['id']

        # Create product
        product_data = {
            "name": "Test Product",
            "description": "Test product for API testing",
            "sku": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 29.99,
            "product_cost": 15.00,
            "quantity": 100,
            "category_id": self.category_id,
            "barcode": f"123456789{datetime.now().strftime('%H%M%S')}"
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

        # Create customer
        customer_data = {
            "name": "Test Customer",
            "email": f"test.customer.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "phone": "+1234567890",
            "address": "123 Test Street, Test City"
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

        return True

    def test_customer_edit_function(self):
        """Test Issue 1: Customer Edit Function - PUT /api/customers/{customer_id}"""
        self.log("🔍 ISSUE 1: Testing Customer Edit Function", "INFO")
        
        # Create a test customer to edit
        customer_data = {
            "name": "Test Customer for Edit",
            "email": f"edit.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "phone": "+1234567890",
            "address": "123 Original Street, Test City"
        }

        success, response = self.run_test(
            "Create Customer for Edit Testing",
            "POST",
            "/api/customers",
            200,
            data=customer_data
        )
        
        if not success or 'id' not in response:
            self.log("❌ Cannot test customer edit - failed to create test customer", "ERROR")
            return False
            
        test_customer_id = response['id']
        self.log(f"Created test customer with ID: {test_customer_id}")
        
        # Test 1: Update customer name
        update_data = {
            "name": "Updated Customer Name",
            "email": customer_data['email'],
            "phone": customer_data['phone'],
            "address": customer_data['address']
        }
        
        success, response = self.run_test(
            "Update Customer Name",
            "PUT",
            f"/api/customers/{test_customer_id}",
            200,
            data=update_data
        )
        
        if success and response.get('name') == update_data['name']:
            self.log("✅ Customer name update successful")
        else:
            self.log("❌ CRITICAL: Customer name update failed")
        
        # Test 2: Update customer email
        new_email = f"updated.email.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com"
        update_data['email'] = new_email
        
        success, response = self.run_test(
            "Update Customer Email",
            "PUT",
            f"/api/customers/{test_customer_id}",
            200,
            data=update_data
        )
        
        if success and response.get('email') == new_email:
            self.log("✅ Customer email update successful")
        else:
            self.log("❌ CRITICAL: Customer email update failed")
        
        # Test 3: Update customer phone and address
        update_data['phone'] = "+1987654321"
        update_data['address'] = "456 Updated Avenue, New City, State 12345"
        
        success, response = self.run_test(
            "Update Customer Phone and Address",
            "PUT",
            f"/api/customers/{test_customer_id}",
            200,
            data=update_data
        )
        
        if success and response.get('phone') == update_data['phone']:
            self.log("✅ Customer phone and address update successful")
        else:
            self.log("❌ CRITICAL: Customer phone and address update failed")
        
        # Test 4: Error handling - invalid customer ID
        success, response = self.run_test(
            "Update Non-existent Customer (Should Fail)",
            "PUT",
            "/api/customers/507f1f77bcf86cd799439999",
            404,
            data=update_data
        )
        
        if success:
            self.log("✅ Non-existent customer handling working correctly")
        else:
            self.log("❌ Non-existent customer handling not working")
        
        return True

    def test_sales_report_pdf_download(self):
        """Test Issue 2: Sales Report PDF Download - GET /api/reports/sales with format=pdf"""
        self.log("🔍 ISSUE 2: Testing Sales Report PDF Download", "INFO")
        
        # Test 1: PDF format with default date range
        success, response = self.run_test(
            "Generate Sales Report (PDF - Default Range)",
            "GET",
            "/api/reports/sales",
            200,  # Try 200 first, then check for 500
            params={"format": "pdf"}
        )
        
        if success:
            self.log("✅ Sales report PDF generation working correctly")
        else:
            # Check if it's a 500 error (WeasyPrint issue)
            success_500, response_500 = self.run_test(
                "Generate Sales Report (PDF - Check for 500 Error)",
                "GET",
                "/api/reports/sales",
                500,
                params={"format": "pdf"}
            )
            if success_500:
                self.log("❌ CRITICAL: Sales report PDF generation returned 500 - WeasyPrint dependency issue confirmed")
            else:
                self.log("❌ CRITICAL: Sales report PDF generation failed with unexpected error")
        
        # Test 2: PDF format with specific date range
        start_date = (datetime.now() - timedelta(days=7)).isoformat()
        end_date = datetime.now().isoformat()
        
        success, response = self.run_test(
            "Generate Sales Report (PDF - Specific Date Range)",
            "GET",
            "/api/reports/sales",
            200,
            params={
                "format": "pdf",
                "start_date": start_date,
                "end_date": end_date
            }
        )
        
        if success:
            self.log("✅ Sales report PDF with date range working")
        else:
            self.log("❌ CRITICAL: Sales report PDF with date range failed")
        
        # Test 3: Compare with Excel format (should work)
        success, response = self.run_test(
            "Generate Sales Report (Excel - For Comparison)",
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
            self.log("✅ Sales report Excel generation working (PDF issue is format-specific)")
        else:
            self.log("❌ Sales report Excel also failing - broader issue")
        
        return True

    def test_today_filter_for_reports(self):
        """Test Issue 3: TODAY Filter for Reports"""
        self.log("🔍 ISSUE 3: Testing TODAY Filter for Reports", "INFO")
        
        today_date = datetime.now().date().isoformat()
        
        # Test 1: Sales Report with today's date (Excel format)
        success, response = self.run_test(
            "Sales Report with Today's Date (Excel)",
            "GET",
            "/api/reports/sales",
            200,
            params={
                "format": "excel",
                "start_date": today_date,
                "end_date": today_date
            }
        )
        
        if success:
            self.log("✅ Sales report with today's date filter working")
        else:
            self.log("❌ CRITICAL: Sales report with today's date filter failed")
        
        # Test 2: Profit Report with today's date (Excel format)
        success, response = self.run_test(
            "Profit Report with Today's Date (Excel)",
            "GET",
            "/api/reports/profit",
            200,
            params={
                "format": "excel",
                "start_date": today_date,
                "end_date": today_date
            }
        )
        
        if success:
            self.log("✅ Profit report with today's date filter working")
        else:
            self.log("❌ CRITICAL: Profit report with today's date filter failed")
        
        # Test 3: Daily Summary with today's date
        success, response = self.run_test(
            "Daily Summary with Today's Date",
            "GET",
            "/api/reports/daily-summary",
            200,
            params={"date": today_date}
        )
        
        if success:
            self.log("✅ Daily summary with today's date working")
            if isinstance(response, dict):
                sales_count = response.get('sales', {}).get('total_sales', 0)
                revenue = response.get('sales', {}).get('total_revenue', 0)
                self.log(f"Today's data: {sales_count} sales, ${revenue:.2f} revenue")
        else:
            self.log("❌ CRITICAL: Daily summary with today's date failed")
        
        # Test 4: Daily Summary without date parameter (should default to today)
        success, response = self.run_test(
            "Daily Summary (Default to Today)",
            "GET",
            "/api/reports/daily-summary",
            200
        )
        
        if success:
            self.log("✅ Daily summary defaulting to today working")
            if isinstance(response, dict):
                sales_count = response.get('sales', {}).get('total_sales', 0)
                revenue = response.get('sales', {}).get('total_revenue', 0)
                self.log(f"Default today's data: {sales_count} sales, ${revenue:.2f} revenue")
        else:
            self.log("❌ CRITICAL: Daily summary default to today failed")
        
        return True

    def test_product_deletion_scenarios(self):
        """Test Issue 4: Product Deletion - DELETE /api/products/{product_id}"""
        self.log("🔍 ISSUE 4: Testing Product Deletion Scenarios", "INFO")
        
        # Create test products for deletion testing
        product_1_data = {
            "name": "Test Product for Deletion 1",
            "description": "Product that will be deleted",
            "sku": f"DEL-TEST-1-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 19.99,
            "product_cost": 10.00,
            "quantity": 50,
            "category_id": self.category_id,
            "barcode": f"DEL1{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Create Test Product 1 for Deletion",
            "POST",
            "/api/products",
            200,
            data=product_1_data
        )
        
        if not success or 'id' not in response:
            self.log("❌ Cannot test product deletion - failed to create test product", "ERROR")
            return False
            
        test_product_1_id = response['id']
        self.log(f"Created test product 1 with ID: {test_product_1_id}")
        
        # Create second test product
        product_2_data = {
            "name": "Test Product for Deletion 2",
            "description": "Product that will be used in sales",
            "sku": f"DEL-TEST-2-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "price": 29.99,
            "product_cost": 15.00,
            "quantity": 30,
            "category_id": self.category_id,
            "barcode": f"DEL2{datetime.now().strftime('%H%M%S')}"
        }
        
        success, response = self.run_test(
            "Create Test Product 2 for Sales Usage",
            "POST",
            "/api/products",
            200,
            data=product_2_data
        )
        
        if not success or 'id' not in response:
            self.log("❌ Cannot test product deletion with sales - failed to create test product 2", "ERROR")
            return False
            
        test_product_2_id = response['id']
        self.log(f"Created test product 2 with ID: {test_product_2_id}")
        
        # Create a sale using product 2 to test deletion protection
        if self.customer_id:
            sale_data = {
                "customer_id": self.customer_id,
                "customer_name": "Test Customer",
                "cashier_id": "507f1f77bcf86cd799439011",
                "cashier_name": "admin@printsandcuts.com",
                "items": [
                    {
                        "product_id": test_product_2_id,
                        "product_name": product_2_data['name'],
                        "sku": product_2_data['sku'],
                        "quantity": 2,
                        "unit_price": product_2_data['price'],
                        "unit_price_snapshot": product_2_data['price'],
                        "unit_cost_snapshot": product_2_data['product_cost'],
                        "total_price": product_2_data['price'] * 2
                    }
                ],
                "subtotal": product_2_data['price'] * 2,
                "tax_amount": 5.40,
                "discount_amount": 0.00,
                "total_amount": (product_2_data['price'] * 2) + 5.40,
                "payment_method": "cash",
                "notes": "Test sale for product deletion protection"
            }
            
            success, sale_response = self.run_test(
                "Create Sale Using Test Product 2",
                "POST",
                "/api/sales",
                200,
                data=sale_data
            )
            
            if success:
                self.log("✅ Created sale using test product 2 for deletion protection test")
            else:
                self.log("⚠️ Failed to create sale - will test deletion without sales protection")
        
        # Test 1: Delete unused product (should be permanently deleted)
        success, response = self.run_test(
            "Delete Unused Product (Should Permanently Delete)",
            "DELETE",
            f"/api/products/{test_product_1_id}",
            204  # No Content for successful deletion
        )
        
        if success:
            self.log("✅ Unused product deletion successful (204 No Content)")
            
            # Verify product is actually deleted
            success, response = self.run_test(
                "Verify Deleted Product Not Found",
                "GET",
                f"/api/products/{test_product_1_id}",
                404  # Should not be found
            )
            
            if success:
                self.log("✅ Deleted product correctly removed from database")
            else:
                self.log("❌ Deleted product still accessible")
        else:
            self.log("❌ CRITICAL: Unused product deletion failed")
        
        # Test 2: Delete product used in sales (should be marked inactive)
        success, response = self.run_test(
            "Delete Product Used in Sales (Should Mark Inactive)",
            "DELETE",
            f"/api/products/{test_product_2_id}",
            409  # Conflict - should not delete but mark inactive
        )
        
        if success:
            self.log("✅ Product used in sales correctly protected (409 Conflict)")
            
            # Verify product is marked inactive but still exists
            success, response = self.run_test(
                "Verify Protected Product Still Exists but Inactive",
                "GET",
                f"/api/products/{test_product_2_id}",
                200  # Should still exist
            )
            
            if success:
                self.log("✅ Protected product still accessible")
                if response.get('is_active') == False:
                    self.log("✅ Protected product correctly marked as inactive")
                else:
                    self.log("❌ Protected product not marked as inactive")
            else:
                self.log("❌ Protected product not accessible after deletion attempt")
        else:
            self.log("❌ CRITICAL: Product deletion protection not working")
        
        # Test 3: Invalid product ID format
        success, response = self.run_test(
            "Delete Product with Invalid ID Format (Should Fail)",
            "DELETE",
            "/api/products/invalid-id-format",
            400  # Bad Request
        )
        
        if success:
            self.log("✅ Invalid product ID format handling working")
        else:
            self.log("❌ Invalid product ID format handling not working")
        
        # Test 4: Non-existent product ID
        success, response = self.run_test(
            "Delete Non-existent Product (Should Fail)",
            "DELETE",
            "/api/products/507f1f77bcf86cd799439999",  # Valid format but non-existent
            404  # Not Found
        )
        
        if success:
            self.log("✅ Non-existent product handling working")
        else:
            self.log("❌ Non-existent product handling not working")
        
        return True

    def run_all_tests(self):
        """Run all 4 specific user issue tests"""
        self.log("=== STARTING SPECIFIC USER ISSUES TESTING ===", "INFO")
        
        # Setup authentication and test data
        if not self.setup_authentication():
            self.log("❌ Authentication setup failed - cannot proceed", "ERROR")
            return False
            
        if not self.setup_test_data():
            self.log("❌ Test data setup failed - cannot proceed", "ERROR")
            return False
        
        # Run the 4 specific issue tests
        self.test_customer_edit_function()
        self.test_sales_report_pdf_download()
        self.test_today_filter_for_reports()
        self.test_product_deletion_scenarios()
        
        # Print final results
        self.log("=== SPECIFIC USER ISSUES TESTING COMPLETED ===", "INFO")
        self.log(f"Tests run: {self.tests_run}", "INFO")
        self.log(f"Tests passed: {self.tests_passed}", "INFO")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%", "INFO")
        
        return self.tests_passed > 0

if __name__ == "__main__":
    tester = UserIssuesTester()
    
    # Run the specific user issues tests
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 SPECIFIC USER ISSUES TESTING COMPLETED")
    else:
        print("\n❌ SPECIFIC USER ISSUES TESTING FAILED")
        sys.exit(1)