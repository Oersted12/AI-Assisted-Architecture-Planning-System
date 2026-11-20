# backend/app/regulations.py
"""
UDA rules used by the planning system. ONE file, used by BOTH:
  - build_dataset.py  (to make the training data)
  - ml_service.py     (to predict for a real user)
so the training data and the live app can never disagree again.

Sources:
  - Greater Jaffna Development Plan 2025-2035: zone factors, plot coverage,
    minimum land extent (Chapter 7)
  - Planning and Building Regulations 2021 (Gazette 2235/54): Schedule 6
    Form A (floor area ratio) and Form B (floors on 3.0 m and 4.5 m roads),
    Regulation 66 (height of small lots)

Project decisions (set by the project owner):
  1. The 9 m access-road rule for non-residential uses is applied in EVERY zone.
  2. Minimum land extent is a WARNING, not a blocker (it is a sub-division rule).
  3. Commercial uses (80% coverage where the plan splits commercial / others):
     Shop, Supermarket, Office, Hotel.
  4. In the live app the ground floor is 70% of the coverage limit
     (see GROUND_FLOOR_SHARE in ml_service.py).
  5. CN3 allows building with 50% coverage, as in the plan.
"""

NON_RESIDENTIAL = {
    "Hospital", "Hotel", "Mixed-Use", "Office", "School",
    "Shop", "Supermarket", "Warehouse",
}
RESIDENTIAL = {"House", "Apartment"}
COMMERCIAL = {"Shop", "Supermarket", "Office", "Hotel"}

# Minimum land extent for sub-division (sq.m) - plan Chapter 7
MIN_LAND_SQM = {
    "C1": 150, "C2": 150, "C3": 150, "MD1": 150, "MD2": 150,
    "MD3": 300, "R1": 300, "R2": 300, "R3": 300, "In2": 300, "I2": 300,
    "AR3": 300, "AG3": 500, "CN3": 500,
}

# Zones whose plot coverage is the same for every use
FLAT_COVERAGE = {
    "R1": 0.80, "In2": 0.65, "I2": 0.65, "AR3": 0.65,
    "AG3": 0.50, "CN1": 0.05, "CN2": 0.05, "CN3": 0.50,
}
# Zones with "Commercial 80% / Others 65%"
COMMERCIAL_SPLIT_ZONES = {"C1", "C2", "C3", "MD3", "R2", "R3"}
# Zones with "Non-residential 80% / Residential 65%"
RESIDENTIAL_SPLIT_ZONES = {"MD1", "MD2"}

UNLIMITED = 99.0   # "UL" in Form A
EXTENT_EDGES = [150, 250, 375, 500, 750, 1000, 1500, 2000, 2500, 3000, 3500, 4000]

