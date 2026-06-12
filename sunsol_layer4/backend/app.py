from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import joblib, numpy as np, os, sys, time
from datetime import datetime
from recommender import generate_recommendations
from pdf_report import generate_pdf

app = Flask(__name__)
CORS(app)

# ── Load ML models ────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__),
                         "../../layer3_ml/models")
try:
    clf      = joblib.load(os.path.join(MODEL_DIR, "classifier.pkl"))
    reg      = joblib.load(os.path.join(MODEL_DIR, "regressor.pkl"))
    scaler   = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
    FEATURES = joblib.load(os.path.join(MODEL_DIR, "feature_names.pkl"))
    print(f"✅ Models loaded — {len(FEATURES)} features: {FEATURES}")
except Exception as e:
    print(f"❌ Model load failed: {e}")
    sys.exit(1)

LABEL_MAP    = {1:"Normal", 2:"Dusty", 3:"Overheating", 4:"Shaded", 5:"Faulty"}
STATUS_COLOR = {"Normal":"green","Dusty":"yellow","Overheating":"red","Shaded":"blue","Faulty":"red"}

# ── Simulation state ──────────────────────────────────────
sim = {
    "active":          False,
    "scenario_name":   None,
    "scenario_params": {},
    "start_time":      None,
    "end_time":        None,
    "buffer":          [],
    "predictions":     [],
    "last_pred_time":  0,
    "PRED_INTERVAL":   120,   # 2 minutes
    "DURATION":        300,   # 5 minutes
    "report_path":     None,
    "report_pdf_path": None,
    "report_ready":    False,
    "report_error":    None,
}

def elapsed():
    if not sim["start_time"]:
        return 0
    return round((sim["end_time"] or time.time()) - sim["start_time"])

def reset():
    sim["active"]         = False
    sim["scenario_name"]  = None
    sim["scenario_params"]= {}
    sim["start_time"]     = None
    sim["end_time"]       = None
    sim["buffer"]         = []
    sim["predictions"]    = []
    sim["last_pred_time"] = 0
    sim["report_path"]    = None
    sim["report_pdf_path"]= None
    sim["report_ready"]   = False
    sim["report_error"]   = None

def run_ml(d):
    X   = np.array([[float(d.get(f, 0.0)) for f in FEATURES]])
    Xsc = scaler.transform(X)
    lbl = int(clf.predict(Xsc)[0])
    prb = clf.predict_proba(Xsc)[0]
    eta = float(reg.predict(Xsc)[0])
    st  = LABEL_MAP.get(lbl, "Unknown")
    return {
        "health_label":  lbl,
        "health_state":  st,
        "status_color":  STATUS_COLOR.get(st, "gray"),
        "confidence":    round(float(max(prb)) * 100, 2),
        "efficiency":    round(eta, 3),
        "power_output":  round(float(d.get("Pmax_W",  0)), 2),
        "Vmp":           round(float(d.get("Vmp_V",   0)), 3),
        "Imp":           round(float(d.get("Imp_A",   0)), 3),
        "Voc":           round(float(d.get("Voc_V",   0)), 3),
        "Isc":           round(float(d.get("Isc_A",   0)), 3),
        "FF":            round(float(d.get("FF",      0)), 4),
    }

