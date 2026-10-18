async def get_all_categories(db):
    cursor = db["products"].find().sort("name", 1)

    categories = await cursor.to_list(length=None)

    for category in categories:
        category["id"] = str(category.pop("_id"))

    return categories