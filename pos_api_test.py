#!/usr/bin/env python3
"""
Test the exact API sequence that POS interface uses
"""

import requests
import json

def test_pos_api_sequence():
    base_url = "https://c0ab9037-c0e6-4a6d-9f88-62db3dc10976.preview.emergentagent.com"
    
    # Step 1: Login as business admin
    print("🔐 Step 1: Logging in as business admin...")
    login_response = requests.post(
        f"{base_url}/api/auth/login",
        json={
            "email": "admin@printsandcuts.com",
            "password": "admin123456",
            "business_subdomain": "prints-cuts-tagum"
        }
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
        return False
    
    token = login_response.json()['access_token']
    print(f"✅ Login successful")
    
    # Step 2: Test the exact Promise.all() sequence that POS uses
    print("\n🔄 Step 2: Testing Promise.all() sequence (Products, Categories, Customers)...")
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # Simulate Promise.all() by making all three requests
    try:
        # Products API
        products_response = requests.get(f"{base_url}/api/products", headers=headers)
        print(f"📦 Products API: {products_response.status_code}")
        
        # Categories API  
        categories_response = requests.get(f"{base_url}/api/categories", headers=headers)
        print(f"📂 Categories API: {categories_response.status_code}")
        
        # Customers API (the previously failing one)
        customers_response = requests.get(f"{base_url}/api/customers", headers=headers)
        print(f"👥 Customers API: {customers_response.status_code}")
        
        # Check if all APIs succeeded (like Promise.all() would)
        if all(r.status_code == 200 for r in [products_response, categories_response, customers_response]):
            print("\n✅ SUCCESS: All APIs returned 200 - Promise.all() would succeed!")
            
            # Parse responses
            products = products_response.json()
            categories = categories_response.json()
            customers = customers_response.json()
            
            print(f"📊 Results:")
            print(f"   - Products: {len(products)} items")
            print(f"   - Categories: {len(categories)} items")
            print(f"   - Customers: {len(customers)} items")
            
            print(f"\n🎯 POS Interface should now display products correctly!")
            return True
            
        else:
            print("\n❌ FAILURE: One or more APIs failed - Promise.all() would fail!")
            
            # Show which APIs failed
            if products_response.status_code != 200:
                print(f"   - Products API failed: {products_response.status_code}")
            if categories_response.status_code != 200:
                print(f"   - Categories API failed: {categories_response.status_code}")
            if customers_response.status_code != 200:
                print(f"   - Customers API failed: {customers_response.status_code}")
                
            return False
            
    except Exception as e:
        print(f"❌ Error during API testing: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_pos_api_sequence()
    
    if success:
        print("\n🎉 CONCLUSION: The POS 'No products found' bug should now be FIXED!")
        print("   The customers API 500 error has been resolved.")
        print("   All three APIs (products, categories, customers) are working correctly.")
        print("   Promise.all() in the frontend should now succeed.")
    else:
        print("\n💥 CONCLUSION: There are still issues that need to be addressed.")