# ── Report generation — safe, verbose error logging ───────
def make_report():
    try:
        import pandas as pd
        print(f"\n📄 Generating report...")
        print(f"   Scenario : {sim['scenario_name']}")
        print(f"   Buffer   : {len(sim['buffer'])} rows")
        print(f"   Preds    : {len(sim['predictions'])} entries")

        if len(sim["buffer"]) == 0:
            raise ValueError("Buffer is empty — no data to report")

        rdir = os.path.join(os.path.dirname(__file__), "reports")
        os.makedirs(rdir, exist_ok=True)

        ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
        name = (sim["scenario_name"] or "run").replace(" ", "_").replace("/","_")
        path = os.path.join(rdir, f"SunSol_{name}_{ts}.xlsx")

        buf    = sim["buffer"]
        preds  = sim["predictions"]
        params = sim["scenario_params"]

        # ── Sheet 1: Summary ──────────────────────────────
        summary_data = {
            "Scenario":      sim["scenario_name"] or "Unknown",
            "Run Date":      datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Duration (s)":  elapsed(),
            "Data Points":   len(buf),
            "Predictions":   len(preds),
            "Base G (W/m2)": params.get("G", "—"),
            "Base T (C)":    params.get("T", "—"),
            "Dust Factor":   params.get("D", "—"),
            "Tilt (deg)":    params.get("theta", "—"),
        }

        df = pd.DataFrame(buf)
        numeric_cols = ["Efficiency_pct","Pmax_W","Temperature_C","Irradiance_Wm2",
                        "Vmp_V","Imp_A","Voc_V","Isc_A","FF"]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                summary_data[f"Avg {col}"] = round(float(df[col].mean()), 3)
                summary_data[f"Min {col}"] = round(float(df[col].min()),  3)
                summary_data[f"Max {col}"] = round(float(df[col].max()),  3)

        summary_df = pd.DataFrame(
            list(summary_data.items()),
            columns=["Parameter", "Value"]
        )

        # ── Sheet 2: Live Data ────────────────────────────
        # Keep only numeric/useful columns
        keep_cols = [c for c in [
            "elapsed_seconds","scenario_name",
            "Irradiance_Wm2","Temperature_C","Dust_factor","Tilt_deg",
            "Vmp_V","Imp_A","Pmax_W","Voc_V","Isc_A","FF","Efficiency_pct",
            "received_at"
        ] if c in df.columns]
        live_df = df[keep_cols].copy() if keep_cols else df.copy()

        # ── Sheet 3: Predictions ──────────────────────────
        pred_rows = []
        for p in preds:
            try:
                pred = p.get("prediction", {})
                recs = p.get("recommendations", [])
                pred_rows.append({
                    "Timestamp":        p.get("timestamp", ""),
                    "Elapsed (s)":      p.get("elapsed", 0),
                    "Health State":     pred.get("health_state", "Unknown"),
                    "Confidence (%)":   pred.get("confidence", 0),
                    "Efficiency (%)":   pred.get("efficiency", 0),
                    "Power (W)":        pred.get("power_output", 0),
                    "Vmp (V)":          pred.get("Vmp", 0),
                    "Fill Factor":      pred.get("FF", 0),
                    "Recommendation 1": recs[0].get("title","") if len(recs) > 0 else "",
                    "Recommendation 2": recs[1].get("title","") if len(recs) > 1 else "",
                })
            except Exception as pe:
                print(f"   Skipping malformed prediction entry: {pe}")

        pred_df = pd.DataFrame(pred_rows) if pred_rows else pd.DataFrame(
            columns=["Timestamp","Elapsed (s)","Health State",
                     "Confidence (%)","Efficiency (%)","Power (W)"]
        )

        # ── Write workbook ────────────────────────────────
        with pd.ExcelWriter(path, engine="openpyxl") as w:
            summary_df.to_excel(w, sheet_name="Summary",     index=False)
            live_df.to_excel(   w, sheet_name="Live Data",   index=False)
            pred_df.to_excel(   w, sheet_name="Predictions", index=False)

        print(f"✅ Report saved: {path}")
        sim["report_error"] = None
        return path

    except Exception as e:
        err = f"Report generation failed: {type(e).__name__}: {e}"
        print(f"❌ {err}")
        import traceback; traceback.print_exc()
        sim["report_error"] = err
        return None

def finalize_simulation(data_point=None):
    """
    Called when simulation ends (naturally or manually).
    Runs final ML prediction, generates Excel + PDF reports.
    """
    sim["active"]   = False
    sim["end_time"] = time.time()

    # Run final ML prediction before generating report
    if data_point and sim["buffer"]:
        try:
            pred_result = run_ml(data_point)
            recs = generate_recommendations(data_point, pred_result)
            sim["predictions"].append({
                "timestamp":       datetime.now().isoformat(),
                "elapsed":         elapsed(),
                "prediction":      pred_result,
                "recommendations": recs,
                "inputs_snapshot": {k: data_point.get(k) for k in FEATURES if k in data_point},
            })
            print(f"⚡ Final prediction: {pred_result['health_state']} ({pred_result['confidence']}%)")
        except Exception as e:
            print(f"Final prediction error: {e}")

    # Generate Excel report
    xlsx_path = make_report()
    if xlsx_path:
        sim["report_path"] = xlsx_path

    # Generate PDF report
    try:
        rdir = os.path.join(os.path.dirname(__file__), "reports")
        pdf_path = generate_pdf(
            scenario_name   = sim["scenario_name"],
            scenario_params = sim["scenario_params"],
            data_points     = sim["buffer"],
            predictions     = sim["predictions"],
            elapsed_sec     = elapsed(),
            output_dir      = rdir,
        )
        sim["report_pdf_path"] = pdf_path
        print(f"✅ PDF report saved: {pdf_path}")
    except Exception as e:
        import traceback
        print(f"❌ PDF generation failed: {e}")
        traceback.print_exc()
        sim["report_error"] = f"PDF error: {e}"

    # Mark ready if at least one report succeeded
    if sim["report_path"] or sim["report_pdf_path"]:
        sim["report_ready"] = True
        sim["report_error"] = None

    return sim["report_ready"]