# Schedule 6 Form A: floor area ratio.
# key = (zone factor from, zone factor to); value = 12 land-extent rows
# (150-250, 250-375, ... , more than 4000), each row = road width 6 m, 9 m, 12 m, 15 m+
FORM_A = {
    (0.5, 0.74): [
        [0.8, 0.9, 0.9, 0.9],
        [0.9, 1.0, 1.2, 1.3],
        [0.9, 1.0, 1.2, 1.4],
        [1.0, 1.1, 1.3, 1.5],
        [1.0, 1.2, 1.4, 1.7],
        [1.1, 1.3, 1.5, 1.8],
        [1.1, 1.4, 1.7, 2.0],
        [1.2, 1.5, 1.8, 2.1],
        [1.2, 1.6, 2.0, 2.4],
        [1.3, 1.7, 2.1, 2.5],
        [1.4, 1.8, 2.2, 2.6],
        [1.5, 1.9, 2.3, 2.8],
    ],
    (0.75, 0.99): [
        [1.3, 1.3, 1.4, 1.4],
        [1.3, 1.6, 1.8, 2.0],
        [1.3, 1.6, 1.9, 2.1],
        [1.4, 1.7, 2.0, 2.2],
        [1.5, 1.8, 2.2, 2.5],
        [1.6, 1.9, 2.3, 2.7],
        [1.7, 2.1, 2.5, 3.0],
        [1.8, 2.3, 2.7, 3.1],
        [1.9, 2.4, 3.0, 3.6],
        [2.0, 2.5, 3.1, 3.7],
        [2.2, 2.6, 3.3, 3.9],
        [2.5, 2.8, 3.5, 4.0],
    ],
    (1.0, 1.24): [
        [1.6, 1.7, 1.8, 1.9],
        [1.8, 2.2, 2.4, 2.7],
        [1.9, 2.2, 2.5, 2.8],
        [2.0, 2.3, 2.7, 3.0],
        [2.1, 2.4, 2.9, 3.3],
        [2.2, 2.5, 3.0, 3.6],
        [2.3, 2.7, 3.4, 4.0],
        [2.4, 2.8, 3.5, 4.2],
        [2.5, 3.2, 4.0, 4.7],
        [2.6, 3.4, 4.2, 5.0],
        [2.8, 3.6, 4.3, 5.3],
        [3.0, 3.8, 4.5, 5.5],
    ],
    (1.25, 1.49): [
        [2.0, 2.2, 2.3, 2.4],
        [2.2, 2.7, 3.0, 3.3],
        [2.3, 2.8, 3.2, 3.4],
        [2.4, 3.0, 3.4, 3.5],
        [2.6, 3.0, 3.6, 4.0],
        [2.7, 3.1, 3.8, 4.5],
        [2.9, 3.4, 4.2, 5.0],
        [3.0, 3.5, 4.4, 5.4],
        [3.1, 3.8, 4.7, 5.8],
        [3.2, 4.0, 5.0, 6.2],
        [3.3, 4.3, 5.5, 6.6],
        [3.5, 4.5, 6.0, 7.0],
    ],
    (1.5, 1.74): [
        [2.4, 2.6, 2.7, 2.8],
        [2.6, 3.2, 3.6, 4.0],
        [2.7, 3.3, 3.8, 4.2],
        [2.8, 3.4, 4.0, 4.5],
        [3.1, 3.6, 4.3, 5.0],
        [3.2, 3.8, 4.6, 5.5],
        [3.4, 4.0, 5.0, 6.0],
        [3.5, 4.2, 5.2, 6.5],
        [3.6, 4.4, 5.5, 7.0],
        [3.7, 4.6, 6.0, 7.5],
        [3.8, 4.8, 6.3, 7.7],
        [4.0, 5.0, 6.5, 8.0],
    ],
    (1.75, 1.99): [
        [2.8, 3.0, 3.2, 3.3],
        [3.0, 3.4, 4.3, 4.7],
        [3.2, 3.5, 4.5, 5.0],
        [3.4, 3.6, 4.7, 5.5],
        [3.5, 3.8, 5.1, 6.0],
        [3.6, 4.0, 5.4, 6.5],
        [3.7, 4.2, 5.8, 7.0],
        [3.8, 4.4, 6.2, 7.5],
        [3.9, 4.6, 6.5, 8.0],
        [4.0, 4.8, 6.9, 8.5],
        [4.0, 5.0, 7.3, 9.0],
        [4.0, 5.2, 7.5, 9.5],
    ],
    (2.0, 2.24): [
        [3.0, 3.4, 3.6, 3.8],
        [3.2, 3.6, 4.5, 4.5],
        [3.4, 3.7, 4.8, 5.2],
        [3.5, 4.0, 5.0, 6.0],
        [3.6, 4.5, 5.7, 6.5],
        [3.7, 5.0, 6.1, 8.0],
        [3.8, 5.1, 6.7, 9.0],
        [3.9, 5.2, 7.1, 10.0],
        [4.0, 5.3, 7.4, 10.5],
        [4.0, 5.4, 7.6, 11.0],
        [4.0, 5.5, 7.8, 11.5],
        [4.0, 5.6, 8.0, 12.0],
    ],
    (2.25, 2.49): [
        [3.0, 3.4, 3.6, 4.0],
        [3.5, 3.8, 4.5, 5.0],
        [3.6, 4.5, 4.7, 5.5],
        [3.7, 5.0, 5.0, 6.0],
        [3.8, 5.1, 6.0, 6.5],
        [3.9, 5.3, 6.5, 8.5],
        [4.0, 5.4, 7.0, 10.0],
        [4.0, 5.5, 7.5, 10.5],
        [4.0, 5.6, 7.5, 11.0],
        [4.0, 5.7, 8.0, 11.5],
        [4.0, 5.8, 8.0, 12.0],
        [4.0, 5.9, 8.0, 99.0],
    ],
    (2.5, 2.74): [
        [3.0, 3.4, 3.6, 4.0],
        [3.5, 4.0, 5.0, 5.5],
        [3.6, 4.6, 5.2, 6.0],
        [3.7, 5.1, 5.5, 6.5],
        [3.8, 5.2, 6.5, 7.0],
        [3.9, 5.4, 7.0, 9.0],
        [4.0, 5.5, 7.5, 10.5],
        [4.0, 5.6, 7.5, 11.0],
        [4.0, 5.7, 8.0, 11.5],
        [4.0, 5.8, 8.0, 12.0],
        [4.0, 5.9, 8.0, 12.0],
        [4.0, 6.0, 8.0, 99.0],
    ],
    (2.75, 2.99): [
        [3.0, 3.4, 3.6, 4.0],
        [3.5, 4.2, 5.0, 5.5],
        [3.6, 4.7, 5.2, 6.0],
        [3.7, 5.2, 5.5, 6.5],
        [3.8, 5.3, 7.0, 7.5],
        [3.9, 5.5, 7.5, 9.0],
        [4.0, 5.6, 7.5, 10.5],
        [4.0, 5.7, 8.0, 11.0],
        [4.0, 5.8, 8.0, 11.5],
        [4.0, 5.9, 8.0, 12.0],
        [4.0, 6.0, 8.0, 12.0],
        [4.0, 6.0, 8.0, 99.0],
    ],
    (3.0, 3.24): [
        [3.0, 3.4, 3.6, 4.0],
        [3.5, 4.4, 5.0, 5.5],
        [3.6, 4.8, 5.2, 6.0],
        [3.7, 5.3, 5.5, 6.5],
        [3.8, 5.4, 7.0, 7.5],
        [3.9, 5.6, 7.5, 9.0],
        [4.0, 5.7, 8.0, 10.5],
        [4.0, 5.8, 8.0, 11.0],
        [4.0, 5.9, 8.0, 11.5],
        [4.0, 6.0, 8.0, 12.0],
        [4.0, 6.0, 8.0, 12.0],
        [4.0, 6.0, 8.0, 99.0],
    ],
    (3.25, 3.49): [
        [3.0, 3.4, 3.6, 4.0],
        [3.5, 4.6, 5.0, 5.5],
        [3.6, 4.9, 5.2, 6.0],
        [3.8, 5.4, 5.5, 6.5],
        [4.0, 5.5, 7.5, 8.0],
        [4.0, 5.7, 8.0, 9.0],
        [4.0, 5.8, 8.0, 11.0],
        [4.0, 5.9, 8.0, 11.5],
        [4.0, 6.0, 8.0, 12.0],
        [4.0, 6.0, 8.0, 12.0],
        [4.0, 6.0, 8.0, 12.0],
        [4.0, 6.0, 8.0, 99.0],
    ],
    (3.5, 3.74): [
        [3.0, 3.4, 3.6, 4.0],
        [3.5, 4.8, 5.0, 5.5],
        [3.6, 5.0, 5.2, 6.0],
        [3.8, 5.5, 5.5, 6.5],
        [4.0, 5.6, 7.5, 8.0],
        [4.2, 5.8, 8.0, 9.0],
        [4.2, 6.0, 8.0, 11.0],
        [4.2, 6.2, 8.0, 11.5],
        [4.2, 6.4, 8.0, 12.0],
        [4.2, 6.5, 8.0, 12.0],
        [4.2, 6.5, 8.0, 12.0],
        [4.2, 6.5, 8.0, 99.0],
    ],
    (3.75, 4.0): [
        [3.0, 3.4, 3.6, 4.0],
        [3.5, 5.0, 5.0, 5.5],
        [3.6, 5.4, 5.2, 6.0],
        [4.0, 5.7, 5.5, 6.5],
        [4.5, 6.0, 7.5, 8.0],
        [4.5, 6.5, 8.0, 9.0],
        [4.5, 7.0, 8.0, 11.0],
        [4.5, 7.0, 8.0, 12.0],
        [4.5, 7.0, 8.0, 12.0],
        [4.5, 7.0, 8.0, 12.0],
        [4.5, 7.0, 8.0, 12.0],
        [4.5, 7.0, 8.0, 99.0],
    ],
}


