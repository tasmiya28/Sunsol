from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import joblib, numpy as np, os, sys, time
from datetime import datetime
from recommender import generate_recommendations

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
    print(f"Models loaded — {len(FEATURES)} features: {FEATURES}")
except Exception as e:
    print(f"Model load failed: {e}"); sys.exit(1)

LABEL_MAP = {1:"Normal",2:"Dusty",3:"Overheating",4:"Shaded",5:"Faulty"}
STATUS_COLOR = {"Normal":"green","Dusty":"yellow",
                "Overheating":"red","Shaded":"blue","Faulty":"red"}

# ── Simulation state (single dict, no classes) ─────────────
sim = {
    "active": False, "scenario_name": None, "scenario_params": {},
    "start_time": None, "end_time": None,
    "buffer": [], "predictions": [],
    "last_pred_time": 0, "PRED_INTERVAL": 120, "DURATION": 300,
    "report_path": None, "report_ready": False,
}

def elapsed():
    if not sim["start_time"]: return 0
    return round((sim["end_time"] or time.time()) - sim["start_time"])

def reset():
    for k in ["active","scenario_name","report_path","report_ready"]:
        sim[k] = False if k == "active" else None
    sim["scenario_params"] = {}
    sim["start_time"] = sim["end_time"] = None
    sim["buffer"] = []; sim["predictions"] = []
    sim["last_pred_time"] = 0

def run_ml(d):
    X   = np.array([[float(d.get(f, 0.0)) for f in FEATURES]])
    Xsc = scaler.transform(X)
    lbl = int(clf.predict(Xsc)[0])
    prb = clf.predict_proba(Xsc)[0]
    eta = float(reg.predict(Xsc)[0])
    st  = LABEL_MAP.get(lbl, "Unknown")
    return {
        "health_label": lbl, "health_state": st,
        "status_color": STATUS_COLOR.get(st, "gray"),
        "confidence":   round(float(max(prb)) * 100, 2),
        "efficiency":   round(eta, 3),
        "power_output": round(float(d.get("Pmax_W", 0)), 2),
        "Vmp": round(float(d.get("Vmp_V", 0)), 3),
        "Imp": round(float(d.get("Imp_A", 0)), 3),
        "Voc": round(float(d.get("Voc_V", 0)), 3),
        "Isc": round(float(d.get("Isc_A", 0)), 3),
        "FF":  round(float(d.get("FF",    0)), 4),
    }

def make_report():
    try:
        import pandas as pd
        rdir = os.path.join(os.path.dirname(__file__), "reports")
        os.makedirs(rdir, exist_ok=True)
        ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
        name = (sim["scenario_name"] or "run").replace(" ", "_")
        path = os.path.join(rdir, f"SunSol_{name}_{ts}.xlsx")
        buf  = sim["buffer"]
        preds = sim["predictions"]
        params = sim["scenario_params"]
        summary = {
            "Scenario": sim["scenario_name"] or "—",
            "Run Date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Duration (s)": elapsed(),
            "Data Points": len(buf),
            "Predictions": len(preds),
            "Base G (W/m2)": params.get("G","—"),
            "Base T (C)":    params.get("T","—"),
            "Dust Factor":   params.get("D","—"),
            "Tilt (deg)":    params.get("theta","—"),
        }
        df = pd.DataFrame(buf)
        for col in ["Efficiency_pct","Pmax_W","Temperature_C","Irradiance_Wm2"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                summary[f"Avg {col}"] = round(df[col].mean(), 3)
                summary[f"Min {col}"] = round(df[col].min(),  3)
                summary[f"Max {col}"] = round(df[col].max(),  3)
        pred_rows = [{
            "Timestamp": p.get("timestamp",""),
            "Elapsed (s)": p.get("elapsed",0),
            "Health State": p["prediction"].get("health_state",""),
            "Confidence (%)": p["prediction"].get("confidence",0),
            "Efficiency (%)": p["prediction"].get("efficiency",0),
            "Power (W)": p["prediction"].get("power_output",0),
            "Recommendation": "; ".join(r.get("title","") for r in p.get("recommendations",[])),
        } for p in preds]
        with pd.ExcelWriter(path, engine="openpyxl") as w:
            pd.DataFrame([summary]).T.reset_index().rename(
                columns={"index":"Parameter",0:"Value"}
            ).to_excel(w, sheet_name="Summary", index=False)
            df.to_excel(w, sheet_name="Live Data", index=False)
            pd.DataFrame(pred_rows).to_excel(w, sheet_name="Predictions", index=False)
        print(f"Report saved: {path}")
        return path
    except Exception as e:
        print(f"Report error: {e}"); return None

# ═══════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status":"online","features":FEATURES,
                    "scenario_active":sim["active"]})

