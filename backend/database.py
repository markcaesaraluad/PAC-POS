from motor.motor_asyncio import AsyncIOMotorClient
from decouple import config
import asyncio

# Separate the database name from the connection URL
MONGO_URL = config("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = config("DB_NAME", "pos_system")

class Database:
    client: AsyncIOMotorClient = None
    database = None

db = Database()

async def get_database():
    return db.database

async def connect_to_mongo():
    """Create database connection"""
    try:
        db.client = AsyncIOMotorClient(MONGO_URL)
        db.database = db.client[DB_NAME]  # Use environment variable instead of hardcoded
        
        # Test the connection
        await db.client.admin.command('ping')
        print(f"Connected to MongoDB - Database: {DB_NAME}")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise e

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        print("Disconnected from MongoDB")

# Database helper functions
async def get_collection(collection_name: str):
    database = await get_database()
    return database[collection_name]