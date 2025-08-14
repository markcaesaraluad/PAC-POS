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
        print("\n⏰ TEST 5: Date Boundary Testing - DETAILED")
        
        # Test 1: Date only (potential issue)
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "excel",
                                  "start_date": today_date_str,
                                  "end_date": today_date_str  # This defaults to 00:00:00
                              }, 
                              headers=headers)
        
        date_only_size = 0
        if response.status_code == 200:
            date_only_size = len(response.content)
            print(f"✅ Sales Report (Date Only): {date_only_size} bytes")
        else:
            print(f"❌ Sales Report (Date Only) failed: {response.status_code}")
            
        # Test 2: Explicit start of day to start of next day
        tomorrow = today + timedelta(days=1)
        tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "excel",
                                  "start_date": today_start.isoformat(),
                                  "end_date": tomorrow_start.isoformat()
                              }, 
                              headers=headers)
        
        full_day_size = 0
        if response.status_code == 200:
            full_day_size = len(response.content)
            print(f"✅ Sales Report (Full Day): {full_day_size} bytes")
        else:
            print(f"❌ Sales Report (Full Day) failed: {response.status_code}")
            
        # Test 3: Explicit time boundaries (00:00:00 to 23:59:59)
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "excel",
                                  "start_date": today_start.isoformat(),
                                  "end_date": today_end.isoformat()
                              }, 
                              headers=headers)
        
        explicit_time_size = 0
        if response.status_code == 200:
            explicit_time_size = len(response.content)
            print(f"✅ Sales Report (Explicit Time): {explicit_time_size} bytes")
        else:
            print(f"❌ Sales Report (Explicit Time) failed: {response.status_code}")
            
        # Test 4: Start date with time, end date without time
        response = requests.get(f"{self.base_url}/reports/sales", 
                              params={
                                  "format": "excel",
                                  "start_date": today_start.isoformat(),
                                  "end_date": today_date_str  # Date only - should default to 00:00:00
                              }, 
                              headers=headers)
        
        mixed_format_size = 0
        if response.status_code == 200:
            mixed_format_size = len(response.content)
            print(f"✅ Sales Report (Mixed Format): {mixed_format_size} bytes")
        else:
            print(f"❌ Sales Report (Mixed Format) failed: {response.status_code}")
            
        print(f"\n📊 SIZE COMPARISON:")
        print(f"   Date Only (start=date, end=date): {date_only_size} bytes")
        print(f"   Full Day (start=00:00, end=next_day_00:00): {full_day_size} bytes")
        print(f"   Explicit Time (start=00:00, end=23:59): {explicit_time_size} bytes")
        print(f"   Mixed Format (start=00:00, end=date): {mixed_format_size} bytes")
        
        if date_only_size < explicit_time_size:
            print(f"\n🚨 ISSUE CONFIRMED:")
            print(f"   Date-only format returns {explicit_time_size - date_only_size} fewer bytes")
            print(f"   This suggests end_date without time defaults to 00:00:00")
            print(f"   This excludes all sales after midnight on the end date")
        
        # Test the same with Profit Report
        print(f"\n💰 PROFIT REPORT COMPARISON:")
        
        # Date only
        response = requests.get(f"{self.base_url}/reports/profit", 
                              params={
                                  "format": "excel",
                                  "start_date": today_date_str,
                                  "end_date": today_date_str
                              }, 
                              headers=headers)
        
        profit_date_only = len(response.content) if response.status_code == 200 else 0
        
        # Explicit time
        response = requests.get(f"{self.base_url}/reports/profit", 
                              params={
                                  "format": "excel",
                                  "start_date": today_start.isoformat(),
                                  "end_date": today_end.isoformat()
                              }, 
                              headers=headers)
        
        profit_explicit_time = len(response.content) if response.status_code == 200 else 0
        
        print(f"   Profit Report (Date Only): {profit_date_only} bytes")
        print(f"   Profit Report (Explicit Time): {profit_explicit_time} bytes")
        
        if profit_date_only < profit_explicit_time:
            print(f"   🚨 Same issue in Profit Report: {profit_explicit_time - profit_date_only} bytes difference")
            
        print("\n🔍 INVESTIGATION COMPLETE")
        print("Key findings:")
        print("1. Check if Daily Summary shows sales data for today")
        print("2. Compare report sizes between different date formats")
        print("3. Look for differences between explicit time boundaries vs date-only")

if __name__ == "__main__":
    tester = TodayFilterTester()
    tester.test_date_filtering_issue()