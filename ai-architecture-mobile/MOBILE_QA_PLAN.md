# Mobile App QA Plan

Phase 1 is a read-only review. These are planned checks; no test cases have
been run. The mobile `package.json` has no test script or declared test runner.
Before Phase 2, approval is required to add `jest-expo`, `jest`,
`@testing-library/react-native`, and `@types/jest`.

## Automated test cases

| ID | Area | Steps | Expected result | Type |
|---|---|---|---|---|
| V-01 | Room validation | Check every room count at 0 and positive integers; try negative, fractional, and above-20 values in each room mode. | Zero and whole counts from 0 to 20 pass; invalid counts fail with field-specific issues. | Automated |
| V-02 | Land length | Validate positive finite values; try 0, negative, `NaN`, `Infinity`, and empty input through payload construction. | Only positive finite numbers pass; invalid or empty required input is rejected. | Automated |
| V-03 | Land width | Validate positive finite values; try 0, negative, `NaN`, `Infinity`, and empty input through payload construction. | Only positive finite numbers pass; invalid or empty required input is rejected. | Automated |
| V-04 | Land area | Validate positive finite area; try 0, negative, `NaN`, `Infinity`, and computed overflow. | Only positive finite area passes validation. | Automated |
| V-05 | Road width | Try positive values, 0, negative, `NaN`, `Infinity`, and empty input through payload construction. | Positive finite road width passes; the rest fail. | Automated |
| V-06 | Road frontage | Try `null`, blank, 0, negative, `NaN`, `Infinity`, and positive finite values. | Empty frontage stays optional; supplied frontage must be positive and finite. | Automated |
| V-07 | Frontage length | Supply frontage longer than the longest plot side, then equal to and shorter than it. | Overlong frontage is rejected; equal or shorter frontage passes. | Automated |
| V-08 | Latitude | Try below -90, exactly -90, an interior value, exactly 90, above 90, `NaN`, and infinity. | Finite values from -90 through 90 pass; all others fail. | Automated |
| V-09 | Longitude | Try below -180, exactly -180, an interior value, exactly 180, above 180, `NaN`, and infinity. | Finite values from -180 through 180 pass; all others fail. | Automated |
| V-10 | Address | Try valid address, empty text, and “Fetching address...”, “Unknown location”, and “Could not fetch address”. | Only a non-empty resolved address passes; unresolved placeholders are rejected. | Automated |
| V-11 | Parking and variant | Try `parkingSpaces` 0, negative, and fractional; try variant 0, negative, and fractional. | Non-negative integers pass; negative or fractional values fail. | Automated |
| V-12 | Floor override normalization | Normalize key `"01"` and submit keys `"abc"`, `"0"`, and `"-1"`. | `"01"` becomes `"1"`; invalid or non-positive keys are rejected. | Automated |
| V-13 | Duplicate override keys | Submit both `"01"` and `"1"`. | Duplicate canonical floor keys are reported rather than silently overwritten. | Automated |
| V-14 | Room layout discriminator | Submit `same`, `standardWithOverrides`, and `perFloor` under matching and mismatched layout modes. | Matching discriminators pass; mismatches fail. | Automated |
| V-15 | Per-floor count | Submit custom room data with fewer or more entries than `floors`, then an exact count. | Only one room configuration per floor passes. | Automated |
| P-01 | Same-room payload | Build a one-floor/same-layout request from a valid draft. | Payload uses `rooms.type = "same"` with the chosen room configuration. | Automated |
| P-02 | Standard-with-overrides payload | Build an “almost” layout with numeric and zero-padded override keys. | Payload preserves standard rooms and normalizes override keys. | Automated |
| P-03 | Per-floor payload | Build a custom layout with one configuration for each floor. | Payload uses `rooms.type = "perFloor"` and preserves floor order and values. | Automated |
| P-04 | Feet conversion | Build a draft in feet with known dimensions and frontage. | Length, width, and frontage convert using 0.3048 metres per foot. | Automated |
| P-05 | Area and perch | Build with known metre dimensions (including 20 m × 15 m). | Area is length × width; perch is sqm ÷ 25.29 (300 sqm is about 11.86 perch). | Automated |
| P-06 | Optional frontage | Build requests with absent, `null`, blank, and positive frontage. | Empty values serialize as the intended optional value; positive frontage is included in metres. | Automated |
| P-07 | Corner plot / extra roads | Build a Corner Plot request for each side (`left`, `right`, `top`) and a non-corner request. | Corner plot sends the selected extra road’s side, width, and label; other shapes send no extra road. | Automated |
| P-08 | Defaults | Inspect default building draft and build a default request. | Floors default to 1; bedrooms, bathrooms, kitchens, visitor halls, and extra rooms default to 0. | Automated |
| P-09 | Resolved address only | Build with “Fetching address...” and a resolved address. | Placeholder is rejected and cannot be sent; resolved address is retained. | Automated |
| A-01 | API success | Mock HTTP 200 responses for location check, prediction, edit, and PDF calls. | Calls resolve with returned data and expected URL, parameters, body, and response type. | Automated |
| A-02 | Location API 400 | Mock outside-Jaffna and Waterbody `detail` errors. | Each user-facing error clearly presents the server detail. | Automated |
| A-03 | API 422 | Mock a validation response with several `detail` issues. | A readable message identifies fields and limits output to the supported issue count. | Automated |
| A-04 | API 500 | Mock a server error without a string detail. | User receives a clear status-based server error. | Automated |
| A-05 | Network failure | Mock an Axios error without a response. | User sees a reachable-backend/network message. | Automated |
| A-06 | Timeout | Mock Axios timeout/no-response error. | Timeout is reported as an unreachable backend, not success or a silent fallback. | Automated |
| A-07 | Missing API base URL | Mock runtime config without `API_BASE_URL`, invoke API calls, and inspect requested URLs. | Clear configuration error; no request falls back to localhost. | Automated |
| A-08 | PDF response validation | Mock a valid `%PDF-` response and invalid/truncated response through PDF save logic. | Only a valid PDF is saved; invalid response produces a visible error. | Automated |
| S-01 | Location search | Render Location screen, search a valid address, select the map point, and wait for reverse geocoding. | Search result opens the map, the resolved address is shown, and confirmation checks the selected coordinates. | Automated |
| S-02 | GPS permission denied | Mock denied foreground permission and invoke GPS. | Clear permission-denied guidance appears and address search remains available. | Automated |
| S-03 | Location no results | Mock geocoder returning no result. | “Address not found” or the service’s clear no-result error is shown; no invalid point is confirmed. | Automated |
| S-04 | Location history load | Mock saved valid, malformed, and excess history entries. | Valid entries load newest-first up to five; invalid entries are filtered; storage failure is visible. | Automated |
| S-05 | Location history save | Confirm a location and inspect AsyncStorage calls/state. | Confirmed location is saved, same-address entry is replaced, and list is capped at five. | Automated |
| S-06 | Location history clear | Clear history and mock storage failure. | Success clears the list; failure shows a clear message. | Automated |
| S-07 | Map reverse-geocode failure | Mock empty/unknown result and stale responses after a map movement. | Confirmation remains disabled until current-pin geocoding succeeds; stale result cannot replace current address. | Automated |
| S-08 | Location check failure | Mock outside-Jaffna/Waterbody and network errors during map confirmation. | Error is visible, selection is retained, and confirmation can be retried. | Automated |
| S-09 | Land units and shape | Render Land Details; switch metres/feet and select every shape. | Selected units and all five shape choices display and update draft state. | Automated |
| S-10 | Land road type | Select each road preset. | Label and width are kept together in the draft. | Automated |
| S-11 | Land Corner Plot | Choose Corner Plot; select every second-road side and type. Change to another shape. | Second-road controls appear only for Corner Plot; selected values are retained in draft. | Automated |
| S-12 | Land errors | Submit empty, zero, negative, non-finite, too-small-area, and valid land values. | Required-field, finite, positive, and 50 sqm minimum errors appear; valid data advances. | Automated |
| S-13 | Room floor limits | Exercise floor counter at 1, 15, and adjacent values. | Floor count never drops below 1 or rises above 15. | Automated |
| S-14 | New custom floor | Select custom layout, increase floors, and inspect newly created floor rooms. | New floor starts with every room count at 0. | Automated |
| S-15 | Room values persist | Enter room counts and notes; navigate Back then Forward. | Values remain unchanged. | Automated |
| S-16 | Purpose and rooms | Change purpose while room counts are set. | Counts are not reset; purpose-dependent fields show or hide correctly. | Automated |
| S-17 | Frontage field position | Render Room Setup and inspect order around Additional Notes; inspect Land Details. | Frontage is at the bottom of Room Setup after Additional Notes and absent from Land Details. Label, hint, and validation match expected text. | Automated |
| S-18 | Frontage validation UI | Submit blank, zero, negative, non-finite, valid, and overlong frontage. | Blank is accepted; supplied values must be finite/positive and not exceed longest plot side; errors are readable. | Automated |
| S-19 | Results fields | Render feasible and infeasible results with populated and empty optional fields. | Feasibility, layout, structure, zone, area-matched status, blockers, warnings, “Try this” suggestions, breakdown, and explanation display conditionally and correctly. | Automated |
| S-20 | Blueprint text edit | Submit blank and valid instructions; mock non-applied, applied, and failed API responses. | Blank is rejected; response messages are visible; applied edit creates a new version and clears the instruction. | Automated |
| S-21 | Blueprint versions | Navigate previous/next versions and regenerate from the selected version. | Correct version/breakdown is active, bounds disable navigation, and the next request uses the active variant and rooms. | Automated |
| S-22 | Results PDF | Mock save and share actions, failures, and current edited version. | PDF request uses active blueprint and breakdown; saved URI enables sharing; failures display clear messages. | Automated |

