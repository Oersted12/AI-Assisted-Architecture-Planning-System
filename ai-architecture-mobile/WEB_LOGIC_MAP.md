# Web Logic Map — Phase 1

This document records the current behavior found in `ai-architecture-web/src`
and the request/response models in `backend/app/schemas.py`. No app logic was
changed in Phase 1.

## 1. Existing mobile project

| Area | Existing contents / finding |
|---|---|
| Navigation | Expo Router is installed and active (`main: expo-router/entry`). The existing route files are under `src/app/`. No second navigation package is needed. |
| `assets/` | Expo starter images/icons, tab icons, and `tutorial-web.png`. |
| `components/` | Empty. |
| `screens/` | Empty. |
| `scripts/` | `reset-project.js` exists. It was not run and must not be run. |
| `services/` | Existing `nominatim.js`, an Axios-based geocoding service. It was read but not modified. |
| `src/` | Expo Router routes (`_layout.tsx`, `index.tsx`, `explore.tsx`), starter components, constants, hooks, and `global.css`. |
| Other project files | `package.json`, `app.json`, `tsconfig.json`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, plus `.claude/` and `.vscode/`. Protected instructions and scripts were not edited. |
| TypeScript | Strict mode is enabled. The `@/*` alias maps to `src/*`. |
| Test runner | No mobile test runner or test script is declared. Phase 5 should use manual test steps unless the project configuration changes with approval. |

### Chosen structure

Use `src/` as the one canonical location for new app routes and app-owned
components, services, types, constants, and utilities. Keep Expo Router routes
in `src/app/`. Do not create parallel feature implementations in the empty
root `components/` or `screens/` folders. Preserve the existing
`services/nominatim.js` unchanged and reuse it rather than creating a duplicate
geocoder; new request/response contracts will be typed in TypeScript.

## 2. Screens and navigation flow

The web app is one conditional flow in `Home.jsx`, not a multi-route router:

1. **Location entry** — auto-attempts GPS, accepts a typed address, offers a
   Jaffna map shortcut, and shows up to five recent locations.
2. **Map picker** — opens after GPS/search/history/map shortcut. The user drags
   the map under a fixed pin, waits for reverse geocoding, then confirms. The
   backend checks the selected coordinates before confirmation.
3. **Location confirmed** — shows address and coordinates; continue opens the
   land/building form.
4. **Land/building form** — three steps: land details, building/room setup,
   review and submit. Back returns to the previous form step or location entry.
5. **Results** — displayed after `/predict`; edit returns to the form, and New
   Plan returns to location entry.
6. **Blueprints and edits** — embedded in Results when blueprint data exists.
   The user can browse versions and submit a text instruction to regenerate the
   currently selected plan.
7. **PDF** — a button on Results requests the report and downloads it.

Mobile plan: implement those as Expo Router screens in the same order:
location picker, land details, room setup, results, then blueprint/edit
controls. Keep blueprint and edit/regenerate as part of the results flow unless
mobile usability requires a dedicated route.

## 3. API calls

### Backend API

| Endpoint | Request | Response fields used by web | Error handling |
|---|---|---|---|
| `GET /check-location?lat={lat}&lng={lng}` | Latitude and longitude query parameters. | The JSON body is not read; an HTTP success allows confirmation. | Map picker shows the server error message. A network failure displays a “Cannot reach the server” message. |
| `POST /predict` | JSON request described below. | `feasibility`, `feas_confidence`, `layout_type`, `layout_confidence`, `structure_type`, `struct_confidence`, `land_area_sqm`, `permissible_fa_sqm`, `requested_fa_sqm`, `fa_utilisation_ratio`, `ground_floor_area_sqm`, `blueprints`, `zone_code`, `zone_name`, `explanation`, `per_floor_breakdown`, `area_matched`, `area_name`, `rule_blockers`, `rule_warnings`, and `rule_suggestions`. `zone_type` exists in the schema but is not displayed by the inspected results page. | API helper parses string `detail` or up to three validation issues from a 422 response. Network errors are surfaced; the form flow shows the message in an alert. |
| `POST /edit-blueprint` | `instruction`, `perFloorBreakdown`, `purpose`, `layout_type`, `structure_type`, `landLength`, `landWidth`, `groundFloorAreaSqm`, `roadLabel`, `variant`, `extraDoors`, and `extraRoads`. | Web reads `applied`, `summary`, `variant`, `extraDoors`, `blueprints`, `perFloorBreakdown`, and `message`. It adds an applied edit as a new version. | Empty instructions show an inline error. Non-applied responses show an info message. HTTP/network errors show an inline error. The text field has a 500-character limit. |
| `POST /download-pdf` | `{ "result": <current result with active blueprints>, "inputs": <original inputs, with active per-floor breakdown when available> }`. | Binary PDF response; no JSON fields are used. | Network failure is reported. Other failed statuses show a PDF-specific error. |