# ── Scenario lifecycle ────────────────────────────────────
@app.route("/scenario/start", methods=["POST"])
def scenario_start():
    d = request.get_json(force=True)
    reset()
    sim["active"]         = True
    sim["scenario_name"]  = d.get("scenario_name","Unknown")
    sim["scenario_params"]= {k:d.get(k) for k in ["G","T","D","theta","duration"] if k in d}
    sim["start_time"]     = time.time()
    sim["last_pred_time"] = time.time()
    print(f"Scenario started: {sim['scenario_name']}")
    return jsonify({"status":"ok"})

@app.route("/scenario/stop", methods=["POST"])
def scenario_stop():
    sim["active"]   = False
    sim["end_time"] = time.time()
    p = make_report()
    if p: sim["report_path"] = p; sim["report_ready"] = True
    return jsonify({"status":"ok","report_ready":sim["report_ready"]})

@app.route("/scenario/end", methods=["POST"])
def scenario_end():
    sim["active"]   = False
    sim["end_time"] = time.time()
    p = make_report()
    if p: sim["report_path"] = p; sim["report_ready"] = True
    return jsonify({"status":"ok","report_ready":sim["report_ready"]})

# ── MATLAB data stream ────────────────────────────────────
@app.route("/stream", methods=["POST"])
def stream():
    d = request.get_json(force=True)

    # Auto-start if not formally started
    if not sim["start_time"]:
        sim["active"]        = True
        sim["start_time"]    = time.time()
        sim["last_pred_time"]= time.time()
        sim["scenario_name"] = d.get("scenario_name","Auto")

    d["received_at"]     = datetime.now().isoformat()
    d["elapsed_seconds"] = elapsed()
    sim["buffer"].append(d)

    # Auto-complete at DURATION
    if elapsed() >= sim["DURATION"] and sim["active"]:
        sim["active"]   = False
        sim["end_time"] = time.time()
        p = make_report()
        if p: sim["report_path"] = p; sim["report_ready"] = True
        print("Simulation completed at 300s")

    # Prediction every 2 minutes
    now = time.time()
    pred_result = None
    triggered   = False
    if (now - sim["last_pred_time"]) >= sim["PRED_INTERVAL"]:
        try:
            pred_result = run_ml(d)
            recs = generate_recommendations(d, pred_result)
            sim["predictions"].append({
                "timestamp":       datetime.now().isoformat(),
                "elapsed":         d["elapsed_seconds"],
                "prediction":      pred_result,
                "recommendations": recs,
                "inputs_snapshot": {k:d.get(k) for k in FEATURES if k in d},
            })
            sim["last_pred_time"] = now
            triggered = True
            print(f"Prediction @{d['elapsed_seconds']}s: "
                  f"{pred_result['health_state']} {pred_result['confidence']}%")
        except Exception as e:
            print(f"Prediction error: {e}")

    return jsonify({
        "status":"received","elapsed":d["elapsed_seconds"],
        "prediction_triggered":triggered,"latest_prediction":pred_result,
        "scenario_complete":sim["report_ready"],
    })

# ── Frontend polling ──────────────────────────────────────
@app.route("/status", methods=["GET"])
def status():
    latest = sim["buffer"][-1]      if sim["buffer"]     else None
    lpred  = sim["predictions"][-1] if sim["predictions"] else None
    el = elapsed()
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
        "has_data":          len(sim["buffer"]) > 0,
    })

@app.route("/live-data", methods=["GET"])
def live_data():
    n   = int(request.args.get("last", 60))
    pts = sim["buffer"][-n:] if sim["buffer"] else []
    return jsonify({
        "status":"ok","points":pts,"count":len(pts),
        "latest":   sim["buffer"][-1] if sim["buffer"] else None,
        "scenario": sim["scenario_name"],
        "elapsed":  elapsed(),
        "has_data": len(sim["buffer"]) > 0,
        "scenario_active": sim["active"],
    })

@app.route("/history", methods=["GET"])
def history():
    return jsonify({
        "status":"ok",
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
        "status":"ok",
        "count":       len(sim["predictions"]),
        "predictions": sim["predictions"],
        "next_in_seconds": round(next_in),
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

@app.route("/download-report", methods=["GET"])
def download_report():
    if not sim["report_ready"] or not sim["report_path"]:
        return jsonify({"error":"Report not ready"}), 404
    if not os.path.exists(sim["report_path"]):
        return jsonify({"error":"Report file missing"}), 404
    return send_file(sim["report_path"],
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=os.path.basename(sim["report_path"]))

if __name__ == "__main__":
    print("\nSunSol Flask — real-time simulation backend")
    print(f"Model dir: {os.path.abspath(MODEL_DIR)}")
    print("Endpoints: /health /status /live-data /history /predictions")
    print("           /scenario/start /scenario/stop /scenario/end")
    print("           /stream /predict /download-report")
    app.run(debug=True, host="0.0.0.0", port=5000)