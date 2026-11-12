from app.zone_resolver import resolve_zone

zone_code, area_name = resolve_zone(9.6615, 80.0093, "Jaffna Town")
print("zone_code:", zone_code)
print("area_name:", area_name)