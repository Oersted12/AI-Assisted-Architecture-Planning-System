# backend/app/schemas.py
"""
Pydantic models mirroring the JSON shape produced by
LandDetailsForm.jsx's handleSubmit(), plus the /predict response shape.
"""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator


# ── Room configuration (matches defaultFloorRooms() in the frontend) ─────────
class RoomConfig(BaseModel):
    bedrooms: int = 0
    bathrooms: int = 1
    kitchens: int = 0
    visitorHalls: int = 0
    extraRooms: int = 0
    extraRoomNote: str = ""
    roomTweaks: Dict[str, Any] = Field(default_factory=dict)


# ── Rooms payload — discriminated by `type`, matching layoutMode logic ───────
class RoomsSame(BaseModel):
    type: Literal["same"]
    data: RoomConfig


class RoomsStandardWithOverrides(BaseModel):
    type: Literal["standardWithOverrides"]
    standard: RoomConfig
    # Keys are floor numbers as strings (JSON object keys are always strings,
    # e.g. differentFloors=[10] becomes overrides={"10": {...}})
    overrides: Dict[str, RoomConfig] = Field(default_factory=dict)

    @field_validator("overrides")
    @classmethod
    def keys_must_be_numeric(cls, v: Dict[str, RoomConfig]) -> Dict[str, RoomConfig]:
        for key in v:
            if not key.isdigit():
                raise ValueError(f"Override key '{key}' is not a valid floor number")
        return v


class RoomsPerFloor(BaseModel):
    type: Literal["perFloor"]
    data: List[RoomConfig]


Rooms = Union[RoomsSame, RoomsStandardWithOverrides, RoomsPerFloor]


# ── Main prediction request ───────────────────────────────────────────────────
class ExtraRoad(BaseModel):
    side: Literal["left", "right", "top"]
    width: float = 6.0
    label: str = "Extra road"


class PredictRequest(BaseModel):
    # Location (from MapPicker confirm)
    lat: float
    lng: float
    address: str
    roadFrontage: float | None = None
    extraRoads: List[ExtraRoad] = Field(default_factory=list, max_length=3)

    # Land details (Step 1)
    landLength: float          # metres, already converted from ft if needed
    landWidth: float           # metres
    landAreaSqm: float
    landAreaPerch: float
    landShape: Literal["Rectangular", "Square", "L-Shape", "Corner Plot", "Irregular"]
    roadWidth: float           # metres, from ROAD_TYPES value
    roadLabel: str

    # Building details (Step 2)
    purpose: Literal[
        "House", "Apartment", "Office", "Shop", "Supermarket",
        "Hospital", "School", "Hotel", "Warehouse", "Mixed-Use",
    ]
    floors: int = Field(ge=1, le=15)
    layoutMode: Literal["same", "almost", "custom"]
    rooms: Rooms = Field(discriminator="type")

    # Free text — routed to Gemini only, never touches the ML model
    notes: str = ""

    # Not yet on the frontend form — defaults applied until added
    parkingSpaces: int = 0


# ── Prediction response (mirrors predict_plan()'s return dict) ───────────────
class PredictResponse(BaseModel):
    feasibility: str
    feas_confidence: float
    layout_type: str
    layout_confidence: float
    structure_type: str
    struct_confidence: float
    land_area_sqm: float
    permissible_fa_sqm: float
    requested_fa_sqm: float
    fa_utilisation_ratio: float
    ground_floor_area_sqm: float
    blueprints: Optional[Dict[int, str]] = None   # {floor_number: blueprint URL}
    zone_code: str
    zone_name: str
    zone_type: str
    explanation: Optional[str] = None
    per_floor_breakdown: Optional[List[Dict[str, Any]]] = None
    # False when the area name was not recognized and a default was used
    area_matched: bool = True

    # Echoed back so the frontend can show it without re-deriving anything
    area_name: str

class RegenerateBlueprintRequest(BaseModel):
    purpose: str
    layout_type: str
    structure_type: str
    landLength: float
    landWidth: float
    groundFloorAreaSqm: float
    roadLabel: str
    perFloorBreakdown: List[RoomConfig]
    extraRoads: List[Dict[str, Any]] = Field(default_factory=list)
    variant: int = 0