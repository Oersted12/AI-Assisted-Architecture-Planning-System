# backend/app/zone_resolver.py
# zone_resolver.py — resolves (lat, lng, address) → (zone_code, area_name)
# using the digitized Jaffna zoning polygons stored in PostGIS.

"""
Resolves (lat, lng, address) → (zone_code, area_name).

Replaces the earlier hardcoded placeholder (always R2/Jaffna Town) with a
real PostGIS point-in-polygon lookup against the `jaffna_zones` table,
which was digitized from Map 65 (Jaffna District Zoning Plan, Greater
Jaffna Development Plan 2025-2035) via QGIS georeferencing + automated
color-based polygon extraction.

`jaffna_zones` stores full legend names (e.g. "High Density Commercial
Zone") in its `zone` column, not the short UDA codes used by ZONE_DATA
(e.g. "C1") — ZONE_NAME_TO_CODE below maps between the two.

NOTE: area_name resolution is intentionally left untouched here — it's
tracked separately (OSM place-name categorical encoding currently falls
back to index 0 for unrecognized names). This function still just passes
the given `address` through. Fixing that is a separate task.
"""

import logging
import os
import psycopg2

from app.zone_data import ZONE_DATA
from app.area_names import resolve_area_name

logger = logging.getLogger(__name__)

# --- DB connection config -----------------------------------------------
# Adjust these (or set the matching env vars) to match your local setup.
DB_HOST = os.environ.get("JAFFNA_DB_HOST", "localhost")
DB_PORT = os.environ.get("JAFFNA_DB_PORT", "5432")
DB_NAME = os.environ.get("JAFFNA_DB_NAME", "jaffna_architecture")
DB_USER = os.environ.get("JAFFNA_DB_USER", "postgres")
DB_PASSWORD = os.environ.get("JAFFNA_DB_PASSWORD", "")  # set this env var, don't hardcode

# --- Zone name (PostGIS) -> zone code (ZONE_DATA) mapping ----------------
# Built primarily from ZONE_DATA's own "name" field, with a couple of
# manual overrides where the map legend's wording differs from ZONE_DATA.
_MANUAL_NAME_OVERRIDES = {
    "Airport oriented Medium Mix Development Zone": "AR3",  # closest match: "Airport Related Activities"
    "High Sensitive Conservation Zone": "CN1",    # ZONE_DATA says "High Sensitivity Conservation"
    "Medium Sensitive Conservation Zone": "CN2",  # ZONE_DATA says "Medium Sensitivity Conservation"
    "Low Sensitive Conservation Zone": "CN3",     # ZONE_DATA says "Low Sensitivity Conservation"
}

def _build_name_to_code_map() -> dict[str, str]:
    mapping = {}
    for code, meta in ZONE_DATA.items():
        # ZONE_DATA names don't include the trailing "Zone" that the
        # PostGIS `zone` column values have (e.g. "High Density Commercial"
        # vs "High Density Commercial Zone") — normalize by appending it.
        full_name = meta["name"]
        if not full_name.endswith("Zone"):
            full_name = f"{full_name} Zone"
        mapping[full_name] = code
    mapping.update(_MANUAL_NAME_OVERRIDES)
    return mapping

ZONE_NAME_TO_CODE = _build_name_to_code_map()

# Zone names that exist on the map but have no buildable UDA code at all
# (e.g. open water) — these should fail loudly, not silently default.
NON_BUILDABLE_ZONE_NAMES = {"Waterbody"}


def _get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def resolve_zone(lat: float, lng: float, address: str) -> tuple[str, str, bool]:
    """
    Returns (zone_code, area_name, area_matched) for a given coordinate/address.    Returns (zone_code, area_name) for a given coordinate/address, using a
    real point-in-polygon lookup against the digitized jaffna_zones table.

    Raises ValueError if:
      - the point doesn't fall inside any digitized zone polygon
        (e.g. outside the mapped Jaffna District extent), or
      - the point falls inside a zone with no corresponding buildable
        UDA code (currently only "Waterbody"), or
      - the resolved zone name has no entry in ZONE_NAME_TO_CODE
        (e.g. the map legend name doesn't match any ZONE_DATA code —
        needs a manual override added above).
    """
    query = """
        SELECT zone
        FROM jaffna_zones
        WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
        LIMIT 1;
    """
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (lng, lat))  # note: ST_MakePoint takes (lon, lat)
            row = cur.fetchone()

    if row is None:
        raise ValueError(
            f"No zone polygon found containing point (lat={lat}, lng={lng}). "
            f"This coordinate may be outside the digitized Jaffna District extent."
        )

    zone_name = row[0]

    if zone_name in NON_BUILDABLE_ZONE_NAMES:
        raise ValueError(
            f"Point (lat={lat}, lng={lng}) falls inside '{zone_name}', which has "
            f"no buildable UDA zone code. This plot cannot be assessed."
        )

    zone_code = ZONE_NAME_TO_CODE.get(zone_name)
    if zone_code is None:
        raise ValueError(
            f"Resolved zone name '{zone_name}' has no mapping to a ZONE_DATA code. "
            f"Add an entry to ZONE_NAME_TO_CODE / _MANUAL_NAME_OVERRIDES in "
            f"zone_resolver.py. Valid codes: {list(ZONE_DATA.keys())}"
        )

    if zone_code not in ZONE_DATA:
        raise ValueError(
            f"Mapped zone_code '{zone_code}' is not a valid ZONE_DATA key. "
            f"Valid codes: {list(ZONE_DATA.keys())}"
        )

    # Address looks like "street, area, district, province, country".
    # Try each part, most specific first.
    parts = [p.strip() for p in (address or "").split(",")]
    area_name, matched = resolve_area_name(parts)
    if not matched:
        logger.warning(
            "No known area found in address '%s'. Using '%s'.", address, area_name
        )

    return zone_code, area_name, matched