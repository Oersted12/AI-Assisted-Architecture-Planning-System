import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.regulations import (  # noqa: E402
    evaluate_rules,
    far_form_a,
    max_coverage,
    max_floors_form_b,
)


@pytest.mark.parametrize(
    ("road_width", "expect_blocker"),
    [(9.0, False), (8.99, True)],
)
def test_non_residential_nine_meter_access_rule(road_width, expect_blocker):
    # Expected: exactly 9 m meets the project's 9 m access-road rule; 8.99 m
    # blocks non-residential use. Source: UDA rules as documented in
    # regulations.py; this is a project-wide rule, not independently checked
    # against the Gazette PDF.
    result = evaluate_rules(
        "R2", 1.32, "Office", 300, road_width, 1, 100, road_width
    )
    road_blockers = [b for b in result["blockers"] if b.startswith("Non-residential")]
    assert bool(road_blockers) is expect_blocker


@pytest.mark.parametrize(
    ("zone_code", "purpose", "expected_coverage"),
    [
        ("C1", "Shop", 0.80),
        ("C1", "House", 0.65),
        ("MD1", "House", 0.65),
        ("MD1", "Office", 0.80),
        ("CN3", "House", 0.50),
        ("R1", "House", 0.80),
    ],
)
def test_plot_coverage_by_zone_and_use(zone_code, purpose, expected_coverage):
    # Expected coverage is the percentage encoded for each zone/use branch in
    # regulations.py. Source: Greater Jaffna Development Plan 2025-2035,
    # Chapter 7, as transcribed by this project; confirm the listed rates and
    # use classifications against the UDA PDF.
    assert max_coverage(zone_code, purpose) == expected_coverage


@pytest.mark.parametrize(
    ("land_area", "expected_far"),
    [
        (150, 1.6),
        (249.999, 1.6),
        (250, 1.8),
        (374.999, 1.8),
        (375, 1.9),
        (499.999, 1.9),
        (500, 2.0),
        (749.999, 2.0),
        (750, 2.1),
        (999.999, 2.1),
        (1000, 2.2),
        (1499.999, 2.2),
        (1500, 2.3),
        (1999.999, 2.3),
        (2000, 2.4),
        (2499.999, 2.4),
        (2500, 2.5),
        (2999.999, 2.5),
        (3000, 2.6),
        (3499.999, 2.6),
        (3500, 2.8),
        (3999.999, 2.8),
        (4000, 3.0),
        (5000, 3.0),
    ],
)
def test_form_a_smallest_and_largest_land_sizes_in_each_extent_range(
    land_area, expected_far
):
    # Expected FAR values are the 6 m-road column for zone-factor band
    # 1.0-1.24 in Schedule 6 Form A. Source: Planning and Building Regulations
    # 2021, Gazette 2235/54, as transcribed in regulations.py. The original
    # Gazette PDF is not in this workspace; verify all listed values there.
    assert far_form_a(1.0, land_area, 6.0) == expected_far


@pytest.mark.parametrize(
    ("zone_factor", "road_width", "expected_floors"),
    [
        (0.50, 3.0, 1),
        (0.74, 4.5, 1),
        (0.75, 3.0, 2),
        (1.24, 4.5, 2),
        (1.25, 3.0, 3),
        (3.49, 4.5, 3),
        (3.50, 3.0, 3),
        (3.50, 4.5, 4),
    ],
)
def test_form_b_floor_limits(zone_factor, road_width, expected_floors):
    # Expected floor counts follow the Form B thresholds documented in
    # regulations.py. Source: Planning and Building Regulations 2021,
    # Gazette 2235/54, Schedule 6 Form B; verify thresholds and rows against
    # the original PDF, which is not present in this workspace.
    assert max_floors_form_b(zone_factor, road_width) == expected_floors


def test_form_b_evaluate_rules_applies_floor_limit_to_permissible_area():
    # Expected: at zone factor 1.32, a 3.0 m road allows 3 floors; at 65%
    # coverage on 300 m2, that is 585 m2. Source: Form B in the 2021
    # Regulations and the residential/commercial coverage split in the
    # Greater Jaffna Development Plan, as transcribed in regulations.py;
    # confirm both values against the UDA PDF.
    result = evaluate_rules("R2", 1.32, "House", 300, 3.0, 4, 100, 6)
    assert result["max_floors"] == 3
    assert result["permissible_fa_sqm"] == 585
    assert any("above the limit of 3" in blocker for blocker in result["blockers"])


@pytest.mark.parametrize(
    ("land_area", "expect_minimum_warning"),
    [(299.99, True), (300, False)],
)
def test_minimum_land_extent_is_a_warning_not_a_blocker(
    land_area, expect_minimum_warning
):
    # Expected: the R2 subdivision minimum is 300 m2, and falling below it
    # warns without blocking. Source: Greater Jaffna Development Plan
    # 2025-2035, Chapter 7, as transcribed in MIN_LAND_SQM in regulations.py;
    # confirm the 300 m2 value and warning treatment against the UDA PDF.
    result = evaluate_rules(
        "R2", 1.32, "House", land_area, 9.0, 1, 100, 9.0
    )
    minimum_warnings = [w for w in result["warnings"] if "zone minimum" in w]
    assert bool(minimum_warnings) is expect_minimum_warning
    assert not any("zone minimum" in blocker for blocker in result["blockers"])


@pytest.mark.parametrize(
    ("ground_floor_area", "expect_coverage_blocker"),
    [(300, False), (300.1, True)],
)
def test_cn3_applies_fifty_percent_coverage(
    ground_floor_area, expect_coverage_blocker
):
    # Expected: CN3 coverage is 50%; on a 600 m2 plot, 300 m2 is allowed and
    # 300.1 m2 exceeds it. Source: Greater Jaffna Development Plan
    # 2025-2035, Chapter 7, as transcribed in regulations.py; verify the CN3
    # rate against the UDA PDF.
    result = evaluate_rules(
        "CN3", 0.56, "House", 600, 9.0, 1, ground_floor_area, 9.0
    )
    assert result["max_coverage"] == 0.50
    coverage_blockers = [
        b for b in result["blockers"] if b.startswith("Plot coverage")
    ]
    assert bool(coverage_blockers) is expect_coverage_blocker
