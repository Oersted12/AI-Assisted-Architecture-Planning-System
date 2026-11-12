# backend/app/payload_transform.py
# payload_transform.py — this is where the room-aggregation logic (Gap 2) lives, converting your RoomsSame/RoomsStandardWithOverrides/RoomsPerFloor shapes into the flat bedrooms/bathrooms/kitchens totals the model expects.

"""
Converts a PredictRequest (the exact JSON shape LandDetailsForm.jsx submits)
into the flat inputs predict_plan() expects, plus a side-channel of
"extra_context" data (visitor halls, extra rooms, free text notes) that
never touches the ML model but is needed downstream by Gemini / the
blueprint generator.
"""

from app.schemas import (
    PredictRequest,
    RoomConfig,
    RoomsSame,
    RoomsStandardWithOverrides,
    RoomsPerFloor,
)


def _expand_to_per_floor(request: PredictRequest) -> list[RoomConfig]:
    """
    Normalizes all three room-input shapes into one list of RoomConfig,
    one entry per floor, in floor order (index 0 = ground floor).
    """
    rooms = request.rooms
    floors = request.floors

    if isinstance(rooms, RoomsSame):
        return [rooms.data for _ in range(floors)]

    if isinstance(rooms, RoomsStandardWithOverrides):
        per_floor = []
        for floor_num in range(1, floors + 1):
            override = rooms.overrides.get(str(floor_num))
            per_floor.append(override if override is not None else rooms.standard)
        return per_floor

    if isinstance(rooms, RoomsPerFloor):
        # Defensive: pad/trim in case floors count and array length drift
        # (shouldn't happen if the frontend stays in sync, but a mismatch
        # here should not crash the whole request)
        data = list(rooms.data)
        if len(data) < floors:
            data += [data[-1] if data else RoomConfig()] * (floors - len(data))
        return data[:floors]

    raise ValueError(f"Unrecognized rooms.type: {type(rooms)}")


def aggregate_rooms(request: PredictRequest) -> dict:
    """
    Returns:
        {
          "bedrooms": int,       # summed across floors — model input
          "bathrooms": int,      # summed across floors — model input
          "kitchens": int,       # summed across floors — model input
          "same_floor_layout": "Yes" | "No",  # model input
          "extra_context": {     # NOT sent to the ML model
              "visitor_halls_total": int,
              "extra_rooms_total": int,
              "extra_room_notes": [str, ...],
              "per_floor_breakdown": [ {...}, ... ],  # for blueprint generator
          }
        }
    """
    per_floor = _expand_to_per_floor(request)

    bedrooms_total = sum(r.bedrooms for r in per_floor)
    bathrooms_total = sum(r.bathrooms for r in per_floor)
    kitchens_total = sum(r.kitchens for r in per_floor)
    visitor_halls_total = sum(r.visitorHalls for r in per_floor)
    extra_rooms_total = sum(r.extraRooms for r in per_floor)
    extra_room_notes = [r.extraRoomNote for r in per_floor if r.extraRoomNote.strip()]

    same_floor_layout = "Yes" if (request.floors == 1 or request.layoutMode == "same") else "No"

    return {
        "bedrooms": bedrooms_total,
        "bathrooms": bathrooms_total,
        "kitchens": kitchens_total,
        "same_floor_layout": same_floor_layout,
        "extra_context": {
            "visitor_halls_total": visitor_halls_total,
            "extra_rooms_total": extra_rooms_total,
            "extra_room_notes": extra_room_notes,
            "per_floor_breakdown": [r.model_dump() for r in per_floor],
        },
    }


def build_predict_plan_kwargs(
    request: PredictRequest,
    zone_code: str,
    area_name: str,
) -> dict:
    """
    Assembles the exact kwargs predict_plan() (from the notebook) expects.
    This is the single place where frontend-shape and model-shape meet.
    """
    room_data = aggregate_rooms(request)

    return {
        "area_name": area_name,
        "zone_code": zone_code,
        "land_length_m": request.landLength,
        "land_width_m": request.landWidth,
        "land_shape": request.landShape,
        "road_width_m": request.roadWidth,
        "road_frontage_m": (
            request.roadFrontage
            if request.roadFrontage is not None
            else request.landLength
        ),
        "building_purpose": request.purpose,
        "floors_requested": request.floors,
        "same_floor_layout": room_data["same_floor_layout"],
        "bedrooms": room_data["bedrooms"],
        "bathrooms": room_data["bathrooms"],
        "kitchens": room_data["kitchens"],
        "parking_spaces": request.parkingSpaces,
    }