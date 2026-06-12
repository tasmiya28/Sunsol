import { useEffect, useRef } from "react";

function KpiCard({ label, value, unit, sub, color, icon, pct, delay }) {
  return (
    <div className="card fade-up" style={{ padding:"1.3rem", animationDelay:`${delay}ms`, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", right:-4, bottom:-10, fontSize:"3.5rem", opacity:0.06 }}>{icon}</div>
      <div style={{ fontSize:"0.62rem", fontFamily:"var(--font-head)", letterSpacing:"0.12em", color:"var(--text3)", marginBottom:8, textTransform:"uppercase" }}>{label}</div>
      <div style={{ fontSize:"2rem", fontWeight:800, color, lineHeight:1 }}>
        {value ?? "—"}<span style={{ fontSize:"0.82rem", color:"var(--text3)", marginLeft:3 }}>{unit}</span>
      </div>
      <div style={{ fontSize:"0.72rem", color:"var(--text3)", marginTop:4, fontFamily:"var(--font-head)" }}>{sub}</div>
      <div className="progress-track" style={{ marginTop:10 }}>
        <div className="progress-fill" style={{ width:`${Math.min(100, pct || 0)}%`, background:color }} />
      </div>
    </div>
  );
}

function GaugeRing({ pct, color }) {
  const circ   = 2 * Math.PI * 70;
  const offset = circ * (1 - Math.min(100, Math.max(0, pct || 0)) / 100);
  return (
    <div style={{ position:"relative", width:160, height:160, margin:"0 auto" }}>
      <svg viewBox="0 0 160 160" width="160" height="160" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14"/>
        <circle cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition:"stroke-dashoffset 1s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:"2rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{(+pct||0).toFixed(1)}%</div>
        <div style={{ fontSize:"0.65rem", color:"var(--text3)" }}>efficiency</div>
      </div>
    </div>
  );
}

function MiniChart({ points, field, color, height = 80 }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current; if (!c || !points.length) return;
    const ctx = c.getContext("2d");
    const W = c.width = c.offsetWidth; const H = c.height = height;
    ctx.clearRect(0, 0, W, H);
    const vals = points.map(p => parseFloat(p[field]) || 0).filter(v => !isNaN(v));
    if (!vals.length) return;
    const min = Math.min(...vals) * 0.95;
    const max = Math.max(...vals) * 1.05 || 1;
    const rng = max - min || 1;
    const px = (i) => (i / (vals.length - 1 || 1)) * W;
    const py = (v) => H - 4 - ((v - min) / rng) * (H - 8);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + "30"); grad.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.moveTo(px(0), H);
    vals.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(vals.length - 1), H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    vals.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
  }, [points, field, color, height]);
  return <canvas ref={ref} style={{ width:"100%", height, display:"block" }}/>;
}

const STATE_COLORS = {
  Normal:"var(--green)", Dusty:"var(--solar)",
  Overheating:"var(--red)", Shaded:"var(--blue)", Faulty:"var(--red)"
};
const STATE_BADGES = {
  Normal:"badge-green", Dusty:"badge-solar",
  Overheating:"badge-red", Shaded:"badge-blue", Faulty:"badge-red"
};

