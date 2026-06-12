"""
pdf_report.py — SunSol professional PDF report generator
Produces a multi-page PDF with:
  • Cover page
  • Scenario parameters
  • Condition analysis & recommendations
  • Live data graphs (efficiency, power, temperature, irradiance)
  • Prediction timeline table
  • Full readings table
"""

import os
import io
from datetime import datetime

# ── ReportLab imports ─────────────────────────────────────
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether, Image as RLImage
)
from reportlab.platypus import Flowable
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics import renderPDF

# ── Colour palette ────────────────────────────────────────
C_BG        = colors.HexColor("#0a0f1e")
C_CARD      = colors.HexColor("#0d1526")
C_SOLAR     = colors.HexColor("#f59e0b")
C_SOLAR2    = colors.HexColor("#fbbf24")
C_GREEN     = colors.HexColor("#10b981")
C_RED       = colors.HexColor("#ef4444")
C_BLUE      = colors.HexColor("#3b82f6")
C_ORANGE    = colors.HexColor("#f97316")
C_CYAN      = colors.HexColor("#06b6d4")
C_PURPLE    = colors.HexColor("#8b5cf6")
C_TEXT      = colors.HexColor("#e2e8f0")
C_TEXT2     = colors.HexColor("#94a3b8")
C_TEXT3     = colors.HexColor("#475569")
C_BORDER    = colors.HexColor("#1e2a45")
C_WHITE     = colors.white

STATE_COLORS = {
    "Normal":      C_GREEN,
    "Dusty":       C_SOLAR,
    "Overheating": C_RED,
    "Shaded":      C_BLUE,
    "Faulty":      C_RED,
}

REC_COLORS = {
    "success": C_GREEN,
    "warning": C_SOLAR,
    "danger":  C_RED,
    "info":    C_BLUE,
}

W, H = A4   # 595 x 842 pts

# ── Custom background flowable ─────────────────────────────
class DarkBackground(Flowable):
    def __init__(self, width, height, color=C_BG):
        Flowable.__init__(self)
        self.width  = width
        self.height = height
        self.color  = color

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)

class ColorRect(Flowable):
    def __init__(self, width, height, fill_color, radius=4):
        Flowable.__init__(self)
        self.width  = width
        self.height = height
        self.fill   = fill_color
        self.radius = radius

    def draw(self):
        self.canv.setFillColor(self.fill)
        self.canv.roundRect(0, 0, self.width, self.height,
                            self.radius, fill=1, stroke=0)

# ── Mini line chart as Drawing ─────────────────────────────
def make_line_chart(data_points, field, color, title, unit, width=220, height=120):
    """Returns a ReportLab Drawing containing a styled line chart."""
    vals = []
    for p in data_points:
        try:
            v = float(p.get(field, 0) or 0)
            if abs(v) < 1e9:
                vals.append(v)
        except Exception:
            vals.append(0)

    if len(vals) < 2:
        vals = [0, 0]

    # Downsample to max 60 points for performance
    if len(vals) > 60:
        step = len(vals) // 60
        vals = vals[::step]

    mn = min(vals)
    mx = max(vals)
    rng = (mx - mn) or 1

    d = Drawing(width, height)

    # Background
    d.add(Rect(0, 0, width, height, fillColor=C_CARD, strokeColor=C_BORDER, strokeWidth=0.5))

    # Grid lines
    for i in range(4):
        y = 15 + (i / 3) * (height - 30)
        d.add(Line(10, y, width - 10, y,
                   strokeColor=colors.HexColor("#1e2a45"), strokeWidth=0.5))
        label_val = mn + (i / 3) * rng
        d.add(String(3, y - 4, f"{label_val:.1f}",
                     fontSize=6, fillColor=C_TEXT3))

    # Area fill (approximated with polygon)
    pts = []
    n = len(vals)
    for i, v in enumerate(vals):
        x = 10 + (i / (n - 1)) * (width - 20)
        y = 15 + ((v - mn) / rng) * (height - 30)
        pts.extend([x, y])
    # close polygon bottom
    pts.extend([10 + (width - 20), 15, 10, 15])
    # Build transparent fill color from the line color
    try:
        hex_str = color.hexval()  # returns e.g. "0x10b981"
        # normalize to 6-char hex string
        hex_str = hex_str.replace("0x","").replace("#","").upper()
        if len(hex_str) == 6:
            poly_color = colors.HexColor(f"#{hex_str}20")
        else:
            poly_color = colors.HexColor("#10b98120")
    except Exception:
        poly_color = colors.HexColor("#10b98120")
    d.add(Polygon(pts, fillColor=poly_color, strokeColor=None))

    # Line
    for i in range(n - 1):
        x1 = 10 + (i / (n - 1)) * (width - 20)
        y1 = 15 + ((vals[i] - mn) / rng) * (height - 30)
        x2 = 10 + ((i + 1) / (n - 1)) * (width - 20)
        y2 = 15 + ((vals[i + 1] - mn) / rng) * (height - 30)
        d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1.8))

    # Last point dot
    lx = 10 + (width - 20)
    ly = 15 + ((vals[-1] - mn) / rng) * (height - 30)
    d.add(Rect(lx - 3, ly - 3, 6, 6, fillColor=color, strokeColor=None))

    # Title
    d.add(String(10, height - 10, title,
                 fontSize=7, fillColor=C_TEXT2))
    # Latest value
    d.add(String(width - 10, height - 10,
                 f"{vals[-1]:.2f}{unit}",
                 fontSize=7, fillColor=color,
                 textAnchor="end"))

    return d


