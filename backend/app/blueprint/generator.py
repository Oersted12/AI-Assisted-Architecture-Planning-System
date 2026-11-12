# backend/app/blueprint/generator.py
"""
Orchestrates room_config + treemap + footprint into a rendered PNG floor
plan. One call generates one floor's blueprint image and returns its
file path (relative to backend/generated_blueprints/).
"""

import hashlib
import json
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # no GUI backend needed — server-side rendering only
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Polygon, FancyArrow

from app.blueprint.room_config import (
    build_room_list,
    scale_rooms_to_footprint,
    fallback_open_space_room,
)
from app.blueprint.treemap import squarify
from app.blueprint.footprint import get_footprint
from app.blueprint.corridor_layout import layout_with_corridor

OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "generated_blueprints"
OUTPUT_DIR.mkdir(exist_ok=True)

# Room-count purposes that don't map to bedroom/bathroom/kitchen concepts
NO_ROOM_COUNT_PURPOSES = {"Warehouse", "Shop", "Supermarket"}

# Layout types where kitchen + visitor hall render as one open space
# (dashed internal divider instead of a solid wall)
OPEN_PLAN_TYPES = {"Open-Plan", "Corner Open-Plan"}

STRUCTURE_LINEWIDTH = {
    "Load-Bearing Masonry": 3.0,
    "Reinforced Concrete Frame": 2.2,
    "Steel Frame": 1.6,
}

# Bump this number whenever the drawing code changes, so old cached
# images are not reused.
RENDER_VERSION = 2


def _door_key(extra_doors) -> list:
    """Normalised, sorted copy of the extra doors, used in the cache key."""
    doors = [
        {"room_type": d.get("room_type"), "index": d.get("index"), "wall": d.get("wall")}
        for d in (extra_doors or [])
    ]
    return sorted(doors, key=lambda d: (str(d["room_type"]), str(d["index"]), str(d["wall"])))


def _floor_cache_key(room_counts: dict, purpose: str, layout_type: str,
                       land_length_m: float, land_width_m: float,
                       footprint_area_sqm: float, variant: int,
                       extra_doors=None) -> str:
    """Deterministic key so identical floor configs reuse one image
    instead of re-rendering the same floor plan multiple times."""
    payload = json.dumps({
        "rooms": room_counts, "purpose": purpose, "layout": layout_type,
        "L": round(land_length_m, 2), "W": round(land_width_m, 2),
        "area": round(footprint_area_sqm, 2), "variant": variant,
        "doors": _door_key(extra_doors), "v": RENDER_VERSION,
    }, sort_keys=True)
    return hashlib.md5(payload.encode()).hexdigest()[:12]

def _place_rooms(rooms: list[dict], footprint: dict, variant: int) -> tuple[list[dict], dict | None, str, list[dict]]:
    """Returns (placed_rooms, corridor_rect, corridor_orientation, spur_rects)."""
    if footprint["shape"] == "rectangle":
        return layout_with_corridor(rooms, width=footprint["width"], height=footprint["height"], variant=variant)

    # L-shape: KNOWN LIMITATION — still uses the old treemap split, no
    # spur corridors here yet.
    bounding, notch = footprint["bounding"], footprint["notch"]
    W, H = bounding["width"], bounding["height"]
    nw, nh = notch["width"], notch["height"]

    rect_a = {"x": 0, "y": 0, "width": W, "height": H - nh}
    rect_b = {"x": 0, "y": H - nh, "width": W - nw, "height": nh}

    area_a = rect_a["width"] * rect_a["height"]
    area_b = rect_b["width"] * rect_b["height"]
    total = area_a + area_b if (area_a + area_b) > 0 else 1

    sorted_rooms = sorted(rooms, key=lambda r: r["target_area"], reverse=True)
    target_a_area = sum(r["target_area"] for r in rooms) * (area_a / total)

    rooms_a, rooms_b = [], []
    running = 0.0
    for r in sorted_rooms:
        if running < target_a_area:
            rooms_a.append(r)
            running += r["target_area"]
        else:
            rooms_b.append(r)

    if not rooms_a:
        rooms_a, rooms_b = [rooms_b[0]], rooms_b[1:]
    if not rooms_b and len(rooms_a) > 1:
        rooms_b, rooms_a = [rooms_a[-1]], rooms_a[:-1]

    placed_a = squarify(rooms_a, x=rect_a["x"], y=rect_a["y"],
                          width=rect_a["width"], height=rect_a["height"]) if rooms_a else []
    placed_b = squarify(rooms_b, x=rect_b["x"], y=rect_b["y"],
                          width=rect_b["width"], height=rect_b["height"]) if rooms_b else []
    return placed_a + placed_b, None, "horizontal", []

