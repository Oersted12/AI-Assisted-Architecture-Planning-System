# backend/app/blueprint/footprint.py
"""
Determines the building's outer footprint shape: a rectangle sized to
the ML pipeline's already-computed ground_floor_area_sqm, fit within the
land's aspect ratio — or an L-shaped notch for the "L-Shape" layout type.
"""

import math


def build_rectangle_footprint(land_length_m: float, land_width_m: float,
                                footprint_area_sqm: float,
                                wide_span: bool = False) -> dict:
    """
    Returns a simple rectangle {"width": w, "height": h} sized to
    footprint_area_sqm, keeping (roughly) the same aspect ratio as the
    land plot itself — so a long narrow plot gets a long narrow building,
    not an oddly-proportioned one.

    wide_span=True forces a more elongated rectangle (used for
    "Single-Floor Wide-Span" layout type), regardless of the land's
    natural aspect ratio.
    """
    land_aspect = land_length_m / land_width_m if land_width_m > 0 else 1.0

    if wide_span:
        # Force an elongated ratio — at least 2:1 — capped so it never
        # exceeds the land's own aspect ratio (can't be wider than the plot).
        land_aspect = max(land_aspect, 2.0)

    # width * height = footprint_area_sqm, width / height = land_aspect
    height = math.sqrt(footprint_area_sqm / land_aspect)
    width = footprint_area_sqm / height

    # Never let the footprint exceed the actual land dimensions —
    # clip and recompute the other side if needed.
    width = min(width, land_length_m)
    height = min(height, land_width_m)

    # Recompute the shrunk side to preserve area as closely as possible
    if width * height < footprint_area_sqm:
        if width < land_length_m:
            width = min(footprint_area_sqm / height, land_length_m)
        else:
            height = min(footprint_area_sqm / width, land_width_m)

    return {"width": width, "height": height}


def build_l_shape_footprint(land_length_m: float, land_width_m: float,
                              footprint_area_sqm: float) -> dict:
    """
    Returns an L-shaped footprint as a full bounding rectangle plus a
    "notch" rectangle to subtract from one corner.

    Shape returned:
        {
          "bounding": {"width": W, "height": H},
          "notch": {"x": nx, "y": ny, "width": nw, "height": nh}
        }
    The notch is always cut from the top-right corner for consistency;
    rendering code draws the L by omitting that corner.
    """
    # Start from a rectangle sized ~25% larger than the target area (since
    # cutting a notch removes area), then cut a notch sized to bring the
    # remaining area back down to footprint_area_sqm.
    bounding_area = footprint_area_sqm * 1.3
    bounding = build_rectangle_footprint(land_length_m, land_width_m, bounding_area)

    notch_area = bounding["width"] * bounding["height"] - footprint_area_sqm
    notch_area = max(notch_area, 0)

    # Make the notch roughly square, sized to whichever bounding dimension
    # is smaller (so it never overhangs past the building's own edges).
    max_notch_side = min(bounding["width"], bounding["height"]) * 0.6
    notch_side = min(math.sqrt(notch_area), max_notch_side)
    notch_width = notch_side
    notch_height = notch_area / notch_width if notch_width > 0 else 0
    notch_height = min(notch_height, bounding["height"])

    notch = {
        "x": bounding["width"] - notch_width,
        "y": bounding["height"] - notch_height,
        "width": notch_width,
        "height": notch_height,
    }

    return {"bounding": bounding, "notch": notch}


def get_footprint(land_length_m: float, land_width_m: float,
                    footprint_area_sqm: float, layout_type: str) -> dict:
    """
    Single entry point: dispatches to the right footprint builder based
    on layout_type, returning a normalized shape:

        {"shape": "rectangle", "width": w, "height": h}
      or
        {"shape": "l_shape", "bounding": {...}, "notch": {...}}
    """
    if layout_type == "L-Shape":
        result = build_l_shape_footprint(land_length_m, land_width_m, footprint_area_sqm)
        return {"shape": "l_shape", **result}

    wide_span = (layout_type == "Single-Floor Wide-Span")
    result = build_rectangle_footprint(land_length_m, land_width_m, footprint_area_sqm, wide_span=wide_span)
    return {"shape": "rectangle", **result}