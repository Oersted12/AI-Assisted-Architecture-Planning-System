# backend/app/schemas.py
"""
Pydantic models mirroring the JSON shape produced by
LandDetailsForm.jsx's handleSubmit(), plus the /predict response shape.
"""

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator


# ── Room configuration (matches defaultFloorRooms() in the frontend) ─────────
class RoomConfig(BaseModel):
    bedrooms: int = Field(default=0, ge=0)
    bathrooms: int = Field(default=1, ge=0)
    kitchens: int = Field(default=0, ge=0)
    visitorHalls: int = Field(default=0, ge=0)
    extraRooms: int = Field(default=0, ge=0)
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

    @field_validator("overrides", mode="before")
    @classmethod
    def keys_must_be_numeric(cls, v: Any) -> Dict[str, RoomConfig]:
        if v is None:
            return {}
        if not isinstance(v, dict):
            raise TypeError("Overrides must be a mapping of floor numbers to room configs")

        normalized: Dict[str, RoomConfig] = {}
        for raw_key, value in v.items():
            key = str(raw_key).strip()
            if not key or not key.isdigit():
                raise ValueError(f"Override key '{raw_key}' is not a valid floor number")
            floor_number = int(key)
            if floor_number < 1:
                raise ValueError(f"Override key '{raw_key}' is not a valid floor number")
            normalized[str(floor_number)] = value
        return normalized


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
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    address: str
    roadFrontage: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    extraRoads: List[ExtraRoad] = Field(default_factory=list, max_length=3)

    # Land details (Step 1)
    landLength: float = Field(gt=0, allow_inf_nan=False)          # metres, already converted from ft if needed
    landWidth: float = Field(gt=0, allow_inf_nan=False)           # metres
    landAreaSqm: float = Field(gt=0, allow_inf_nan=False)
    landAreaPerch: float = Field(gt=0, allow_inf_nan=False)
    landShape: Literal["Rectangular", "Square", "L-Shape", "Corner Plot", "Irregular"]
    roadWidth: float = Field(gt=0, allow_inf_nan=False)           # metres, from ROAD_TYPES value
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
    parkingSpaces: int = Field(default=0, ge=0)


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
    rule_blockers: List[str] = Field(default_factory=list)
    rule_warnings: List[str] = Field(default_factory=list)
    rule_suggestions: List[str] = Field(default_factory=list)

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
    variant: int = Field(default=0, ge=0)