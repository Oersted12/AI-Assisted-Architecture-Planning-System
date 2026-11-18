# Backend QA Report

Run date: 2026-11-18

## 1. Summary

| Round | Scope | Test result | Failed | Run date |
|---|---|---:|---:|---|
| 1 | Schema validation fixes and `test_schemas.py` | 39 passed | 0 | 2026-11-18 |
| 2 | Regulations, API, and other endpoint tests; full backend suite | 94 passed, 2 skipped (96 collected) | 0 | 2026-11-18 |

- Round 1 was reported as 39 passing tests in the earlier run.
- Round 2 was rerun for this report. Final pytest summary: `94 passed, 2 skipped, 7 warnings in 9.01s`.
- Round 2 includes the schema tests from Round 1.

## 2. App code changes

Only `backend/app/schemas.py` contains app code changes in the current diff. Those changes were made in Round 1. **No app code was changed in Round 2.**

| File and lines | Change | Why |
|---|---|---|
| `backend/app/schemas.py:13-17` | Added non-negative constraints to bedrooms, bathrooms, kitchens, visitor halls, and extra rooms. | Reject invalid negative room counts. |
| `backend/app/schemas.py:35-52` | Validates override floor keys and converts numeric keys to canonical decimal strings. | Reject invalid floor keys and make `"01"` match floor `"1"` during lookup. |
| `backend/app/schemas.py:72-75,79-84` | Added coordinate ranges and positive, finite land/road measurement constraints. | Reject out-of-range coordinates and invalid measurements. |
| `backend/app/schemas.py:100` | Added a non-negative constraint to `parkingSpaces`. | Reject negative parking counts. |
| `backend/app/schemas.py:141` | Added a non-negative constraint to `RegenerateBlueprintRequest.variant`. | Reject negative blueprint variants. |

## 3. Tests added

### `backend/tests/test_schemas.py`

| Test name | What it checks | Expected value |
|---|---|---|
| `test_room_counts_reject_negative_values` | Rejects negative values for all five room-count fields. | Each negative count raises `ValidationError`. |
| `test_room_counts_accept_zero` | Accepts zero for all five room-count fields. | Each count remains `0`. |
| `test_land_and_road_values_reject_bad_values` | Rejects zero/negative measurements and infinite/NaN areas. | Each invalid value raises `ValidationError`. |
| `test_land_and_road_values_accept_positive_finite_values` | Accepts positive finite dimensions, areas, road width, and frontage. | Supplied values are retained. |
| `test_coordinates_reject_out_of_range_or_nonfinite_values` | Rejects out-of-range or infinite coordinates. | Each invalid coordinate raises `ValidationError`. |
| `test_coordinates_accept_boundary_values` | Accepts latitude and longitude endpoints. | Latitude `-90`/`90`; longitude `-180`/`180`. |
| `test_parking_spaces_reject_negative_value` | Rejects negative parking count. | Raises `ValidationError`. |
| `test_parking_spaces_accept_zero` | Accepts zero parking spaces. | `parkingSpaces == 0`. |
| `test_variant_rejects_negative_value` | Rejects a negative regeneration variant. | Raises `ValidationError`. |
| `test_variant_accepts_zero` | Accepts variant zero. | `variant == 0`. |
| `test_floor_override_rejects_invalid_keys` | Rejects `"abc"`, `"0"`, and `"-1"`. | Each raises `ValidationError`. |
| `test_floor_override_positive_whole_number_is_accepted` | Accepts a positive floor key. | `"2"` remains available as key `"2"`. |
| `test_floor_override_01_is_canonicalized_and_used` | Normalizes `"01"` and checks the aggregation path uses the override. | Key becomes `"1"`; aggregated bedrooms total `6`. |

### `backend/tests/test_regulations.py`

| Test name | What it checks | Expected value |
|---|---|---|
| `test_non_residential_nine_meter_access_rule` | Tests the access rule at `9.0 m` and `8.99 m`. | No road blocker at `9.0`; blocker at `8.99`. |
| `test_plot_coverage_by_zone_and_use` | Checks coverage for C1, MD1, CN3, and R1 use examples. | `0.80`, `0.65`, or `0.50` as listed in section 7. |
| `test_form_a_smallest_and_largest_land_sizes_in_each_extent_range` | Checks the first and last tested sizes in each Form A extent range for factor band 1.0-1.24 and a 6 m road. | FAR sequence and boundaries are listed in section 7. |
| `test_form_b_floor_limits` | Checks floor thresholds and 3.0/4.5 m road examples. | 1, 2, 3, or 4 floors as listed in section 7. |
| `test_form_b_evaluate_rules_applies_floor_limit_to_permissible_area` | Checks Form B limit and permissible area for an R2 example. | 3-floor limit; `585 m2`; 4 floors blocked. |
| `test_minimum_land_extent_is_a_warning_not_a_blocker` | Checks R2 plots just below and at the configured minimum. | `299.99 m2` warns; `300 m2` does not. |
| `test_cn3_applies_fifty_percent_coverage` | Checks CN3 coverage at and just above half of a 600 m2 plot. | `300 m2` allowed; `300.1 m2` blocked. |

