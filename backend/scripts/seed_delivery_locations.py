"""Upsert policy-aligned standard delivery locations into MongoDB."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import database
from app.services.delivery_locations import seed_delivery_locations


async def main() -> None:
    await database.connect()
    try:
        result = await seed_delivery_locations(database.db)
        print(
            "Delivery location seed complete: "
            f"{result['inserted']} inserted, {result['updated']} updated."
        )
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
