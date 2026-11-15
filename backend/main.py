# backend/main.py
"""
FastAPI entrypoint. Exposes POST /predict, which takes the exact JSON
LandDetailsForm.jsx's handleSubmit() produces and returns the ML
predictions plus generated floor plan blueprint URLs.

Run with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.schemas import PredictRequest, PredictResponse
from app.zone_resolver import resolve_zone
from app.payload_transform import build_predict_plan_kwargs, aggregate_rooms
from app.ml_service import ml_service
from app.blueprint.generator import generate_all_floor_blueprints, OUTPUT_DIR
from app.schemas import RegenerateBlueprintRequest
from app.gemini_service import generate_explanation
from typing import Any, Dict, List, Optional
from app.blueprint_edit import parse_instruction, apply_changes, merge_doors
from pydantic import BaseModel
from fastapi.responses import Response
from app.pdf_report import build_pdf

app = FastAPI(title="AI Architecture Planning API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve generated blueprint PNGs as static files ────────────────────────────
# A file saved as backend/generated_blueprints/floor_abc123.png becomes
# reachable at http://<host>:8000/blueprints/floor_abc123.png
app.mount("/blueprints", StaticFiles(directory=str(OUTPUT_DIR)), name="blueprints")


@app.get("/")
def health_check():
    return {"status": "ok", "service": "AI Architecture Planning API"}


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    try:
        zone_code, area_name, area_matched = resolve_zone(
            request.lat, request.lng, request.address
        )
        kwargs = build_predict_plan_kwargs(request, zone_code=zone_code, area_name=area_name)
        result = ml_service.predict_plan(**kwargs)

        blueprints = None
        if result["feasibility"] == "Feasible":
            room_data = aggregate_rooms(request)
            per_floor_breakdown = room_data["extra_context"]["per_floor_breakdown"]

            blueprint_files = generate_all_floor_blueprints(
                per_floor_breakdown=per_floor_breakdown,
                purpose=request.purpose,
                layout_type=result["layout_type"],
                structure_type=result["structure_type"],
                land_length_m=request.landLength,
                land_width_m=request.landWidth,
                ground_floor_area_sqm=result["ground_floor_area_sqm"],
                road_label=request.roadLabel,
                extra_roads=[r.model_dump() for r in request.extraRoads],
            )
            blueprints = {
                floor_num: f"/blueprints/{filename}"
                for floor_num, filename in blueprint_files.items()
            }

        room_data = aggregate_rooms(request)  # you likely already compute this for blueprints
        explanation = generate_explanation(
            prediction=result,
            purpose=request.purpose,
            floors=request.floors,
            extra_context=room_data["extra_context"],
            user_notes=request.notes,
        )
        return PredictResponse(
            **result,
            area_matched=area_matched,
            per_floor_breakdown=room_data["extra_context"]["per_floor_breakdown"],
            blueprints=blueprints,
            explanation=explanation,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

@app.post("/regenerate-blueprint")
def regenerate_blueprint(request: RegenerateBlueprintRequest):
    try:
        per_floor_breakdown = [r.model_dump() for r in request.perFloorBreakdown]
        blueprint_files = generate_all_floor_blueprints(
            per_floor_breakdown=per_floor_breakdown,
            purpose=request.purpose,
            layout_type=request.layout_type,
            structure_type=request.structure_type,
            land_length_m=request.landLength,
            land_width_m=request.landWidth,
            ground_floor_area_sqm=request.groundFloorAreaSqm,
            road_label=request.roadLabel,
            variant=request.variant % 3,
            extra_roads=request.extraRoads,
        )
        return {
            "blueprints": {fn: f"/blueprints/{name}" for fn, name in blueprint_files.items()},
            "variant_used": request.variant % 3,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regeneration failed: {e}")

class PdfRequest(BaseModel):
    result: Dict[str, Any]
    inputs: Dict[str, Any] = {}


@app.post("/download-pdf")
def download_pdf(request: PdfRequest):
    try:
        pdf_bytes = build_pdf(request.result, request.inputs, OUTPUT_DIR)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="Building_Plan_Report.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF creation failed: {e}")


class EditBlueprintRequest(BaseModel):
    instruction: str
    perFloorBreakdown: List[Dict[str, Any]]
    purpose: str
    layout_type: str
    structure_type: str
    landLength: float
    landWidth: float
    groundFloorAreaSqm: float
    roadLabel: str
    variant: int = 0
    extraDoors: List[Dict[str, Any]] = []
    extraRoads: List[Dict[str, Any]] = []


@app.post("/edit-blueprint")
def edit_blueprint(request: EditBlueprintRequest):
    instruction = request.instruction.strip()[:500]
    if not instruction:
        raise HTTPException(status_code=400, detail="Please type what you want to change.")

    try:
        parsed = parse_instruction(instruction, request.perFloorBreakdown)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Could not understand the request: {e}")

    outcome = apply_changes(request.perFloorBreakdown, parsed)
    if not outcome["applied"] and not outcome["rearrange"]:
        return {
            "applied": False,
            "message": outcome["unsupported"]
            or "No change was made. Try asking for rooms or doors, for example: add one more bathroom.",
        }

    variant_used = (
        (request.variant + 1) % 3 if outcome["rearrange"] else request.variant % 3
    )
    all_doors = merge_doors(request.extraDoors, outcome["doors"])

    try:
        blueprint_files = generate_all_floor_blueprints(
            per_floor_breakdown=outcome["breakdown"],
            purpose=request.purpose,
            layout_type=request.layout_type,
            structure_type=request.structure_type,
            land_length_m=request.landLength,
            land_width_m=request.landWidth,
            ground_floor_area_sqm=request.groundFloorAreaSqm,
            road_label=request.roadLabel,
            variant=variant_used,
            extra_doors=all_doors,
            extra_roads=request.extraRoads,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blueprint generation failed: {e}")

    return {
        "applied": True,
        "variant": variant_used,
        "summary": outcome["summary"],
        "message": outcome["unsupported"],
        "blueprints": {fn: f"/blueprints/{name}" for fn, name in blueprint_files.items()},
        "perFloorBreakdown": outcome["breakdown"],
        "extraDoors": all_doors,
    }