# backend/app/blueprint/extra_roads.py
"""
Extra roads for corner plots (drawing only).

The main road is always drawn at the bottom of the plan. Extra roads can be
on the left, on the right, or at the top (the back of the plot). Standing on
the main road and facing the land, "left" is the west side and "right" is
the east side.

Today the form sends ONE extra road, but everything here works with a list
(up to 3, one per side), so supporting more roads later needs no backend change.

This file only changes the DRAWING: it draws the roads and keeps the building
a small gap away from them. It does not change the ML prediction or any UDA
setback rule.
"""

import re

SIDES = ("left", "right", "top")
SIDE_NAME = {"left": "Left", "right": "Right", "top": "Back"}
SIDE_GAP_M = 1.5          # gap kept between the building and an extra road
ROAD_COLOR = "#F0A500"


def clean_extra_roads(extra_roads) -> list[dict]:
    """Returns a clean list like [{"side": "left", "label": "Local Road"}].
    Invalid items are skipped, each side is used once, at most 3 roads."""
    if not isinstance(extra_roads, list):
        return []

    roads, used = [], set()
    for item in extra_roads:
        if not isinstance(item, dict):
            continue
        side = item.get("side")
        if side not in SIDES or side in used:
            continue
        label = re.sub(r"[^A-Za-z0-9 ()/\-]", "", str(item.get("label") or "")).strip()[:40]
        roads.append({"side": side, "label": label or "Road"})
        used.add(side)
    return roads[:3]


def _fit_axis(offset: float, land: float, size: float, gap_low: float, gap_high: float) -> float:
    """Keeps the building inside the allowed range along one axis.
    If the plot is too small for both gaps, the building is centred."""
    low = gap_low
    high = land - size - gap_high
    if low > high:
        return max((land - size) / 2, 0)
    return min(max(offset, low), max(high, 0))


def shift_for_extra_roads(footprint: dict, offset_x: float, offset_y: float,
                            land_length_m: float, land_width_m: float, sides):
    """Moves the building so it keeps a gap from every extra road (when the
    plot is big enough). Returns the new (offset_x, offset_y)."""
    sides = set(sides or [])
    if not sides:
        return offset_x, offset_y

    if footprint["shape"] == "rectangle":
        fw, fh = footprint["width"], footprint["height"]
    else:
        fw, fh = footprint["bounding"]["width"], footprint["bounding"]["height"]

    if "left" in sides or "right" in sides:
        offset_x = _fit_axis(
            offset_x, land_length_m, fw,
            gap_low=SIDE_GAP_M if "left" in sides else 0,
            gap_high=SIDE_GAP_M if "right" in sides else 0,
        )
    if "top" in sides:
        offset_y = min(offset_y, max(land_width_m - fh - SIDE_GAP_M, 0))
    return offset_x, offset_y


def axis_limits(land_length_m: float, land_width_m: float, sides):
    """(xmin, xmax, ymin, ymax) with extra space on every side that has a road."""
    sides = set(sides or [])
    xmin, xmax = -1, land_length_m + 1
    ymin, ymax = -2, land_width_m + 2
    if "left" in sides:
        xmin = -2.6
    if "right" in sides:
        xmax = land_length_m + 2.6
    if "top" in sides:
        ymax = land_width_m + 3
    return xmin, xmax, ymin, ymax


def draw_extra_roads(ax, land_length_m: float, land_width_m: float, roads: list[dict]):
    """Draws an orange bar and a name along each chosen side."""
    for road in roads or []:
        side = road.get("side")
        if side not in SIDES:
            continue
        text = f"{SIDE_NAME[side]} road — {road.get('label') or 'Road'}"
        style = dict(color=ROAD_COLOR, fontsize=9, fontweight="bold", ha="center", va="center")

        if side == "left":
            ax.plot([-0.4, -0.4], [0, land_width_m], color=ROAD_COLOR, linewidth=4, zorder=10)
            ax.text(-1.4, land_width_m / 2, text, rotation=90, **style)
        elif side == "right":
            ax.plot([land_length_m + 0.4] * 2, [0, land_width_m], color=ROAD_COLOR, linewidth=4, zorder=10)
            ax.text(land_length_m + 1.4, land_width_m / 2, text, rotation=270, **style)
        else:
            ax.plot([0, land_length_m], [land_width_m + 0.4] * 2, color=ROAD_COLOR, linewidth=4, zorder=10)
            ax.text(land_length_m / 2, land_width_m + 1.3, text, **style)