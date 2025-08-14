#!/usr/bin/env python3
"""
Test script to verify profit report response headers and content
"""

import requests
import sys
import os
sys.path.append('/app')

from backend_test import POSAPITester

def test_profit_report_headers():
    """Test profit report response headers and content"""
    tester = POSAPITester()
    
    print("=== TESTING PROFIT REPORT HEADERS AND CONTENT ===")
    
    # Setup authentication
    tester.test_health_check()
    tester.test_super_admin_setup()
    tester.test_business_admin_login()
    tester.test_get_current_user()
    
    base_url = "https://pos-upgrade-1.preview.emergentagent.com"
    headers = {'Authorization': f'Bearer {tester.business_admin_token}'}
    
    # Test Excel format
    print("\n🔍 Testing Excel Format Headers and Content")
    response = requests.get(f"{base_url}/api/reports/profit?format=excel", headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'Not set')}")
    print(f"Content-Disposition: {response.headers.get('content-disposition', 'Not set')}")
    print(f"Content Length: {len(response.content)} bytes")
    
    if response.status_code == 200:
        # Check if it's actually Excel content
        if response.content.startswith(b'PK'):  # Excel files start with PK
            print("✅ Excel file content verified (starts with PK signature)")
        else:
            print("❌ Excel file content invalid")
            
        # Check headers
        expected_excel_mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if expected_excel_mime in response.headers.get('content-type', ''):
            print("✅ Excel Content-Type header correct")
        else:
            print(f"❌ Excel Content-Type incorrect: {response.headers.get('content-type')}")
            
        if "attachment" in response.headers.get('content-disposition', ''):
            print("✅ Excel Content-Disposition header correct")
        else:
            print(f"❌ Excel Content-Disposition incorrect: {response.headers.get('content-disposition')}")
    
    # Test CSV format
    print("\n🔍 Testing CSV Format Headers and Content")
    response = requests.get(f"{base_url}/api/reports/profit?format=csv", headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('content-type', 'Not set')}")
    print(f"Content-Disposition: {response.headers.get('content-disposition', 'Not set')}")
    print(f"Content Length: {len(response.content)} bytes")
    
    if response.status_code == 200:
        # Check if it's actually CSV content
        try:
            csv_content = response.content.decode('utf-8')
            if "Prints & Cuts Tagum" in csv_content and "SUMMARY" in csv_content:
                print("✅ CSV file content verified (contains expected business data)")
            else:
                print("❌ CSV file content invalid")
                print(f"First 200 chars: {csv_content[:200]}")
        except:
            print("❌ CSV file content not decodable as UTF-8")
            
        # Check headers
        if "text/csv" in response.headers.get('content-type', ''):
            print("✅ CSV Content-Type header correct")
        else:
            print(f"❌ CSV Content-Type incorrect: {response.headers.get('content-type')}")
            
        if "attachment" in response.headers.get('content-disposition', ''):
            print("✅ CSV Content-Disposition header correct")
        else:
            print(f"❌ CSV Content-Disposition incorrect: {response.headers.get('content-disposition')}")
    
    # Test without authentication
    print("\n🔍 Testing Authentication Requirement")
    response = requests.get(f"{base_url}/api/reports/profit?format=excel")
    print(f"Status Code without auth: {response.status_code}")
    if response.status_code in [401, 403]:
        print("✅ Authentication correctly required")
    else:
        print("❌ Authentication not properly enforced")
    
    print("\n=== PROFIT REPORT HEADERS AND CONTENT TESTING COMPLETED ===")

if __name__ == "__main__":
    test_profit_report_headers()