def _draw_footprint_outline(ax, footprint: dict, structure_type: str, offset_x: float, offset_y: float):
    lw = STRUCTURE_LINEWIDTH.get(structure_type, 2.0)
    if footprint["shape"] == "rectangle":
        ax.add_patch(Rectangle((offset_x, offset_y), footprint["width"], footprint["height"],
                                 fill=False, edgecolor="#1A3C5E", linewidth=lw, zorder=5))
    else:
        b, n = footprint["bounding"], footprint["notch"]
        W, H = b["width"], b["height"]
        nw, nh = n["width"], n["height"]
        pts = [
            (offset_x, offset_y), (offset_x + W, offset_y), (offset_x + W, offset_y + H - nh),
            (offset_x + W - nw, offset_y + H - nh), (offset_x + W - nw, offset_y + H), (offset_x, offset_y + H),
        ]
        ax.add_patch(Polygon(pts, closed=True, fill=False,
                               edgecolor="#1A3C5E", linewidth=lw, zorder=5))


# ── Room labels that always fit inside their room ─────────────────────────────
CHAR_WIDTH = 0.60  # average bold character width, as a fraction of the font size


def _text_width_in(text: str, fontsize: float) -> float:
    return max(len(line) for line in text.split("\n")) * fontsize * CHAR_WIDTH / 72


def _text_height_in(text: str, fontsize: float) -> float:
    return (text.count("\n") + 1) * fontsize * 1.25 / 72


def _fit_label(label: str, dims: str, room_w_in: float, room_h_in: float):
    """Pick the largest readable text that fits inside the room.
    Tries: name + size, then name only; horizontal, then rotated 90 degrees;
    from font size 7.5 down to 5. Returns (text, fontsize, rotation) or None."""
    for fontsize in (7.5, 6.5, 5.5, 5.0):
        for text in (f"{label}\n{dims}", label):
            for rotation in (0, 90):
                if rotation == 0:
                    along, across = room_w_in, room_h_in
                else:
                    along, across = room_h_in, room_w_in
                if (_text_width_in(text, fontsize) <= along * 0.94
                        and _text_height_in(text, fontsize) <= across * 0.94):
                    return text, fontsize, rotation
    return None


def _draw_rooms(ax, placed_rooms: list[dict], layout_type: str,
                  offset_x: float, offset_y: float, inches_per_m: float):
    palette = {
        "bedroom": "#D6EAF8", "bathroom": "#EBF5FB", "kitchen": "#FCF3CF",
        "visitor_hall": "#D5F5E3", "extra_room": "#FADBD8", "open_space": "#E8DAEF",
    }
    open_plan = layout_type in OPEN_PLAN_TYPES

    for room in placed_rooms:
        rect = room["rect"]
        x, y = rect["x"] + offset_x, rect["y"] + offset_y
        is_open_plan_pair = open_plan and room["type"] in ("kitchen", "visitor_hall")
        linestyle = "dashed" if is_open_plan_pair else "solid"

        # zorder=6 — drawn ABOVE the wall outline (zorder=5), so the room
        # fill paints cleanly over the wall's inner edge with no visible
        # double-line overlap (Option B fix for the thin-strip artifact).
        ax.add_patch(Rectangle(
            (x, y), rect["width"], rect["height"],
            facecolor=palette.get(room["type"], "#F4F6F9"),
            edgecolor="#5D6D7E", linewidth=1.2, linestyle=linestyle, zorder=6,
        ))

        cx, cy = x + rect["width"] / 2, y + rect["height"] / 2
        dims = f"{rect['width']:.1f}×{rect['height']:.1f}m"
        fit = _fit_label(room["label"], dims,
                         rect["width"] * inches_per_m, rect["height"] * inches_per_m)
        if fit:
            text, fontsize, rotation = fit
            ax.text(cx, cy, text, ha="center", va="center", fontsize=fontsize,
                     rotation=rotation, color="#1A3C5E", fontweight="bold", zorder=7)