### `backend/tests/test_predict_api.py`

| Test name | What it checks | Expected value |
|---|---|---|
| `test_predict_valid_jaffna_plot_returns_rule_and_prediction_fields` | Successful `/predict` response with resolver, model, and Gemini stubbed. | HTTP 200; requested prediction and rule fields exist. |
| `test_predict_outside_jaffna_returns_no_zone_error` | Outside-Jaffna resolver error response. | HTTP 400; detail says outside Jaffna District. |
| `test_predict_waterbody_returns_clear_error` | Waterbody resolver error response. | HTTP 400; detail identifies water and requests moving the pin. |
| `test_predict_road_under_nine_metres_blocks_non_residential_use` | `/predict` for a Shop with an 8.99 m road. | HTTP 200; non-feasible result and a 9 m rule blocker. |
| `test_predict_rule_blocker_overrides_feasible_model_prediction` | Actual ML service with a feasible model stub and a road-rule blocker. | HTTP 200; feasibility is `Not Feasible`. |
| `test_predict_cn3_uses_fifty_percent_plot_coverage` | CN3 API prediction on a 600 m2 site. | Ground-floor area `210 m2`; no plot-coverage blocker. |
| `test_predict_unknown_area_name_sets_area_matched_false` | Resolver reports an unmatched area. | HTTP 200; `area_matched` is `false`. |
| `test_predict_negative_land_value_returns_422` | Negative `landLength` request. | HTTP 422. |
| `test_real_postgis_resolves_known_jaffna_point` | Real zone lookup for a known Jaffna coordinate. | A zone code, area name, and boolean match result. |
| `test_real_postgis_returns_no_zone_outside_mapped_district` | Real lookup outside the mapped region. | `ValueError` mentioning outside Jaffna District. |

Gemini calls were stubbed in API tests. Most zone lookups were mocked. The two real PostGIS tests were skipped in this run.

### `backend/tests/test_other_endpoints.py`

| Test name | What it checks | Expected value |
|---|---|---|
| `test_edit_blueprint_applies_room_count_change` | `/edit-blueprint` applies a mocked request to add a bathroom. | HTTP 200; bathroom count changes from 1 to 2 and edited blueprint URL is returned. |
| `test_download_pdf_returns_pdf_file` | `/download-pdf` produces a PDF response. | HTTP 200; content type is `application/pdf`; body starts with `%PDF-`. |

## 4. Bugs found

These validation bugs were identified and fixed in Round 1. The Round 2 tests did not expose additional app bugs.

| Problem | Where it was | Fix | Test proving the fix |
|---|---|---|---|
| Negative bedroom, bathroom, kitchen, visitor-hall, and extra-room counts were accepted. | `backend/app/schemas.py:13-17` | Added `ge=0` constraints. | `test_room_counts_reject_negative_values`; `test_room_counts_accept_zero`. |
| Invalid negative, zero, or non-finite land/road measurements could be accepted. | `backend/app/schemas.py:75,79-84` | Added positive and finite constraints to frontage, dimensions, areas, and road width. | `test_land_and_road_values_reject_bad_values`; `test_land_and_road_values_accept_positive_finite_values`. |
| Coordinates had no geographic range validation. | `backend/app/schemas.py:72-73` | Added latitude and longitude bounds and disallowed infinity/NaN. | `test_coordinates_reject_out_of_range_or_nonfinite_values`; `test_coordinates_accept_boundary_values`. |
| Negative parking-space counts were accepted. | `backend/app/schemas.py:100` | Added `ge=0`. | `test_parking_spaces_reject_negative_value`; `test_parking_spaces_accept_zero`. |
| Negative blueprint variants were accepted. | `backend/app/schemas.py:141` | Added `ge=0`. | `test_variant_rejects_negative_value`; `test_variant_accepts_zero`. |
| A key such as `"01"` could validate but fail lookup as floor `"1"`. | `backend/app/schemas.py:35-52`; floor lookup in `backend/app/payload_transform.py` | Canonicalized positive numeric keys to decimal strings and rejected invalid keys. | `test_floor_override_01_is_canonicalized_and_used`; `test_floor_override_rejects_invalid_keys`. |

## 5. Skipped tests

- The two tests marked `@pytest.mark.db` were skipped because `JAFFNA_DB_PASSWORD` was not set.
- To run them:
  - Set `JAFFNA_DB_PASSWORD` in the test process environment. The test reads it from that variable; it does not print or save it.
  - Make the Jaffna PostgreSQL/PostGIS database available.
  - Ensure `jaffna_zones` and its polygon data are installed.
  - Set `JAFFNA_DB_HOST`, `JAFFNA_DB_PORT`, `JAFFNA_DB_NAME`, and `JAFFNA_DB_USER` if the defaults in `zone_resolver.py` do not match the database.

No database connection was attempted during the skipped tests.

## 6. Warnings

The final Round 2 run had seven warnings. They did not fail tests.

