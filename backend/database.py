from motor.motor_asyncio import AsyncIOMotorClient
from decouple import config
import asyncio

MONGO_URL = config("MONGO_URL", default="mongodb://localhost:27017/pos_system")

class Database:
    client: AsyncIOMotorClient = None
    database = None

db = Database()

async def get_database():
    return db.database

async def connect_to_mongo():
    """Create database connection"""
    db.client = AsyncIOMotorClient(MONGO_URL)
    db.database = db.client.pos_system
    print("Connected to MongoDB")

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        print("Disconnected from MongoDB")

# Database helper functions
async def get_collection(collection_name: str):
    database = await get_database()
    return database[collection_name]