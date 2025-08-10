#!/usr/bin/env python3
"""
Quick Health Check for Backend API after Frontend Fixes
Tests core functionality to ensure no regressions
"""

import requests
import sys
import json
from datetime import datetime

class QuickHealthCheck:
    def __init__(self, base_url="https://c5e297fc-0b24-49ca-97d7-7ab4548e3561.preview.emergentagent.com"):
        self.base_url = base_url
        self.super_admin_token = None
        self.business_admin_token = None
        self.tests_run = 0
        self.tests_passed = 0

    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data=None, headers=None) -> tuple[bool, dict]:
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"Testing {name}...")

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)

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
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/api/health",
            200
        )
        if success and response.get('status') == 'healthy':
            self.log("✅ Health check passed - API is healthy")
            return True
        return False

    def test_super_admin_login(self):
        """Test super admin authentication"""
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
            self.log("✅ Super admin authentication working")
            return True
        return False

    def test_business_admin_login(self):
        """Test business admin authentication"""
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
            self.log("✅ Business admin authentication working")
            return True
        return False

    def test_business_api_endpoints(self):
        """Test basic business API endpoints"""
        if not self.business_admin_token:
            self.log("❌ No business admin token available", "ERROR")
            return False

        headers = {'Authorization': f'Bearer {self.business_admin_token}'}
        
        # Test products endpoint
        success1, _ = self.run_test(
            "Get Products",
            "GET",
            "/api/products",
            200,
            headers=headers
        )
        
        # Test categories endpoint
        success2, _ = self.run_test(
            "Get Categories",
            "GET",
            "/api/categories",
            200,
            headers=headers
        )
        
        # Test customers endpoint
        success3, _ = self.run_test(
            "Get Customers",
            "GET",
            "/api/customers",
            200,
            headers=headers
        )
        
        # Test sales endpoint
        success4, _ = self.run_test(
            "Get Sales",
            "GET",
            "/api/sales",
            200,
            headers=headers
        )

        if success1 and success2 and success3 and success4:
            self.log("✅ All basic business API endpoints working")
            return True
        return False

    def test_business_info(self):
        """Test business info endpoint"""
        if not self.business_admin_token:
            return False

        headers = {'Authorization': f'Bearer {self.business_admin_token}'}
        
        success, response = self.run_test(
            "Get Business Info",
            "GET",
            "/api/business/info",
            200,
            headers=headers
        )
        
        if success and 'name' in response:
            self.log(f"✅ Business info accessible - Business: {response.get('name')}")
            return True
        return False

    def run_all_tests(self):
        """Run all health check tests"""
        self.log("=== QUICK HEALTH CHECK STARTED ===")
        self.log(f"Testing against: {self.base_url}")
        
        # Core health check
        health_ok = self.test_health_check()
        
        # Authentication tests
        super_admin_ok = self.test_super_admin_login()
        business_admin_ok = self.test_business_admin_login()
        
        # Business API tests
        business_apis_ok = self.test_business_api_endpoints()
        business_info_ok = self.test_business_info()
        
        # Summary
        self.log("=== QUICK HEALTH CHECK RESULTS ===")
        self.log(f"Tests completed: {self.tests_passed}/{self.tests_run}")
        
        if health_ok and super_admin_ok and business_admin_ok and business_apis_ok and business_info_ok:
            self.log("✅ ALL CORE SYSTEMS WORKING - No regressions detected", "SUCCESS")
            return True
        else:
            self.log("❌ Some core systems have issues", "WARNING")
            return False

if __name__ == "__main__":
    checker = QuickHealthCheck()
    success = checker.run_all_tests()
    sys.exit(0 if success else 1)