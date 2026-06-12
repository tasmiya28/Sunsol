def generate_recommendations(inputs, prediction):
    recs  = []
    G     = inputs.get("Irradiance_Wm2",  0)
    T     = inputs.get("Temperature_C",   0)
    D     = inputs.get("Dust_factor",     0)
    tilt  = inputs.get("Tilt_deg",        0)
    eta   = prediction.get("efficiency",  0)
    state = prediction.get("health_state", "")

    if state == "Dusty" or D > 0.35:
        loss = round(D * 30)
        recs.append({
            "type":   "warning",
            "title":  "Panel cleaning required",
            "detail": f"Dust factor {D:.2f} detected. Schedule cleaning immediately. "
                      f"Estimated efficiency loss: {loss}%. "
                      f"Use soft brush and distilled water for best results."
        })

    if state == "Overheating" or T > 60:
        recs.append({
            "type":   "danger",
            "title":  "Overheating detected",
            "detail": f"Cell temperature {T:.1f}°C exceeds safe operating limit (60°C). "
                      f"Improve rear ventilation, reduce load, and check cooling system. "
                      f"Efficiency drops 0.38% per °C above 25°C."
        })

    if state == "Shaded" or G < 300:
        recs.append({
            "type":   "info",
            "title":  "Low irradiance detected",
            "detail": f"Irradiance at {G:.0f} W/m² — panel output reduced significantly. "
                      f"Check for nearby obstructions, tree shading, or cloud cover. "
                      f"Performance will recover automatically when irradiance improves."
        })

    if state == "Faulty":
        recs.append({
            "type":   "danger",
            "title":  "Faulty panel — immediate inspection",
            "detail": "ML model detected abnormal panel behaviour. "
                      "Efficiency critically low despite conditions. "
                      "Check bypass diodes, wiring connections, and cell integrity. "
                      "Contact qualified solar engineer."
        })

    optimal_tilt = 30
    if abs(tilt - optimal_tilt) > 15:
        direction = "increase" if tilt < optimal_tilt else "decrease"
        recs.append({
            "type":   "info",
            "title":  "Suboptimal tilt angle",
            "detail": f"Current tilt {tilt:.0f}° — optimal is ~{optimal_tilt}° for maximum yield. "
                      f"Please {direction} tilt angle. "
                      f"Correction could improve annual energy yield by 5–8%."
        })

    if state == "Normal" and eta > 11:
        recs.append({
            "type":   "success",
            "title":  "System operating at peak efficiency",
            "detail": f"All parameters nominal. Efficiency at {eta:.1f}%. "
                      f"Continue regular monitoring. Next recommended service in 30 days."
        })

    if not recs:
        recs.append({
            "type":   "info",
            "title":  "System check complete",
            "detail": "No critical issues detected. "
                      "Continue regular monitoring schedule."
        })

    return recs
