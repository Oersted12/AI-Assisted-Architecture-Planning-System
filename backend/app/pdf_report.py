# backend/app/pdf_report.py
"""
Builds the downloadable PDF report: project summary, feasibility result,
zone numbers, generated floor plans and the written explanation.
Uses reportlab only (pip install reportlab).
"""

import re
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#1A3C5E")
ACCENT = colors.HexColor("#F0A500")
GREEN = colors.HexColor("#1E8449")
RED = colors.HexColor("#C0392B")
LIGHT = colors.HexColor("#F4F8FB")
BORDER = colors.HexColor("#D6EAF8")
GREY = colors.HexColor("#888888")
TEXT = colors.HexColor("#2C3E50")

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
FRAME_W = PAGE_W - 2 * MARGIN_X


def _styles():
    return {
        "banner_title": ParagraphStyle(
            "banner_title", fontName="Helvetica-Bold", fontSize=22, leading=27,
            textColor=colors.white,
        ),
        "banner_sub": ParagraphStyle(
            "banner_sub", fontName="Helvetica", fontSize=10.5, leading=14,
            textColor=colors.HexColor("#AED6F1"),
        ),
        "h": ParagraphStyle(
            "h", fontName="Helvetica-Bold", fontSize=13, leading=16,
            textColor=NAVY, spaceBefore=16, spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body", fontName="Helvetica", fontSize=10, leading=15,
            textColor=TEXT, spaceAfter=7,
        ),
        "small": ParagraphStyle(
            "small", fontName="Helvetica", fontSize=8.5, leading=12, textColor=GREY,
        ),
        "label": ParagraphStyle(
            "label", fontName="Helvetica", fontSize=9.5, leading=13, textColor=GREY,
        ),
        "value": ParagraphStyle(
            "value", fontName="Helvetica-Bold", fontSize=9.5, leading=13, textColor=NAVY,
        ),
        "th": ParagraphStyle(
            "th", fontName="Helvetica-Bold", fontSize=9, leading=12,
            textColor=colors.white, alignment=1,
        ),
        "td": ParagraphStyle(
            "td", fontName="Helvetica", fontSize=9.5, leading=13,
            textColor=TEXT, alignment=1,
        ),
        "td_left": ParagraphStyle(
            "td_left", fontName="Helvetica-Bold", fontSize=9.5, leading=13,
            textColor=NAVY,
        ),
        "status": ParagraphStyle(
            "status", fontName="Helvetica-Bold", fontSize=16, leading=20,
        ),
        "plan_label": ParagraphStyle(
            "plan_label", fontName="Helvetica-Bold", fontSize=10, leading=14,
            textColor=NAVY, spaceAfter=4,
        ),
    }


S = _styles()


# -- Text helpers --------------------------------------------------------------
def _p(text) -> str:
    """Make any value safe for a reportlab Paragraph.
    Removes characters the built-in PDF font cannot draw (emoji etc.),
    escapes XML, and turns **bold** into <b>bold</b>."""
    text = "" if text is None else str(text)
    text = text.encode("cp1252", "ignore").decode("cp1252")
    text = escape(text)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)


def _num(value, suffix="", digits=0) -> str:
    try:
        return f"{float(value):,.{digits}f}{suffix}"
    except (TypeError, ValueError):
        return "-"


def _section(title):
    return [
        Paragraph(_p(title), S["h"]),
        HRFlowable(width="100%", thickness=1.2, color=BORDER, spaceAfter=8),
    ]


def _kt(title, *flowables):
    """Heading + content kept on the same page (no heading alone at the bottom)."""
    return [KeepTogether(_section(title) + list(flowables))]


def _kv_table(rows):
    data = [[Paragraph(_p(k), S["label"]), Paragraph(_p(v), S["value"])] for k, v in rows]
    t = Table(data, colWidths=[FRAME_W * 0.38, FRAME_W * 0.62])
    t.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


# -- Page decoration -----------------------------------------------------------
def _on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 7 * mm, PAGE_W, 7 * mm, stroke=0, fill=1)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, PAGE_H - 8.2 * mm, PAGE_W, 1.2 * mm, stroke=0, fill=1)

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN_X, 15 * mm, PAGE_W - MARGIN_X, 15 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY)
    canvas.drawString(
        MARGIN_X, 10.5 * mm,
        "AI-generated concept plan only. A licensed architect must certify the final construction drawings.",
    )
    canvas.drawRightString(PAGE_W - MARGIN_X, 10.5 * mm, f"Page {doc.page}")
    canvas.restoreState()

