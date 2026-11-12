# backend/app/blueprint/corridor_layout.py
"""
Corridor-based layout strategies. Every strategy guarantees each room
touches a corridor — either the main corridor or a small spur corridor
— directly. No room is ever reachable only by walking through another
room, including stacked small rooms sharing one column.
"""

CORRIDOR_THICKNESS_M = 1.4
SPUR_THICKNESS_M = 0.9  # width of a connector corridor for stacked rooms

SMALL_ROOM_RATIO = 0.55


def _split_rooms_by_area(rooms: list[dict]) -> tuple[list[dict], list[dict]]:
    sorted_rooms = sorted(rooms, key=lambda r: r["target_area"], reverse=True)
    side_a, side_b = [], []
    area_a, area_b = 0.0, 0.0
    for room in sorted_rooms:
        if area_a <= area_b:
            side_a.append(room)
            area_a += room["target_area"]
        else:
            side_b.append(room)
            area_b += room["target_area"]
    return side_a, side_b


def _split_rooms_by_category(rooms: list[dict]) -> tuple[list[dict], list[dict]]:
    bedrooms = [r for r in rooms if r["type"] == "bedroom"]
    others = [r for r in rooms if r["type"] != "bedroom"]
    if not bedrooms or not others:
        return _split_rooms_by_area(rooms)
    return bedrooms, others


def _group_small_rooms(rooms: list[dict]) -> list[list[dict]]:
    if not rooms:
        return []
    avg_area = sum(r["target_area"] for r in rooms) / len(rooms)
    threshold = avg_area * SMALL_ROOM_RATIO
    normal = [r for r in rooms if r["target_area"] >= threshold]
    small = [r for r in rooms if r["target_area"] < threshold]
    slots = [[r] for r in normal]
    if small:
        for i in range(0, len(small), 2):
            slots.append(small[i:i + 2])
    return slots


def _layout_single_row(rooms: list[dict], x: float, y: float, width: float, depth: float,
                         spur_thickness: float = SPUR_THICKNESS_M) -> tuple[list[dict], list[dict]]:
    """
    Places rooms across `width`, each slot given the full `depth`.
    Stacked slots (2 rooms sharing a column) get a thin spur corridor
    along the column's right edge, spanning the full depth — so it
    always touches the main corridor at one end, giving BOTH stacked
    rooms independent access instead of one blocking the other.

    Returns (placed_rooms, spur_rects).
    """
    if not rooms:
        return [], []

    slots = _group_small_rooms(rooms)
    slot_areas = [sum(r["target_area"] for r in slot) for slot in slots]
    total_area = sum(slot_areas)
    if total_area <= 0:
        return [], []

    placed = []
    spur_rects = []
    offset = 0.0
    for slot, slot_area in zip(slots, slot_areas):
        slot_width = width * (slot_area / total_area)

        if len(slot) == 1:
            slot[0]["rect"] = {"x": x + offset, "y": y, "width": slot_width, "height": depth}
            placed.append(slot[0])
        else:
            usable_width = max(slot_width - spur_thickness, 0.3)
            spur_x = x + offset + usable_width
            spur_rect = {"x": spur_x, "y": y, "width": spur_thickness, "height": depth}

            sub_total = sum(r["target_area"] for r in slot)
            sub_offset_y = 0.0
            for room in slot:
                share = room["target_area"] / sub_total if sub_total > 0 else 1 / len(slot)
                room_h = depth * share
                room["rect"] = {"x": x + offset, "y": y + sub_offset_y,
                                  "width": usable_width, "height": room_h}
                room["_spur"] = spur_rect  # tags this room as needing spur-facing door
                sub_offset_y += room_h
                placed.append(room)

            spur_rects.append(spur_rect)

        offset += slot_width

    return placed, spur_rects


def _layout_single_row_vertical(rooms: list[dict], x: float, y: float, width: float, depth: float,
                                   spur_thickness: float = SPUR_THICKNESS_M) -> tuple[list[dict], list[dict]]:
    """
    Vertical-corridor equivalent of _layout_single_row: rooms stack
    top-to-bottom within a fixed column width. Stacked slots get a
    spur along the top edge of that slot's band, spanning the full
    column width, so it reaches the vertical main corridor.

    Returns (placed_rooms, spur_rects).
    """
    if not rooms:
        return [], []

    slots = _group_small_rooms(rooms)
    slot_areas = [sum(r["target_area"] for r in slot) for slot in slots]
    total_area = sum(slot_areas)
    if total_area <= 0:
        return [], []

    placed = []
    spur_rects = []
    offset = 0.0
    for slot, slot_area in zip(slots, slot_areas):
        slot_height = depth * (slot_area / total_area)

        if len(slot) == 1:
            slot[0]["rect"] = {"x": x, "y": y + offset, "width": width, "height": slot_height}
            placed.append(slot[0])
        else:
            usable_height = max(slot_height - spur_thickness, 0.3)
            spur_y = y + offset + usable_height
            spur_rect = {"x": x, "y": spur_y, "width": width, "height": spur_thickness}

            sub_total = sum(r["target_area"] for r in slot)
            sub_offset_x = 0.0
            for room in slot:
                share = room["target_area"] / sub_total if sub_total > 0 else 1 / len(slot)
                room_w = width * share
                room["rect"] = {"x": x + sub_offset_x, "y": y + offset,
                                  "width": room_w, "height": usable_height}
                room["_spur"] = spur_rect
                sub_offset_x += room_w
                placed.append(room)

            spur_rects.append(spur_rect)

        offset += slot_height

    return placed, spur_rects


def layout_with_corridor(rooms: list[dict], width: float, height: float, variant: int = 0,
                           corridor_thickness: float = CORRIDOR_THICKNESS_M
                           ) -> tuple[list[dict], dict | None, str, list[dict]]:
    """
    Returns (placed_rooms, corridor_rect, corridor_orientation, spur_rects).
    """
    if len(rooms) <= 1:
        if rooms:
            rooms[0]["rect"] = {"x": 0, "y": 0, "width": width, "height": height}
        return rooms, None, "horizontal", []

    vertical = (variant == 1)
    split_fn = _split_rooms_by_category if variant == 2 else _split_rooms_by_area

    side_a, side_b = split_fn(rooms)
    area_a = sum(r["target_area"] for r in side_a)
    area_b = sum(r["target_area"] for r in side_b)
    total_area = area_a + area_b if (area_a + area_b) > 0 else 1

    if not vertical:
        available_depth = max(height - corridor_thickness, 0.1)
        depth_a = available_depth * (area_a / total_area)
        depth_b = available_depth - depth_a

        placed_a, spurs_a = _layout_single_row(side_a, x=0, y=0, width=width, depth=depth_a)
        placed_b, spurs_b = _layout_single_row(side_b, x=0, y=depth_a + corridor_thickness,
                                                 width=width, depth=depth_b)
        corridor_rect = {"x": 0, "y": depth_a, "width": width, "height": corridor_thickness}
        return placed_a + placed_b, corridor_rect, "horizontal", spurs_a + spurs_b

    else:
        available_width = max(width - corridor_thickness, 0.1)
        width_a = available_width * (area_a / total_area)
        width_b = available_width - width_a

        placed_a, spurs_a = _layout_single_row_vertical(side_a, x=0, y=0, width=width_a, depth=height)
        placed_b, spurs_b = _layout_single_row_vertical(side_b, x=width_a + corridor_thickness, y=0,
                                                           width=width_b, depth=height)
        corridor_rect = {"x": width_a, "y": 0, "width": corridor_thickness, "height": height}
        return placed_a + placed_b, corridor_rect, "vertical", spurs_a + spurs_b