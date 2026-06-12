import { useEffect, useRef, useState } from "react";

const API = "http://localhost:5000";

const SCENARIOS = [
  { name:"Normal operation",  G:1000, T:25,  D:0.0,  theta:35, icon:"🌞", desc:"Ideal conditions — full sun, clean panel, optimal tilt" },
  { name:"Dusty conditions",  G:900,  T:30,  D:0.65, theta:35, icon:"🌫", desc:"High dust accumulation reducing effective irradiance" },
  { name:"Overheating",       G:1000, T:72,  D:0.0,  theta:35, icon:"🌡", desc:"Cell temperature above 60°C — efficiency drop expected" },
  { name:"Partially shaded",  G:220,  T:22,  D:0.0,  theta:35, icon:"🌥", desc:"Low irradiance — shade or heavy cloud cover" },
  { name:"Faulty panel",      G:180,  T:25,  D:0.82, theta:62, icon:"⚠️", desc:"Extreme dust + low irradiance + bad tilt — faulty state" },
  { name:"Custom",            G:800,  T:35,  D:0.2,  theta:40, icon:"🎛", desc:"Define your own environmental conditions" },
];

const STATE_COLORS = {
  Normal:"var(--green)", Dusty:"var(--solar)",
  Overheating:"var(--red)", Shaded:"var(--blue)", Faulty:"var(--red)"
};

function CanvasChart({ points, field, color, label, unit = "" }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current; if (!c || !points.length) return;
    const ctx = c.getContext("2d");
    const W = c.width = c.offsetWidth; const H = c.height = 130;
    ctx.clearRect(0, 0, W, H);
    const vals = points.map(p => parseFloat(p[field]) || 0).filter(v => isFinite(v));
    if (vals.length < 2) return;
    const mn = Math.min(...vals), mx = Math.max(...vals) || 1;
    const rng = (mx - mn) || 1;
    const px = i => (i / (vals.length - 1)) * W;
    const py = v => H - 8 - ((v - mn) / rng) * (H - 16);
    ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = 8 + (i / 3) * (H - 16);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, color + "30"); g.addColorStop(1, color + "00");
    ctx.beginPath(); ctx.moveTo(px(0), H);
    vals.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(vals.length - 1), H); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    vals.forEach((v, i) => i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v)));
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = "round"; ctx.stroke();
    const lx = px(vals.length - 1), ly = py(vals[vals.length - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = "#475569"; ctx.font = "9px DM Sans";
    ctx.fillText(mx.toFixed(1) + unit, 3, 12);
    ctx.fillText(mn.toFixed(1) + unit, 3, H - 2);
  }, [points, field, color]);
  return (
    <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:10, padding:"1rem", border:"1px solid var(--border2)" }}>
      <div style={{ fontSize:"0.65rem", fontFamily:"var(--font-head)", letterSpacing:"0.1em", color:"var(--text3)", marginBottom:8 }}>{label}</div>
      <canvas ref={ref} style={{ width:"100%", height:130, display:"block" }}/>
    </div>
  );
}

