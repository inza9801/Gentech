"""Seed checkout locations aligned with the published delivery zones."""

from __future__ import annotations

from typing import Any


_ZONE_1_AREAS = {
    ("Dhaka", "Dhanmondi"),
    ("Dhaka", "Mirpur"),
    ("Dhaka", "Uttara"),
}
_ZONE_2_AREAS = {
    ("Dhaka", "Savar"),
    ("Dhaka", "Keraniganj"),
    ("Gazipur", "Gazipur City"),
    ("Gazipur", "Tongi"),
    ("Narayanganj", "Narayanganj City"),
    ("Narsingdi", "Narsingdi Town"),
}
_ZONE_3_AREAS = {
    ("Chattogram", "Agrabad"),
    ("Chattogram", "Panchlaish"),
    ("Sylhet", "Sylhet City Centre"),
    ("Rajshahi", "Rajshahi City Centre"),
    ("Khulna", "Khulna City Centre"),
    ("Barishal", "Barishal City Centre"),
    ("Rangpur", "Rangpur City Centre"),
    ("Mymensingh", "Mymensingh City Centre"),
}
_ZONE_4_DISTRICTS = (
    "Faridpur",
    "Gopalganj",
    "Kishoreganj",
    "Madaripur",
    "Manikganj",
    "Munshiganj",
    "Rajbari",
    "Shariatpur",
    "Tangail",
    "Bandarban",
    "Brahmanbaria",
    "Chandpur",
    "Cumilla",
    "Cox's Bazar",
    "Feni",
    "Khagrachhari",
    "Lakshmipur",
    "Noakhali",
    "Rangamati",
    "Bogura",
    "Joypurhat",
    "Naogaon",
    "Natore",
    "Chapainawabganj",
    "Pabna",
    "Sirajganj",
    "Bagerhat",
    "Chuadanga",
    "Jashore",
    "Jhenaidah",
    "Kushtia",
    "Magura",
    "Meherpur",
    "Narail",
    "Satkhira",
    "Barguna",
    "Bhola",
    "Jhalokati",
    "Patuakhali",
    "Pirojpur",
    "Habiganj",
    "Moulvibazar",
    "Sunamganj",
    "Dinajpur",
    "Gaibandha",
    "Kurigram",
    "Lalmonirhat",
    "Nilphamari",
    "Panchagarh",
    "Thakurgaon",
    "Jamalpur",
    "Netrokona",
    "Sherpur",
)


def delivery_location_records() -> list[dict[str, Any]]:
    """Return idempotent location records for standard delivery coverage."""
    locations = [
        {"district": district, "area": area, "deliveryZone": zone}
        for areas, zone in (
            (_ZONE_1_AREAS, "zone_1"),
            (_ZONE_2_AREAS, "zone_2"),
            (_ZONE_3_AREAS, "zone_3"),
        )
        for district, area in sorted(areas)
    ]
    locations.extend(
        {
            "district": district,
            "area": "District Town",
            "deliveryZone": "zone_4",
        }
        for district in _ZONE_4_DISTRICTS
    )
    return [
        {**location, "active": True}
        for location in locations
    ]


async def seed_delivery_locations(db: Any) -> dict[str, int]:
    """Upsert policy service locations without replacing existing location IDs."""
    inserted = 0
    updated = 0
    for location in delivery_location_records():
        result = await db.locations.update_one(
            {
                "district": location["district"],
                "area": location["area"],
            },
            {"$set": location},
            upsert=True,
        )
        inserted += int(result.upserted_id is not None)
        updated += int(result.matched_count > 0)
    return {"inserted": inserted, "updated": updated}