The `/predict` request shape comes from `PredictRequest` in `schemas.py`:

```text
lat, lng, address, landLength, landWidth, roadFrontage, extraRoads,
landAreaSqm, landAreaPerch, landShape, roadWidth, roadLabel, purpose,
floors, layoutMode, rooms, notes, parkingSpaces
```

`extraRoads` entries have `side`, `width`, and `label`. `rooms` is one of:

- `{ type: "same", data: RoomConfig }`
- `{ type: "standardWithOverrides", standard: RoomConfig, overrides: Record<string, RoomConfig> }`
- `{ type: "perFloor", data: RoomConfig[] }`

`RoomConfig` includes `bedrooms`, `bathrooms`, `kitchens`, `visitorHalls`,
`extraRooms`, `extraRoomNote`, and optional-to-the-user `roomTweaks` (default
empty mapping in the schema).

### External geocoding calls

| Endpoint | Request | Response values used | Error handling |
|---|---|---|---|
| Nominatim `GET /search` | `q={address}, Jaffna, Sri Lanka&format=json&limit=1` | First result's `lat`, `lon`, and `display_name`. | No result becomes “Address not found”; the search screen shows the thrown message. |
| Nominatim `GET /reverse` | `lat`, `lon`, `format=json` | `display_name`. | The map shows “Could not fetch address” and offers Retry. The mobile service returns “Unknown location” when its response has no usable address. |

Blueprint image paths are returned in `blueprints`; relative paths are joined to
the configured backend base URL. Absolute HTTP paths are used as-is.

## 4. Fields and validation

### Location and land

| Field | Web behavior | Required contract |
|---|---|---|
| `lat` | Comes from GPS or the map pin. | Finite number from -90 through 90. |
| `lng` | Comes from GPS or the map pin. | Finite number from -180 through 180. |
| `address` | Geocoded address shown for the selected pin. Confirmation is disabled until the current pin has a successful address lookup. | Send the real selected address only; never send the “Fetching address...” placeholder. |
| `landLength`, `landWidth` | User enters metres or feet; feet convert to metres using `0.3048`. | Positive finite numbers. |
| `landAreaSqm` | Computed as converted length × width. | Positive finite number. The web form additionally blocks computed areas below about 50 sqm. |
| `landAreaPerch` | Computed as sqm ÷ `25.29`. | Positive finite number. |
| `roadFrontage` | Optional; empty becomes `null`; feet convert to metres. Web also rejects a frontage longer than the plot's longest side. | If supplied, positive and finite. |
| `landShape` | `Rectangular`, `Square`, `L-Shape`, `Corner Plot`, or `Irregular`. | One of the listed values. |
| `roadWidth` / `roadLabel` | Road presets: Highway (A-Road) 12 m, Main Road (B-Road) 9 m, Local Road 6 m, Lane / Small Road 3 m. | Positive finite width; label is a string. |
| `extraRoads` | Only shown for Corner Plot; one additional road, side `left`, `right`, or `top`, with a selected road preset. | At most three entries; side is one of the schema literals. |

The web's quick `isInJaffna` check is only a rough box (latitude 9.0–10.0,
longitude 79.5–80.5); backend zone lookup remains authoritative.

