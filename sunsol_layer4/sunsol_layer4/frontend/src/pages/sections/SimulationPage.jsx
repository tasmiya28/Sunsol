import { useState, useEffect, useRef } from "react";
import { useSensorData } from "../../hooks/useSensorData";

const SCENARIOS = [
  { name:"Normal operation",  G:1000, T:25, D:0.0,  theta:35, icon:"🌞" },
  { name:"Dusty conditions",  G:900,  T:30, D:0.65, theta:35, icon:"🌫" },
  { name:"Overheating",       G:1000, T:72, D:0.0,  theta:35, icon:"🌡" },
  { name:"Partially shaded",  G:220,  T:22, D:0.0,  theta:35, icon:"🌥" },
  { name:"Faulty panel",      G:180,  T:25, D:0.82, theta:62, icon:"⚠️" },
  { name:"Custom",            G:800,  T:35, D:0.2,  theta:40, icon:"🎛" },
];

function CanvasChart({ points, field, color, label, unit }) {
  const ref = useRef();
  useEffect(() => {
    if (!points.length || !ref.current) return;
    const c = ref.current;
    const ctx = c.getContext("2d");
    const W = c.width = c.offsetWidth;
    if (!W) return; // FIX: guard against zero-width canvas
    const H = c.height = 120;
    ctx.clearRect(0, 0, W, H);
    const vals = points.map(p => parseFloat(p[field]) || 0);
    const min  = Math.min(...vals) * 0.97;
    const max  = Math.max(...vals) * 1.03 || 1;
    const rng  = max - min || 1;
    const px   = (i) => (i / (vals.length - 1 || 1)) * W;
    const py   = (v) => H - 10 - ((v - min) / rng) * (H - 20);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = 10 + (i / 3) * (H - 20);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + "35");
    grad.addColorStop(1, color + "00");
    ctx.beginPath();
    ctx.moveTo(px(0), H);
    vals.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(vals.length - 1), H);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    vals.forEach((v, i) => i === 0
      ? ctx.moveTo(px(i), py(v))
      : ctx.lineTo(px(i), py(v)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    if (vals.length > 0) {
      const lx = px(vals.length - 1), ly = py(vals[vals.length - 1]);
      ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }
    ctx.fillStyle = "#64748b"; ctx.font = "10px DM Sans";
    ctx.fillText(max.toFixed(1) + unit, 4, 14);
    ctx.fillText(min.toFixed(1) + unit, 4, H - 4);
  }, [points, field, color]);
  return (
    <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:10, padding:"1rem", border:"1px solid var(--border2)" }}>
      <div style={{ fontSize:"0.68rem", fontFamily:"var(--font-head)", letterSpacing:"0.1em", color:"var(--text3)", marginBottom:8 }}>{label}</div>
      <canvas ref={ref} style={{ width:"100%", height:120, display:"block" }} />
    </div>
  );
}

const STATE_COLORS = {
  Normal:"var(--green)", Dusty:"var(--solar)",
  Overheating:"var(--red)", Shaded:"var(--blue)", Faulty:"var(--red)"
};