| Warning | Count | Simple meaning | Risk |
|---|---:|---|---|
| anyio / pytest `CallSpec2` deprecation | 1 | The installed anyio pytest plugin uses an old pytest compatibility name. | Low now; may need a plugin update before a future pytest release removes it. |
| scikit-learn `DecisionTreeClassifier` version mismatch | 1 | The saved estimator was made with scikit-learn 1.6.1; this environment loads it with 1.5.2. | Medium: sklearn warns predictions may be invalid or behave differently. |
| scikit-learn `RandomForestClassifier` version mismatch | 1 | The saved estimator was made with 1.6.1; this environment loads it with 1.5.2. | Medium: same model-loading and prediction reliability risk. |
| scikit-learn `LabelEncoder` version mismatch | 1 | The saved encoder was made with scikit-learn 1.6.1; this environment loads it with 1.5.2. | Medium: encoded labels may not behave as expected across versions. |
| XGBoost serialized model version warning | 1 | XGBoost warns that the saved serialized model came from a different version. | Medium: model loading or prediction behavior may differ. |
| Unknown `pytest.mark.db` marker | 2 | Pytest has no registration for the `db` marker, so it warns at each decorated test. | Low for this run; marker filtering and test selection are less clear. |

The exact versions creating the scikit-learn warnings are `1.6.1` (artifact) and `1.5.2` (installed runtime). The XGBoost warning does not identify both exact versions in its output.

## 7. Expected values to check against the UDA PDF

The UDA/Gazette PDF was not found in the repository. The numbers below are values encoded in `regulations.py` and asserted by tests; passing tests only confirms code matches those transcribed values. Please verify them against the source PDF.

### Form A

- The tests use zone-factor band `1.0-1.24` and road-width column `6 m`.
- The tested land-extent boundaries are `150`, `250`, `375`, `500`, `750`, `1000`, `1500`, `2000`, `2500`, `3000`, `3500`, and `4000 m2`.
- The largest tested values below boundaries are `249.999`, `374.999`, `499.999`, `749.999`, `999.999`, `1499.999`, `1999.999`, `2499.999`, `2999.999`, `3499.999`, and `3999.999 m2`. The last open-ended extent is also tested at `5000 m2`.
- Expected FAR sequence for the respective extent rows is:
  - `1.6`, `1.8`, `1.9`, `2.0`, `2.1`, `2.2`, `2.3`, `2.4`, `2.5`, `2.6`, `2.8`, `3.0`.

### Form B

- Zone-factor thresholds tested: `0.50`, `0.75`, `1.25`, and `3.50`; upper-neighbor samples: `0.74`, `1.24`, and `3.49`.
- Tested road widths: `3.0 m` and `4.5 m`.
- Expected floors:
  - Factor `0.50` and `0.74`: `1` floor.
  - Factor `0.75` and `1.24`: `2` floors.
  - Factor `1.25` and `3.49`: `3` floors.
  - Factor `3.50`: `3` floors on a `3.0 m` road; `4` floors on a `4.5 m` road.
- The integrated Form B test expects the R2 residential case at factor `1.32`, site area `300 m2`, and road width `3.0 m` to have a 3-floor limit and `585 m2` permissible floor area. This uses `65%` coverage (`300 × 0.65 × 3`).

### Coverage

- C1 Shop: `80%`; C1 House: `65%`.
- MD1 House: `65%`; MD1 Office: `80%`.
- R1 House: `80%`.
- CN3: `50%`.
- The underlying use groups are project rules documented in `regulations.py`; verify the rates and classifications against the UDA plan.

### 9 m access-road rule

- Non-residential access road: `9 m` or more.
- The test expects `9.0 m` to pass this rule and `8.99 m` to trigger a blocker.
- The code documents this as a project-wide decision. The PDF was not available to independently confirm it is a Gazette rule.

### CN3 50% example

- The test uses a `600 m2` plot.
- `300 m2` (50%) is allowed; `300.1 m2` triggers a coverage blocker.
- Verify the CN3 `50%` rate against the UDA plan.

### Other tested plan value

- R2 subdivision minimum: `300 m2`; the test expects `299.99 m2` to warn and `300 m2` not to warn.
- Verify the minimum land value and its interpretation against Chapter 7 of the plan.

## 8. Not tested yet

- Web app behavior and UI rendering.
- Mobile app behavior.
- A real Gemini API request.
- PDF report contents, page layout, and images. The test only checks response type and the PDF signature.
- Corner-plot flows with real extra-road geometry.
- Real PostGIS lookup in this run; both database tests were skipped.
- UDA values against the original PDF; the PDF was not found.

## 9. Next steps

1. Verify the values in section 7 against the UDA plan and Gazette PDF.
2. Provide PostGIS access and set the database environment variables, then rerun the `db` tests.
3. Align installed scikit-learn and XGBoost versions with the versions used to create the model artifacts.
4. Register the `db` pytest marker to remove the unknown-marker warnings.
5. Add UI, real Gemini, PDF-content, and corner-plot coverage when those test environments are available.
