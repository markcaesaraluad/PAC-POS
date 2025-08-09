"""
Migration script to handle product cost field updates and create initial cost history
"""

import asyncio
from database import connect_to_mongo, close_mongo_connection, get_collection
from datetime import datetime
from bson import ObjectId

async def migrate_product_costs():
    """Migrate existing products to use product_cost field and create cost history"""
    
    print("Starting product cost migration...")
    
    try:
        # Get collections
        products_collection = await get_collection("products")
        cost_history_collection = await get_collection("product_cost_history")
        users_collection = await get_collection("users")
        
        # Find a system user (first business admin) for the migration
        system_user = await users_collection.find_one({"role": "business_admin"})
        if not system_user:
            system_user = await users_collection.find_one({"role": "super_admin"})
        
        if not system_user:
            print("No admin user found for migration. Please ensure you have admin users.")
            return
        
        system_user_id = system_user["_id"]
        
        # Get all products
        products = await products_collection.find({}).to_list(length=None)
        
        print(f"Found {len(products)} products to migrate...")
        
        migrated_count = 0
        
        for product in products:
            business_id = product.get("business_id")
            if not business_id:
                continue
            
            # Check if product has old 'cost' field or needs product_cost
            old_cost = product.get("cost", 0.0)
            product_cost = product.get("product_cost")
            
            update_needed = False
            cost_to_set = 0.0
            
            if product_cost is None:
                # Need to set product_cost
                if old_cost is not None and old_cost > 0:
                    cost_to_set = float(old_cost)
                else:
                    cost_to_set = 0.0
                update_needed = True
            
            if update_needed:
                # Update product with product_cost field
                update_result = await products_collection.update_one(
                    {"_id": product["_id"]},
                    {
                        "$set": {
                            "product_cost": cost_to_set,
                            "updated_at": datetime.utcnow()
                        },
                        "$unset": {"cost": ""} if "cost" in product else {}
                    }
                )
                
                if update_result.modified_count > 0:
                    # Create initial cost history entry
                    cost_history_doc = {
                        "_id": ObjectId(),
                        "business_id": ObjectId(business_id),
                        "product_id": product["_id"],
                        "cost": cost_to_set,
                        "effective_from": product.get("created_at", datetime.utcnow()),
                        "changed_by": ObjectId(system_user_id),
                        "notes": "Migration: Initial cost entry from legacy system",
                        "created_at": datetime.utcnow()
                    }
                    
                    await cost_history_collection.insert_one(cost_history_doc)
                    migrated_count += 1
                    
                    print(f"Migrated product {product.get('name', 'Unknown')} (ID: {product['_id']}) - Cost: ${cost_to_set:.2f}")
        
        print(f"Migration completed! Migrated {migrated_count} products.")
        
        # Create indexes for better performance
        print("Creating database indexes...")
        
        # Index on product_cost_history
        await cost_history_collection.create_index([
            ("product_id", 1),
            ("effective_from", -1)
        ])
        
        await cost_history_collection.create_index([
            ("business_id", 1),
            ("product_id", 1),
            ("effective_from", -1)
        ])
        
        # Index on products for cost queries
        await products_collection.create_index([
            ("business_id", 1),
            ("product_cost", 1)
        ])
        
        print("Database indexes created successfully!")
        
    except Exception as e:
        print(f"Migration failed: {str(e)}")
        raise

async def main():
    """Main migration function"""
    await connect_to_mongo()
    try:
        await migrate_product_costs()
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())