# -- Rooms ---------------------------------------------------------------------
def _per_floor_rooms(inputs):
    rooms = inputs.get("rooms") or {}
    floors = int(inputs.get("floors") or 1)
    kind = rooms.get("type")
    try:
        if kind == "same":
            return [rooms["data"]] * floors
        if kind == "standardWithOverrides":
            overrides = rooms.get("overrides") or {}
            return [overrides.get(str(i), rooms["standard"]) for i in range(1, floors + 1)]
        if kind == "perFloor":
            return list(rooms["data"])[:floors]
    except (KeyError, TypeError):
        pass
    return []


def _rooms_table(inputs):
    per_floor = _per_floor_rooms(inputs)
    if not per_floor:
        return None

    head = ["Floor", "Bedrooms", "Bathrooms", "Kitchens", "Visitor Halls", "Extra Rooms"]
    data = [[Paragraph(h, S["th"]) for h in head]]
    for i, r in enumerate(per_floor, start=1):
        label = "Ground" if i == 1 else f"Floor {i}"
        data.append([
            Paragraph(label, S["td_left"]),
            Paragraph(_num(r.get("bedrooms")), S["td"]),
            Paragraph(_num(r.get("bathrooms")), S["td"]),
            Paragraph(_num(r.get("kitchens")), S["td"]),
            Paragraph(_num(r.get("visitorHalls")), S["td"]),
            Paragraph(_num(r.get("extraRooms")), S["td"]),
        ])

    widths = [FRAME_W * 0.20] + [FRAME_W * 0.16] * 5
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


# -- Floor plan images ---------------------------------------------------------
def _plan_image(path: Path, max_h=150 * mm):
    iw, ih = ImageReader(str(path)).getSize()
    scale = min(FRAME_W / iw, max_h / ih)
    return Image(str(path), width=iw * scale, height=ih * scale)


def _blueprint_files(result, blueprint_dir: Path):
    """Return [(floor_number, Path)] for every blueprint that exists.
    Only the file NAME is used, so a request cannot read other folders."""
    base = Path(blueprint_dir).resolve()
    found = []
    for key, url in (result.get("blueprints") or {}).items():
        name = Path(str(url)).name
        path = (base / name).resolve()
        if path.parent == base and path.is_file():
            try:
                found.append((int(key), path))
            except ValueError:
                continue
    return sorted(found)


