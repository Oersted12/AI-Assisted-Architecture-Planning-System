# backend/app/ml_service.py
"""
Loads the 5 exported .joblib artifacts and reimplements predict_plan()
from the Colab notebook as a proper service class.
 
Expects these files in backend/models/:
  - model_feasibility.joblib
  - model_layout.joblib
  - model_structure.joblib
  - label_encoders.joblib
  - feature_columns.joblib
"""
 
import logging
from difflib import get_close_matches
from pathlib import Path
 
import joblib
import pandas as pd
 
from app.zone_data import get_zone
from app.regulations import evaluate_rules, max_coverage

GROUND_FLOOR_SHARE = 0.70
 
logger = logging.getLogger(__name__)
 
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
 
 
class MLService:
    def __init__(self, models_dir: Path = MODELS_DIR):
        self._require_files_exist(models_dir)
 
        self.model_feasibility = joblib.load(models_dir / "model_feasibility.joblib")
        self.model_layout = joblib.load(models_dir / "model_layout.joblib")
        self.model_structure = joblib.load(models_dir / "model_structure.joblib")
        self.label_encoders = joblib.load(models_dir / "label_encoders.joblib")
        self.feature_cols = joblib.load(models_dir / "feature_columns.joblib")
 
    @staticmethod
    def _require_files_exist(models_dir: Path) -> None:
        required = [
            "model_feasibility.joblib",
            "model_layout.joblib",
            "model_structure.joblib",
            "label_encoders.joblib",
            "feature_columns.joblib",
        ]
        missing = [f for f in required if not (models_dir / f).exists()]
        if missing:
            raise FileNotFoundError(
                f"Missing model files in {models_dir}: {missing}. "
                f"Re-run the export cell in the Colab notebook and drop "
                f"the downloaded .joblib files into backend/models/."
            )
 
    def _safe_encode(self, encoder, value, field="value"):
        """Encodes a category safely. Tries, in order:
        1. exact match
        2. match ignoring upper/lower case and extra spaces
        3. close spelling match
        4. last resort: index 0 (same as the notebook), but logged
        so an unfamiliar value never crashes the request or hides silently.
        """
        classes = list(encoder.classes_)
 
        # 1. exact match
        if value in classes:
            return encoder.transform([value])[0]
 
        # 2. ignore upper/lower case and extra spaces
        lower_map = {str(c).lower(): c for c in classes}
        key = str(value).strip().lower()
        if key in lower_map:
            return encoder.transform([lower_map[key]])[0]
 
        # 3. close spelling (e.g. "Nallur " vs "Nallur")
        close = get_close_matches(key, list(lower_map), n=1, cutoff=0.8)
        if close:
            logger.warning(
                "%s: '%s' matched to '%s'", field, value, lower_map[close[0]]
            )
            return encoder.transform([lower_map[close[0]]])[0]
 
        # 4. last resort
        logger.warning("%s: '%s' not in training data, using index 0", field, value)
        return 0
 
    def predict_plan(
        self,
        area_name: str,
        zone_code: str,
        land_length_m: float,
        land_width_m: float,
        land_shape: str,
        road_width_m: float,
        road_frontage_m: float | None,
        building_purpose: str,
        floors_requested: int,
        same_floor_layout: str,   # "Yes" | "No"
        bedrooms: int,
        bathrooms: int,
        kitchens: int,
        parking_spaces: int,
    ) -> dict:
        zone = get_zone(zone_code)  # raises ValueError on unknown code
 
        # ── Derived fields — identical formulas to the notebook ──────────────
        land_area_sqm = land_length_m * land_width_m
        land_area_perch = land_area_sqm / 25.29
        zone_factor = zone["factor"]
        zone_name = zone["name"]
        zone_type = zone["type"]
        max_plot_coverage_pct = max_coverage(zone_code, building_purpose)
        ground_floor_area_sqm = (
            land_area_sqm * max_plot_coverage_pct * GROUND_FLOOR_SHARE
        )
        rules = evaluate_rules(
            zone_code, zone_factor, building_purpose, land_area_sqm,
            road_width_m, floors_requested, ground_floor_area_sqm,
            road_frontage_m,
        )
        permissible_fa_sqm = rules["permissible_fa_sqm"]
        requested_total_fa_sqm = ground_floor_area_sqm * floors_requested
        fa_utilisation_ratio = min(
            requested_total_fa_sqm / max(permissible_fa_sqm, 0.001), 10.0
        )
        coverage_used_ratio = ground_floor_area_sqm / max(land_area_sqm, 0.001)
        fa_per_floor = requested_total_fa_sqm / max(floors_requested, 1)
        same_floor_encoded = 1 if same_floor_layout == "Yes" else 0
 
        # ── Encode categoricals using the saved label encoders ───────────────
        area_encoded = self._safe_encode(
            self.label_encoders["Area_Name"], area_name, "Area_Name"
        )
        zone_encoded = self._safe_encode(
            self.label_encoders["Zone_Code"], zone_code, "Zone_Code"
        )
        zname_encoded = self._safe_encode(
            self.label_encoders["Zone_Name"], zone_name, "Zone_Name"
        )
        ztype_encoded = self._safe_encode(
            self.label_encoders["Zone_Type"], zone_type, "Zone_Type"
        )
        shape_encoded = self._safe_encode(
            self.label_encoders["Land_Shape"], land_shape, "Land_Shape"
        )
        purpose_encoded = self._safe_encode(
            self.label_encoders["Building_Purpose"], building_purpose, "Building_Purpose"
        )
 
        # ── Build feature row — column order must match feature_columns.joblib ──
        row = {
            "Area_Name": area_encoded,
            "Zone_Code": zone_encoded,
            "Zone_Name": zname_encoded,
            "Zone_Type": ztype_encoded,
            "Zone_Factor": zone_factor,
            "Land_Length_m": land_length_m,
            "Land_Width_m": land_width_m,
            "Land_Area_sqm": land_area_sqm,
            "Land_Area_Perch": land_area_perch,
            "Land_Shape": shape_encoded,
            "Road_Width_m": road_width_m,
            # The Random Forest requires finite numeric features. Zero marks
            # unknown frontage; rule checks receive None and skip frontage rules.
            "Road_Frontage_m": (
                road_frontage_m if road_frontage_m is not None else 0.0
            ),
            "Building_Purpose": purpose_encoded,
            "Floors_Requested": floors_requested,
            "Same_Floor_Layout": same_floor_encoded,
            "Bedrooms": bedrooms,
            "Bathrooms": bathrooms,
            "Kitchens": kitchens,
            "Parking_Spaces": parking_spaces,
            "Max_Plot_Coverage_Pct": max_plot_coverage_pct,
            "Ground_Floor_Area_sqm": ground_floor_area_sqm,
            "Requested_Total_FA_sqm": requested_total_fa_sqm,
            "Permissible_FA_sqm": permissible_fa_sqm,
            "FA_Utilisation_Ratio": fa_utilisation_ratio,
            "Coverage_Used_Ratio": coverage_used_ratio,
            "FA_Per_Floor": fa_per_floor,
        }
 
        # Reindex to self.feature_cols rather than trusting dict insertion
        # order — this is the guard against silent column-order mismatches
        # between training and inference.
        input_data = pd.DataFrame([row])[self.feature_cols]
 
        # ── Predict Feasibility ────────────────────────────────────────────
        feas_encoded = self.model_feasibility.predict(input_data)[0]
        feas_proba = self.model_feasibility.predict_proba(input_data)[0]
        feasibility = self.label_encoders["Feasibility"].inverse_transform([feas_encoded])[0]
        feas_confidence = round(float(max(feas_proba)) * 100, 1)

        if rules["blockers"]:
            feasibility = "Not Feasible"
 
        # ── Predict Layout + Structure (only if Feasible) ───────────────────
        if feasibility == "Feasible":
            layout_encoded = self.model_layout.predict(input_data)[0]
            layout_proba = self.model_layout.predict_proba(input_data)[0]
            layout_type = self.label_encoders["Layout_Type"].inverse_transform([layout_encoded])[0]
            layout_confidence = round(float(max(layout_proba)) * 100, 1)
 
            struct_encoded = self.model_structure.predict(input_data)[0]
            struct_proba = self.model_structure.predict_proba(input_data)[0]
            structure_type = self.label_encoders["Structure_Type"].inverse_transform([struct_encoded])[0]
            struct_confidence = round(float(max(struct_proba)) * 100, 1)
        else:
            layout_type = "N/A - Not Feasible"
            structure_type = "N/A - Not Feasible"
            layout_confidence = 0.0
            struct_confidence = 0.0
 
        return {
            "feasibility": feasibility,
            "feas_confidence": feas_confidence,
            "layout_type": layout_type,
            "layout_confidence": layout_confidence,
            "structure_type": structure_type,
            "struct_confidence": struct_confidence,
            "land_area_sqm": round(land_area_sqm, 2),
            "permissible_fa_sqm": round(permissible_fa_sqm, 2),
            "requested_fa_sqm": round(requested_total_fa_sqm, 2),
            "fa_utilisation_ratio": round(fa_utilisation_ratio, 3),
            "zone_code": zone_code,
            "zone_name": zone_name,
            "zone_type": zone_type,
            "area_name": area_name,
            "ground_floor_area_sqm": round(ground_floor_area_sqm, 2),
            "rule_blockers": rules["blockers"],
            "rule_warnings": rules["warnings"],
            "rule_suggestions": rules["suggestions"],
        }
 
 
# ── Singleton instance — models loaded once at import time, not per-request ──
# This is what main.py will import and use in the /predict endpoint.
ml_service = MLService()