export default function SimulationPage() {
  const { liveData, predictions, scenarioInfo, elapsed,
          isRunning, reportReady, mlOnline,
          downloadReport, latestPoint, latestPred } = useSensorData();

  const [selected,   setSelected]   = useState(SCENARIOS[0]);
  const [customVals, setCustomVals] = useState({ G:800, T:35, D:0.2, theta:40 });
  const [phase,      setPhase]      = useState("select");
  const [matlabCmd,  setMatlabCmd]  = useState("");

  const DURATION = 300;
  const progress = Math.min(100, (elapsed / DURATION) * 100);

  // FIX: Added fallback `else setPhase("select")` to prevent jumping to "running"
  // if isRunning is true on initial mount with no data yet
  useEffect(() => {
    if (isRunning) setPhase("running");
    else if (reportReady) setPhase("done");
    else setPhase("select");
  }, [isRunning, reportReady]);

  function buildMatlabCmd(sc) {
    const G = sc.name === "Custom" ? customVals.G     : sc.G;
    const T = sc.name === "Custom" ? customVals.T     : sc.T;
    const D = sc.name === "Custom" ? customVals.D     : sc.D;
    const θ = sc.name === "Custom" ? customVals.theta : sc.theta;
    return `run_scenario('${sc.name}', ${G}, ${T}, ${D}, ${θ})`;
  }

  function handleRunClick() {
    const cmd = buildMatlabCmd(selected);
    setMatlabCmd(cmd);
    setPhase("ready");
  }

  return (
    <div>
      <div style={{ marginBottom:"1.5rem" }}>
        <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
          REAL-TIME <span style={{ color:"var(--solar)" }}>SIMULATION</span>
        </h1>
        <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>
          5-minute Simulink runs · ML prediction every 2 minutes · Auto-generated report
        </p>
      </div>

      {phase === "select" && (
        <div style={{ display:"grid", gridTemplateColumns:"360px 1fr", gap:"1.5rem" }}>
          <div>
            <div className="card" style={{ padding:"1.5rem", marginBottom:"1rem" }}>
              <div className="sec-title">Select scenario</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:"1.5rem" }}>
                {SCENARIOS.map(sc => (
                  <button key={sc.name}
                    onClick={() => setSelected(sc)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:10, border:"none", cursor:"pointer", background: selected.name === sc.name ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)", borderLeft: selected.name === sc.name ? "3px solid var(--solar)" : "3px solid transparent", color:"var(--text)", fontFamily:"var(--font-body)", fontSize:"0.9rem", textAlign:"left", transition:"all 0.2s" }}>
                    <span style={{ fontSize:"1.1rem" }}>{sc.icon}</span>
                    <div>
                      <div style={{ fontWeight: selected.name === sc.name ? 600 : 400, color: selected.name === sc.name ? "var(--solar)" : "var(--text)" }}>{sc.name}</div>
                      {sc.name !== "Custom" && (
                        <div style={{ fontSize:"0.72rem", color:"var(--text3)", marginTop:2 }}>
                          G={sc.G} W/m² · T={sc.T}°C · D={sc.D} · θ={sc.theta}°
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {selected.name === "Custom" && (
                <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:"1.5rem", padding:"1rem", background:"rgba(245,158,11,0.04)", borderRadius:10, border:"1px solid var(--border)" }}>
                  {[
                    { key:"G",     label:"Irradiance", unit:"W/m²", min:100, max:1200, step:10  },
                    { key:"T",     label:"Temperature", unit:"°C",   min:10,  max:80,  step:1   },
                    { key:"D",     label:"Dust factor",  unit:"",    min:0,   max:0.9, step:0.05 },
                    { key:"theta", label:"Tilt angle",   unit:"°",   min:0,   max:75,  step:1   },
                  ].map(s => (
                    <div key={s.key}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:13, color:"var(--text2)" }}>{s.label}</span>
                        <span style={{ fontSize:13, color:"var(--solar)", fontFamily:"var(--font-head)", fontWeight:600 }}>
                          {Number(customVals[s.key]).toFixed(s.step < 1 ? 2 : 0)}{s.unit}
                        </span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step}
                        value={customVals[s.key]}
                        onChange={e => setCustomVals(v => ({...v, [s.key]: parseFloat(e.target.value)}))}
                        style={{ width:"100%", accentColor:"var(--solar)" }} />
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-solar" style={{ width:"100%" }}
                onClick={handleRunClick} disabled={!mlOnline}>
                {mlOnline ? `⚡ Prepare scenario` : "⚠ Flask offline"}
              </button>
              {!mlOnline && (
                <div style={{ fontSize:"0.75rem", color:"var(--orange)", marginTop:8, textAlign:"center" }}>
                  Start Flask: python app.py
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding:"1.5rem" }}>
            <div className="sec-title">How it works</div>
            {[
              { step:"1", title:"Select scenario",     detail:"Choose environmental conditions — irradiance, temperature, dust, and tilt angle define what the panel experiences." },
              { step:"2", title:"MATLAB runs simulation", detail:"The run_scenario.m script drives Simulink for 5 minutes, generating physics-based data every 5 seconds using the single-diode model." },
              { step:"3", title:"Flask receives live data", detail:"Each Simulink output is POSTed to /stream. Flask buffers the data and checks if 2 minutes have passed since the last prediction." },
              { step:"4", title:"ML model predicts",    detail:"Every 2 minutes, the Random Forest classifier and regressor analyse the latest data point. Total: 3 predictions per 5-minute run." },
              { step:"5", title:"Report generated",     detail:"After 5 minutes, Flask generates an Excel report with scenario parameters, all data points, prediction results, and performance insights." },
            ].map(({ step, title, detail }) => (
              <div key={step} style={{ display:"flex", gap:14, marginBottom:16 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.78rem", fontWeight:700, color:"var(--solar)", fontFamily:"var(--font-head)", flexShrink:0, marginTop:2 }}>{step}</div>
                <div>
                  <div style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--text)", marginBottom:3 }}>{title}</div>
                  <div style={{ fontSize:"0.8rem", color:"var(--text3)", lineHeight:1.55 }}>{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "ready" && (
        <div style={{ maxWidth:640, margin:"0 auto" }}>
          <div className="card" style={{ padding:"2rem", textAlign:"center", marginBottom:"1.5rem" }}>
            <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>
              {selected.icon}
            </div>
            <h2 style={{ fontFamily:"var(--font-head)", fontSize:"1.1rem", color:"var(--solar)", marginBottom:8 }}>
              Ready: {selected.name}
            </h2>
            <p style={{ color:"var(--text3)", fontSize:"0.85rem", marginBottom:"1.5rem" }}>
              Copy the command below into MATLAB and press Enter to start the 5-minute simulation.
            </p>
            <div style={{ background:"rgba(0,0,0,0.3)", borderRadius:10, padding:"1rem 1.2rem", fontFamily:"var(--font-head)", fontSize:"0.82rem", color:"var(--solar2)", marginBottom:"1.5rem", textAlign:"left", border:"1px solid var(--border)", wordBreak:"break-all" }}>
              {matlabCmd}
            </div>
            <button className="btn btn-solar" style={{ marginRight:12 }}
              onClick={() => { navigator.clipboard.writeText(matlabCmd); }}>
              📋 Copy command
            </button>
            <button className="btn btn-ghost"
              onClick={() => setPhase("running")}>
              ▶ I've started it in MATLAB
            </button>
          </div>
          <button className="btn btn-ghost" style={{ width:"100%" }}
            onClick={() => setPhase("select")}>
            ← Change scenario
          </button>
        </div>
      )}

      {phase === "running" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"1rem", marginBottom:"1.5rem" }}>
            {[
              { label:"Scenario",    value: scenarioInfo?.name || selected.name,                  color:"var(--solar)"  },
              { label:"Elapsed",     value: `${elapsed}s / 300s`,                                 color:"var(--cyan)"   },
              { label:"Data points", value: liveData.length,                                      color:"var(--green)"  },
              { label:"Predictions", value: `${predictions.length} / 3`,                          color:"var(--purple)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="card fade-up" style={{ padding:"1.2rem" }}>
                <div className="sec-title">{label}</div>
                <div style={{ fontSize:"1.4rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding:"1rem 1.5rem", marginBottom:"1.5rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.75rem", color:"var(--text3)", marginBottom:6 }}>
              <span>Simulation progress</span>
              <span style={{ color:"var(--solar)", fontFamily:"var(--font-head)" }}>{progress.toFixed(0)}%  ·  {elapsed}s / 300s</span>
            </div>
            <div className="progress-track" style={{ height:8 }}>
              <div className="progress-fill" style={{ width:`${progress}%`, background:"linear-gradient(90deg,var(--solar),var(--orange))" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.68rem", color:"var(--text3)", marginTop:6 }}>
              <span>Start</span>
              <span>Prediction 1 (2 min)</span>
              <span>Prediction 2 (4 min)</span>
              <span>Report (5 min)</span>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"1rem", marginBottom:"1.5rem" }}>
            <CanvasChart points={liveData} field="Efficiency_pct" color="#10b981" label="EFFICIENCY (%)"   unit="%" />
            <CanvasChart points={liveData} field="Pmax_W"         color="#f59e0b" label="POWER OUTPUT (W)" unit="W" />
            <CanvasChart points={liveData} field="Temperature_C"  color="#f97316" label="TEMPERATURE (°C)" unit="°C" />
            <CanvasChart points={liveData} field="Irradiance_Wm2" color="#06b6d4" label="IRRADIANCE (W/m²)" unit="" />
          </div>

          {latestPoint && (
            <div className="card" style={{ padding:"1.5rem", marginBottom:"1.5rem" }}>
              <div className="sec-title">📡 Latest data point from Simulink</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10 }}>
                {[
                  { label:"Vmp",        value:`${parseFloat(latestPoint.Vmp_V||0).toFixed(2)}V`, color:"var(--solar)"  },
                  { label:"Imp",        value:`${parseFloat(latestPoint.Imp_A||0).toFixed(3)}A`, color:"var(--cyan)"   },
                  { label:"Pmax",       value:`${parseFloat(latestPoint.Pmax_W||0).toFixed(1)}W`, color:"var(--green)" },
                  { label:"Voc",        value:`${parseFloat(latestPoint.Voc_V||0).toFixed(2)}V`, color:"var(--solar2)" },
                  { label:"Isc",        value:`${parseFloat(latestPoint.Isc_A||0).toFixed(3)}A`, color:"var(--blue)"  },
                  { label:"Fill Factor",value:`${parseFloat(latestPoint.FF||0).toFixed(4)}`,      color:"var(--text2)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background:"rgba(255,255,255,0.02)", borderRadius:8, padding:"10px 12px", border:"1px solid var(--border2)" }}>
                    <div className="sec-title" style={{ margin:0, marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:"1.1rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {predictions.length > 0 && (
            <div className="card" style={{ padding:"1.5rem" }}>
              <div className="sec-title">🤖 ML predictions (every 2 minutes)</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {predictions.map((p, i) => {
                  const color = STATE_COLORS[p.prediction?.health_state] || "var(--text2)";
                  return (
                    <div key={i} style={{ padding:"14px", borderRadius:10, background:"rgba(255,255,255,0.02)", border:`1px solid ${color}30`, borderLeft:`4px solid ${color}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                        <span style={{ color, fontWeight:700, fontFamily:"var(--font-head)", fontSize:"0.95rem" }}>
                          Prediction {i+1} — {p.prediction?.health_state}
                        </span>
                        <span style={{ color:"var(--text3)", fontSize:"0.75rem" }}>t = {p.elapsed}s</span>
                      </div>
                      <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:10 }}>
                        {[
                          { l:"Confidence",  v:`${p.prediction?.confidence}%`,   c:"var(--solar)"  },
                          { l:"Efficiency",  v:`${p.prediction?.efficiency}%`,    c:"var(--green)"  },
                          { l:"Power",       v:`${p.prediction?.power_output}W`,  c:"var(--cyan)"   },
                        ].map(({ l, v, c }) => (
                          <div key={l}>
                            <div style={{ fontSize:"0.65rem", color:"var(--text3)", fontFamily:"var(--font-head)" }}>{l}</div>
                            <div style={{ fontSize:"1rem", fontWeight:700, color:c, fontFamily:"var(--font-head)" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {(p.recommendations||[]).slice(0,2).map((r, j) => {
                        const bc = r.type==="danger"?"var(--red)":r.type==="warning"?"var(--orange)":r.type==="success"?"var(--green)":"var(--blue)";
                        return (
                          <div key={j} style={{ fontSize:"0.78rem", color:"var(--text3)", padding:"6px 10px", borderLeft:`2px solid ${bc}`, marginBottom:4, borderRadius:"0 6px 6px 0", background:"rgba(255,255,255,0.01)" }}>
                            <strong style={{ color:bc }}>{r.title}</strong> — {r.detail}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "done" && (
        <div>
          <div className="card" style={{ padding:"2rem", textAlign:"center", marginBottom:"1.5rem", borderLeft:"4px solid var(--green)" }}>
            <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>✅</div>
            <h2 style={{ fontFamily:"var(--font-head)", color:"var(--green)", marginBottom:8 }}>Simulation complete</h2>
            <p style={{ color:"var(--text3)", fontSize:"0.85rem", marginBottom:"1.5rem" }}>
              5-minute run finished · {predictions.length} predictions made · Report ready
            </p>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <button className="btn btn-solar" onClick={() => downloadReport("xlsx")}>
                📊 Download Excel report
              </button>
              <button className="btn btn-outline" onClick={() => setPhase("select")}>
                🔄 Run another scenario
              </button>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
            <div className="card" style={{ padding:"1.5rem" }}>
              <div className="sec-title">📈 Simulation summary</div>
              {/* FIX: Guard the entire summary block so Math.max / reduce never run on empty array */}
              {liveData.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[
                    { label:"Total data points",
                      value: liveData.length },
                    { label:"Avg efficiency",
                      value: `${(liveData.reduce((a,b)=>a+parseFloat(b.Efficiency_pct||0),0)/liveData.length).toFixed(2)}%` },
                    { label:"Peak power",
                      // FIX: was Math.max(...[]) which returns -Infinity on empty array → crash
                      value: `${Math.max(...liveData.map(p=>parseFloat(p.Pmax_W||0))).toFixed(1)}W` },
                    { label:"Avg temperature",
                      value: `${(liveData.reduce((a,b)=>a+parseFloat(b.Temperature_C||0),0)/liveData.length).toFixed(1)}°C` },
                    { label:"ML predictions made",
                      value: predictions.length },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--border2)", fontSize:"0.85rem" }}>
                      <span style={{ color:"var(--text2)" }}>{label}</span>
                      <span style={{ color:"var(--solar)", fontFamily:"var(--font-head)", fontWeight:600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding:"1.5rem" }}>
              <div className="sec-title">🤖 Prediction summary</div>
              {predictions.map((p, i) => {
                const color = STATE_COLORS[p.prediction?.health_state] || "var(--text2)";
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid var(--border2)" }}>
                    <span style={{ color:"var(--text3)", fontSize:"0.8rem" }}>t = {p.elapsed}s</span>
                    <span style={{ color, fontWeight:700, fontFamily:"var(--font-head)" }}>{p.prediction?.health_state}</span>
                    <span style={{ color:"var(--solar)", fontSize:"0.82rem" }}>{p.prediction?.efficiency}%</span>
                    <span style={{ color:"var(--green)", fontSize:"0.82rem" }}>{p.prediction?.confidence}% conf</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}