#!/usr/bin/env python3
"""
Test script specifically for profit report download functionality
"""

import sys
import os
sys.path.append('/app')

from backend_test import POSAPITester

def main():
    """Run profit report tests"""
    tester = POSAPITester()
    
    print("=== STARTING PROFIT REPORT DOWNLOAD TESTING ===")
    
    # Setup authentication first
    if not tester.test_health_check():
        print("❌ Health check failed - cannot proceed")
        return False
        
    if not tester.test_super_admin_setup():
        print("❌ Super admin setup failed - cannot proceed")
        return False
        
    if not tester.test_business_admin_login():
        print("❌ Business admin login failed - cannot proceed")
        return False
        
    if not tester.test_get_current_user():
        print("❌ Get current user failed - cannot proceed")
        return False
    
    # Run the specific profit report download tests
    success = tester.test_profit_report_download_functionality()
    
    # Print summary
    tester.print_summary()
    
    print("=== PROFIT REPORT DOWNLOAD TESTING COMPLETED ===")
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)