# ── Page template (dark background on every page) ─────────
def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(C_BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    # subtle grid lines
    canvas.setStrokeColor(colors.HexColor("#0e1628"))
    canvas.setLineWidth(0.3)
    for x in range(0, int(W), 40):
        canvas.line(x, 0, x, H)
    for y in range(0, int(H), 40):
        canvas.line(0, y, W, y)
    # footer
    canvas.setFillColor(C_TEXT3)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(2*cm, 1.2*cm,
        "SunSol v1.0  ·  RIT Rajaramnagar  ·  Dept. of IT  ·  A.Y. 2025–26")
    canvas.drawRightString(W - 2*cm, 1.2*cm,
        f"Page {doc.page}  ·  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    canvas.restoreState()


def build_styles():
    styles = {}

    styles["title"] = ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=26,
        textColor=C_SOLAR, alignment=TA_CENTER,
        spaceAfter=6, letterSpacing=2,
    )
    styles["subtitle"] = ParagraphStyle(
        "subtitle", fontName="Helvetica", fontSize=11,
        textColor=C_TEXT2, alignment=TA_CENTER, spaceAfter=4,
    )
    styles["section"] = ParagraphStyle(
        "section", fontName="Helvetica-Bold", fontSize=9,
        textColor=C_SOLAR2, spaceAfter=8, spaceBefore=16,
        letterSpacing=1.5, textTransform="uppercase",
    )
    styles["body"] = ParagraphStyle(
        "body", fontName="Helvetica", fontSize=9,
        textColor=C_TEXT, spaceAfter=4, leading=14,
    )
    styles["body2"] = ParagraphStyle(
        "body2", fontName="Helvetica", fontSize=8,
        textColor=C_TEXT2, spaceAfter=3, leading=12,
    )
    styles["label"] = ParagraphStyle(
        "label", fontName="Helvetica-Bold", fontSize=7,
        textColor=C_TEXT3, spaceAfter=2, letterSpacing=1,
    )
    styles["value"] = ParagraphStyle(
        "value", fontName="Helvetica-Bold", fontSize=18,
        textColor=C_SOLAR, spaceAfter=2,
    )
    styles["center"] = ParagraphStyle(
        "center", fontName="Helvetica", fontSize=9,
        textColor=C_TEXT, alignment=TA_CENTER,
    )
    styles["h2"] = ParagraphStyle(
        "h2", fontName="Helvetica-Bold", fontSize=13,
        textColor=C_TEXT, spaceAfter=8, spaceBefore=8,
    )
    return styles


def kpi_table(kpis):
    """Builds a styled KPI row table. kpis = list of (label, value, color)."""
    data = [[
        Paragraph(f'<font color="{c.hexval()}" size="14"><b>{v}</b></font>', ParagraphStyle(
            "kv", fontName="Helvetica-Bold", fontSize=14, textColor=c, alignment=TA_CENTER))
        for _, v, c in kpis
    ], [
        Paragraph(f'<font color="#475569" size="7">{l}</font>', ParagraphStyle(
            "kl", fontName="Helvetica", fontSize=7, textColor=C_TEXT3, alignment=TA_CENTER))
        for l, _, _ in kpis
    ]]
    col_w = (W - 4*cm) / len(kpis)
    t = Table(data, colWidths=[col_w]*len(kpis), rowHeights=[22, 14])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,-1), C_CARD),
        ("BOX",         (0,0), (-1,-1), 0.5, C_BORDER),
        ("INNERGRID",   (0,0), (-1,-1), 0.3, C_BORDER),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",  (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 4),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0), (-1,-1), 6),
        ("ROUNDEDCORNERS", (0,0), (-1,-1), 4),
    ]))
    return t