### Building and rooms

| Field | Web behavior | Required contract |
|---|---|---|
| `purpose` | House, Apartment, Office, Shop, Supermarket, Hospital, School, Hotel, Warehouse, or Mixed-Use. | One of the listed values. |
| `floors` | Counter starts at 1 and allows 1–15. | Integer from 1 through 15. |
| `layoutMode` | `same`, `almost`, or `custom`; single-floor plans submit `same`. | Match the enum. |
| Room counts | `bedrooms`, `bathrooms`, `kitchens`, `visitorHalls`, and `extraRooms`. Counters start at 0 except bathrooms (1), and UI counters cap at 20. Bedrooms/kitchens are hidden for non-residential purposes. | Each count is an integer >= 0. |
| `extraRoomNote` | Optional free text shown when extra rooms > 0. | String. |
| `rooms` mode | `same` repeats one config; `almost` submits a standard config plus selected per-floor overrides; `custom` submits one config per floor. | Discriminator and shapes must match the schema. Floor override keys must be positive whole numbers; normalize `"01"` to `"1"` and reject values such as `"abc"`, `"0"`, or `"-1"`. |
| `notes` | Optional description; sent for the written Gemini explanation, not ML prediction. | String; trim before sending. |
| `parkingSpaces` | Not currently present in the web form; backend default is 0. | Integer >= 0. Keep defaulted unless the user approves adding a control. |
| Regeneration `variant` | Starts at 0 and carries forward the selected/applied version's variant. | Integer >= 0. |

### Web-only validation rules to preserve

- Land length and width must be entered and greater than zero.
- Calculated area below about 50 sqm is blocked at the form step.
- If frontage is entered, it must be greater than zero and no longer than the
  plot's longest side.
- The mobile implementation must additionally reject non-finite numbers and
  match every server-side range/positivity rule above.

## 5. Scenarios, loading, errors, and empty states

- GPS is attempted on entry; permission denial, unsupported GPS, timeout, or a
  rough-box point outside Jaffna leaves address search available.
- Manual address search geocodes to coordinates; selecting a recent location
  reopens the map at those coordinates.
- Recent locations are de-duplicated by address, newest first, capped at five,
  timestamped, and can be cleared. The web stores this in `localStorage`.
- The map starts at the selected point, displays a fixed pin, and reverse
  geocodes after movement with a 600 ms delay. Stale address responses are
  ignored. Confirmation is disabled until the address matches the current pin.
- The `/check-location` result may reject a point outside the mapped zone or in
  a Waterbody; surface the returned message without losing the selection.
- Land entry supports sqm display and perch conversion, road width/frontage,
  corner plot with a second road and side, and the five land shapes.
- Room setup supports standard all-floors, standard-with-selected-overrides,
  and fully custom per-floor configurations. Floors can range from 1 to 15.
- Results show feasibility and confidence, layout and structure when feasible,
  zone/area figures, area matching status, blockers, warnings, suggestions
  (“Try this”), per-floor breakdown via blueprint versions, and the explanation.
- Blueprint editing is available when inputs and per-floor breakdown exist.
  Regenerated plans are versioned; previous/next navigation changes the active
  blueprint/breakdown used for PDF export. The original feasibility and
  explanation remain unchanged after an edit.
- Empty results are tolerated: blueprints and explanation are only shown when
  present; history is hidden when empty; an unrecognized area has an explicit
  warning.
- Preserve visible loading states for GPS, geocoding, location checks, plan
  generation, PDF creation, and blueprint regeneration.
- Surface 422 field errors, outside-Jaffna/no-zone and Waterbody errors, and
  backend/network failures. Provide an empty/retry state when geocoding fails.

## 6. Web feature → mobile plan

