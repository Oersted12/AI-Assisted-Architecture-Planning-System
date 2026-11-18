import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402
from app import zone_resolver  # noqa: E402


client = TestClient(main.app)


def predict_payload(**updates):
    payload = {
        "lat": 9.6615,
        "lng": 80.0093,
        "address": "Jaffna Town, Jaffna",
        "landLength": 20,
        "landWidth": 15,
        "landAreaSqm": 300,
        "landAreaPerch": 11.86,
        "landShape": "Rectangular",
        "roadWidth": 9,
        "roadLabel": "Main road",
        "purpose": "House",
        "floors": 1,
        "layoutMode": "same",
        "rooms": {
            "type": "same",
            "data": {
                "bedrooms": 2,
                "bathrooms": 1,
                "kitchens": 1,
                "visitorHalls": 0,
                "extraRooms": 0,
                "extraRoomNote": "",
                "roomTweaks": {},
            },
        },
    }
    payload.update(updates)
    return payload


def mocked_prediction(feasibility="Not Feasible"):
    return {
        "feasibility": feasibility,
        "feas_confidence": 90.0,
        "layout_type": "N/A - Not Feasible" if feasibility != "Feasible" else "Open",
        "layout_confidence": 0.0 if feasibility != "Feasible" else 85.0,
        "structure_type": (
            "N/A - Not Feasible" if feasibility != "Feasible" else "Reinforced Concrete"
        ),
        "struct_confidence": 0.0 if feasibility != "Feasible" else 80.0,
        "land_area_sqm": 300.0,
        "permissible_fa_sqm": 840.0,
        "requested_fa_sqm": 210.0,
        "fa_utilisation_ratio": 0.25,
        "ground_floor_area_sqm": 210.0,
        "zone_code": "R2",
        "zone_name": "Medium Density Residential",
        "zone_type": "Residential",
        "area_name": "Jaffna Town",
        "rule_blockers": [],
        "rule_warnings": [],
        "rule_suggestions": [],
    }


def stub_predict_and_gemini(monkeypatch, feasibility="Not Feasible"):
    monkeypatch.setattr(
        main.ml_service, "predict_plan", lambda **kwargs: mocked_prediction(feasibility)
    )
    monkeypatch.setattr(
        main, "generate_explanation", lambda **kwargs: "Mock explanation"
    )
    monkeypatch.setattr(
        main,
        "generate_all_floor_blueprints",
        lambda **kwargs: {1: "floor-1.png"},
    )


def mock_jaffna_zone(monkeypatch, matched=True, area_name="Jaffna Town"):
    monkeypatch.setattr(
        main,
        "resolve_zone",
        lambda lat, lng, address: ("R2", area_name, matched),
    )


def test_predict_valid_jaffna_plot_returns_rule_and_prediction_fields(monkeypatch):
    mock_jaffna_zone(monkeypatch)
    stub_predict_and_gemini(monkeypatch, feasibility="Feasible")

    response = client.post("/predict", json=predict_payload())

    assert response.status_code == 200
    body = response.json()
    for field in (
        "feasibility",
        "layout_type",
        "structure_type",
        "rule_blockers",
        "rule_warnings",
        "rule_suggestions",
    ):
        assert field in body
    assert body["feasibility"] == "Feasible"


def test_predict_outside_jaffna_returns_no_zone_error(monkeypatch):
    def no_zone(lat, lng, address):
        raise ValueError(
            "This location is outside Jaffna District. "
            "This tool only works for plots inside Jaffna District."
        )

    monkeypatch.setattr(main, "resolve_zone", no_zone)
    response = client.post(
        "/predict",
        json=predict_payload(lat=6.9271, lng=79.8612, address="Colombo"),
    )

    assert response.status_code == 400
    assert "outside Jaffna District" in response.json()["detail"]


def test_predict_waterbody_returns_clear_error(monkeypatch):
    def waterbody(lat, lng, address):
        raise ValueError(
            "This point is on a water body, so nothing can be built here. "
            "Please move the pin onto land."
        )

    monkeypatch.setattr(main, "resolve_zone", waterbody)
    response = client.post("/predict", json=predict_payload())

    assert response.status_code == 400
    assert "water body" in response.json()["detail"]