def _draw_corridor(ax, corridor_rect: dict, offset_x: float, offset_y: float):
    x, y = corridor_rect["x"] + offset_x, corridor_rect["y"] + offset_y
    w, h = corridor_rect["width"], corridor_rect["height"]

    ax.add_patch(Rectangle(
        (x, y), w, h,
        facecolor="#EAECEE", edgecolor="#5D6D7E", linewidth=1.0,
        hatch="///", zorder=6,
    ))
    if w > 2 and h > 0.3:
        ax.text(x + w / 2, y + h / 2, "Corridor", ha="center", va="center",
                 fontsize=6.5, color="#5D6D7E", style="italic", fontweight="bold", zorder=7)

def _draw_spurs(ax, spur_rects: list[dict], offset_x: float, offset_y: float):
    """Draws each small connector corridor the same way as the main
    corridor (hatched strip), so stacked rooms visibly have their own
    access path instead of a mystery gap."""
    for spur in spur_rects:
        x, y = spur["x"] + offset_x, spur["y"] + offset_y
        w, h = spur["width"], spur["height"]
        ax.add_patch(Rectangle(
            (x, y), w, h,
            facecolor="#EAECEE", edgecolor="#5D6D7E", linewidth=0.8,
            hatch="///", zorder=6,
        ))

def _draw_door_swings(ax, placed_rooms: list[dict], corridor_rect: dict,
                        corridor_orientation: str, offset_x: float, offset_y: float):
    from matplotlib.patches import Arc
    from matplotlib.lines import Line2D

    MAIN_DOOR_WIDTH = 0.75
    SPUR_DOOR_WIDTH = 0.55

    # Correct hinge-based sweep angles for each wall the door sits on.
    # Hinge = one end of the drawn door line; the arc connects "closed
    # flat against the wall" to "open, perpendicular into the room."
    ANGLES = {
        "top":    (270, 360),  # room is below this wall
        "bottom": (0, 90),     # room is above this wall
        "right":  (90, 180),   # room is to the left of this wall
        "left":   (0, 90),     # room is to the right of this wall
    }

    def draw_one(door_x, door_y, door_width, facing, horizontal_line):
        theta1, theta2 = ANGLES[facing]
        if horizontal_line:
            ax.add_line(Line2D([door_x, door_x + door_width], [door_y, door_y],
                                 color="white", linewidth=2.0, zorder=8))
        else:
            ax.add_line(Line2D([door_x, door_x], [door_y, door_y + door_width],
                                 color="white", linewidth=2.0, zorder=8))
        ax.add_patch(Arc((door_x, door_y), door_width * 2, door_width * 2,
                           angle=0, theta1=theta1, theta2=theta2,
                           color="#5D6D7E", linewidth=0.7, zorder=8))

    for room in placed_rooms:
        rect = room["rect"]
        if min(rect["width"], rect["height"]) < 1.0:
            continue

        x, y = rect["x"] + offset_x, rect["y"] + offset_y
        w, h = rect["width"], rect["height"]

        spur = room.get("_spur")
        if spur:
            door_width = SPUR_DOOR_WIDTH
            if spur["x"] >= rect["x"] + rect["width"] - 0.01:
                facing = "right"
            elif spur["x"] + spur["width"] <= rect["x"] + 0.01:
                facing = "left"
            elif spur["y"] >= rect["y"] + rect["height"] - 0.01:
                facing = "top"
            else:
                facing = "bottom"

            room_center_y = rect["y"] + rect["height"] / 2
            room_center_x = rect["x"] + rect["width"] / 2
            spur_center_y = spur["y"] + spur["height"] / 2
            spur_center_x = spur["x"] + spur["width"] / 2

            if facing in ("left", "right"):
                bias = 0.72 if room_center_y >= spur_center_y else 0.28
                door_y = y + h * bias - door_width / 2
                door_x = x + w if facing == "right" else x
                draw_one(door_x, door_y, door_width, facing, horizontal_line=False)
            else:
                bias = 0.72 if room_center_x >= spur_center_x else 0.28
                door_x = x + w * bias - door_width / 2
                door_y = y + h if facing == "top" else y
                draw_one(door_x, door_y, door_width, facing, horizontal_line=True)
            continue

        if not corridor_rect:
            continue

        door_width = MAIN_DOOR_WIDTH
        if corridor_orientation == "horizontal":
            facing = "top" if (rect["y"] + rect["height"]) <= corridor_rect["y"] + 0.01 else "bottom"
            door_x = x + w / 2 - door_width / 2
            door_y = y + h if facing == "top" else y
            draw_one(door_x, door_y, door_width, facing, horizontal_line=True)
        else:
            facing = "right" if (rect["x"] + rect["width"]) <= corridor_rect["x"] + 0.01 else "left"
            door_y = y + h / 2 - door_width / 2
            door_x = x + w if facing == "right" else x
            draw_one(door_x, door_y, door_width, facing, horizontal_line=False)


