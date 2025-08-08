#!/usr/bin/env python3
"""
Initialize Super Admin User
Run this script once to create the first super admin user
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from auth_utils import get_password_hash
from models import UserRole
from decouple import config
from datetime import datetime
from bson import ObjectId

MONGO_URL = config("MONGO_URL", default="mongodb://localhost:27017/pos_system")

async def create_super_admin():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.pos_system
    users_collection = db.users
    
    # Check if super admin already exists
    existing_admin = await users_collection.find_one({"role": "super_admin"})
    if existing_admin:
        print("Super admin already exists!")
        print(f"Email: {existing_admin['email']}")
        return
    
    # Get super admin details
    email = input("Enter super admin email: ")
    password = input("Enter super admin password: ")
    full_name = input("Enter super admin full name: ")
    
    if not email or not password or not full_name:
        print("All fields are required!")
        sys.exit(1)
    
    # Create super admin user
    admin_doc = {
        "_id": ObjectId(),
        "email": email,
        "password": get_password_hash(password),
        "full_name": full_name,
        "role": UserRole.SUPER_ADMIN,
        "business_id": None,  # Super admin doesn't belong to any business
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    await users_collection.insert_one(admin_doc)
    print(f"Super admin created successfully!")
    print(f"Email: {email}")
    print(f"You can now login with these credentials.")
    
    client.close()

if __name__ == "__main__":
    print("=== Super Admin Setup ===")
    print("This will create the first super admin user for the POS system.")
    print("")
    
    try:
        asyncio.run(create_super_admin())
    except KeyboardInterrupt:
        print("\nSetup cancelled.")
    except Exception as e:
        print(f"Error: {e}")