def max_coverage(zone_code: str, purpose: str) -> float:
    """Maximum plot coverage (0-1) for this zone and building use."""
    if zone_code in COMMERCIAL_SPLIT_ZONES:
        return 0.80 if purpose in COMMERCIAL else 0.65
    if zone_code in RESIDENTIAL_SPLIT_ZONES:
        return 0.65 if purpose in RESIDENTIAL else 0.80
    if zone_code in FLAT_COVERAGE:
        return FLAT_COVERAGE[zone_code]
    raise ValueError(f"Unknown zone_code '{zone_code}'")


def _extent_index(land_area_sqm: float) -> int:
    idx = 0
    for i, edge in enumerate(EXTENT_EDGES):
        if land_area_sqm >= edge:
            idx = i
    return idx


def far_form_a(zone_factor: float, land_area_sqm: float, road_width_m: float):
    """Floor area ratio from Form A. Needs a road of 6 m or more.
    Returns 0.0 for zones with no zone factor (conservation)."""
    if zone_factor < 0.5:
        return 0.0
    band = None
    for key in sorted(FORM_A):
        if key[0] - 1e-9 <= zone_factor:
            band = key
    if band is None:
        return 0.0
    if road_width_m >= 15:
        col = 3
    elif road_width_m >= 12:
        col = 2
    elif road_width_m >= 9:
        col = 1
    else:
        col = 0
    return FORM_A[band][_extent_index(land_area_sqm)][col]