| Web feature | Mobile plan | Installed package(s) / gap |
|---|---|---|
| Conditional screen flow | Reuse as ordered Expo Router screens. | `expo-router` |
| Search, reverse geocoding | Reuse existing service behavior; keep typed contracts for callers. | Existing `axios`; existing `services/nominatim.js` |
| Interactive map and fixed pin | Change to native map interactions and mobile-sized controls. | `react-native-maps` |
| GPS and permission flow | Reuse behavior, native permission prompts. | `expo-location` (approved and installed in Phase 3) |
| Recent-location history | Reuse five-item limit and clear action with on-device persistence. | `@react-native-async-storage/async-storage` (approved and installed in Phase 3) |
| Land/building forms | Reuse field semantics, validations, values, units, and room modes; change layout for touch and keyboard. | React Native / Expo already installed |
| API client and typed models | Reuse backend contract with typed request/response models and configured base URL. | `axios`, `expo-constants` |
| Result/rule/explanation cards | Reuse data and conditional behavior; adapt to scroll views and safe areas. | React Native / `react-native-safe-area-context` |
| Blueprint display | Reuse per-floor image URLs and version navigation. | `expo-image` |
| Edit/regenerate | Reuse endpoint and version state with mobile multiline input. | `axios` |
| PDF download/share | Reuse request payload and filename; save/open/share on device. | `expo-file-system`, `expo-sharing` (approved and installed in Phase 4) |
| Pure-logic/API tests | Write manual steps unless a runner is approved/added. | No test runner installed |

No packages were installed in Phase 2. In Phase 3, with approval, the project
added `expo-location` and `@react-native-async-storage/async-storage`. In Phase
4, with approval, it added `expo-file-system` and `expo-sharing`. The mobile app
must use a configured API origin, not `localhost`. `.env.example` contains an
empty `API_BASE_URL`; exact `.env` is ignored by git. Phase 2 adds
`app.config.ts` to put `API_BASE_URL` into Expo runtime `extra`; the API client
reads it through the already installed `expo-constants`. Only the public
backend URL belongs there; Gemini credentials remain on the backend. The client
reports a configuration error rather than falling back to localhost when the
value is empty.

## 7. Missing packages and open questions

### Missing packages

No runtime feature packages remain unapproved. No mobile test runner is
installed; Phase 5 will use manual checks rather than adding one.

### Open questions for the next phase

1. Should mobile add a `parkingSpaces` control, or keep the backend's current
   default of 0 to preserve the web form's API behavior?
2. No further PDF decision is needed: Phase 4 was approved for save and share.

## 8. Observed web issues / limits

- `ResultsPage.jsx` contains a literal `3` immediately after the rule-blocker
  section's JSX. It appears to be rendered as stray text. This was not changed.
- The web land form checks empty/zero-or-negative input but does not explicitly
  check finite values. Backend schema validation remains the final guard.
- The web test file is still the Create React App “learn react” starter smoke
  test; it does not cover this workflow.
- The rough Jaffna bounding box is only a convenience check, not authoritative
  district geometry.

## 9. Phase 2 shared logic

Phase 2 is approved and implemented in TypeScript:

- `src/types/api.ts` defines typed backend requests and responses.
- `src/constants/architecture.ts` contains form choices, road presets, and
  conversion/bounds constants.
- `src/utils/validation.ts` validates finite/ranged values, room counts,
  regeneration variants, and canonical positive floor keys.
- `src/utils/payload.ts` builds the `/predict` payload, converts feet to metres,
  computes sqm/perch, normalizes override keys, and rejects unresolved address
  placeholders.
- `src/services/api.ts` provides typed calls to `/check-location`, `/predict`,
  `/edit-blueprint`, and `/download-pdf`, plus blueprint URL resolution and
  readable server/network errors.
- Root `app.config.ts` exposes the configured API origin to the mobile runtime.

No mobile test runner is installed. Pure logic will be validated manually in
Phase 5 unless a runner is later approved.

## 10. Phase 3 screens

Phase 3 is approved and implemented:

- The Expo Router entry now opens the planner flow, and the router uses a Stack
  with hidden starter tab navigation.
- Location selection supports address search, automatic/current GPS, Jaffna
  map shortcut, map dragging, reverse geocoding, backend location checks, and
  up to five persisted recent locations.