export default function LiveAnalytics({ sensorHook }) {
  const {
    livePoints, predictions, isRunning, hasData,
    elapsed, progressPct, scenarioName, reportReady, reportError,
    downloadReport, stopScenario, startScenario, mlOnline,
    latestPoint, latestPred, status, refresh,
  } = sensorHook || {};

  const [phase,    setPhase]    = useState("select");
  const [selected, setSelected] = useState(SCENARIOS[0]);
  const [custom,   setCustom]   = useState({ G:800, T:35, D:0.2, theta:40 });
  const [matlabCmd,setMatlabCmd]= useState("");
  const [copied,   setCopied]   = useState(false);
  const [stopping, setStopping] = useState(false);
  const [dots,     setDots]     = useState(1);

  // Animate dots while report is generating
  useEffect(() => {
    if (phase === "done" && !reportReady) {
      const t = setInterval(() => setDots(d => (d % 3) + 1), 600);
      return () => clearInterval(t);
    }
  }, [phase, reportReady]);

  // Sync phase with backend state
  useEffect(() => {
    if (isRunning)                   setPhase("running");
    else if (reportReady && hasData) setPhase("done");
    else if (hasData && !isRunning)  setPhase("done");
  }, [isRunning, reportReady, hasData]);

  function buildCmd(sc) {
    const G = sc.name === "Custom" ? custom.G     : sc.G;
    const T = sc.name === "Custom" ? custom.T     : sc.T;
    const D = sc.name === "Custom" ? custom.D     : sc.D;
    const θ = sc.name === "Custom" ? custom.theta : sc.theta;
    return `run_scenario('${sc.name}', ${G}, ${T}, ${D}, ${θ})`;
  }

  function handlePrepare() {
    const cmd = buildCmd(selected);
    setMatlabCmd(cmd);
    setPhase("ready");
  }

  function handleCopy() {
    navigator.clipboard.writeText(matlabCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleStop() {
    setStopping(true);
    await stopScenario();
    setStopping(false);
    await refresh();
  }

  function handleNewScenario() {
    setPhase("select");
    setSelected(SCENARIOS[0]);
    setMatlabCmd("");
  }

  const DURATION = 300;

  // ══════════════════════════════════════════════════════════
  //  PHASE: SELECT
  // ══════════════════════════════════════════════════════════
  if (phase === "select") return (
    <div>
      <div style={{ marginBottom:"1.5rem" }}>
        <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
          LIVE <span style={{ color:"var(--solar)" }}>ANALYTICS</span>
        </h1>
        <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>
          Select a scenario → MATLAB generates live Simulink data for 5 minutes
        </p>
      </div>

      {!mlOnline && (
        <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"14px 18px", color:"#f87171", fontSize:"0.85rem", marginBottom:"1.5rem" }}>
          ⚠ Flask backend is offline. Run: <code style={{ background:"rgba(0,0,0,0.2)", padding:"2px 8px", borderRadius:4 }}>python app.py</code>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"380px 1fr", gap:"1.5rem" }}>

        {/* Scenario picker */}
        <div>
          <div className="card" style={{ padding:"1.5rem", marginBottom:"1rem" }}>
            <div className="sec-title">Choose scenario</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:"1.5rem" }}>
              {SCENARIOS.map(sc => (
                <button key={sc.name} onClick={() => setSelected(sc)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:10, border:"none", cursor:"pointer", background:selected.name===sc.name?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.03)", borderLeft:selected.name===sc.name?"3px solid var(--solar)":"3px solid transparent", color:"var(--text)", fontFamily:"var(--font-body)", textAlign:"left", transition:"all 0.2s" }}>
                  <span style={{ fontSize:"1.1rem", flexShrink:0 }}>{sc.icon}</span>
                  <div>
                    <div style={{ fontSize:"0.88rem", fontWeight:selected.name===sc.name?600:400, color:selected.name===sc.name?"var(--solar)":"var(--text)" }}>{sc.name}</div>
                    {sc.name !== "Custom" && (
                      <div style={{ fontSize:"0.7rem", color:"var(--text3)", marginTop:2 }}>
                        G={sc.G} · T={sc.T}°C · D={sc.D} · θ={sc.theta}°
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {selected.name === "Custom" && (
              <div style={{ padding:"1rem", background:"rgba(245,158,11,0.04)", borderRadius:10, border:"1px solid var(--border)", marginBottom:"1.5rem" }}>
                {[
                  { key:"G",     label:"Irradiance", unit:"W/m²", min:100, max:1200, step:10  },
                  { key:"T",     label:"Temperature", unit:"°C",   min:10,  max:80,  step:1   },
                  { key:"D",     label:"Dust factor",  unit:"",    min:0,   max:0.9, step:0.05 },
                  { key:"theta", label:"Tilt angle",   unit:"°",   min:0,   max:75,  step:1   },
                ].map(s => (
                  <div key={s.key} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:13, color:"var(--text2)" }}>{s.label}</span>
                      <span style={{ fontSize:13, color:"var(--solar)", fontFamily:"var(--font-head)", fontWeight:600 }}>
                        {Number(custom[s.key]).toFixed(s.step<1?2:0)}{s.unit}
                      </span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step}
                      value={custom[s.key]}
                      onChange={e => setCustom(v => ({...v, [s.key]:parseFloat(e.target.value)}))}
                      style={{ width:"100%", accentColor:"var(--solar)" }}/>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-solar" style={{ width:"100%" }}
              onClick={handlePrepare} disabled={!mlOnline}>
              {mlOnline ? `⚡ Prepare — ${selected.name}` : "⚠ Flask offline"}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="card" style={{ padding:"1.5rem" }}>
          <div className="sec-title">How real-time simulation works</div>
          {[
            { step:"1", icon:"🎯", title:"Select scenario",          detail:"Choose environmental conditions. These define what Simulink will simulate — irradiance, temperature, dust, and tilt." },
            { step:"2", icon:"📋", title:"Copy MATLAB command",      detail:"A run_scenario() command is generated for your selected parameters. Copy and paste it into MATLAB." },
            { step:"3", icon:"⚙",  title:"MATLAB runs Simulink",     detail:"run_scenario.m drives the single-diode model for exactly 5 minutes, sending physics-based data to Flask every 5 seconds." },
            { step:"4", icon:"📡", title:"Flask buffers live data",  detail:"Every 5-second data point is stored. The dashboard polls /live-data and /status every 3 seconds to update charts." },
            { step:"5", icon:"🤖", title:"ML predicts every 2 min",  detail:"At t=120s, t=240s, and t=300s the Random Forest classifier and regressor run on the latest Simulink output." },
            { step:"6", icon:"📄", title:"Report after 5 minutes",   detail:"After 300s the report button appears. Download an Excel file with all data points, predictions, and performance insights." },
          ].map(({ step, icon, title, detail }) => (
            <div key={step} style={{ display:"flex", gap:14, marginBottom:16 }}>
              <div style={{ width:30, height:30, borderRadius:8, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.85rem", flexShrink:0, marginTop:1 }}>{icon}</div>
              <div>
                <div style={{ fontSize:"0.88rem", fontWeight:600, color:"var(--text)", marginBottom:2 }}>{title}</div>
                <div style={{ fontSize:"0.78rem", color:"var(--text3)", lineHeight:1.55 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  //  PHASE: READY (show MATLAB command)
  // ══════════════════════════════════════════════════════════
  if (phase === "ready") return (
    <div>
      <div style={{ marginBottom:"1.5rem" }}>
        <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
          LIVE <span style={{ color:"var(--solar)" }}>ANALYTICS</span>
        </h1>
      </div>
      <div style={{ maxWidth:640, margin:"0 auto" }}>
        <div className="card" style={{ padding:"2rem", textAlign:"center", marginBottom:"1rem" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>{selected.icon}</div>
          <h2 style={{ fontFamily:"var(--font-head)", fontSize:"1.1rem", color:"var(--solar)", marginBottom:8 }}>
            Ready: {selected.name}
          </h2>
          <p style={{ color:"var(--text3)", fontSize:"0.83rem", marginBottom:"1.5rem", lineHeight:1.6 }}>
            {selected.desc}<br/>
            Copy the command below and paste it into MATLAB Command Window.
          </p>

          <div style={{ background:"rgba(0,0,0,0.35)", borderRadius:10, padding:"1rem 1.4rem", fontFamily:"var(--font-head)", fontSize:"0.82rem", color:"var(--solar2)", marginBottom:"1.5rem", textAlign:"left", border:"1px solid var(--border)", wordBreak:"break-all", letterSpacing:"0.03em" }}>
            {matlabCmd}
          </div>

          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button className="btn btn-solar" onClick={handleCopy}>
              {copied ? "✓ Copied!" : "📋 Copy command"}
            </button>
            <button className="btn btn-ghost" onClick={() => setPhase("running")}>
              ▶ Started in MATLAB — show dashboard
            </button>
          </div>
        </div>

        <button className="btn btn-ghost" style={{ width:"100%" }}
          onClick={() => setPhase("select")}>
          ← Change scenario
        </button>

        <div style={{ marginTop:"1rem", padding:"14px", background:"rgba(245,158,11,0.05)", borderRadius:10, border:"1px solid var(--border)", fontSize:"0.8rem", color:"var(--text3)", lineHeight:1.6 }}>
          <strong style={{ color:"var(--solar)" }}>Make sure:</strong> Flask is running at localhost:5000 &nbsp;·&nbsp;
          run_scenario.m is in your MATLAB path &nbsp;·&nbsp;
          SunSol_mathBlock.slx is open or accessible
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  //  PHASE: RUNNING
  // ══════════════════════════════════════════════════════════
  if (phase === "running") return (
    <div>
      <div style={{ marginBottom:"1.5rem", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
            LIVE <span style={{ color:"var(--solar)" }}>ANALYTICS</span>
          </h1>
          <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>
            Scenario: <strong style={{ color:"var(--solar)" }}>{scenarioName || selected.name}</strong> · Simulink generating data
          </p>
        </div>
        <button className="btn" style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", color:"#f87171", padding:"8px 18px", fontSize:"0.85rem" }}
          onClick={handleStop} disabled={stopping}>
          {stopping ? "⏳ Stopping..." : "■ Stop simulation"}
        </button>
      </div>

      {/* Progress bar */}
      <div className="card" style={{ padding:"1rem 1.5rem", marginBottom:"1.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.75rem", color:"var(--text3)", marginBottom:6 }}>
          <span>Simulation progress</span>
          <span style={{ color:"var(--solar)", fontFamily:"var(--font-head)" }}>
            {elapsed}s / {DURATION}s · {(progressPct||0).toFixed(0)}%
          </span>
        </div>
        <div className="progress-track" style={{ height:8 }}>
          <div className="progress-fill" style={{ width:`${progressPct||0}%`, background:"linear-gradient(90deg,var(--solar),var(--orange))" }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.65rem", color:"var(--text3)", marginTop:6 }}>
          <span>Start (t=0)</span>
          <span style={{ color: elapsed >= 120 ? "var(--green2)" : "var(--text3)" }}>① Prediction (2 min)</span>
          <span style={{ color: elapsed >= 240 ? "var(--green2)" : "var(--text3)" }}>② Prediction (4 min)</span>
          <span style={{ color: elapsed >= 300 ? "var(--green2)" : "var(--text3)" }}>③ Report (5 min)</span>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem", marginBottom:"1.5rem" }}>
        {[
          { label:"Data points",   value: status?.data_points_count ?? livePoints.length, color:"var(--green)"  },
          { label:"Predictions",   value: `${predictions.length} / 3`,                    color:"var(--solar)"  },
          { label:"Elapsed",       value: `${elapsed}s`,                                  color:"var(--cyan)"   },
          { label:"ML Status",     value: latestPred?.prediction?.health_state || "Waiting...", color: STATE_COLORS[latestPred?.prediction?.health_state] || "var(--text3)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card fade-up" style={{ padding:"1.2rem" }}>
            <div className="sec-title">{label}</div>
            <div style={{ fontSize:"1.4rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {livePoints.length > 1 ? (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.5rem" }}>
          <CanvasChart points={livePoints} field="Efficiency_pct" color="#10b981" label="EFFICIENCY (%)"    unit="%"/>
          <CanvasChart points={livePoints} field="Pmax_W"         color="#f59e0b" label="POWER OUTPUT (W)"  unit="W"/>
          <CanvasChart points={livePoints} field="Temperature_C"  color="#f97316" label="TEMPERATURE (°C)"  unit="°C"/>
          <CanvasChart points={livePoints} field="Irradiance_Wm2" color="#06b6d4" label="IRRADIANCE (W/m²)" unit=""/>
        </div>
      ) : (
        <div className="card" style={{ padding:"2rem", textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ color:"var(--text3)", fontSize:"0.85rem" }}>
            ⏳ Waiting for first data point from Simulink...
          </div>
          <div style={{ fontSize:"0.75rem", color:"var(--text3)", marginTop:8 }}>
            Make sure run_scenario.m is running in MATLAB
          </div>
        </div>
      )}

      {/* Latest point */}
      {latestPoint && (
        <div className="card" style={{ padding:"1.5rem", marginBottom:"1.5rem" }}>
          <div className="sec-title">📡 Latest Simulink data point</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10 }}>
            {[
              { l:"Vmp",    v:`${parseFloat(latestPoint.Vmp_V||0).toFixed(2)}V`,  c:"var(--solar)"  },
              { l:"Imp",    v:`${parseFloat(latestPoint.Imp_A||0).toFixed(3)}A`,  c:"var(--cyan)"   },
              { l:"Pmax",   v:`${parseFloat(latestPoint.Pmax_W||0).toFixed(1)}W`, c:"var(--green)"  },
              { l:"Voc",    v:`${parseFloat(latestPoint.Voc_V||0).toFixed(2)}V`,  c:"var(--solar2)" },
              { l:"Isc",    v:`${parseFloat(latestPoint.Isc_A||0).toFixed(3)}A`,  c:"var(--blue)"   },
              { l:"FF",     v:`${parseFloat(latestPoint.FF||0).toFixed(4)}`,      c:"var(--text2)"  },
              { l:"η",      v:`${parseFloat(latestPoint.Efficiency_pct||0).toFixed(2)}%`, c:"var(--green)" },
              { l:"G",      v:`${parseFloat(latestPoint.Irradiance_Wm2||0).toFixed(0)} W/m²`, c:"var(--solar)" },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background:"rgba(255,255,255,0.02)", borderRadius:8, padding:"10px 12px", border:"1px solid var(--border2)" }}>
                <div style={{ fontSize:"0.65rem", fontFamily:"var(--font-head)", color:"var(--text3)", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:"1rem", fontWeight:800, color:c, fontFamily:"var(--font-head)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictions so far */}
      {predictions.length > 0 && (
        <div className="card" style={{ padding:"1.5rem" }}>
          <div className="sec-title">🤖 ML Predictions so far</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {predictions.map((p, i) => {
              const pred  = p.prediction || {};
              const color = STATE_COLORS[pred.health_state] || "var(--text2)";
              return (
                <div key={i} style={{ padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.02)", borderLeft:`4px solid ${color}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ color, fontWeight:700, fontFamily:"var(--font-head)" }}>
                      Prediction {i+1} — {pred.health_state}
                    </span>
                    <span style={{ fontSize:"0.75rem", color:"var(--text3)" }}>t = {p.elapsed}s</span>
                  </div>
                  <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                    {[["Confidence",`${pred.confidence}%`,"var(--solar)"],["Efficiency",`${pred.efficiency}%`,"var(--green)"],["Power",`${pred.power_output}W`,"var(--cyan)"]].map(([l,v,c]) => (
                      <div key={l}>
                        <div style={{ fontSize:"0.65rem", color:"var(--text3)", fontFamily:"var(--font-head)" }}>{l}</div>
                        <div style={{ fontSize:"0.95rem", fontWeight:700, color:c, fontFamily:"var(--font-head)" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════
  //  PHASE: DONE — report + next simulation
  // ══════════════════════════════════════════════════════════
  if (phase === "done") return (
    <div>
      <div style={{ marginBottom:"1.5rem" }}>
        <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
          LIVE <span style={{ color:"var(--solar)" }}>ANALYTICS</span>
        </h1>
        <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>
          Simulation complete — {scenarioName || selected.name}
        </p>
      </div>

      {/* Completion banner */}
      <div style={{ background:"rgba(16,185,129,0.08)", border:"2px solid rgba(16,185,129,0.35)", borderRadius:14, padding:"2rem", textAlign:"center", marginBottom:"1.5rem" }}>
        <div style={{ fontSize:"3rem", marginBottom:"0.8rem" }}>✅</div>
        <h2 style={{ fontFamily:"var(--font-head)", fontSize:"1.2rem", color:"var(--green)", marginBottom:10 }}>
          5-MINUTE SIMULATION COMPLETE
        </h2>
        <p style={{ color:"var(--text3)", fontSize:"0.85rem", marginBottom:"1.8rem", lineHeight:1.6 }}>
          Scenario: <strong style={{ color:"var(--text)" }}>{scenarioName || selected.name}</strong> ·{" "}
          {status?.data_points_count ?? livePoints.length} data points collected ·{" "}
          {predictions.length} ML prediction{predictions.length !== 1 ? "s" : ""} made
        </p>

        {/* Action buttons */}
        <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
          {reportReady ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
                <button className="btn btn-solar"
                  style={{ fontSize:"1rem", padding:"14px 32px", boxShadow:"0 0 30px rgba(245,158,11,0.35)" }}
                  onClick={() => downloadReport("pdf")}>
                  📄 Download PDF Report
                </button>
                <button className="btn btn-outline"
                  style={{ fontSize:"0.9rem", padding:"12px 24px" }}
                  onClick={() => downloadReport("xlsx")}>
                  📊 Download Excel Report
                </button>
              </div>
              <div style={{ fontSize:"0.75rem", color:"var(--green2)", marginTop:2 }}>
                ✓ PDF includes: cover page · scenario params · graphs · predictions · recommendations · full readings table
              </div>
            </div>
          ) : reportError ? (
            <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"12px 20px", color:"#f87171", fontSize:"0.82rem", maxWidth:460, textAlign:"left" }}>
              <strong>Report generation failed:</strong><br/>
              {reportError}<br/>
              <span style={{ color:"var(--text3)", fontSize:"0.75rem" }}>Check Flask console for details. Make sure reportlab is installed: pip install reportlab</span>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
              <button className="btn" disabled
                style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.3)", color:"var(--solar)", fontSize:"0.9rem", padding:"12px 28px", cursor:"not-allowed" }}>
                ⏳ Generating report{"·".repeat(dots)}
              </button>
              <span style={{ fontSize:"0.72rem", color:"var(--text3)" }}>
                Building PDF + Excel — this takes a few seconds
              </span>
            </div>
          )}

          <button className="btn btn-outline" style={{ fontSize:"0.95rem", padding:"12px 28px" }}
            onClick={handleNewScenario}>
            🔄 Start New Simulation
          </button>
        </div>

        {reportReady && (
          <div style={{ marginTop:"1rem", fontSize:"0.75rem", color:"var(--green2)" }}>
            ✓ Report ready · Includes: Summary · {status?.data_points_count ?? livePoints.length} data points · {predictions.length} predictions
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
        {[
          { label:"Duration",       value:`${elapsed}s`,                                                                    color:"var(--cyan)"   },
          { label:"Data points",    value: status?.data_points_count ?? livePoints.length,                                   color:"var(--green)"  },
          { label:"Predictions",    value: predictions.length,                                                               color:"var(--solar)"  },
          { label:"Avg efficiency", value: livePoints.length ? `${(livePoints.reduce((a,b)=>a+parseFloat(b.Efficiency_pct||0),0)/livePoints.length).toFixed(1)}%` : "—", color:"var(--green)" },
          { label:"Peak power",     value: livePoints.length ? `${Math.max(...livePoints.map(p=>parseFloat(p.Pmax_W||0))).toFixed(1)}W` : "—",    color:"var(--solar)"  },
          { label:"Final state",    value: predictions.length ? predictions[predictions.length-1]?.prediction?.health_state || "—" : "—",          color: STATE_COLORS[predictions[predictions.length-1]?.prediction?.health_state] || "var(--text2)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card fade-up" style={{ padding:"1.2rem" }}>
            <div className="sec-title">{label}</div>
            <div style={{ fontSize:"1.4rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts — historical view */}
      {livePoints.length > 1 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.5rem" }}>
          <CanvasChart points={livePoints} field="Efficiency_pct" color="#10b981" label="EFFICIENCY — FULL RUN (%)"    unit="%"/>
          <CanvasChart points={livePoints} field="Pmax_W"         color="#f59e0b" label="POWER OUTPUT — FULL RUN (W)"  unit="W"/>
          <CanvasChart points={livePoints} field="Temperature_C"  color="#f97316" label="TEMPERATURE — FULL RUN (°C)"  unit="°C"/>
          <CanvasChart points={livePoints} field="Irradiance_Wm2" color="#06b6d4" label="IRRADIANCE — FULL RUN (W/m²)" unit=""/>
        </div>
      )}

      {/* Prediction summary table */}
      {predictions.length > 0 && (
        <div className="card" style={{ padding:"1.5rem", marginBottom:"1.5rem" }}>
          <div className="sec-title">🤖 Prediction summary</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border2)" }}>
                  {["#","Time (s)","Health State","Confidence","Efficiency","Power","Key Recommendation"].map(h => (
                    <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontFamily:"var(--font-head)", fontSize:"0.6rem", letterSpacing:"0.1em", color:"var(--text3)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {predictions.map((p, i) => {
                  const pred  = p.prediction || {};
                  const color = STATE_COLORS[pred.health_state] || "var(--text2)";
                  const rec   = p.recommendations?.[0]?.title || "—";
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid var(--border2)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding:"10px 12px", color:"var(--text3)" }}>{i+1}</td>
                      <td style={{ padding:"10px 12px", color:"var(--text3)", fontFamily:"var(--font-head)" }}>{p.elapsed}s</td>
                      <td style={{ padding:"10px 12px" }}><span style={{ color, fontWeight:700 }}>{pred.health_state}</span></td>
                      <td style={{ padding:"10px 12px", color:"var(--solar)", fontFamily:"var(--font-head)" }}>{pred.confidence}%</td>
                      <td style={{ padding:"10px 12px", color:"var(--green)",  fontFamily:"var(--font-head)" }}>{pred.efficiency}%</td>
                      <td style={{ padding:"10px 12px", color:"var(--cyan)",   fontFamily:"var(--font-head)" }}>{pred.power_output}W</td>
                      <td style={{ padding:"10px 12px", color:"var(--text2)", fontSize:"0.78rem" }}>{rec}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Second "Start New Simulation" button at bottom */}
      <div style={{ textAlign:"center", padding:"1.5rem 0" }}>
        <button className="btn btn-solar" style={{ fontSize:"1rem", padding:"14px 40px" }}
          onClick={handleNewScenario}>
          🔄 Start New Simulation
        </button>
        <div style={{ fontSize:"0.75rem", color:"var(--text3)", marginTop:10 }}>
          Previous data will be cleared when new scenario starts
        </div>
      </div>
    </div>
  );

  return null;
}