import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402


client = TestClient(main.app)


def test_edit_blueprint_applies_room_count_change(monkeypatch):
    monkeypatch.setattr(
        main,
        "parse_instruction",
        lambda instruction, breakdown: {
            "changes": [
                {"floor": 1, "field": "bathrooms", "action": "add", "value": 1}
            ],
            "summary": "Added one bathroom",
            "unsupported": "",
            "rearrange": False,
            "doors": [],
            "rooms": [],
        },
    )
    monkeypatch.setattr(
        main,
        "generate_all_floor_blueprints",
        lambda **kwargs: {1: "edited-floor.png"},
    )
    payload = {
        "instruction": "Add one bathroom",
        "perFloorBreakdown": [
            {
                "bedrooms": 2,
                "bathrooms": 1,
                "kitchens": 1,
                "visitorHalls": 0,
                "extraRooms": 0,
            }
        ],
        "purpose": "House",
        "layout_type": "Open",
        "structure_type": "Reinforced Concrete",
        "landLength": 20,
        "landWidth": 15,
        "groundFloorAreaSqm": 100,
        "roadLabel": "Main road",
    }

    response = client.post("/edit-blueprint", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is True
    assert body["perFloorBreakdown"][0]["bathrooms"] == 2
    assert body["blueprints"] == {"1": "/blueprints/edited-floor.png"}


def test_download_pdf_returns_pdf_file():
    response = client.post(
        "/download-pdf",
        json={
            "result": {
                "feasibility": "Not Feasible",
                "area_name": "Jaffna Town",
                "zone_code": "R2",
                "zone_name": "Medium Density Residential",
                "zone_type": "Residential",
                "land_area_sqm": 300,
                "permissible_fa_sqm": 500,
                "requested_fa_sqm": 200,
                "fa_utilisation_ratio": 0.4,
                "ground_floor_area_sqm": 200,
                "rule_blockers": [],
                "rule_warnings": [],
                "explanation": "Test report",
            },
            "inputs": {
                "address": "Jaffna Town",
                "purpose": "House",
                "floors": 1,
                "landLength": 20,
                "landWidth": 15,
                "landAreaPerch": 11.86,
                "landShape": "Rectangular",
                "roadLabel": "Main road",
                "roadWidth": 9,
            },
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
