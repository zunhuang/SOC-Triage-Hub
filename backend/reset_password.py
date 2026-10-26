"""One-shot script to reset a user's password in MongoDB Atlas.

Usage (from backend/ with venv active):
    python reset_password.py admin@deloitte.com NewPassword123!
"""
import asyncio
import sys
from datetime import datetime, timezone

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

# Load .env
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "SOC-triage-hub")


async def reset(email: str, new_password: str) -> None:
    client = AsyncIOMotorClient(MONGODB_URI, tls=True, tlsAllowInvalidCertificates=True)
    db = client[MONGODB_DB_NAME]

    hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    result = await db.users.update_one(
        {"email": email.lower()},
        {"$set": {"password_hash": hashed, "updated_at": datetime.now(timezone.utc)}},
    )

    if result.matched_count == 0:
        # User doesn't exist — create them as admin
        await db.users.insert_one({
            "email": email.lower(),
            "password_hash": hashed,
            "first_name": "Admin",
            "last_name": None,
            "role": "admin",
            "auth_provider": "local",
            "azure_oid": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "last_login": None,
        })
        print(f"Created new admin user: {email}")
    else:
        print(f"Password reset for: {email}")

    client.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <email> <new_password>")
        sys.exit(1)
    asyncio.run(reset(sys.argv[1], sys.argv[2]))
