#!/usr/bin/env python3
"""
Test Enhanced POS Features - 7 New Features
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import POSAPITester

def main():
    tester = POSAPITester()
    
    print("=== ENHANCED POS FEATURES TESTING (7 NEW FEATURES) ===")
    
    # Run basic setup
    if not tester.test_health_check():
        print("❌ Health check failed - stopping tests")
        return False
    
    if not tester.test_super_admin_setup():
        print("❌ Super admin setup failed - stopping tests")
        return False
    
    if not tester.test_business_admin_login():
        print("⚠️ Business admin login failed - continuing with super admin")
        tester.token = tester.super_admin_token
    
    if not tester.test_get_current_user():
        print("❌ Get current user failed")
    
    # Basic CRUD setup
    tester.test_categories_crud()
    tester.test_customers_crud()
    
    # Create a test product for sales testing
    try:
        # Get existing products first
        success, response = tester.run_test(
            "Get Existing Products",
            "GET",
            "/api/products",
            200
        )
        
        if success and response and len(response) > 0:
            # Use first existing product
            tester.product_id = response[0]['id']
            print(f"Using existing product: {tester.product_id}")
        else:
            # Create a test product
            product_data = {
                "name": "Enhanced Test Product",
                "description": "Product for enhanced POS testing",
                "sku": f"ENHANCED-TEST-{tester.tests_run}",
                "price": 29.99,
                "product_cost": 15.00,
                "quantity": 100,
                "category_id": tester.category_id,
                "barcode": f"ENH{tester.tests_run}"
            }
            
            success, response = tester.run_test(
                "Create Test Product for Enhanced Testing",
                "POST",
                "/api/products",
                200,
                data=product_data
            )
            
            if success and 'id' in response:
                tester.product_id = response['id']
                print(f"Created test product: {tester.product_id}")
    except Exception as e:
        print(f"Error setting up test product: {e}")
    
    # Run the enhanced POS features test
    success = tester.test_enhanced_pos_features()
    
    print(f"\n=== ENHANCED POS FEATURES TEST RESULTS ===")
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if success:
        print(f"\n🎉 Enhanced POS Features testing completed successfully!")
    else:
        print(f"\n❌ Enhanced POS Features testing completed with some failures!")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)