def readings_table(buf, styles, max_rows=60):
    """Full readings table — up to max_rows rows."""
    headers = ["t(s)", "G(W/m²)", "T(°C)", "Dust",
               "Vmp(V)", "Imp(A)", "Pmax(W)", "Voc(V)", "Isc(A)", "FF", "η(%)"]
    fields  = ["elapsed_seconds","Irradiance_Wm2","Temperature_C","Dust_factor",
               "Vmp_V","Imp_A","Pmax_W","Voc_V","Isc_A","FF","Efficiency_pct"]

    rows = [headers]
    step = max(1, len(buf) // max_rows)
    for p in buf[::step][:max_rows]:
        row = []
        for f in fields:
            v = p.get(f, "—")
            try:
                v = f"{float(v):.2f}"
            except Exception:
                v = str(v)
            row.append(v)
        rows.append(row)

    col_w = (W - 4*cm) / len(headers)
    t = Table(rows, colWidths=[col_w]*len(headers), repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  C_SOLAR),
        ("TEXTCOLOR",     (0,0), (-1,0),  colors.black),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,0),  7),
        ("FONTSIZE",      (0,1), (-1,-1), 7),
        ("BACKGROUND",    (0,1), (-1,-1), C_CARD),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [C_CARD, colors.HexColor("#111f38")]),
        ("TEXTCOLOR",     (0,1), (-1,-1), C_TEXT),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("GRID",          (0,0), (-1,-1), 0.3, C_BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    return t


def generate_pdf(scenario_name, scenario_params, data_points, predictions,
                 elapsed_sec, output_dir):
    """
    Main entry point.
    Returns path to the generated PDF file, or raises on failure.
    """
    os.makedirs(output_dir, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    name = (scenario_name or "run").replace(" ", "_").replace("/", "_")
    path = os.path.join(output_dir, f"SunSol_{name}_{ts}.pdf")

    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
        onPage=on_page,
    )

    S = build_styles()
    story = []

    # ── compute statistics ────────────────────────────────
    buf = data_points
    preds = predictions
    params = scenario_params or {}

    import statistics as stat
    def col_vals(field):
        vals = []
        for p in buf:
            try:
                v = float(p.get(field) or 0)
                if abs(v) < 1e9:
                    vals.append(v)
            except Exception:
                pass
        return vals or [0]

    eff_vals  = col_vals("Efficiency_pct")
    pmax_vals = col_vals("Pmax_W")
    temp_vals = col_vals("Temperature_C")
    irr_vals  = col_vals("Irradiance_Wm2")
    vmp_vals  = col_vals("Vmp_V")
    isc_vals  = col_vals("Isc_A")
    ff_vals   = col_vals("FF")

    avg_eff   = stat.mean(eff_vals)
    max_eff   = max(eff_vals)
    min_eff   = min(eff_vals)
    avg_pmax  = stat.mean(pmax_vals)
    max_pmax  = max(pmax_vals)
    avg_temp  = stat.mean(temp_vals)
    max_temp  = max(temp_vals)

    final_pred  = preds[-1]["prediction"]   if preds else {}
    final_state = final_pred.get("health_state", "Unknown")
    final_eff   = final_pred.get("efficiency", 0)
    final_conf  = final_pred.get("confidence", 0)
    state_color = STATE_COLORS.get(final_state, C_TEXT2)

    all_recs = []
    for p in preds:
        all_recs.extend(p.get("recommendations", []))

    # ══════════════════════════════════════════════════════
    #  PAGE 1 — COVER
    # ══════════════════════════════════════════════════════
    story.append(Spacer(1, 1.5*cm))

    # ── Logo image (SunSol Solutions branded logo) ─────────
    LOGO_PATH = os.path.join(os.path.dirname(__file__), "sunsol_logo.jpg")
    if os.path.exists(LOGO_PATH):
        # Original is 1600×754 — scale to width=7cm keeping aspect ratio
        logo_w  = 7 * cm
        logo_h  = logo_w * (754 / 1600)
        logo_img = RLImage(LOGO_PATH, width=logo_w, height=logo_h)
        logo_tbl = Table([[logo_img]], colWidths=[W - 4*cm])
        logo_tbl.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER")]))
        story.append(logo_tbl)
    else:
        # Fallback SVG-style drawing if image missing
        logo_d = Drawing(120, 60)
        logo_d.add(Rect(30, 0, 60, 60, rx=12, ry=12,
                        fillColor=C_SOLAR, strokeColor=None))
        logo_d.add(String(48, 18, "S", fontSize=36, fillColor=colors.black,
                          fontName="Helvetica-Bold"))
        logo_tbl = Table([[logo_d]], colWidths=[W - 4*cm])
        logo_tbl.setStyle(TableStyle([("ALIGN",(0,0),(-1,-1),"CENTER")]))
        story.append(logo_tbl)

    story.append(Spacer(1, 0.6*cm))

    # ── Title block ────────────────────────────────────────
    story.append(Paragraph("AI-Driven Solar Panel Simulation Report",
                           S["subtitle"]))
    story.append(Spacer(1, 0.4*cm))
    story.append(HRFlowable(width="100%", thickness=0.8,
                             color=C_SOLAR, spaceAfter=14))

    # ── Cover KPI row ──────────────────────────────────────
    cover_kpis = [
        ("Scenario",        scenario_name or "—",   C_SOLAR),
        ("Duration",        f"{elapsed_sec}s",       C_CYAN),
        ("Data Points",     str(len(buf)),            C_GREEN),
        ("ML Predictions",  str(len(preds)),          C_PURPLE),
        ("Final Condition", final_state,              state_color),
        ("Avg Efficiency",  f"{avg_eff:.1f}%",        C_GREEN),
    ]
    story.append(kpi_table(cover_kpis))
    story.append(Spacer(1, 0.8*cm))

    # ── Run info table — fixed column widths, no overlap ──
    # Label col | Value col | Label col | Value col
    LW = 3.5*cm                    # label column width
    VW = (W - 4*cm - 2*LW) / 2    # value column width (remaining split 2)

    # Helper to make a styled paragraph for label cells
    def lbl_p(text):
        return Paragraph(
            f'<font color="#475569" size="7"><b>{text}</b></font>',
            ParagraphStyle("ri_lbl", fontName="Helvetica-Bold",
                           fontSize=7, textColor=C_TEXT3, leading=10))

    def val_p(text, color=None):
        c = color.hexval() if color else C_TEXT.hexval()
        return Paragraph(
            f'<font color="{c}" size="8">{text}</font>',
            ParagraphStyle("ri_val", fontName="Helvetica",
                           fontSize=8, textColor=C_TEXT, leading=11,
                           wordWrap="CJK"))

    run_info = [
        [lbl_p("Report Generated"), val_p(datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
         lbl_p("Institution"),       val_p("RIT Rajaramnagar")],
        [lbl_p("Department"),        val_p("Information Technology"),
         lbl_p("Academic Year"),     val_p("2025–26")],
        [lbl_p("Team Members"),
         val_p("Abdulwahid Shaikh  |  Tasmiya Pathan  |  Anushka Bamane  |  Pooja Hankare"),
         lbl_p(""),  val_p("")],
        [lbl_p("Guide"),             val_p("Dr. Amol Admuthe"),
         lbl_p("HOD"),               val_p("Dr. Amol Admuthe")],
    ]

    ri_table = Table(run_info, colWidths=[LW, VW, LW, VW])
    ri_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), C_CARD),
        ("TEXTCOLOR",     (0,0), (-1,-1), C_TEXT),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("GRID",          (0,0), (-1,-1), 0.4, C_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 7),
        ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        # Span team members row across value+label+value columns
        ("SPAN",          (1,2), (3,2)),
        # Alternate row shading
        ("BACKGROUND",    (0,1), (-1,1),  colors.HexColor("#0f1e38")),
        ("BACKGROUND",    (0,3), (-1,3),  colors.HexColor("#0f1e38")),
    ]))
    story.append(ri_table)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    #  PAGE 2 — SCENARIO & CONDITION ANALYSIS
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("SCENARIO PARAMETERS", S["section"]))

    param_data = [
        ["Parameter",         "Value",      "Parameter",       "Value"],
        ["Irradiance (G)",    f"{params.get('G','—')} W/m²",
         "Temperature (T)",   f"{params.get('T','—')} °C"],
        ["Dust Factor (D)",   str(params.get("D","—")),
         "Tilt Angle (θ)",    f"{params.get('theta','—')}°"],
        ["Simulation Duration","300 seconds (5 minutes)",
         "Data Interval",     "Every 5 seconds"],
        ["Total Data Points", str(len(buf)),
         "ML Predictions",    str(len(preds))],
    ]
    pt = Table(param_data, colWidths=[(W-4*cm)/4]*4)
    pt.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0),  C_SOLAR),
        ("TEXTCOLOR",    (0,0), (-1,0),  colors.black),
        ("FONTNAME",     (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,-1), 8),
        ("BACKGROUND",   (0,1), (-1,-1), C_CARD),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [C_CARD, colors.HexColor("#111f38")]),
        ("TEXTCOLOR",    (0,1), (0,-1),  C_TEXT3),
        ("FONTNAME",     (0,1), (0,-1),  "Helvetica-Bold"),
        ("TEXTCOLOR",    (2,1), (2,-1),  C_TEXT3),
        ("FONTNAME",     (2,1), (2,-1),  "Helvetica-Bold"),
        ("TEXTCOLOR",    (1,1), (1,-1),  C_TEXT),
        ("TEXTCOLOR",    (3,1), (3,-1),  C_TEXT),
        ("GRID",         (0,0), (-1,-1), 0.4, C_BORDER),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",   (0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(pt)
    story.append(Spacer(1, 0.4*cm))

    story.append(Paragraph("CONDITION ANALYSIS", S["section"]))

    # Current condition box
    cond_color = state_color
    cond_data = [[
        Paragraph(f'<font size="22" color="{cond_color.hexval()}"><b>{final_state}</b></font>',
                  ParagraphStyle("cs", alignment=TA_CENTER)),
        Table([
            [Paragraph('<font color="#475569" size="7">CONFIDENCE</font>',
                       ParagraphStyle("cl", alignment=TA_CENTER)),
             Paragraph('<font color="#475569" size="7">EFFICIENCY</font>',
                       ParagraphStyle("cl", alignment=TA_CENTER)),
             Paragraph('<font color="#475569" size="7">POWER OUTPUT</font>',
                       ParagraphStyle("cl", alignment=TA_CENTER))],
            [Paragraph(f'<font color="{C_SOLAR.hexval()}" size="14"><b>{final_conf:.1f}%</b></font>',
                       ParagraphStyle("cv", alignment=TA_CENTER)),
             Paragraph(f'<font color="{C_GREEN.hexval()}" size="14"><b>{final_eff:.2f}%</b></font>',
                       ParagraphStyle("cv", alignment=TA_CENTER)),
             Paragraph(f'<font color="{C_CYAN.hexval()}" size="14"><b>{final_pred.get("power_output",0):.1f}W</b></font>',
                       ParagraphStyle("cv", alignment=TA_CENTER))],
        ], colWidths=[(W-7*cm)/3]*3,
        style=[("ALIGN",(0,0),(-1,-1),"CENTER"),
               ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
               ("TOPPADDING",(0,0),(-1,-1),4),
               ("BOTTOMPADDING",(0,0),(-1,-1),4)]),
    ]]
    ct = Table(cond_data, colWidths=[4.5*cm, W-7*cm])
    ct.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_CARD),
        ("BOX",        (0,0), (-1,-1), 1, cond_color),
        ("LEFTBORDER", (0,0), (0,-1),  4, cond_color),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING",(0,0),(-1,-1),10),
        ("LEFTPADDING",(0,0), (-1,-1), 12),
    ]))
    story.append(ct)
    story.append(Spacer(1, 0.4*cm))

    # Statistics table
    story.append(Paragraph("PERFORMANCE STATISTICS", S["section"]))
    stats_data = [
        ["Metric", "Average", "Minimum", "Maximum"],
        ["Efficiency (%)",     f"{avg_eff:.2f}",  f"{min_eff:.2f}",  f"{max_eff:.2f}"],
        ["Power (W)",          f"{avg_pmax:.2f}", f"{min(pmax_vals):.2f}", f"{max_pmax:.2f}"],
        ["Temperature (°C)",   f"{avg_temp:.2f}", f"{min(temp_vals):.2f}", f"{max_temp:.2f}"],
        ["Irradiance (W/m²)",  f"{stat.mean(irr_vals):.1f}", f"{min(irr_vals):.1f}", f"{max(irr_vals):.1f}"],
        ["Vmp (V)",            f"{stat.mean(vmp_vals):.3f}", f"{min(vmp_vals):.3f}", f"{max(vmp_vals):.3f}"],
        ["Isc (A)",            f"{stat.mean(isc_vals):.3f}", f"{min(isc_vals):.3f}", f"{max(isc_vals):.3f}"],
        ["Fill Factor",        f"{stat.mean(ff_vals):.4f}",  f"{min(ff_vals):.4f}",  f"{max(ff_vals):.4f}"],
    ]
    st = Table(stats_data, colWidths=[(W-4*cm)/4]*4)
    st.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0),  C_SOLAR),
        ("TEXTCOLOR",     (0,0), (-1,0),  colors.black),
        ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("BACKGROUND",    (0,1), (-1,-1), C_CARD),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [C_CARD, colors.HexColor("#111f38")]),
        ("TEXTCOLOR",     (0,1), (-1,-1), C_TEXT),
        ("FONTNAME",      (0,1), (0,-1),  "Helvetica-Bold"),
        ("TEXTCOLOR",     (0,1), (0,-1),  C_TEXT3),
        ("ALIGN",         (1,0), (-1,-1), "CENTER"),
        ("ALIGN",         (0,0), (0,-1),  "LEFT"),
        ("GRID",          (0,0), (-1,-1), 0.4, C_BORDER),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ]))
    story.append(st)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    #  PAGE 3 — GRAPHS
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("REAL-TIME DATA GRAPHS", S["section"]))
    story.append(Paragraph(
        "The following charts show values recorded from MATLAB Simulink every 5 seconds "
        "during the 5-minute simulation run.",
        S["body2"]))
    story.append(Spacer(1, 0.3*cm))

    charts = [
        ("Efficiency_pct",   C_GREEN,   "EFFICIENCY (%)",    "%"),
        ("Pmax_W",           C_SOLAR,   "POWER OUTPUT (W)",  "W"),
        ("Temperature_C",    C_ORANGE,  "TEMPERATURE (°C)",  "°C"),
        ("Irradiance_Wm2",   C_CYAN,    "IRRADIANCE (W/m²)", ""),
        ("Vmp_V",            C_SOLAR2,  "VOLTAGE Vmp (V)",   "V"),
        ("Isc_A",            C_PURPLE,  "CURRENT Isc (A)",   "A"),
    ]

    CW = (W - 4*cm - 0.4*cm) / 2  # two per row
    CH = 130

    for i in range(0, len(charts), 2):
        row_charts = charts[i:i+2]
        row_drawings = []
        for field, color, title, unit in row_charts:
            d = make_line_chart(buf, field, color, title, unit, int(CW), CH)
            row_drawings.append(d)
        while len(row_drawings) < 2:
            row_drawings.append(Spacer(CW, CH))
        t = Table([row_drawings],
                  colWidths=[CW, CW],
                  rowHeights=[CH])
        t.setStyle(TableStyle([
            ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ("RIGHTPADDING",  (0,0), (-1,-1), 4),
            ("TOPPADDING",    (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ]))
        story.append(t)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    #  PAGE 4 — PREDICTIONS & RECOMMENDATIONS
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("ML PREDICTION TIMELINE", S["section"]))
    story.append(Paragraph(
        "The Random Forest ensemble model made predictions every 2 minutes using "
        "11 electrical and environmental features from the live Simulink data.",
        S["body2"]))
    story.append(Spacer(1, 0.3*cm))

    if preds:
        pred_header = ["#", "Elapsed", "Health State", "Confidence",
                       "Efficiency", "Power (W)", "Vmp (V)", "Fill Factor"]
        pred_rows = [pred_header]
        for i, p in enumerate(preds):
            pred = p.get("prediction", {})
            pred_rows.append([
                str(i + 1),
                f"{p.get('elapsed',0)}s",
                pred.get("health_state", "—"),
                f"{pred.get('confidence',0):.1f}%",
                f"{pred.get('efficiency',0):.2f}%",
                f"{pred.get('power_output',0):.2f}",
                f"{pred.get('Vmp',0):.3f}",
                f"{pred.get('FF',0):.4f}",
            ])

        # Color health state cells
        pred_t = Table(pred_rows, colWidths=[(W-4*cm)/8]*8, repeatRows=1)
        ts_style = [
            ("BACKGROUND",    (0,0), (-1,0),  colors.HexColor("#1a2744")),
            ("TEXTCOLOR",     (0,0), (-1,0),  C_SOLAR2),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,-1), 8),
            ("BACKGROUND",    (0,1), (-1,-1), C_CARD),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [C_CARD, colors.HexColor("#111f38")]),
            ("TEXTCOLOR",     (0,1), (-1,-1), C_TEXT),
            ("ALIGN",         (0,0), (-1,-1), "CENTER"),
            ("GRID",          (0,0), (-1,-1), 0.4, C_BORDER),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0), (-1,-1), 5),
            ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ]
        # Color health state column by condition
        for i, p in enumerate(preds, start=1):
            hs  = p.get("prediction",{}).get("health_state","Normal")
            hc  = STATE_COLORS.get(hs, C_TEXT)
            ts_style.append(("TEXTCOLOR", (2,i), (2,i), hc))
            ts_style.append(("FONTNAME",  (2,i), (2,i), "Helvetica-Bold"))
        pred_t.setStyle(TableStyle(ts_style))
        story.append(pred_t)
    else:
        story.append(Paragraph("No ML predictions recorded during this simulation.", S["body2"]))

    story.append(Spacer(1, 0.5*cm))

    # ── Detailed recommendations per prediction ───────────
    story.append(Paragraph("AI RECOMMENDATIONS", S["section"]))

    if all_recs:
        seen = set()
        unique_recs = []
        for r in all_recs:
            key = r.get("title","")
            if key not in seen:
                seen.add(key)
                unique_recs.append(r)

        for r in unique_recs:
            rtype  = r.get("type", "info")
            rc     = REC_COLORS.get(rtype, C_BLUE)
            icon   = {"success":"✓","warning":"!","danger":"⚠","info":"i"}.get(rtype,"·")
            title  = r.get("title", "")
            detail = r.get("detail", "")

            rec_data = [[
                Paragraph(f'<font color="{rc.hexval()}" size="11"><b>{icon}</b></font>',
                          ParagraphStyle("ri", alignment=TA_CENTER, leading=16)),
                [Paragraph(f'<font color="{rc.hexval()}" size="9"><b>{title}</b></font>',
                           ParagraphStyle("rt", spaceAfter=2)),
                 Paragraph(f'<font color="#94a3b8" size="8">{detail}</font>',
                           ParagraphStyle("rd", leading=12))]
            ]]
            rt = Table(rec_data, colWidths=[1.2*cm, W - 4*cm - 1.2*cm])
            rt.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,-1), C_CARD),
                ("LEFTPADDING",   (0,0), (0,-1),  0),
                ("RIGHTPADDING",  (0,0), (-1,-1), 8),
                ("TOPPADDING",    (0,0), (-1,-1), 8),
                ("BOTTOMPADDING", (0,0), (-1,-1), 8),
                ("VALIGN",        (0,0), (-1,-1), "TOP"),
                ("BOX",           (0,0), (-1,-1), 0.5, C_BORDER),
                ("LEFTBORDER",    (0,0), (0,-1),  3,   rc),
            ]))
            story.append(rt)
            story.append(Spacer(1, 0.2*cm))
    else:
        story.append(Paragraph("No critical recommendations generated.", S["body2"]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════
    #  PAGE 5 — FULL READINGS TABLE
    # ══════════════════════════════════════════════════════
    story.append(Paragraph("FULL SIMULATION READINGS", S["section"]))
    story.append(Paragraph(
        f"Showing up to 60 evenly-sampled data points from {len(buf)} total recorded. "
        "All values generated by MATLAB Simulink single-diode model.",
        S["body2"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(readings_table(buf, S, max_rows=60))

    # ══════════════════════════════════════════════════════
    #  BUILD
    # ══════════════════════════════════════════════════════
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return path