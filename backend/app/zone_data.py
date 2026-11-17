# backend/app/zone_data.py
"""
UDA Zone lookup table for Jaffna District.
Source: Greater Jaffna Development Plan 2025-2035, Chapter 7.

This holds the zone name, zone factor, type and the HIGHEST plot coverage of
each zone. Some zones allow less coverage for some building uses (for example
a house in a commercial zone). That use-based coverage, and the floor area
rules (Form A / Form B), are in app/regulations.py.
"""

ZONE_DATA = {
    "C1":  {"name": "High Density Commercial",          "factor": 2.61, "max_coverage": 0.80, "type": "Commercial"},
    "C2":  {"name": "Medium Density Commercial",        "factor": 2.14, "max_coverage": 0.80, "type": "Commercial"},
    "C3":  {"name": "Low Density Commercial",           "factor": 1.78, "max_coverage": 0.80, "type": "Commercial"},
    "MD1": {"name": "High Density Mixed Development",   "factor": 2.11, "max_coverage": 0.80, "type": "Mixed"},
    "MD2": {"name": "Medium Density Mixed Development", "factor": 1.92, "max_coverage": 0.80, "type": "Mixed"},
    "MD3": {"name": "Low Density Mixed Development",    "factor": 1.37, "max_coverage": 0.80, "type": "Mixed"},
    "R1":  {"name": "High Density Residential",         "factor": 1.54, "max_coverage": 0.80, "type": "Residential"},
    "R2":  {"name": "Medium Density Residential",       "factor": 1.32, "max_coverage": 0.80, "type": "Residential"},
    "R3":  {"name": "Low Density Residential",          "factor": 0.78, "max_coverage": 0.80, "type": "Residential"},
    "In2": {"name": "Medium Density Institutional",     "factor": 1.84, "max_coverage": 0.65, "type": "Institutional"},
    "I2":  {"name": "Medium Density Industrial",        "factor": 1.86, "max_coverage": 0.65, "type": "Industrial"},
    "AR3": {"name": "Airport Related Activities",       "factor": 1.25, "max_coverage": 0.65, "type": "Mixed"},
    "AG3": {"name": "Agro Promotion Zone",              "factor": 0.95, "max_coverage": 0.50, "type": "Agricultural"},
    "CN1": {"name": "High Sensitivity Conservation",    "factor": 0.00, "max_coverage": 0.05, "type": "Conservation"},
    "CN2": {"name": "Medium Sensitivity Conservation",  "factor": 0.00, "max_coverage": 0.05, "type": "Conservation"},
    "CN3": {"name": "Low Sensitivity Conservation",     "factor": 0.56, "max_coverage": 0.50, "type": "Conservation"},
}


def get_zone(zone_code: str) -> dict:
    """Look up zone metadata, raising a clear error for unknown codes
    rather than silently defaulting - an unknown zone should fail loudly."""
    zone = ZONE_DATA.get(zone_code)
    if zone is None:
        raise ValueError(
            f"Unknown zone_code '{zone_code}'. Valid codes: {list(ZONE_DATA.keys())}"
        )
    return zone