export default function Overview({ sensorHook }) {
  const {
    hasData, isRunning, latestPoint, livePoints,
    latestPred, elapsed, progressPct,
    scenarioName, mlOnline, lastError,
    status,
  } = sensorHook;

  // ── No data state ────────────────────────────────────────
  if (!hasData) {
    return (
      <div>
        <div style={{ marginBottom:"1.5rem" }}>
          <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
            SYSTEM <span style={{ color:"var(--solar)" }}>OVERVIEW</span>
          </h1>
          <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>
            Real-time solar panel monitoring
          </p>
        </div>

        {lastError && (
          <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"14px 18px", color:"#f87171", fontSize:"0.85rem", marginBottom:"1.5rem" }}>
            ⚠ {lastError}
          </div>
        )}

        <div className="card" style={{ padding:"3rem", textAlign:"center" }}>
          <div style={{ fontSize:"4rem", marginBottom:"1rem" }}>☀</div>
          <h2 style={{ fontFamily:"var(--font-head)", color:"var(--solar)", marginBottom:12, fontSize:"1.1rem" }}>
            START SIMULATION TO VIEW DATA
          </h2>
          <p style={{ color:"var(--text3)", fontSize:"0.85rem", maxWidth:480, margin:"0 auto 1.5rem", lineHeight:1.7 }}>
            Go to <strong style={{ color:"var(--text)" }}>Live Analytics</strong>, select a scenario, and run the MATLAB command.
            This dashboard will automatically populate with live Simulink data.
          </p>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 18px", background:"rgba(245,158,11,0.08)", border:"1px solid var(--border)", borderRadius:10, fontSize:"0.8rem", color:"var(--text2)" }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background: mlOnline ? "var(--green)" : "var(--red)", display:"inline-block" }}/>
            Flask backend: {mlOnline ? "Online" : "Offline"}
          </div>
        </div>
      </div>
    );
  }

  // ── Data available ────────────────────────────────────────
  const p   = latestPoint || {};
  const pr  = latestPred?.prediction || {};
  const eff = parseFloat(pr.efficiency ?? p.Efficiency_pct ?? 0);
  const state     = pr.health_state || "Normal";
  const stateColor = STATE_COLORS[state] || "var(--text2)";
  const effColor   = eff > 12 ? "var(--green)" : eff > 7 ? "var(--solar)" : "var(--red)";
  const recs = latestPred?.recommendations || [];

  const kpis = [
    { label:"Irradiance",   value: parseFloat(p.Irradiance_Wm2||0).toFixed(0), unit:"W/m²", sub: parseFloat(p.Irradiance_Wm2||0)>800?"Strong":"Moderate",      color:"var(--solar)",  icon:"☀", pct:(parseFloat(p.Irradiance_Wm2||0)/1200)*100, delay:50  },
    { label:"Temperature",  value: parseFloat(p.Temperature_C||0).toFixed(1),  unit:"°C",   sub: parseFloat(p.Temperature_C||0)>60?"⚠ Overheating":"Normal",   color:"var(--orange)", icon:"🌡",pct:(parseFloat(p.Temperature_C||0)/80)*100,    delay:100 },
    { label:"Dust factor",  value: parseFloat(p.Dust_factor||0).toFixed(2),    unit:"",     sub: parseFloat(p.Dust_factor||0)>0.6?"Heavy":parseFloat(p.Dust_factor||0)>0.3?"Moderate":"Clean", color:"var(--text2)", icon:"🌫",pct:(parseFloat(p.Dust_factor||0)/0.9)*100, delay:150 },
    { label:"Tilt angle",   value: parseFloat(p.Tilt_deg||0).toFixed(1),       unit:"°",    sub:`Optimal: 30°`,                                                   color:"var(--blue)",   icon:"📐",pct:(parseFloat(p.Tilt_deg||0)/75)*100,         delay:200 },
    { label:"Vmp",          value: parseFloat(p.Vmp_V||0).toFixed(2),          unit:"V",    sub:"Voltage at MPP",                                                 color:"var(--solar2)", icon:"🔋",pct:(parseFloat(p.Vmp_V||0)/35)*100,            delay:250 },
    { label:"Imp",          value: parseFloat(p.Imp_A||0).toFixed(3),          unit:"A",    sub:"Current at MPP",                                                 color:"var(--cyan)",   icon:"⚡",pct:(parseFloat(p.Imp_A||0)/10)*100,            delay:300 },
    { label:"Pmax",         value: parseFloat(p.Pmax_W||0).toFixed(1),         unit:"W",    sub:`${((parseFloat(p.Pmax_W||0)/200)*100).toFixed(0)}% of max`,     color:"var(--green)",  icon:"🔌",pct:(parseFloat(p.Pmax_W||0)/200)*100,         delay:350 },
    { label:"Fill factor",  value: parseFloat(p.FF||0).toFixed(4),             unit:"",     sub:"IV curve quality",                                               color:"var(--blue)",   icon:"📊",pct:(parseFloat(p.FF||0))*100,                  delay:400 },
  ];

  return (
    <div>
      <div style={{ marginBottom:"1.5rem", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
            SYSTEM <span style={{ color:"var(--solar)" }}>OVERVIEW</span>
          </h1>
          <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>
            {scenarioName ? `Scenario: ${scenarioName}` : "Real-time solar panel monitoring"} · Auto-refreshes every 3s
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {state && (
            <span className={`badge ${STATE_BADGES[state] || "badge-blue"}`}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:stateColor, display:"inline-block" }}/>
              {state}
            </span>
          )}
          <span style={{ fontSize:"0.72rem", color: isRunning ? "var(--green2)" : "var(--text3)", fontFamily:"var(--font-head)" }}>
            {isRunning ? "● LIVE" : "● STOPPED"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {(isRunning || elapsed > 0) && (
        <div className="card" style={{ padding:"1rem 1.5rem", marginBottom:"1.5rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.75rem", color:"var(--text3)", marginBottom:6 }}>
            <span>Simulation progress — {scenarioName}</span>
            <span style={{ color:"var(--solar)", fontFamily:"var(--font-head)" }}>
              {elapsed}s / 300s · {progressPct.toFixed(0)}%
            </span>
          </div>
          <div className="progress-track" style={{ height:6 }}>
            <div className="progress-fill" style={{ width:`${progressPct}%`, background:"linear-gradient(90deg,var(--solar),var(--orange))" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.65rem", color:"var(--text3)", marginTop:4 }}>
            <span>Start</span>
            <span>Prediction 1 (2 min)</span>
            <span>Prediction 2 (4 min)</span>
            <span>Report (5 min)</span>
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
        {kpis.map(k => <KpiCard key={k.label} {...k}/>)}
      </div>

      {/* Gauge + recommendations + tilt */}
      <div style={{ display:"grid", gridTemplateColumns:"200px 1fr 220px", gap:"1rem", marginBottom:"1.5rem" }}>
        <div className="card fade-up" style={{ padding:"1.5rem", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div className="sec-title" style={{ marginBottom:"1rem" }}>Efficiency</div>
          <GaugeRing pct={eff} color={effColor}/>
        </div>

        <div className="card fade-up" style={{ padding:"1.5rem" }}>
          <div className="sec-title">🤖 AI Recommendations</div>
          {recs.length === 0 ? (
            <div style={{ color:"var(--text3)", fontSize:"0.85rem", padding:"1rem 0" }}>
              {latestPred ? "No critical recommendations." : "Waiting for first ML prediction (2 min)..."}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {recs.map((r, i) => {
                const bc = r.type==="danger"?"var(--red)":r.type==="warning"?"var(--orange)":r.type==="success"?"var(--green)":"var(--blue)";
                return (
                  <div key={i} style={{ padding:"10px 14px", borderRadius:"0 10px 10px 0", borderLeft:`3px solid ${bc}`, background:"rgba(255,255,255,0.02)", fontSize:"0.85rem", lineHeight:1.5 }}>
                    <strong style={{ color:bc }}>{r.title}</strong> — {r.detail}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop:"1rem", padding:"10px 14px", background:"rgba(245,158,11,0.05)", borderRadius:10, border:"1px solid var(--border)", fontSize:"0.8rem" }}>
            📍 17.020°N, 74.550°E · Optimal tilt: 30°
          </div>
        </div>

        <div className="card fade-up" style={{ padding:"1.5rem" }}>
          <div className="sec-title">Panel Tilt</div>
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:110, marginBottom:"1rem" }}>
            <div style={{ width:80, height:60, background:`${stateColor}25`, border:`2px solid ${stateColor}`, borderRadius:6, transform:`rotate(${(parseFloat(p.Tilt_deg||0))*0.4}deg) perspective(200px) rotateX(15deg)`, transition:"transform 1s ease", boxShadow:`0 0 20px ${stateColor}30` }}/>
          </div>
          <div style={{ fontSize:"0.78rem", color:"var(--text2)" }}>
            {[["Pitch", `${parseFloat(p.Tilt_deg||0).toFixed(1)}°`, "var(--solar)"],["Voc", `${parseFloat(p.Voc_V||0).toFixed(2)}V`, "var(--solar2)"],["Isc", `${parseFloat(p.Isc_A||0).toFixed(3)}A`, "var(--cyan)"],["Optimal", "30°", "var(--green)"]].map(([l,v,c]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span>{l}</span><span style={{ color:c, fontFamily:"var(--font-head)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mini trend charts */}
      {livePoints.length > 2 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.5rem" }}>
          {[
            { field:"Efficiency_pct", color:"#10b981", label:"EFFICIENCY (%)" },
            { field:"Pmax_W",         color:"#f59e0b", label:"POWER OUTPUT (W)" },
            { field:"Temperature_C",  color:"#f97316", label:"TEMPERATURE (°C)" },
            { field:"Irradiance_Wm2", color:"#06b6d4", label:"IRRADIANCE (W/m²)" },
          ].map(({ field, color, label }) => (
            <div key={field} className="card" style={{ padding:"1.2rem" }}>
              <div className="sec-title">{label}</div>
              <MiniChart points={livePoints} field={field} color={color}/>
            </div>
          ))}
        </div>
      )}

      {/* ML output cards */}
      {latestPred && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          <div className="card fade-up" style={{ padding:"1.5rem" }}>
            <div className="sec-title">⚡ Latest ML Prediction (t={latestPred.elapsed}s)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"Health State",  value: state,                                  color: stateColor           },
                { label:"Confidence",    value: `${pr.confidence ?? "—"}%`,             color:"var(--solar)"        },
                { label:"Efficiency",    value: `${pr.efficiency ?? "—"}%`,             color:"var(--green)"        },
                { label:"Power",         value: `${pr.power_output ?? "—"}W`,           color:"var(--cyan)"         },
                { label:"Fill Factor",   value: pr.FF ?? "—",                           color:"var(--blue)"         },
                { label:"Vmp",           value: `${pr.Vmp ?? "—"}V`,                   color:"var(--solar2)"       },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.02)", borderRadius:8, padding:"10px 12px", border:"1px solid var(--border2)" }}>
                  <div style={{ fontSize:"0.62rem", fontFamily:"var(--font-head)", letterSpacing:"0.1em", color:"var(--text3)", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:"1.2rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card fade-up" style={{ padding:"1.5rem" }}>
            <div className="sec-title">📡 Simulink Input Snapshot</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"Irradiance",   value:`${parseFloat(p.Irradiance_Wm2||0).toFixed(0)} W/m²`, color:"var(--solar)"  },
                { label:"Temperature",  value:`${parseFloat(p.Temperature_C||0).toFixed(1)} °C`,    color:"var(--orange)" },
                { label:"Dust factor",  value:`${parseFloat(p.Dust_factor||0).toFixed(2)}`,         color:"var(--text2)"  },
                { label:"Tilt angle",   value:`${parseFloat(p.Tilt_deg||0).toFixed(1)}°`,           color:"var(--blue)"   },
                { label:"Isc",          value:`${parseFloat(p.Isc_A||0).toFixed(3)} A`,            color:"var(--cyan)"   },
                { label:"Voc",          value:`${parseFloat(p.Voc_V||0).toFixed(2)} V`,            color:"var(--green2)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.02)", borderRadius:8, padding:"10px 12px", border:"1px solid var(--border2)" }}>
                  <div style={{ fontSize:"0.62rem", fontFamily:"var(--font-head)", letterSpacing:"0.1em", color:"var(--text3)", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:"1.2rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}