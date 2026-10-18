from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = None
db = None


async def connect():
    global client, db

    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]

    # Check whether MongoDB is reachable
    await client.admin.command("ping")

    print("Connected to MongoDB:", settings.mongodb_db)


async def close():
    global client, db

    if client is not None:
        client.close()
        client = None
        db = None

        print("MongoDB connection closed")


async def get_db():
    if db is None:
        raise RuntimeError("Database is not connected")

    return db