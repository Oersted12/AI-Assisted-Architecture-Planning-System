# backend/build_dataset.py
"""
Rebuilds the training CSV with the corrected UDA rules (app/regulations.py).

Run from the backend folder:
    python build_dataset.py Jaffna_ML_Training_Dataset.csv Jaffna_ML_Training_Dataset_v2.csv

What it changes (row by row):
  - Max_Plot_Coverage_Pct   coverage limit for the zone AND the building use
  - Permissible_FA_sqm      Form A (road 6 m or more) or Form B (narrow road)
  - Feasibility             from the corrected rules
  - Feasibility_Reason      the blockers, warnings and notes
What it keeps: every input column, Ground_Floor_Area_sqm, Requested_Total_FA_sqm,
Layout_Type and Structure_Type. The 26 feature columns stay the same, so the
Colab notebook needs no code change.
"""

import sys

import pandas as pd

from app.regulations import evaluate_rules


def rebuild(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    coverage, permissible, labels, reasons = [], [], [], []

    for r in out.itertuples():
        res = evaluate_rules(
            zone_code=r.Zone_Code,
            zone_factor=r.Zone_Factor,
            purpose=r.Building_Purpose,
            land_area_sqm=r.Land_Area_sqm,
            road_width_m=r.Road_Width_m,
            floors=int(r.Floors_Requested),
            ground_floor_area_sqm=r.Ground_Floor_Area_sqm,
            road_frontage_m=r.Road_Frontage_m,
        )
        coverage.append(res["max_coverage"])
        permissible.append(round(res["permissible_fa_sqm"], 1))

        if res["blockers"]:
            labels.append("Not Feasible")
            reasons.append("; ".join(res["blockers"] + res["warnings"]))
        else:
            labels.append("Feasible")
            reasons.append(
                "Meets all UDA regulations"
                if not res["warnings"]
                else "Meets the UDA rules. Notes: " + "; ".join(res["warnings"])
            )

    out["Max_Plot_Coverage_Pct"] = coverage
    out["Permissible_FA_sqm"] = permissible
    out["Feasibility"] = labels
    out["Feasibility_Reason"] = reasons
    return out


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "Jaffna_ML_Training_Dataset.csv"
    dst = sys.argv[2] if len(sys.argv) > 2 else "Jaffna_ML_Training_Dataset_v2.csv"

    old = pd.read_csv(src)
    new = rebuild(old)

    print("Rows:", len(new))
    print("\nFeasibility  (old -> new)")
    print(pd.crosstab(old["Feasibility"], new["Feasibility"]).to_string())
    print("\nNew class counts:", new["Feasibility"].value_counts().to_dict())

    print("\nWhy rows are Not Feasible (one row can have several reasons):")
    frag = (new["Feasibility_Reason"][new["Feasibility"] == "Not Feasible"]
            .str.split("; ").explode()
            .str.replace(r"\d+(\.\d+)?", "#", regex=True))
    print(frag.value_counts().head(12).to_string())

    new.to_csv(dst, index=False)
    print("\nSaved:", dst)