- Land details supports units, shape, road presets, frontage, corner-road side,
  and the web form's 50 sqm/frontage checks.
- Room setup supports purpose, 1–15 floors, standard/override/custom modes,
  non-negative room counters, extra-room notes, and free-text notes.
- Results show feasibility, area/zone values, rule blockers/warnings/suggestions,
  blueprints, version navigation, explanation, and text edits/regeneration.
- No web/backend files were changed.
- Installing the two approved packages reported 49 npm audit findings (1
  critical, 39 high, 9 moderate). The Phase 4 install reduced the reported count
  to 45 (1 critical, 38 high, 6 moderate). No automatic audit fix was run.
  Investigate the dependency tree before a release.

## 11. Phase 4 PDF

Phase 4 is approved and implemented:

- The results page posts the current result and active plan inputs to
  `/download-pdf`.
- The response is checked for a PDF signature and saved as
  `Building_Plan_Report.pdf` in the app's document directory.
- The native share sheet can open/share the saved PDF.
- Web builds show a clear unsupported-platform error for this native file flow.

## 12. Phase 5 verification

The mobile package has no test runner, so no automated tests were added and no
test package was installed. TypeScript checking, Android export, and an Expo
Metro startup/status check were run successfully. The interactive checklist
below still needs to be completed on a phone; backend-dependent cases need a
reachable backend.

### Manual checks to perform

1. Put a reachable backend base URL in the ignored `.env` as `API_BASE_URL`.
   Do not use `localhost` on a physical phone. Run `npx expo start --lan`, open
   the project using an SDK-compatible Expo client/development build, and
   confirm the location screen appears.
2. With valid Jaffna coordinates, a resolved address, 20 m × 15 m land, and
   valid room counts, confirm payload construction gives 300 sqm, about
   11.86 perch, a nullable frontage when blank, and a complete `/predict`
   request.
3. Repeat with feet and confirm length, width, frontage, area, and perch use the
   same conversions as the web form.
4. Confirm zero room counts pass, while a negative, fractional, or above-20 room
   count is rejected. Confirm `parkingSpaces: 0` passes and a negative value
   fails.
5. Confirm invalid coordinates, non-finite or non-positive dimensions/road
   widths, and non-positive supplied frontage are rejected. Confirm exactly
   -90/90 latitude and -180/180 longitude are accepted.
6. Confirm a 49 sqm lot is blocked by the same client-side minimum as the web
   form, and a frontage longer than the longest side is rejected.
7. For `standardWithOverrides`, confirm key `"01"` becomes `"1"`; confirm
   `"abc"`, `"0"`, and `"-1"` raise validation errors. Confirm duplicate keys
   such as `"01"` and `"1"` are reported instead of silently overwriting.
8. Confirm each rooms discriminator matches its layout mode and custom mode
   contains one room configuration per floor.
9. Confirm an empty or unresolved address such as `"Fetching address..."` is
   rejected and never reaches `/predict`.
10. Confirm regeneration variant `0` passes and a negative or fractional
    variant is rejected.
11. Confirm search, GPS permission/denial, reverse geocoding, map pin dragging,
    and recent-location history behave correctly.
12. Confirm loading, no-zone/outside-Jaffna, Waterbody, 422, and network error
    states are visible and recoverable.
13. Confirm results show zone/area, feasibility, rule blockers, warnings,
    suggestions, per-floor breakdown, explanation, and blueprint variants.
14. Configure a reachable backend in `.env`, restart Expo, and confirm the
    runtime API URL is used for `/check-location` and `/predict`. Confirm a
    server validation response is readable and a stopped/unreachable backend
    shows a network error, not a localhost fallback.
15. With a valid backend result, confirm response cards and floor images use
    the returned fields and relative blueprint URLs resolve against the same
    backend origin. Confirm text edit/regenerate creates a new version.
16. Confirm PDF generation saves `Building_Plan_Report.pdf`, the native share
    sheet opens the file, and invalid PDF responses and unavailable sharing
    produce visible errors.
