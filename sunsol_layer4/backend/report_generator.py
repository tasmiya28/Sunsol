import os, json
import pandas as pd
import numpy as np
from datetime import datetime

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "reports")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_report(scenario_name, scenario_params,
                    data_points, predictions):
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = f"SunSol_{scenario_name}_{ts}"

    df = pd.DataFrame(data_points)
    numeric_cols = ["Irradiance_Wm2","Temperature_C","Dust_factor",
                    "Tilt_deg","Vmp_V","Imp_A","Pmax_W",
                    "Voc_V","Isc_A","FF","Efficiency_pct"]
    for c in numeric_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    pred_rows = []
    for p in predictions:
        pred_rows.append({
            "Timestamp":    p["timestamp"],
            "Elapsed (s)":  p["elapsed"],
            "Health State": p["prediction"]["health_state"],
            "Confidence %": p["prediction"]["confidence"],
            "Efficiency %": p["prediction"]["efficiency"],
            "Power W":      p["prediction"]["power_output"],
            "Fill Factor":  p["prediction"]["FF"],
            "Recommendation": "; ".join(
                r["title"] for r in p.get("recommendations",[]))
        })
    pred_df = pd.DataFrame(pred_rows)

    summary = {
        "Scenario Name":       scenario_name,
        "Run Date":            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "Duration (s)":        len(data_points) * 5,
        "Total Data Points":   len(data_points),
        "Total Predictions":   len(predictions),
        "Base Irradiance":     scenario_params.get("G","—"),
        "Base Temperature":    scenario_params.get("T","—"),
        "Dust Factor":         scenario_params.get("D","—"),
        "Tilt Angle":          scenario_params.get("theta","—"),
    }
    if len(df) > 0:
        for col in ["Efficiency_pct","Pmax_W","Temperature_C"]:
            if col in df.columns:
                summary[f"Avg {col}"] = round(df[col].mean(), 3)
                summary[f"Min {col}"] = round(df[col].min(), 3)
                summary[f"Max {col}"] = round(df[col].max(), 3)

    xlsx_path = os.path.join(OUTPUT_DIR, base + ".xlsx")
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        pd.DataFrame([summary]).T.reset_index().rename(
            columns={"index":"Parameter", 0:"Value"}
        ).to_excel(writer, sheet_name="Summary", index=False)
        df.to_excel(writer, sheet_name="Live Data", index=False)
        pred_df.to_excel(writer, sheet_name="Predictions", index=False)

    print(f"Report saved: {xlsx_path}")
    return {"xlsx": xlsx_path}