# ── Extra doors requested by the user (for example "south wall of Hall 1") ────
# On the plan: north = top (where the N arrow points), south = bottom (the
# road side), east = right, west = left.
EXTRA_DOOR_WIDTH = 0.85
EXTRA_DOOR_FACING = {"north": "top", "south": "bottom", "east": "right", "west": "left"}
EXTRA_DOOR_ANGLES = {
    "top":    (270, 360),
    "bottom": (0, 90),
    "right":  (90, 180),
    "left":   (0, 90),
}


def _room_number(room: dict) -> int:
    """'Visitor's Hall 2' -> 2. A room with no number (for example 'Kitchen') is 1."""
    match = re.search(r"(\d+)\s*$", str(room.get("label", "")))
    return int(match.group(1)) if match else 1


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return min(a_end, b_end) - max(a_start, b_start) > 0.05


def _wall_touches_connector(rect: dict, wall: str, connectors: list[dict]) -> bool:
    """True when a corridor/spur already sits against this wall of the room
    (so the room already has its normal door there)."""
    for c in connectors:
        if wall == "top":
            if abs(c["y"] - (rect["y"] + rect["height"])) <= 0.05 and \
               _overlaps(rect["x"], rect["x"] + rect["width"], c["x"], c["x"] + c["width"]):
                return True
        elif wall == "bottom":
            if abs((c["y"] + c["height"]) - rect["y"]) <= 0.05 and \
               _overlaps(rect["x"], rect["x"] + rect["width"], c["x"], c["x"] + c["width"]):
                return True
        elif wall == "right":
            if abs(c["x"] - (rect["x"] + rect["width"])) <= 0.05 and \
               _overlaps(rect["y"], rect["y"] + rect["height"], c["y"], c["y"] + c["height"]):
                return True
        elif wall == "left":
            if abs((c["x"] + c["width"]) - rect["x"]) <= 0.05 and \
               _overlaps(rect["y"], rect["y"] + rect["height"], c["y"], c["y"] + c["height"]):
                return True
    return False