# ════════════════════════════════════════════════════════
#  ROUTES
# ════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":          "online",
        "features":        FEATURES,
        "scenario_active": sim["active"],
        "report_ready":    sim["report_ready"],
    })

# ── Scenario lifecycle ────────────────────────────────────
@app.route("/scenario/start", methods=["POST"])
def scenario_start():
    d = request.get_json(force=True)
    reset()
    sim["active"]          = True
    sim["scenario_name"]   = d.get("scenario_name", "Unknown")
    sim["scenario_params"] = {k: d.get(k) for k in ["G","T","D","theta","duration"] if k in d}
    sim["start_time"]      = time.time()
    sim["last_pred_time"]  = time.time()
    print(f"\n📡 Scenario started: {sim['scenario_name']} — {sim['scenario_params']}")
    return jsonify({"status": "ok", "message": "Scenario started"})

@app.route("/scenario/stop", methods=["POST"])
def scenario_stop():
    """Frontend 'Stop' button."""
    last_point = sim["buffer"][-1] if sim["buffer"] else None
    ok = finalize_simulation(data_point=last_point)
    return jsonify({
        "status":       "ok",
        "report_ready": sim["report_ready"],
        "report_error": sim["report_error"],
    })

@app.route("/scenario/end", methods=["POST"])
def scenario_end():
    """Called by MATLAB run_scenario.m at the end of simulation."""
    last_point = sim["buffer"][-1] if sim["buffer"] else None
    ok = finalize_simulation(data_point=last_point)
    return jsonify({
        "status":       "ok",
        "report_ready": sim["report_ready"],
        "report_error": sim["report_error"],
    })

# ── MATLAB data stream ────────────────────────────────────
@app.route("/stream", methods=["POST"])
def stream():
    d = request.get_json(force=True)

    # Auto-start if MATLAB posted without calling /scenario/start
    if not sim["start_time"]:
        sim["active"]         = True
        sim["start_time"]     = time.time()
        sim["last_pred_time"] = time.time()
        sim["scenario_name"]  = d.get("scenario_name", "Auto")

    d["received_at"]     = datetime.now().isoformat()
    d["elapsed_seconds"] = elapsed()
    sim["buffer"].append(d)

    # Periodic ML prediction (every 2 minutes)
    now = time.time()
    pred_result = None
    triggered   = False
    if sim["active"] and (now - sim["last_pred_time"]) >= sim["PRED_INTERVAL"]:
        try:
            pred_result = run_ml(d)
            recs = generate_recommendations(d, pred_result)
            sim["predictions"].append({
                "timestamp":       datetime.now().isoformat(),
                "elapsed":         d["elapsed_seconds"],
                "prediction":      pred_result,
                "recommendations": recs,
                "inputs_snapshot": {k: d.get(k) for k in FEATURES if k in d},
            })
            sim["last_pred_time"] = now
            triggered = True
            print(f"⚡ Prediction @{d['elapsed_seconds']}s: "
                  f"{pred_result['health_state']} ({pred_result['confidence']}%)")
        except Exception as e:
            print(f"Prediction error: {e}")

    # Auto-finalize when 300s reached
    # IMPORTANT: prediction check runs BEFORE finalize so final pred is included
    if elapsed() >= sim["DURATION"] and sim["active"]:
        print(f"⏱ Auto-finalizing at {elapsed()}s")
        finalize_simulation(data_point=d)

    return jsonify({
        "status":               "received",
        "elapsed":              d["elapsed_seconds"],
        "prediction_triggered": triggered,
        "latest_prediction":    pred_result,
        "scenario_complete":    sim["report_ready"],
        "report_ready":         sim["report_ready"],
    })

# ── Frontend polling endpoints ────────────────────────────
@app.route("/status", methods=["GET"])
def status():
    latest = sim["buffer"][-1]      if sim["buffer"]      else None
    lpred  = sim["predictions"][-1] if sim["predictions"]  else None
    el     = elapsed()
    next_in = 0
    if sim["active"] and sim["last_pred_time"]:
        next_in = max(0, sim["PRED_INTERVAL"] - (time.time() - sim["last_pred_time"]))
    return jsonify({
        "scenario_active":   sim["active"],
        "scenario_name":     sim["scenario_name"],
        "scenario_params":   sim["scenario_params"],
        "elapsed_seconds":   el,
        "duration":          sim["DURATION"],
        "progress_pct":      min(100, round(el / sim["DURATION"] * 100, 1)) if sim["DURATION"] else 0,
        "data_points_count": len(sim["buffer"]),
        "predictions_count": len(sim["predictions"]),
        "latest_prediction": lpred,
        "live_snapshot":     latest,
        "report_ready":      sim["report_ready"],
        "report_error":      sim["report_error"],
        "has_data":          len(sim["buffer"]) > 0,
        "next_in_seconds":   round(next_in),
    })