## Manual phone cases

Run on physical iOS and Android phones. Backend-dependent scenarios need a
reachable backend and valid public API URL. Each result is to be recorded as
pass or fail in Phase 5.

| ID | Area | Steps | Expected result | Type |
|---|---|---|---|---|
| M-01 | Jaffna house plan | Select a Jaffna town plot, enter a normal house and generate. | Location confirms; plan, rules, explanation, and blueprint load. | Manual on phone |
| M-02 | Outside Jaffna | Select a point in Colombo and confirm. | Clear outside-Jaffna error appears; selection remains available for correction. | Manual on phone |
| M-03 | Waterbody | Select a known waterbody point and confirm. | Clear waterbody/building-not-allowed error appears. | Manual on phone |
| M-04 | Shop road-width blocker | Choose Shop and a road under 9 m; generate. | Result displays the backend rule blocker and does not hide it. | Manual on phone |
| M-05 | CN3 coverage | Choose a known CN3 location and submit a plot/building case for the 50% coverage rule. | Result reflects the 50% coverage rule. | Manual on phone |
| M-06 | Corner plot | Choose Corner Plot, configure a second road and side, generate. | Request/result uses the selected second-road values and blueprint reflects access. | Manual on phone |
| M-07 | Per-floor rooms | Configure multiple floors with different room counts and generate. | Each floor’s values appear in results and blueprint breakdown. | Manual on phone |
| M-08 | Edit and variants | Enter a blueprint edit, regenerate, then navigate versions. | New version appears; previous/next navigation works; edits apply to the displayed plan. | Manual on phone |
| M-09 | PDF download/share | Download report, use Share saved PDF, and save through the native share sheet. | Success message appears; PDF opens/shares and can be saved to a user-visible location. | Manual on phone |
| M-10 | GPS permission and service | Test GPS allowed, denied, and device location services turned off. | Each state gives useful feedback; manual address search remains possible. | Manual on phone |
| M-11 | Orientation | Rotate phone to landscape and back on each screen. | Content remains usable and controls are not obscured or clipped. | Manual on phone |
| M-12 | App backgrounding | Switch to another app and return during entry and results. | Current form and result state remain intact. | Manual on phone |
| M-13 | Backend off / retry | Turn backend off, trigger an API action, turn it back on, and retry. | Network error is clear; retry succeeds without restarting the app or losing input. | Manual on phone |
| M-14 | Slow network | Throttle or use a slow connection during geocoding, plan generation, edit, and PDF. | Loading indicators appear; no stale results or duplicate submissions; final response/error is clear. | Manual on phone |
| M-15 | Extreme land values | Enter very large and very small dimensions, including values causing overflow or less than 50 sqm. | Invalid or too-small values are blocked with clear messages; valid values remain usable. | Manual on phone |
| M-16 | Appearance/accessibility | Enable system dark mode and a large system font size. | Text and controls remain readable, contrast is usable, and layout does not clip. | Manual on phone |
| M-17 | Back navigation | Use visible Back and platform swipe-back/back gesture on every applicable screen. | Returns to the prior step without losing entered form state. | Manual on phone |
| M-18 | Web/mobile equivalence | Enter the same location, land, purpose, floors, rooms, and road data on web and mobile. | Request values and resulting rule/model output match, allowing for nondeterministic explanation text. | Manual on phone |

## Approval gate

Phase 2 is paused until approval to install the four test dependencies listed
above. No package has been installed for this plan. Phase 5 will add per-platform
pass/fail checkboxes to this file.