def _draw_extra_doors(ax, placed_rooms: list[dict], extra_doors: list[dict],
                        connectors: list[dict], offset_x: float, offset_y: float):
    from matplotlib.patches import Arc
    from matplotlib.lines import Line2D

    for spec in extra_doors:
        facing = EXTRA_DOOR_FACING.get(spec.get("wall"))
        if facing is None:
            continue

        room = next(
            (r for r in placed_rooms
             if r.get("type") == spec.get("room_type")
             and _room_number(r) == spec.get("index")),
            None,
        )
        if room is None:
            continue  # that room does not exist on this floor

        rect = room["rect"]
        x, y = rect["x"] + offset_x, rect["y"] + offset_y
        w, h = rect["width"], rect["height"]
        horizontal = facing in ("top", "bottom")
        wall_length = w if horizontal else h
        if wall_length < EXTRA_DOOR_WIDTH + 0.4:
            continue  # wall too short for a door

        # Keep the extra door away from the normal corridor door
        bias = 0.2 if _wall_touches_connector(rect, facing, connectors) else 0.5

        if horizontal:
            door_x = x + wall_length * bias - EXTRA_DOOR_WIDTH / 2
            door_y = y + h if facing == "top" else y
            ax.add_line(Line2D([door_x, door_x + EXTRA_DOOR_WIDTH], [door_y, door_y],
                                 color="white", linewidth=2.2, zorder=8))
        else:
            door_y = y + wall_length * bias - EXTRA_DOOR_WIDTH / 2
            door_x = x + w if facing == "right" else x
            ax.add_line(Line2D([door_x, door_x], [door_y, door_y + EXTRA_DOOR_WIDTH],
                                 color="white", linewidth=2.2, zorder=8))

        theta1, theta2 = EXTRA_DOOR_ANGLES[facing]
        ax.add_patch(Arc((door_x, door_y), EXTRA_DOOR_WIDTH * 2, EXTRA_DOOR_WIDTH * 2,
                           angle=0, theta1=theta1, theta2=theta2,
                           color="#C0392B", linewidth=0.9, zorder=8))


def _draw_north_arrow(ax, land_length_m: float, land_width_m: float):
    x = land_length_m * 0.97
    y = land_width_m * 0.78
    size = min(land_length_m, land_width_m) * 0.07
    ax.add_patch(FancyArrow(x, y, 0, size, width=size * 0.12,
                              head_width=size * 0.45, head_length=size * 0.35,
                              length_includes_head=True, color="#1A3C5E", zorder=10))
    ax.text(x, y + size * 1.4, "N", ha="center", va="bottom",
             fontsize=11, fontweight="bold", color="#1A3C5E", zorder=10)


def _draw_road_marker(ax, land_length_m: float, road_label: str):
    ax.plot([0, land_length_m], [-0.4, -0.4], color="#F0A500", linewidth=4, zorder=10)
    ax.text(land_length_m / 2, -1.2, f"Road-facing side — {road_label}",
             ha="center", fontsize=9, color="#F0A500", fontweight="bold")


def _compute_offsets(land_length_m: float, land_width_m: float, footprint: dict) -> tuple[float, float]:
    """Centers the footprint horizontally within the land plot, and gives
    it a small front setback from the road instead of sitting flush
    against it."""
    if footprint["shape"] == "rectangle":
        fw, fh = footprint["width"], footprint["height"]
    else:
        fw, fh = footprint["bounding"]["width"], footprint["bounding"]["height"]

    offset_x = max((land_length_m - fw) / 2, 0)
    offset_y = min(1.5, max(land_width_m - fh, 0))  # front setback, capped at 1.5m
    return offset_x, offset_y

