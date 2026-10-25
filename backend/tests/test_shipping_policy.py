import pytest

from app.services.shipping_policy import quote_delivery, resolve_delivery_zone


@pytest.mark.parametrize(
    ("amount", "district", "expected_fee", "expected_zone"),
    [
        (19_999, "Dhaka", 60, "zone_1"),
        (20_000, "Dhaka", 0, "zone_1"),
        (20_000, "Gazipur", 0, "zone_2"),
        (19_999, "Narayanganj", 100, "zone_2"),
        (49_999, "Chattogram", 120, "zone_3"),
        (50_000, "Chattogram", 0, "zone_3"),
        (49_999, "Cumilla", 150, "zone_4"),
        (50_000, "Cumilla", 0, "zone_4"),
    ],
)
def test_policy_standard_fees_and_free_thresholds(
    amount: int,
    district: str,
    expected_fee: int,
    expected_zone: str,
) -> None:
    quote = quote_delivery(amount, district, "Central")
    assert quote.fee == expected_fee
    assert quote.zone == expected_zone


def test_explicit_remote_location_requires_quote() -> None:
    assert resolve_delivery_zone(
        "Bandarban",
        "Thanchi",
        configured_zone="remote",
    ) == "remote"
    with pytest.raises(ValueError, match="requires a support quote"):
        quote_delivery(
            80_000,
            "Bandarban",
            "Thanchi",
            configured_zone="remote",
        )


def test_invalid_order_total_is_rejected() -> None:
    with pytest.raises(ValueError, match="cannot be negative"):
        quote_delivery(-1, "Dhaka", "Dhanmondi")