def test_predict_road_under_nine_metres_blocks_non_residential_use(monkeypatch):
    mock_jaffna_zone(monkeypatch)
    monkeypatch.setattr(
        main, "generate_explanation", lambda **kwargs: "Mock explanation"
    )
    monkeypatch.setattr(
        main, "generate_all_floor_blueprints", lambda **kwargs: {1: "unused.png"}
    )
    payload = predict_payload(purpose="Shop", roadWidth=8.99, roadLabel="Narrow road")

    response = client.post("/predict", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["feasibility"] != "Feasible"
    assert any(
        blocker.startswith("Non-residential use needs an access road of 9 m")
        for blocker in body["rule_blockers"]
    )


class _AlwaysFeasibleModel:
    def predict(self, input_data):
        return [0]

    def predict_proba(self, input_data):
        return [[0.9, 0.1]]


class _Encoder:
    def __init__(self, classes):
        self.classes_ = classes

    def transform(self, values):
        return [self.classes_.index(value) for value in values]

    def inverse_transform(self, values):
        return [self.classes_[int(value)] for value in values]


def test_predict_rule_blocker_overrides_feasible_model_prediction(monkeypatch):
    mock_jaffna_zone(monkeypatch)
    monkeypatch.setattr(
        main, "generate_explanation", lambda **kwargs: "Mock explanation"
    )
    monkeypatch.setattr(
        main, "generate_all_floor_blueprints", lambda **kwargs: {1: "unused.png"}
    )
    monkeypatch.setattr(
        main.ml_service, "model_feasibility", _AlwaysFeasibleModel()
    )
    monkeypatch.setattr(
        main.ml_service,
        "label_encoders",
        {
            "Area_Name": _Encoder(["Jaffna Town"]),
            "Zone_Code": _Encoder(["R2"]),
            "Zone_Name": _Encoder(["Medium Density Residential"]),
            "Zone_Type": _Encoder(["Residential"]),
            "Land_Shape": _Encoder(["Rectangular"]),
            "Building_Purpose": _Encoder(["Office"]),
            "Feasibility": _Encoder(["Feasible", "Not Feasible"]),
        },
    )

    response = client.post(
        "/predict",
        json=predict_payload(purpose="Office", roadWidth=8.99, roadLabel="Narrow road"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["feasibility"] == "Not Feasible"
    assert any("9 m or more" in blocker for blocker in body["rule_blockers"])


def test_predict_cn3_uses_fifty_percent_plot_coverage(monkeypatch):
    monkeypatch.setattr(
        main,
        "resolve_zone",
        lambda lat, lng, address: ("CN3", "Jaffna Town", True),
    )
    monkeypatch.setattr(
        main, "generate_explanation", lambda **kwargs: "Mock explanation"
    )
    monkeypatch.setattr(
        main, "generate_all_floor_blueprints", lambda **kwargs: {1: "unused.png"}
    )

    response = client.post(
        "/predict",
        json=predict_payload(
            landLength=30,
            landWidth=20,
            landAreaSqm=600,
            landAreaPerch=23.72,
        ),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ground_floor_area_sqm"] == 210.0
    assert not any(
        blocker.startswith("Plot coverage") for blocker in body["rule_blockers"]
    )


def test_predict_unknown_area_name_sets_area_matched_false(monkeypatch):
    mock_jaffna_zone(monkeypatch, matched=False)
    stub_predict_and_gemini(monkeypatch)

    response = client.post("/predict", json=predict_payload())

    assert response.status_code == 200
    assert response.json()["area_matched"] is False


def test_predict_negative_land_value_returns_422(monkeypatch):
    mock_jaffna_zone(monkeypatch)

    response = client.post("/predict", json=predict_payload(landLength=-1))

    assert response.status_code == 422


@pytest.fixture
def real_postgis_password(monkeypatch):
    password = os.environ.get("JAFFNA_DB_PASSWORD")
    if not password:
        pytest.skip("JAFFNA_DB_PASSWORD is not set")
    monkeypatch.setattr(zone_resolver, "DB_PASSWORD", password)


@pytest.mark.db
def test_real_postgis_resolves_known_jaffna_point(real_postgis_password):
    zone_code, area_name, area_matched = zone_resolver.resolve_zone(
        9.6615, 80.0093, "Jaffna Town, Jaffna"
    )
    assert zone_code
    assert area_name
    assert isinstance(area_matched, bool)


@pytest.mark.db
def test_real_postgis_returns_no_zone_outside_mapped_district(real_postgis_password):
    with pytest.raises(ValueError, match="outside Jaffna District"):
        zone_resolver.resolve_zone(0.0, 0.0, "")