def generate_floor_blueprint(
    room_counts: dict,
    purpose: str,
    layout_type: str,
    structure_type: str,
    land_length_m: float,
    land_width_m: float,
    footprint_area_sqm: float,
    road_label: str,
    floor_label: str,
    variant: int = 0,
    extra_doors: list[dict] | None = None,
) -> str:
    cache_key = _floor_cache_key(room_counts, purpose, layout_type,
                                   land_length_m, land_width_m, footprint_area_sqm,
                                   variant, extra_doors)
    filename = f"floor_{cache_key}.png"
    filepath = OUTPUT_DIR / filename

    if filepath.exists():
        return filename

    total_counted = (
        room_counts.get("bedrooms", 0)
        + room_counts.get("bathrooms", 0)
        + room_counts.get("kitchens", 0)
        + room_counts.get("visitorHalls", 0)
        + room_counts.get("extraRooms", 0)
    )

    if purpose in NO_ROOM_COUNT_PURPOSES or total_counted == 0:
        rooms = (
            fallback_open_space_room(footprint_area_sqm, purpose)
            if total_counted == 0
            else scale_rooms_to_footprint(build_room_list(room_counts), footprint_area_sqm)
        )
    else:
        rooms = scale_rooms_to_footprint(build_room_list(room_counts), footprint_area_sqm)

    footprint = get_footprint(land_length_m, land_width_m, footprint_area_sqm, layout_type)
    placed_rooms, corridor_rect, corridor_orientation, spur_rects = _place_rooms(rooms, footprint, variant)

    fig_w = 8.0
    fig_h = 8 * (land_width_m / land_length_m if land_length_m > 0 else 1)
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    # Rough size of one metre on the page, used to make labels fit their rooms
    inches_per_m = 0.9 * min(fig_w / (land_length_m + 2), fig_h / (land_width_m + 4))

    ax.add_patch(Rectangle((0, 0), land_length_m, land_width_m,
                             fill=False, edgecolor="#AAB7B8", linewidth=1, linestyle="dashed", zorder=1))

    offset_x, offset_y = _compute_offsets(land_length_m, land_width_m, footprint)
    _draw_footprint_outline(ax, footprint, structure_type, offset_x, offset_y)
    _draw_rooms(ax, placed_rooms, layout_type, offset_x, offset_y, inches_per_m)
    if corridor_rect:
        _draw_corridor(ax, corridor_rect, offset_x, offset_y)
    if spur_rects:
        _draw_spurs(ax, spur_rects, offset_x, offset_y)
    _draw_door_swings(ax, placed_rooms, corridor_rect, corridor_orientation, offset_x, offset_y)
    if extra_doors:
        connectors = ([corridor_rect] if corridor_rect else []) + list(spur_rects or [])
        _draw_extra_doors(ax, placed_rooms, extra_doors, connectors, offset_x, offset_y)
    _draw_north_arrow(ax, land_length_m, land_width_m)
    _draw_road_marker(ax, land_length_m, road_label)

    ax.set_xlim(-1, land_length_m + 1)
    ax.set_ylim(-2, land_width_m + 2)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(f"{floor_label} — {layout_type} · {structure_type}",
                  fontsize=11, fontweight="bold", color="#1A3C5E", pad=14)

    plt.tight_layout()
    plt.savefig(filepath, dpi=150, bbox_inches="tight")
    plt.close(fig)

    return filename

def generate_all_floor_blueprints(
    per_floor_breakdown: list[dict],
    purpose: str,
    layout_type: str,
    structure_type: str,
    land_length_m: float,
    land_width_m: float,
    ground_floor_area_sqm: float,
    road_label: str,
    variant: int = 0,
    extra_doors: list[dict] | None = None,
) -> dict:
    result = {}
    for i, room_counts in enumerate(per_floor_breakdown):
        floor_num = i + 1
        floor_label = "Ground Floor" if floor_num == 1 else f"Floor {floor_num}"

        floor_doors = []
        for door in (extra_doors or []):
            try:
                if int(door.get("floor", 0)) == floor_num:
                    floor_doors.append(door)
            except (TypeError, ValueError):
                continue

        filename = generate_floor_blueprint(
            room_counts=room_counts,
            purpose=purpose,
            layout_type=layout_type,
            structure_type=structure_type,
            land_length_m=land_length_m,
            land_width_m=land_width_m,
            footprint_area_sqm=ground_floor_area_sqm,
            road_label=road_label,
            floor_label=floor_label,
            variant=variant,
            extra_doors=floor_doors,
        )
        result[floor_num] = filename

    return result