from app.zone_resolver import resolve_zone

if __name__ == "__main__":
    zone_code, area_name, area_matched = resolve_zone(
        9.6615, 80.0093, "Jaffna Town"
    )
    print("zone_code:", zone_code)
    print("area_name:", area_name)
    print("area_matched:", area_matched)