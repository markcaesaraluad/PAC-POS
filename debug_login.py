#!/usr/bin/env python3
"""
Debug login issue
"""

import requests
import json

base_url = "https://b3786809-e7a6-4054-a6f1-57c413252394.preview.emergentagent.com"

# Test business admin login with detailed error info
login_data = {
    "email": "admin@printsandcuts.com",
    "password": "admin123456",
    "business_subdomain": "prints-cuts-tagum"
}

print("Testing business admin login...")
print(f"URL: {base_url}/api/auth/login")
print(f"Data: {json.dumps(login_data, indent=2)}")

response = requests.post(
    f"{base_url}/api/auth/login",
    json=login_data,
    headers={'Content-Type': 'application/json'}
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")

# Also test without subdomain
login_data_no_subdomain = {
    "email": "admin@printsandcuts.com",
    "password": "admin123456"
}

print("\n" + "="*50)
print("Testing business admin login without subdomain...")
print(f"Data: {json.dumps(login_data_no_subdomain, indent=2)}")

response2 = requests.post(
    f"{base_url}/api/auth/login",
    json=login_data_no_subdomain,
    headers={'Content-Type': 'application/json'}
)

print(f"Status Code: {response2.status_code}")
print(f"Response: {response2.text}")