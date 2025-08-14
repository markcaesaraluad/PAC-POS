#!/usr/bin/env python3
"""
Focused test for TODAY date filtering issue in Sales and Profit Reports
"""

import requests
import json
from datetime import datetime, timedelta

class TodayFilterTester:
    def __init__(self):
        self.base_url = "https://pos-upgrade-1.preview.emergentagent.com/api"
        self.token = None
        self.business_id = None
        
    def login(self):
        """Login and get token"""
        # Super admin login
        response = requests.post(f"{self.base_url}/auth/login", json={
            "email": "admin@pos.com",
            "password": "admin123"
        })
        
        if response.status_code == 200:
            super_token = response.json()["access_token"]
            
            # Business admin login
            response = requests.post(f"{self.base_url}/auth/login", 
                                   json={
                                       "email": "admin@printsandcuts.com",
                                       "password": "admin123456",
                                       "business_subdomain": "prints-cuts-tagum"
                                   })
            
            if response.status_code == 200:
                self.token = response.json()["access_token"]
                return True
        return False
    
    def test_date_filtering_issue(self):
        """Test the specific TODAY date filtering issue"""
        if not self.login():
            print("❌ Login failed")
            return
            
        print("✅ Login successful")
        
        # Get today's date in different formats
        today = datetime.now()
        today_date_str = today.strftime('%Y-%m-%d')
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        print(f"🔍 Testing with today's date: {today_date_str}")
        print(f"   Start: {today_start.isoformat()}")
        print(f"   End: {today_end.isoformat()}")
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # TEST 1: Daily Summary for today
        print("\n📊 TEST 1: Daily Summary for Today")
        response = requests.get(f"{self.base_url}/reports/daily-summary", 
                              params={"date": today_date_str}, 
                              headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            sales_count = data.get('sales', {}).get('total_sales', 0)
            revenue = data.get('sales', {}).get('total_revenue', 0)
            print(f"✅ Daily Summary: {sales_count} sales, ${revenue} revenue")
        else:
            print(f"❌ Daily Summary failed: {response.status_code}")
            
        # TEST 2: Sales Report - Excel format with today's date
        print("\n📈 TEST 2: Sales Report - Excel Format (Today)")
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "excel",
                                  "start_date": today_date_str,
                                  "end_date": today_date_str
                              }, 
                              headers=headers)
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ Excel Sales Report: {content_length} bytes")
            if content_length > 1000:
                print("   ✅ Report appears to contain data")
            else:
                print("   ⚠️ Report may be empty (small size)")
        else:
            print(f"❌ Excel Sales Report failed: {response.status_code}")
            print(f"   Error: {response.text}")
            
        # TEST 3: Sales Report - PDF format with today's date
        print("\n📄 TEST 3: Sales Report - PDF Format (Today)")
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "pdf",
                                  "start_date": today_date_str,
                                  "end_date": today_date_str
                              }, 
                              headers=headers)
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ PDF Sales Report: {content_length} bytes")
            if content_length > 1000:
                print("   ✅ Report appears to contain data")
            else:
                print("   ⚠️ Report may be empty (small size)")
        else:
            print(f"❌ PDF Sales Report failed: {response.status_code}")
            print(f"   Error: {response.text}")
            
        # TEST 4: Profit Report - Excel format with today's date
        print("\n💰 TEST 4: Profit Report - Excel Format (Today)")
        response = requests.get(f"{self.base_url}/reports/profit", 
                              params={
                                  "format": "excel",
                                  "start_date": today_date_str,
                                  "end_date": today_date_str
                              }, 
                              headers=headers)
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ Excel Profit Report: {content_length} bytes")
            if content_length > 1000:
                print("   ✅ Report appears to contain data")
            else:
                print("   ⚠️ Report may be empty (small size)")
        else:
            print(f"❌ Excel Profit Report failed: {response.status_code}")
            print(f"   Error: {response.text}")
            
        # TEST 5: Date boundary testing - explicit time ranges
        print("\n⏰ TEST 5: Date Boundary Testing")
        
        # Test with explicit time boundaries
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "excel",
                                  "start_date": today_start.isoformat(),
                                  "end_date": today_end.isoformat()
                              }, 
                              headers=headers)
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ Sales Report (Explicit Time): {content_length} bytes")
        else:
            print(f"❌ Sales Report (Explicit Time) failed: {response.status_code}")
            
        # Test with date-only end_date (potential issue)
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "excel",
                                  "start_date": today_date_str,
                                  "end_date": today_date_str  # This might default to 00:00:00
                              }, 
                              headers=headers)
        
        if response.status_code == 200:
            content_length = len(response.content)
            print(f"✅ Sales Report (Date Only): {content_length} bytes")
            print("   ⚠️ This might be the issue - end_date without time defaults to 00:00:00")
        else:
            print(f"❌ Sales Report (Date Only) failed: {response.status_code}")
            
        print("\n🔍 INVESTIGATION COMPLETE")
        print("Key findings:")
        print("1. Check if Daily Summary shows sales data for today")
        print("2. Compare report sizes between different date formats")
        print("3. Look for differences between explicit time boundaries vs date-only")

if __name__ == "__main__":
    tester = TodayFilterTester()
    tester.test_date_filtering_issue()