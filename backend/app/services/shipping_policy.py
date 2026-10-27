"""Delivery pricing rules transcribed from the Gentech shipping policy."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DeliveryQuote:
    zone: str
    zone_label: str
    fee: int


_ZONE_2_DISTRICTS = {
    "gazipur",
    "narayanganj",
    "savar",
    "keraniganj",
    "tongi",
    "narsingdi",
}
_ZONE_3_DISTRICTS = {
    "chattogram",
    "chittagong",
    "sylhet",
    "rajshahi",
    "khulna",
    "barishal",
    "barisal",
    "rangpur",
    "mymensingh",
}


def _normalized(value: str) -> str:
    return " ".join(
        value.casefold()
        .replace("-", " ")
        .replace("_", " ")
        .replace(":", " ")
        .replace("(", " ")
        .replace(")", " ")
        .split()
    )


def resolve_delivery_zone(
    district: str,
    area: str,
    *,
    configured_zone: str | None = None,
) -> str:
    """Resolve the delivery policy zone, honoring an explicit location setting."""
    if configured_zone:
        normalized_zone = _normalized(configured_zone)
        if normalized_zone in {"remote", "remote areas"}:
            return "remote"
        if normalized_zone in {"dhaka", "1", "zone 1", "zone 1 dhaka city"}:
            return "zone_1"
        if normalized_zone in {"2", "zone 2", "zone 2 greater dhaka"}:
            return "zone_2"
        if normalized_zone in {"3", "zone 3", "zone 3 divisional cities"}:
            return "zone_3"
        if normalized_zone in {"4", "zone 4", "zone 4 other districts"}:
            return "zone_4"
        raise ValueError(f"Unknown delivery zone configured for location: {configured_zone}")

    district_name = _normalized(district)
    area_name = _normalized(area)
    if district_name in _ZONE_2_DISTRICTS or area_name in _ZONE_2_DISTRICTS:
        return "zone_2"
    if district_name in {"dhaka", "dhaka north", "dhaka south"}:
        return "zone_1"
    if district_name in _ZONE_3_DISTRICTS:
        return "zone_3"
    return "zone_4"


def quote_delivery(
    order_total_after_discounts: int,
    district: str,
    area: str,
    *,
    configured_zone: str | None = None,
) -> DeliveryQuote:
    """Return the fixed delivery fee assigned to the resolved zone."""
    if order_total_after_discounts < 0:
        raise ValueError("Order total after discounts cannot be negative.")
    zone = resolve_delivery_zone(district, area, configured_zone=configured_zone)
    if zone == "remote":
        raise ValueError("Remote-area delivery requires a support quote.")

    fees = {
        "zone_1": ("Zone 1: Dhaka city", 60),
        "zone_2": ("Zone 2: Greater Dhaka", 100),
        "zone_3": ("Zone 3: Divisional cities", 120),
        "zone_4": ("Zone 4: Other districts and upazilas", 150),
    }
    zone_label, fee = fees[zone]
    return DeliveryQuote(
        zone=zone,
        zone_label=zone_label,
        fee=fee,
    )
