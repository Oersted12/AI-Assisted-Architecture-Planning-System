import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.payload_transform import aggregate_rooms, build_predict_plan_kwargs
from app.schemas import (
    PredictRequest,
    RegenerateBlueprintRequest,
    RoomConfig,
    RoomsStandardWithOverrides,
)


def valid_predict_payload():
    return {
        "lat": 7.0,
        "lng": 80.0,
        "address": "Test address",
        "landLength": 10.0,
        "landWidth": 8.0,
        "landAreaSqm": 80.0,
        "landAreaPerch": 3.16,
        "landShape": "Rectangular",
        "roadWidth": 6.0,
        "roadLabel": "Main road",
        "purpose": "House",
        "floors": 2,
        "layoutMode": "almost",
        "rooms": {
            "type": "standardWithOverrides",
            "standard": {
                "bedrooms": 2,
                "bathrooms": 1,
                "kitchens": 1,
                "visitorHalls": 1,
                "extraRooms": 0,
                "extraRoomNote": "",
                "roomTweaks": {},
            },
            "overrides": {},
        },
    }


def test_missing_optional_frontage_remains_none_in_model_kwargs():
    request = PredictRequest(**valid_predict_payload())

    kwargs = build_predict_plan_kwargs(request, zone_code="R2", area_name="Test")

    assert kwargs["road_frontage_m"] is None


@pytest.mark.parametrize(
    ("field", "bad_value"),
    [
        ("bedrooms", -1),
        ("bathrooms", -1),
        ("kitchens", -1),
        ("visitorHalls", -1),
        ("extraRooms", -1),
    ],
)
def test_room_counts_reject_negative_values(field, bad_value):
    with pytest.raises(ValidationError):
        RoomConfig(**{field: bad_value})


@pytest.mark.parametrize(
    ("field", "good_value"),
    [
        ("bedrooms", 0),
        ("bathrooms", 0),
        ("kitchens", 0),
        ("visitorHalls", 0),
        ("extraRooms", 0),
    ],
)
def test_room_counts_accept_zero(field, good_value):
    assert getattr(RoomConfig(**{field: good_value}), field) == good_value


@pytest.mark.parametrize(
    ("field", "bad_value"),
    [
        ("landLength", 0),
        ("landWidth", -1),
        ("landAreaSqm", float("inf")),
        ("landAreaPerch", float("nan")),
        ("roadWidth", 0),
        ("roadFrontage", -1),
    ],
)
def test_land_and_road_values_reject_bad_values(field, bad_value):
    payload = valid_predict_payload()
    payload[field] = bad_value
    with pytest.raises(ValidationError):
        PredictRequest(**payload)


@pytest.mark.parametrize(
    ("field", "good_value"),
    [
        ("landLength", 10),
        ("landWidth", 8),
        ("landAreaSqm", 80),
        ("landAreaPerch", 3.16),
        ("roadWidth", 6),
        ("roadFrontage", 5),
    ],
)
def test_land_and_road_values_accept_positive_finite_values(field, good_value):
    payload = valid_predict_payload()
    payload[field] = good_value
    assert getattr(PredictRequest(**payload), field) == good_value


@pytest.mark.parametrize(
    ("field", "bad_value"),
    [
        ("lat", -91),
        ("lat", float("inf")),
        ("lng", 181),
        ("lng", float("-inf")),
    ],
)
def test_coordinates_reject_out_of_range_or_nonfinite_values(field, bad_value):
    payload = valid_predict_payload()
    payload[field] = bad_value
    with pytest.raises(ValidationError):
        PredictRequest(**payload)


@pytest.mark.parametrize(("field", "good_value"), [("lat", -90), ("lat", 90), ("lng", -180), ("lng", 180)])
def test_coordinates_accept_boundary_values(field, good_value):
    payload = valid_predict_payload()
    payload[field] = good_value
    assert getattr(PredictRequest(**payload), field) == good_value


def test_parking_spaces_reject_negative_value():
    payload = valid_predict_payload()
    payload["parkingSpaces"] = -1
    with pytest.raises(ValidationError):
        PredictRequest(**payload)


def test_parking_spaces_accept_zero():
    payload = valid_predict_payload()
    payload["parkingSpaces"] = 0
    assert PredictRequest(**payload).parkingSpaces == 0


def test_variant_rejects_negative_value():
    with pytest.raises(ValidationError):
        RegenerateBlueprintRequest(
            purpose="House",
            layout_type="Standard",
            structure_type="Reinforced",
            landLength=10,
            landWidth=8,
            groundFloorAreaSqm=80,
            roadLabel="Main road",
            perFloorBreakdown=[],
            variant=-1,
        )


def test_variant_accepts_zero():
    request = RegenerateBlueprintRequest(
        purpose="House",
        layout_type="Standard",
        structure_type="Reinforced",
        landLength=10,
        landWidth=8,
        groundFloorAreaSqm=80,
        roadLabel="Main road",
        perFloorBreakdown=[],
        variant=0,
    )
    assert request.variant == 0


@pytest.mark.parametrize("bad_key", ["abc", "0", "-1"])
def test_floor_override_rejects_invalid_keys(bad_key):
    with pytest.raises(ValidationError):
        RoomsStandardWithOverrides(
            type="standardWithOverrides",
            standard=RoomConfig(),
            overrides={bad_key: RoomConfig(bedrooms=3)},
        )


def test_floor_override_positive_whole_number_is_accepted():
    rooms = RoomsStandardWithOverrides(
        type="standardWithOverrides",
        standard=RoomConfig(),
        overrides={"2": RoomConfig(bedrooms=3)},
    )
    assert rooms.overrides["2"].bedrooms == 3


def test_floor_override_01_is_canonicalized_and_used():
    payload = valid_predict_payload()
    payload["rooms"]["overrides"] = {"01": {"bedrooms": 4}}

    request = PredictRequest(**payload)
    assert "01" not in request.rooms.overrides
    assert "1" in request.rooms.overrides
    assert request.rooms.overrides["1"].bedrooms == 4

    room_data = aggregate_rooms(request)
    assert room_data["bedrooms"] == 6