@app.route("/live-data", methods=["GET"])
def live_data():
    n   = int(request.args.get("last", 300))
    pts = sim["buffer"][-n:] if sim["buffer"] else []
    return jsonify({
        "status":          "ok",
        "points":          pts,
        "count":           len(pts),
        "latest":          sim["buffer"][-1] if sim["buffer"] else None,
        "scenario":        sim["scenario_name"],
        "elapsed":         elapsed(),
        "has_data":        len(sim["buffer"]) > 0,
        "scenario_active": sim["active"],
    })

@app.route("/history", methods=["GET"])
def history():
    return jsonify({
        "status":          "ok",
        "scenario_name":   sim["scenario_name"],
        "scenario_params": sim["scenario_params"],
        "elapsed":         elapsed(),
        "total_points":    len(sim["buffer"]),
        "data":            sim["buffer"],
        "predictions":     sim["predictions"],
    })

@app.route("/predictions", methods=["GET"])
def predictions():
    next_in = 0
    if sim["active"] and sim["last_pred_time"]:
        next_in = max(0, sim["PRED_INTERVAL"] - (time.time() - sim["last_pred_time"]))
    return jsonify({
        "status":            "ok",
        "count":             len(sim["predictions"]),
        "predictions":       sim["predictions"],
        "next_in_seconds":   round(next_in),
    })

@app.route("/predict", methods=["POST"])
def predict():
    try:
        d    = request.get_json(force=True)
        res  = run_ml(d)
        recs = generate_recommendations(d, res)
        return jsonify({"status":"success","prediction":res,"recommendations":recs})
    except Exception as e:
        return jsonify({"status":"error","message":str(e)}), 400

# ── Report download ───────────────────────────────────────
@app.route("/download-report", methods=["GET"])
def download_report():
    """
    ?format=pdf  → PDF report  (default)
    ?format=xlsx → Excel report
    """
    fmt = request.args.get("format", "pdf")

    if not sim["report_ready"]:
        return jsonify({
            "error":       "Report not ready",
            "report_ready": sim["report_ready"],
            "report_error": sim["report_error"],
            "hint":         "Simulation has not ended yet, or report generation failed.",
        }), 404

    if fmt == "pdf":
        path = sim.get("report_pdf_path")
        mime = "application/pdf"
        ext  = ".pdf"
    else:
        path = sim.get("report_path")
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ext  = ".xlsx"

    if not path:
        # Fallback: try the other format
        path = sim.get("report_path") or sim.get("report_pdf_path")
        if not path:
            return jsonify({"error": "No report file available"}), 500

    if not os.path.exists(path):
        return jsonify({"error": f"File not found: {path}"}), 500

    print(f"📥 Download: {path}")
    return send_file(
        path,
        mimetype=mime,
        as_attachment=True,
        download_name=os.path.basename(path),
    )

@app.route("/report-status", methods=["GET"])
def report_status():
    return jsonify({
        "report_ready":    sim["report_ready"],
        "report_error":    sim["report_error"],
        "has_pdf":         bool(sim.get("report_pdf_path") and
                                os.path.exists(sim.get("report_pdf_path",""))),
        "has_xlsx":        bool(sim.get("report_path") and
                                os.path.exists(sim.get("report_path",""))),
        "pdf_name":        os.path.basename(sim["report_pdf_path"]) if sim.get("report_pdf_path") else None,
        "xlsx_name":       os.path.basename(sim["report_path"])     if sim.get("report_path")     else None,
        "buffer_size":     len(sim["buffer"]),
        "preds_count":     len(sim["predictions"]),
    })

if __name__ == "__main__":
    print("\n🌞 SunSol Flask — real-time simulation backend")
    print(f"   Model dir : {os.path.abspath(MODEL_DIR)}")
    print("   Endpoints :")
    for ep in ["/health","/status","/live-data","/history","/predictions",
               "/scenario/start","/scenario/stop","/scenario/end",
               "/stream","/predict","/download-report","/report-status"]:
        print(f"     {ep}")
    app.run(debug=True, host="0.0.0.0", port=5000)