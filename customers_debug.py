#!/usr/bin/env python3
"""
Debug script to investigate customers API 500 error
"""

import requests
import json

def test_customers_api():
    base_url = "https://d519676e-f0c2-4fde-9a8e-a1574c01622c.preview.emergentagent.com"
    
    # Step 1: Login as business admin
    print("Step 1: Logging in as business admin...")
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
        return
    
    token = login_response.json()['access_token']
    print(f"✅ Login successful, token obtained")
    
    # Step 2: Get current user info
    print("\nStep 2: Getting current user info...")
    user_response = requests.get(
        f"{base_url}/api/auth/me",
        headers={'Authorization': f'Bearer {token}'}
    )
    
    if user_response.status_code == 200:
        user_info = user_response.json()
        print(f"✅ User info: {user_info.get('email')} - Role: {user_info.get('role')} - Business ID: {user_info.get('business_id')}")
    else:
        print(f"❌ User info failed: {user_response.status_code} - {user_response.text}")
    
    # Step 3: Test customers API
    print("\nStep 3: Testing customers API...")
    customers_response = requests.get(
        f"{base_url}/api/customers",
        headers={'Authorization': f'Bearer {token}'}
    )
    
    print(f"Status Code: {customers_response.status_code}")
    print(f"Headers: {dict(customers_response.headers)}")
    
    if customers_response.status_code == 200:
        customers = customers_response.json()
        print(f"✅ Customers API successful: {len(customers)} customers found")
        if customers:
            print(f"Sample customer: {json.dumps(customers[0], indent=2)}")
    else:
        print(f"❌ Customers API failed: {customers_response.status_code}")
        print(f"Response text: {customers_response.text}")
        
        # Try to get more details
        try:
            error_detail = customers_response.json()
            print(f"Error detail: {json.dumps(error_detail, indent=2)}")
        except:
            print("Could not parse error response as JSON")
    
    # Step 4: Test other APIs for comparison
    print("\nStep 4: Testing other APIs for comparison...")
    
    # Test products API
    products_response = requests.get(
        f"{base_url}/api/products",
        headers={'Authorization': f'Bearer {token}'}
    )
    print(f"Products API: {products_response.status_code} - {len(products_response.json()) if products_response.status_code == 200 else 'Failed'}")
    
    # Test categories API
    categories_response = requests.get(
        f"{base_url}/api/categories",
        headers={'Authorization': f'Bearer {token}'}
    )
    print(f"Categories API: {categories_response.status_code} - {len(categories_response.json()) if categories_response.status_code == 200 else 'Failed'}")

if __name__ == "__main__":
    test_customers_api()