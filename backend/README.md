# AI-Assisted Architecture Planning System – Backend

FastAPI backend for the AI-Assisted Architecture Planning System for Jaffna District.
It finds the UDA zone for a plot, checks UDA rules, runs the ML models, draws the blueprint, and writes the explanation.

## What It Does

1. Finds the zone of a plot using PostGIS (point-in-polygon on the digitized Map 65 zones)
2. Checks UDA rules (floor area, coverage, 9 m road rule, minimum land)
3. Predicts with 3 ML models:
   - Feasibility (Random Forest)
   - Layout type (XGBoost)
   - Structure type (Random Forest)
4. Draws the blueprint with Matplotlib (corridor-based, 3 layout variants)
5. Writes a plain English explanation with Gemini
6. Builds a PDF report with reportlab

UDA rule blockers override the ML result.

## Tech Stack

- Python, FastAPI
- scikit-learn, XGBoost (models saved as `.joblib`)
- PostgreSQL 17 + PostGIS 3.6
- psycopg2-binary
- Matplotlib (blueprints)
- google-genai SDK (Gemini)
- reportlab (PDF)

## Project Structure

```
backend/
├── main.py
├── requirements.txt
├── .env
├── test_zone.py
├── build_dataset.py
├── generated_blueprints/
├── models/
│   ├── feature_columns.joblib
│   ├── label_encoders.joblib
│   ├── model_feasibility.joblib
│   ├── model_layout.joblib
│   └── model_structure.joblib
└── app/
    ├── blueprint/            # blueprint generator (rooms, corridors, doors)
    ├── area_names.py         # 16 trained areas, aliases, close match
    ├── blueprint_edit.py     # edit requests (room counts, sizes, doors)
    ├── gemini_service.py     # English-only explanation
    ├── ml_service.py         # model prediction + rule override
    ├── payload_transform.py  # request -> model features
    ├── pdf_report.py         # PDF report
    ├── regulations.py        # UDA rules
    ├── schemas.py            # request / response models
    ├── zone_data.py          # zone rules table
    └── zone_resolver.py      # PostGIS zone lookup
```

## API Endpoints

| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/predict` | Returns feasibility, design, zone info, rule results, blueprint, explanation |
| POST | `/edit-blueprint` | Changes the blueprint from the user's text request |
| POST | `/download-pdf` | Returns the PDF report |

When the server is running, open http://localhost:8000/docs to see and test all endpoints.

## Requirements

- Python 3.10 or newer
- PostgreSQL 17 with PostGIS 3.6
- Database `jaffna_architecture` with the `jaffna_zones` table (448 zone polygons)
- A Gemini API key

## Setup

1. Open a terminal in the `backend` folder.
2. (Optional) Create a virtual environment:
   ```
   python -m venv venv
   venv\Scripts\activate
   ```
3. Install packages:
   ```
   pip install -r requirements.txt
   ```
4. Set the database password (PowerShell):
   ```
   $env:JAFFNA_DB_PASSWORD="your_password"
   ```
5. Add your Gemini key to the `.env` file. Use the variable name that `gemini_service.py` reads.
6. Make sure the `.joblib` files are inside `models/`.

## Run the Server

```
uvicorn main:app --reload
```

The API runs at http://localhost:8000.

## Test

Check that a real coordinate resolves to the right zone:

```
python test_zone.py
```

## Database

- Database: `jaffna_architecture` (schema `public`)
- Table: `jaffna_zones` (zone polygons from Map 65, Greater Jaffna Development Plan)
- Host `localhost`, port `5432`, user `postgres`
- Zone names from PostGIS are mapped to UDA codes in `zone_resolver.py`
- A point in water (`Waterbody`) returns a clear error

## Retrain the Models

1. Edit rules in `app/regulations.py` or `app/zone_data.py`.
2. Rebuild the dataset:
   ```
   python build_dataset.py
   ```
3. Retrain in Google Colab with the training notebook.
4. Replace the `.joblib` files in `models/`.

Training data: 1,030 rows from the Greater Jaffna Development Plan 2025–2035 and UDA Building Regulations 2021.

## Notes

- The data only covers **Jaffna District**. A location outside it returns a "no zone polygon" error.
- Never commit `.env` or passwords to GitHub.

## Known Issues / To Do

- Unknown OSM place names fall back to the first area label (`area_matched` shows false)
- Which road is the main frontage on corner plots (for UDA setbacks)
- Nominatim / Overpass road widths
- Custom door adding after the blueprint is shown
- UDA admin option to change zoning rules in future
