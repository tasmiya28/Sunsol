import { useEffect, useRef } from "react";

function PredCard({ icon, title, value, sub, color, confidence, delay }) {
  return (
    <div className="card fade-up" style={{ padding:"1.4rem", animationDelay:`${delay}ms` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"0.8rem" }}>
        <div style={{ width:38, height:38, borderRadius:10, background:`${color}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", border:`1px solid ${color}40` }}>{icon}</div>
        <div style={{ fontSize:"0.75rem", color:"var(--text2)", fontWeight:500 }}>{title}</div>
      </div>
      <div style={{ fontSize:"1.7rem", fontWeight:800, color, marginBottom:4, fontFamily:"var(--font-head)" }}>{value}</div>
      <div style={{ fontSize:"0.75rem", color:"var(--text3)", marginBottom:"0.8rem", lineHeight:1.5 }}>{sub}</div>
      {confidence != null && (
        <>
          <div style={{ fontSize:"0.68rem", color:"var(--text3)", marginBottom:4, fontFamily:"var(--font-head)", letterSpacing:"0.08em" }}>CONFIDENCE</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width:`${confidence}%`, background:color }}/>
          </div>
          <div style={{ textAlign:"right", fontSize:"0.72rem", color, marginTop:3, fontFamily:"var(--font-head)" }}>{confidence}%</div>
        </>
      )}
    </div>
  );
}

const STATE_COLORS = {
  Normal:"var(--green)", Dusty:"var(--solar)",
  Overheating:"var(--red)", Shaded:"var(--blue)", Faulty:"var(--red)"
};

function CountdownBar({ nextIn, interval }) {
  const pct = interval > 0 ? Math.min(100, ((interval - nextIn) / interval) * 100) : 0;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.72rem", color:"var(--text3)", marginBottom:4 }}>
        <span>Next prediction in</span>
        <span style={{ color:"var(--solar)", fontFamily:"var(--font-head)" }}>{nextIn}s</span>
      </div>
      <div className="progress-track" style={{ height:4 }}>
        <div className="progress-fill" style={{ width:`${pct}%`, background:"var(--solar)" }}/>
      </div>
    </div>
  );
}

export default function PredictiveInsights({ sensorHook }) {
  const {
    predictions, latestPred, hasData,
    isRunning, elapsed, mlOnline, status,
  } = sensorHook;

  const nextIn  = status?.next_in_seconds ?? 0;
  const latestP = latestPred?.prediction  || {};
  const state   = latestP.health_state    || null;
  const stateColor = STATE_COLORS[state]  || "var(--text2)";

  // ── No data / idle state ──────────────────────────────────
  if (!hasData || predictions.length === 0) {
    return (
      <div>
        <div style={{ marginBottom:"1.5rem" }}>
          <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
            AI / PREDICTIVE <span style={{ color:"var(--solar)" }}>INSIGHTS</span>
          </h1>
          <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>ML predictions every 2 minutes from live Simulink data</p>
        </div>

        <div className="card" style={{ padding:"3rem", textAlign:"center", marginBottom:"1.5rem" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🤖</div>
          <h2 style={{ fontFamily:"var(--font-head)", fontSize:"1.1rem", color:"var(--solar)", marginBottom:12 }}>
            {hasData && isRunning
              ? "WAITING FOR FIRST PREDICTION"
              : !hasData
              ? "START SIMULATION TO VIEW PREDICTIONS"
              : "SIMULATION ENDED — NO PREDICTIONS YET"}
          </h2>
          <p style={{ color:"var(--text3)", fontSize:"0.85rem", maxWidth:440, margin:"0 auto 1.5rem", lineHeight:1.7 }}>
            {hasData && isRunning
              ? "The ML model predicts every 2 minutes. Keep the simulation running — first prediction appears at t=120s."
              : "Start a scenario in Live Analytics and run the MATLAB command. Predictions appear every 2 minutes automatically."}
          </p>
          {hasData && isRunning && (
            <div style={{ maxWidth:300, margin:"0 auto" }}>
              <CountdownBar nextIn={nextIn} interval={120}/>
              <div style={{ fontSize:"0.72rem", color:"var(--text3)", marginTop:8 }}>
                Elapsed: {elapsed}s · Data points: {status?.data_points_count ?? 0}
              </div>
            </div>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem" }}>
          {[
            { label:"RF Accuracy",  value:"97.2%",  color:"var(--green)",  icon:"🎯" },
            { label:"R² Score",     value:"0.9992", color:"var(--cyan)",   icon:"📈" },
            { label:"F1 Score",     value:"0.971",  color:"var(--solar)",  icon:"⚡" },
            { label:"MAE (η)",      value:"0.03%",  color:"var(--green2)", icon:"🔬" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="card fade-up" style={{ padding:"1.2rem", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ fontSize:"1.5rem" }}>{icon}</div>
              <div>
                <div style={{ fontSize:"1.3rem", fontWeight:800, color, fontFamily:"var(--font-head)" }}>{value}</div>
                <div style={{ fontSize:"0.68rem", color:"var(--text3)", fontFamily:"var(--font-head)", letterSpacing:"0.08em" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Predictions available ─────────────────────────────────
  const cards = [
    { icon:"🤖", title:"Health prediction",      value: state || "—",              sub:`Confidence: ${latestP.confidence ?? "—"}%`, color: stateColor,      confidence: Math.round(latestP.confidence ?? 0), delay:50  },
    { icon:"⚡", title:"Predicted efficiency",    value:`${latestP.efficiency ?? "—"}%`, sub:"From regression model",               color:"var(--green)",   confidence: 94,  delay:100 },
    { icon:"🔋", title:"Power output",            value:`${latestP.power_output ?? "—"}W`, sub:"Pmax from IV curve",                color:"var(--cyan)",    confidence: 91,  delay:150 },
    { icon:"📐", title:"Fill factor",             value: latestP.FF ?? "—",         sub:"IV curve quality metric",                  color:"var(--blue)",    confidence: 88,  delay:200 },
  ];

  return (
    <div>
      <div style={{ marginBottom:"1.5rem", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-head)", fontSize:"1.3rem", fontWeight:900, letterSpacing:"0.05em" }}>
            AI / PREDICTIVE <span style={{ color:"var(--solar)" }}>INSIGHTS</span>
          </h1>
          <p style={{ color:"var(--text3)", fontSize:"0.82rem", marginTop:4 }}>
            {predictions.length} prediction{predictions.length !== 1 ? "s" : ""} made · Updates every 2 minutes
          </p>
        </div>
        {isRunning && (
          <div style={{ minWidth:220 }}>
            <CountdownBar nextIn={nextIn} interval={120}/>
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
        {cards.map(c => <PredCard key={c.title} {...c}/>)}
      </div>

      {/* All predictions timeline */}
      <div className="card fade-up" style={{ padding:"1.5rem", marginBottom:"1.5rem" }}>
        <div className="sec-title">📅 Prediction timeline</div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[...predictions].reverse().map((p, i) => {
            const pred  = p.prediction || {};
            const color = STATE_COLORS[pred.health_state] || "var(--text2)";
            return (
              <div key={i} style={{ padding:"14px 16px", borderRadius:10, background:"rgba(255,255,255,0.02)", border:`1px solid ${color}25`, borderLeft:`4px solid ${color}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ color, fontWeight:700, fontFamily:"var(--font-head)", fontSize:"0.95rem" }}>
                      {pred.health_state}
                    </span>
                    <span style={{ fontSize:"0.75rem", color:"var(--solar)", fontFamily:"var(--font-head)" }}>
                      {pred.confidence}% conf
                    </span>
                  </div>
                  <span style={{ fontSize:"0.75rem", color:"var(--text3)" }}>t = {p.elapsed}s</span>
                </div>
                <div style={{ display:"flex", gap:20, flexWrap:"wrap", marginBottom: p.recommendations?.length ? 10 : 0 }}>
                  {[
                    { l:"Efficiency", v:`${pred.efficiency}%`,    c:"var(--green)"  },
                    { l:"Power",      v:`${pred.power_output}W`,  c:"var(--cyan)"   },
                    { l:"Fill Factor",v:`${pred.FF}`,             c:"var(--blue)"   },
                    { l:"Vmp",        v:`${pred.Vmp}V`,           c:"var(--solar2)" },
                  ].map(({ l, v, c }) => (
                    <div key={l}>
                      <div style={{ fontSize:"0.65rem", color:"var(--text3)", fontFamily:"var(--font-head)" }}>{l}</div>
                      <div style={{ fontSize:"0.95rem", fontWeight:700, color:c, fontFamily:"var(--font-head)" }}>{v}</div>
                    </div>
                  ))}
                </div>
                {(p.recommendations || []).slice(0,2).map((r, j) => {
                  const bc = r.type==="danger"?"var(--red)":r.type==="warning"?"var(--orange)":r.type==="success"?"var(--green)":"var(--blue)";
                  return (
                    <div key={j} style={{ fontSize:"0.78rem", color:"var(--text3)", padding:"5px 10px", borderLeft:`2px solid ${bc}`, marginTop:4, borderRadius:"0 6px 6px 0", background:"rgba(255,255,255,0.01)" }}>
                      <strong style={{ color:bc }}>{r.title}</strong> — {r.detail}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Model metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.5rem" }}>
        <div className="card fade-up" style={{ padding:"1.5rem" }}>
          <div className="sec-title">📊 Model performance</div>
          {[
            { label:"RF Classifier accuracy",  value:"97.2%",  color:"var(--green)",  bar:97 },
            { label:"Regression R²",            value:"0.9992", color:"var(--cyan)",   bar:99 },
            { label:"F1 score (macro avg)",     value:"0.971",  color:"var(--solar)",  bar:97 },
            { label:"MAE (efficiency)",         value:"0.03%",  color:"var(--green2)", bar:99 },
          ].map(({ label, value, color, bar }) => (
            <div key={label} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:"0.78rem", color:"var(--text2)" }}>{label}</span>
                <span style={{ fontSize:"0.78rem", color, fontFamily:"var(--font-head)", fontWeight:600 }}>{value}</span>
              </div>
              <div className="progress-track" style={{ height:4 }}>
                <div className="progress-fill" style={{ width:`${bar}%`, background:color }}/>
              </div>
            </div>
          ))}
        </div>

        <div className="card fade-up" style={{ padding:"1.5rem" }}>
          <div className="sec-title">📦 Training dataset</div>
          {[
            { state:"Normal",      count:845,  color:"var(--green)"  },
            { state:"Dusty",       count:1440, color:"var(--solar)"  },
            { state:"Overheating", count:864,  color:"var(--orange)" },
            { state:"Shaded",      count:1171, color:"var(--blue)"   },
            { state:"Faulty",      count:1440, color:"var(--red)"    },
          ].map(({ state:s, count, color }) => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
              <span style={{ fontSize:"0.78rem", color, width:100, flexShrink:0, fontWeight:500 }}>{s}</span>
              <div className="progress-track" style={{ flex:1 }}>
                <div className="progress-fill" style={{ width:`${(count/5760)*100}%`, background:color }}/>
              </div>
              <span style={{ fontSize:"0.72rem", color, fontFamily:"var(--font-head)", width:40, textAlign:"right" }}>{count}</span>
            </div>
          ))}
          <div style={{ marginTop:"0.5rem", fontSize:"0.72rem", color:"var(--text3)", fontFamily:"var(--font-head)" }}>
            Total: 5760 rows · 11 features · MATLAB Simulink generated
          </div>
        </div>
      </div>
    </div>
  );
}