# backend/app/blueprint/treemap.py
# The squarified treemap algorithm that actually places rooms into non-overlapping rectangles inside the footprint.
"""
Squarified treemap algorithm: takes a list of rooms with target areas and
a rectangle, and subdivides the rectangle into smaller rectangles sized
proportionally to each room's target area.

This is a generic, well-known layout algorithm (used in treemap charts)
adapted here to lay out rooms instead of chart data. It always produces
non-overlapping rectangles that exactly fill the given space.
"""


def squarify(rooms: list[dict], x: float, y: float, width: float, height: float) -> list[dict]:
    """
    rooms: list of {"label": str, "type": str, "target_area": float}
    x, y: bottom-left corner of the rectangle to fill
    width, height: dimensions of the rectangle to fill

    Returns the same room dicts, each with an added "rect" key:
        {"x": float, "y": float, "width": float, "height": float}
    describing where that room was placed.
    """
    if not rooms:
        return []

    # Sort largest-first — squarified treemaps look best (closer to
    # square aspect ratios) when placed in descending size order.
    sorted_rooms = sorted(rooms, key=lambda r: r["target_area"], reverse=True)

    # Normalize target areas to actual rectangle area, in case of any
    # floating point drift from the scaling step.
    total_target = sum(r["target_area"] for r in sorted_rooms)
    total_rect_area = width * height
    norm_factor = total_rect_area / total_target if total_target > 0 else 1.0
    for r in sorted_rooms:
        r["_area"] = r["target_area"] * norm_factor

    placed = []
    remaining = sorted_rooms[:]
    cur_x, cur_y = x, y
    cur_w, cur_h = width, height

    while remaining:
        # Decide whether to lay the next row along the width or height,
        # based on which side is currently shorter (keeps rectangles
        # closer to square as we go).
        along_width = cur_w >= cur_h

        row, row_area = _next_row(remaining, cur_w if along_width else cur_h)
        remaining = remaining[len(row):]

        if along_width:
            row_rects = _layout_row(row, row_area, cur_x, cur_y, cur_w, along_width=True)
            row_thickness = row_area / cur_w if cur_w > 0 else 0
            cur_y += row_thickness
            cur_h -= row_thickness
        else:
            row_rects = _layout_row(row, row_area, cur_x, cur_y, cur_h, along_width=False)
            row_thickness = row_area / cur_h if cur_h > 0 else 0
            cur_x += row_thickness
            cur_w -= row_thickness

        placed.extend(row_rects)

    return placed


def _next_row(rooms: list[dict], side_length: float) -> tuple[list[dict], float]:
    """
    Greedily picks how many of the next rooms to put in one row/column,
    stopping when adding another room would make the row's aspect ratio
    worse (less square) rather than better. This is the "squarified" part
    of the algorithm — it's what keeps rectangles from becoming long slivers.
    """
    row = []
    row_area = 0.0
    best_worst_ratio = float("inf")

    for room in rooms:
        trial_row = row + [room]
        trial_area = row_area + room["_area"]
        ratio = _worst_aspect_ratio(trial_row, trial_area, side_length)

        if ratio <= best_worst_ratio:
            row = trial_row
            row_area = trial_area
            best_worst_ratio = ratio
        else:
            # Adding this room made things worse — stop, this room
            # starts the next row instead.
            break

    return row, row_area


def _worst_aspect_ratio(row: list[dict], row_area: float, side_length: float) -> float:
    """Returns the worst (furthest-from-square) aspect ratio among
    rectangles if `row` were laid out along a strip of the given length."""
    if side_length <= 0 or row_area <= 0:
        return float("inf")

    row_thickness = row_area / side_length
    if row_thickness <= 0:
        return float("inf")

    worst = 0.0
    for room in row:
        room_length = room["_area"] / row_thickness
        ratio = max(room_length / row_thickness, row_thickness / room_length)
        worst = max(worst, ratio)
    return worst


def _layout_row(row: list[dict], row_area: float, x: float, y: float,
                 side_length: float, along_width: bool) -> list[dict]:
    """Places one row's rooms as adjacent rectangles, mutating each room
    dict with its final "rect", and returns the list of placed rooms."""
    if side_length <= 0 or row_area <= 0:
        for room in row:
            room["rect"] = {"x": x, "y": y, "width": 0, "height": 0}
        return row

    row_thickness = row_area / side_length
    offset = 0.0

    for room in row:
        room_length = room["_area"] / row_thickness if row_thickness > 0 else 0

        if along_width:
            room["rect"] = {
                "x": x + offset,
                "y": y,
                "width": room_length,
                "height": row_thickness,
            }
        else:
            room["rect"] = {
                "x": x,
                "y": y + offset,
                "width": row_thickness,
                "height": room_length,
            }
        offset += room_length

    return row