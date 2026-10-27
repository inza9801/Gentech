import pytest

from app.services.shipping_policy import quote_delivery, resolve_delivery_zone


@pytest.mark.parametrize(
    ("amount", "district", "expected_fee", "expected_zone"),
    [
        (19_999, "Dhaka", 60, "zone_1"),
        (20_000, "Dhaka", 60, "zone_1"),
        (25_000, "Gazipur", 100, "zone_2"),
        (19_999, "Narayanganj", 100, "zone_2"),
        (49_999, "Chattogram", 120, "zone_3"),
        (50_000, "Chattogram", 120, "zone_3"),
        (49_999, "Cumilla", 150, "zone_4"),
        (50_000, "Cumilla", 150, "zone_4"),
    ],
)
def test_policy_flat_fees_by_zone(
    amount: int,
    district: str,
    expected_fee: int,
    expected_zone: str,
) -> None:
    quote = quote_delivery(amount, district, "Central")
    assert quote.fee == expected_fee
    assert quote.zone == expected_zone


@pytest.mark.parametrize(
    ("configured_zone", "amount", "expected_fee"),
    [
        ("zone_1", 19_999, 60),
        ("zone_1", 20_000, 60),
        ("zone_1", 20_001, 60),
        ("zone_2", 19_999, 100),
        ("zone_2", 20_000, 100),
        ("zone_2", 20_001, 100),
        ("zone_3", 49_999, 120),
        ("zone_3", 50_000, 120),
        ("zone_3", 50_001, 120),
        ("zone_4", 49_999, 150),
        ("zone_4", 50_000, 150),
        ("zone_4", 50_001, 150),
    ],
)
def test_all_zone_fees_do_not_change_with_order_total(
    configured_zone: str,
    amount: int,
    expected_fee: int,
) -> None:
    quote = quote_delivery(
        amount,
        "Dhaka",
        "Dhanmondi",
        configured_zone=configured_zone,
    )
    assert quote.fee == expected_fee


@pytest.mark.parametrize(
    ("configured_zone", "expected_zone", "expected_fee"),
    [
        ("Zone 1: Dhaka city", "zone_1", 60),
        ("Zone 2: Greater Dhaka", "zone_2", 100),
    ],
)
def test_descriptive_configured_zone_labels_are_accepted(
    configured_zone: str,
    expected_zone: str,
    expected_fee: int,
) -> None:
    quote = quote_delivery(
        19_999,
        "Dhaka",
        "Dhanmondi",
        configured_zone=configured_zone,
    )
    assert quote.zone == expected_zone
    assert quote.fee == expected_fee


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


@pytest.mark.parametrize(
    ("configured_zone", "amount", "expected_fee"),
    [
        ("dhaka", 19_999, 60),
        ("Dhaka", 20_000, 60),
        ("zone_1", 19_999, 60),
    ],
)
def test_dhaka_zone_alias_applies_city_fee_without_threshold(
    configured_zone: str,
    amount: int,
    expected_fee: int,
) -> None:
    quote = quote_delivery(
        amount,
        "Dhaka",
        "Dhanmondi",
        configured_zone=configured_zone,
    )
    assert quote.zone == "zone_1"
    assert quote.fee == expected_fee


def test_invalid_order_total_is_rejected() -> None:
    with pytest.raises(ValueError, match="cannot be negative"):
        quote_delivery(-1, "Dhaka", "Dhanmondi")