def max_floors_form_b(zone_factor: float, road_width_m: float) -> int:
    """Form B: most floors allowed on a 3.0 m or 4.5 m wide road."""
    if zone_factor < 0.75:
        return 1
    if zone_factor < 1.25:
        return 2
    if zone_factor < 3.5:
        return 3
    return 4 if road_width_m >= 4.5 else 3


def evaluate_rules(zone_code: str, zone_factor: float, purpose: str,
                   land_area_sqm: float, road_width_m: float, floors: int,
                   ground_floor_area_sqm: float,
                   road_frontage_m: float | None = None) -> dict:
    """Checks one plan against the rules.

    Returns a dict:
      max_coverage        coverage limit (0-1) for this zone and use
      permissible_fa_sqm  permissible total floor area
      far / max_floors    the number used (far for roads of 6 m or more,
                          max_floors for narrow roads)
      blockers            reasons the plan is NOT feasible
      warnings            things to check, which do not block the plan
    """
    blockers, warnings = [], []
    coverage_limit = max_coverage(zone_code, purpose)
    requested_fa = ground_floor_area_sqm * floors

    # ── Floor area (Form A) or number of floors (Form B) ─────────────────────
    far = max_floors = None
    if road_width_m >= 6:
        far = far_form_a(zone_factor, land_area_sqm, road_width_m)
        permissible_fa = land_area_sqm * far
        if requested_fa > permissible_fa:
            blockers.append(
                f"Requested floor area {requested_fa:.0f} m2 is above the "
                f"permissible {permissible_fa:.0f} m2"
            )
    elif zone_factor < 0.5:
        # No zone factor (conservation CN1 / CN2): nothing is permitted by floor area.
        # The conservation rule below already blocks it.
        max_floors = 0
        permissible_fa = 0.0
    else:
        max_floors = max_floors_form_b(zone_factor, road_width_m)
        permissible_fa = land_area_sqm * coverage_limit * max_floors
        if floors > max_floors:
            blockers.append(
                f"{floors} floors is above the limit of {max_floors} floor(s) "
                f"for a {road_width_m:g} m road"
            )
        if road_width_m < 3:
            warnings.append("The access road is narrower than 3 m. Confirm the access with the UDA")

    # ── Plot coverage ────────────────────────────────────────────────────────
    if land_area_sqm > 0 and ground_floor_area_sqm > land_area_sqm * coverage_limit + 0.05:
        used = ground_floor_area_sqm / land_area_sqm * 100
        blockers.append(
            f"Plot coverage {used:.0f}% is above the zone limit of {coverage_limit * 100:.0f}%"
        )

    # ── Use and access rules ─────────────────────────────────────────────────
    if purpose in NON_RESIDENTIAL and road_width_m < 9:
        blockers.append(
            f"Non-residential use needs an access road of 9 m or more (current {road_width_m:g} m)"
        )
    if zone_code in ("CN1", "CN2"):
        blockers.append("Conservation zone: normal buildings are not permitted")
    if zone_code == "AG3" and purpose != "Warehouse":
        blockers.append("Agro zone: non-agricultural use is not permitted")

    # ── Warnings (do not block) ──────────────────────────────────────────────
    minimum = MIN_LAND_SQM.get(zone_code)
    if minimum and land_area_sqm < minimum:
        warnings.append(
            f"Land {land_area_sqm:.0f} m2 is below the zone minimum of {minimum} m2 "
            f"for sub-division. An existing lot may still be built on. Confirm with the UDA"
        )
    if land_area_sqm < 150:
        warnings.append("Land under 150 m2: building height is limited to 10 m (Regulation 66)")
    if road_frontage_m is not None and 0 < road_frontage_m < 6:
        warnings.append("Road frontage under 6 m: building height is limited to 10 m (Regulation 66)")
    if floors > 4:
        warnings.append("A lift is required above 4 floors")

    suggestions = []
    max_ground = land_area_sqm * coverage_limit
    if any(b.startswith("Plot coverage") for b in blockers):
        suggestions.append(
            f"Reduce the ground floor to {max_ground:.0f} m2 or less, or add a floor.")
    if any(b.startswith("Requested floor area") for b in blockers):
        suggestions.append(
            f"Reduce the total floor area to {permissible_fa:.0f} m2 or less.")
    if any("floors is above" in b for b in blockers) and max_floors:
        suggestions.append(f"Use {max_floors} floor(s) or fewer on this road.")
    if any(b.startswith("Non-residential") for b in blockers):
        suggestions.append("Choose a road of 9 m or more, or change the use to House.")
    if any(b.startswith(("Conservation", "Agro")) for b in blockers):
        suggestions.append("Choose a different plot in a different zone.")

    return {
        "suggestions": suggestions,
        "max_coverage": coverage_limit,
        "permissible_fa_sqm": permissible_fa,
        "far": far,
        "max_floors": max_floors,
        "blockers": blockers,
        "warnings": warnings,
    }