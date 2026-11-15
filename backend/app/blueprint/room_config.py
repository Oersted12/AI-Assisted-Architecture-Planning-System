# The room sizing rules
# backend/app/blueprint/room_config.py
"""
Defines typical real-world room sizes (in sqm) and scales them to fit
whatever floor area is actually available. This keeps room proportions
looking sensible whether the plot is tiny or huge, rather than using
made-up fixed sizes that might not add up to the real footprint.

Owner tweaks (bigger / smaller / square) arrive inside the floor data as
"roomTweaks", for example:
    {"kitchen:1": {"square": True}, "visitor_hall:1": {"size": 1.3}}
"size" is a multiplier on the typical area. Because all rooms are scaled to
fit the footprint afterwards, a bigger room automatically makes the others
a little smaller.
"""

# ── Typical room sizes (sqm) — rough real-world averages ─────────────────────
TYPICAL_ROOM_AREA = {
    "bedroom":       12.0,
    "bathroom":      4.0,
    "kitchen":       9.0,
    "visitor_hall":  16.0,
    "extra_room":    10.0,
}

# Minimum sensible size for any single room, so scaling down never
# produces a room too small to draw meaningfully (e.g. a 0.5 sqm "bathroom").
MIN_ROOM_AREA = 2.5

# Limits for the owner's "make it bigger / smaller" multiplier
SIZE_MIN = 0.4
SIZE_MAX = 2.5


def _tweak_for(tweaks: dict, room_type: str, number: int) -> dict:
    tweak = tweaks.get(f"{room_type}:{number}")
    return tweak if isinstance(tweak, dict) else {}


def _size_factor(tweak: dict) -> float:
    try:
        factor = float(tweak.get("size", 1.0))
    except (TypeError, ValueError):
        factor = 1.0
    return max(SIZE_MIN, min(SIZE_MAX, factor))


def build_room_list(room_counts: dict) -> list[dict]:
    """
    room_counts: {"bedrooms": int, "bathrooms": int, "kitchens": int,
                  "visitorHalls": int, "extraRooms": int,
                  "roomTweaks": {...}   # optional}

    Returns a flat list of individual room dicts:
        [{"type": "bedroom", "label": "Bedroom 1", "target_area": 12.0,
          "square": False}, ...]
    """
    mapping = [
        ("bedroom",      room_counts.get("bedrooms", 0),     "Bedroom"),
        ("bathroom",     room_counts.get("bathrooms", 0),    "Bathroom"),
        ("kitchen",      room_counts.get("kitchens", 0),      "Kitchen"),
        ("visitor_hall", room_counts.get("visitorHalls", 0),  "Visitor's Hall"),
        ("extra_room",   room_counts.get("extraRooms", 0),    "Extra Room"),
    ]

    tweaks = room_counts.get("roomTweaks")
    if not isinstance(tweaks, dict):
        tweaks = {}

    rooms = []
    for room_type, count, label in mapping:
        for i in range(count):
            suffix = f" {i + 1}" if count > 1 else ""
            tweak = _tweak_for(tweaks, room_type, i + 1)
            rooms.append({
                "type": room_type,
                "label": f"{label}{suffix}",
                "target_area": TYPICAL_ROOM_AREA[room_type] * _size_factor(tweak),
                "square": bool(tweak.get("square")),
            })
    return rooms


def scale_rooms_to_footprint(rooms: list[dict], footprint_area_sqm: float) -> list[dict]:
    """
    Scales every room's target_area so the total matches footprint_area_sqm
    exactly (minus a small circulation allowance — real floors always lose
    some space to corridors/walls, not 100% usable room area).

    Returns the same list with target_area values replaced by scaled values.
    Raises ValueError if there are no rooms to place (caller should handle
    this — e.g. purposes like Warehouse might have zero bedrooms/kitchens
    and need a fallback "open space" room instead).
    """
    if not rooms:
        raise ValueError("No rooms to scale — caller must supply a fallback room list")

    # Reserve ~12% of floor area for circulation (corridors, stairwell, walls)
    usable_area = footprint_area_sqm * 0.88

    raw_total = sum(r["target_area"] for r in rooms)
    if raw_total <= 0:
        raise ValueError("Room target areas sum to zero — cannot scale")

    scale_factor = usable_area / raw_total

    for r in rooms:
        scaled = r["target_area"] * scale_factor
        r["target_area"] = max(scaled, MIN_ROOM_AREA)

    # Re-normalize after applying the MIN_ROOM_AREA floor, so the total
    # still matches usable_area even if some rooms got bumped up to the minimum.
    adjusted_total = sum(r["target_area"] for r in rooms)
    if adjusted_total > 0:
        renormalize = usable_area / adjusted_total
        for r in rooms:
            r["target_area"] *= renormalize

    return rooms


def fallback_open_space_room(footprint_area_sqm: float, purpose: str) -> list[dict]:
    """
    For building purposes with no bedroom/bathroom/kitchen concept in the
    room counts (e.g. Warehouse, Shop with no rooms specified), return one
    single open-space room filling the usable floor area, rather than
    crashing with an empty room list.
    """
    label = {
        "Warehouse": "Storage Floor",
        "Shop": "Retail Floor",
        "Supermarket": "Retail Floor",
        "Office": "Open Office Floor",
    }.get(purpose, "Open Floor Space")

    return [{
        "type": "open_space",
        "label": label,
        "target_area": footprint_area_sqm * 0.88,
    }]