# -- Main builder --------------------------------------------------------------
def build_pdf(result: dict, inputs: dict, blueprint_dir) -> bytes:
    inputs = inputs or {}
    buffer = BytesIO()
    doc = BaseDocTemplate(
        buffer, pagesize=A4,
        leftMargin=MARGIN_X, rightMargin=MARGIN_X,
        topMargin=20 * mm, bottomMargin=22 * mm,
        title="Building Plan Report",
        author="AI Architecture Planning System",
    )
    frame = Frame(MARGIN_X, 22 * mm, FRAME_W, PAGE_H - 42 * mm, id="main",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="page", frames=[frame], onPage=_on_page)])

    story = []

    # Title banner
    banner = Table(
        [[Paragraph("Building Plan Report", S["banner_title"])],
         [Paragraph("AI-Assisted Architecture Planning System  |  Jaffna District", S["banner_sub"])],
         [Paragraph(datetime.now().strftime("Generated on %d %B %Y"), S["banner_sub"])]],
        colWidths=[FRAME_W],
    )
    banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (0, 0), 16),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 16),
        ("TOPPADDING", (0, 1), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -2), 2),
        ("LINEBELOW", (0, -1), (-1, -1), 3, ACCENT),
    ]))
    story += [banner, Spacer(1, 6)]

    # Site and project
    site_title = "Site and Project Summary"
    address = inputs.get("address") or "Not provided"
    lat, lng = inputs.get("lat"), inputs.get("lng")
    summary = [("Location", address)]
    if lat is not None and lng is not None:
        summary.append(("Coordinates", f"{float(lat):.6f}, {float(lng):.6f}"))
    summary += [
        ("Building purpose", inputs.get("purpose", "-")),
        ("Number of floors", _num(inputs.get("floors"))),
        ("Land dimensions",
         f"{_num(inputs.get('landLength'), digits=2)} m x {_num(inputs.get('landWidth'), digits=2)} m"),
        ("Land area",
         f"{_num(result.get('land_area_sqm'), ' sqm', 1)} ({_num(inputs.get('landAreaPerch'), ' perch', 2)})"),
        ("Land shape", inputs.get("landShape", "-")),
        ("Road type", f"{inputs.get('roadLabel', '-')} (about {_num(inputs.get('roadWidth'), ' m')} wide)"),
    ]
    if inputs.get("roadFrontage"):
        summary.append(("Road frontage", _num(inputs.get("roadFrontage"), " m", 2)))
    side_names = {"left": "left side", "right": "right side", "top": "back side"}
    for road in inputs.get("extraRoads") or []:
        summary.append((
            "Second road",
            f"{road.get('label', 'Road')} on the {side_names.get(road.get('side'), '-')}",
        ))
    story += _kt(site_title, _kv_table(summary))

    # Feasibility
    feasible = result.get("feasibility") == "Feasible"
    colour = GREEN if feasible else RED
    status = Table(
        [[Paragraph(
            f'<font color="{colour.hexval()}">{"Feasible" if feasible else _p(result.get("feasibility", "Not Feasible"))}</font>',
            S["status"]),
          ],
         [Paragraph(
             "Decided by the UDA rules" if result.get("rule_blockers")
             else f"Model confidence: {_num(result.get('feas_confidence'), '%', 1)}",
             S["small"])]],
        colWidths=[FRAME_W],
    )
    status.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EAF6EE") if feasible else colors.HexColor("#FBECEA")),
        ("LINEBEFORE", (0, 0), (0, -1), 4, colour),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (0, 0), 10),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 10),
    ]))
    story += _kt("Feasibility Result", status)

    # UDA rule check (reasons and notes from the rules)
    blockers = result.get("rule_blockers") or []
    warnings = result.get("rule_warnings") or []
    if blockers or warnings:
        items = []
        if blockers:
            items.append(Paragraph("<b>Rules that block this plan</b>", S["body"]))
            items += [Paragraph("- " + _p(b), S["body"]) for b in blockers]
        if warnings:
            items.append(Paragraph("<b>Things to check with the UDA</b>", S["body"]))
            items += [Paragraph("- " + _p(w), S["body"]) for w in warnings]
        story += _kt("UDA Rule Check", *items)

    # Zone and area
    story += _kt("Zone and Floor Area", _kv_table([
        ("Area", result.get("area_name", "-")),
        ("Zone", f"{result.get('zone_name', '-')} ({result.get('zone_code', '-')})"),
        ("Land area", _num(result.get("land_area_sqm"), " sqm", 1)),
        ("Allowed floor area", _num(result.get("permissible_fa_sqm"), " sqm", 1)),
        ("Requested floor area", _num(result.get("requested_fa_sqm"), " sqm", 1)),
        ("Floor area used", _num(float(result.get("fa_utilisation_ratio") or 0) * 100, "%")),
        ("Ground floor area", _num(result.get("ground_floor_area_sqm"), " sqm", 1)),
    ]))
    if result.get("area_matched") is False:
        story += [Spacer(1, 6), Paragraph(
            f"Note: the address could not be matched to a known area, so "
            f"\"{_p(result.get('area_name'))}\" was used. Results may be less exact.",
            S["small"])]

    # Suggested design
    if feasible:
        story += _kt("Suggested Design", _kv_table([
            ("Layout type",
             f"{result.get('layout_type', '-')} ({_num(result.get('layout_confidence'), '%', 1)})"),
            ("Structure type",
             f"{result.get('structure_type', '-')} ({_num(result.get('struct_confidence'), '%', 1)})"),
        ]))

    # Rooms
    rooms_table = _rooms_table(inputs)
    if rooms_table is not None:
        story += _kt("Room Requirements", rooms_table)

    # Floor plans (each on its own, kept with its label)
    plans = _blueprint_files(result, blueprint_dir)
    if plans:
        for index, (floor_no, path) in enumerate(plans):
            label = "Ground Floor" if floor_no == 1 else f"Floor {floor_no}"
            frame_img = Table([[_plan_image(path)]], colWidths=[FRAME_W])
            frame_img.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            block = [Paragraph(label, S["plan_label"]), frame_img, Spacer(1, 10)]
            if index == 0:
                block = _section("Generated Floor Plans") + block
            story.append(KeepTogether(block))

    # Explanation
    explanation = (result.get("explanation") or "").strip()
    if explanation:
        paras = [Paragraph(_p(p.strip()), S["body"])
                 for p in explanation.split("\n\n") if p.strip()]
        story += _kt("Explanation", paras[0])
        story += paras[1:]

    # Notes
    notes = (inputs.get("notes") or "").strip()
    if notes:
        story += _kt("Additional Notes from the Applicant", Paragraph(_p(notes), S["body"]))

    # Disclaimer
    story += [Spacer(1, 14), HRFlowable(width="100%", thickness=0.6, color=BORDER, spaceAfter=6),
              Paragraph(
                  "<b>Disclaimer.</b> This report is an AI-generated concept plan prepared for "
                  "early-stage guidance. It is not a building approval. A licensed architect must "
                  "certify the final construction drawings, and the plan must be approved by the "
                  "relevant authority before construction.", S["small"])]

    doc.build(story)
    return buffer.getvalue()