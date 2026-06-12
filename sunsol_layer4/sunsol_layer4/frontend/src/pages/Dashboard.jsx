import { useState, useEffect } from "react";
import ParticleBackground from "../components/ParticleBackground";
import { useTheme } from "../context/ThemeContext";
import Overview           from "./sections/Overview";
import LiveAnalytics      from "./sections/SimulationPage";
import MaintenanceReports from "./sections/MaintenanceReports";
import PredictiveInsights from "./sections/PredictiveInsights";
import { useSensorData }  from "../hooks/useSensorData";

const NAV = [
  { id:"overview",    icon:"⚡", label:"Overview"       },
  { id:"analytics",   icon:"📊", label:"Live Analytics" },
  { id:"maintenance", icon:"🔧", label:"Maintenance"    },
  { id:"insights",    icon:"🤖", label:"AI Insights"    },
];

function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <span style={{ fontFamily:"var(--font-head)", fontSize:"0.75rem", color:"var(--text2)", letterSpacing:"0.06em" }}>
      {t.toLocaleTimeString()}
    </span>
  );
}

export default function Dashboard({ user, onLogout }) {
  const [active,   setActive]   = useState("overview");
  const [sideOpen, setSideOpen] = useState(true);
  const { isDark, toggle }      = useTheme();

  // Single hook instance — shared across ALL pages
  const sensorHook = useSensorData();
  const { mlOnline, isRunning, hasData, elapsed,
          progressPct, scenarioName, reportReady,
          downloadReport, stopScenario, status } = sensorHook;

  const initials = user.name?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";
  const eff = status?.live_snapshot?.Efficiency_pct
           ?? status?.latest_prediction?.prediction?.efficiency
           ?? null;

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
      <ParticleBackground/>
      <div className="solar-bg"/>
      <div className="orb orb-1"/><div className="orb orb-2"/>

      {/* ── Sidebar ── */}
      <aside style={{ width:sideOpen?240:68, transition:"width 0.3s ease", background:"var(--sidebar-bg)", backdropFilter:"blur(20px)", borderRight:"1px solid var(--border2)", display:"flex", flexDirection:"column", position:"relative", zIndex:10, flexShrink:0 }}>

        <div style={{ padding:"1.4rem 1rem 1rem", borderBottom:"1px solid var(--border2)", display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background:"linear-gradient(135deg,#f59e0b,#f97316)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.2rem", boxShadow:"0 0 20px rgba(245,158,11,0.35)" }}>☀</div>
          {sideOpen && (
            <div>
              <div style={{ fontFamily:"var(--font-head)", fontWeight:900, fontSize:"1rem", letterSpacing:"0.05em" }}>SUN<span style={{ color:"var(--solar)" }}>SOL</span></div>
              <div style={{ fontSize:"0.6rem", color:"var(--text3)", fontFamily:"var(--font-head)", letterSpacing:"0.08em" }}>SOLAR AI v1.0</div>
            </div>
          )}
        </div>

        <nav style={{ flex:1, padding:"1rem 0.6rem", display:"flex", flexDirection:"column", gap:4 }}>
          {NAV.map(n => {
            const isActive = active === n.id;
            return (
              <button key={n.id} onClick={() => setActive(n.id)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:sideOpen?"10px 14px":"10px", justifyContent:sideOpen?"flex-start":"center", border:"none", cursor:"pointer", borderRadius:10, background:isActive?"rgba(245,158,11,0.15)":"transparent", borderLeft:isActive?"3px solid var(--solar)":"3px solid transparent", color:isActive?"var(--solar)":"var(--text2)", fontFamily:"var(--font-body)", fontSize:"0.88rem", fontWeight:isActive?600:400, transition:"all 0.2s", whiteSpace:"nowrap", overflow:"hidden" }}>
                <span style={{ fontSize:"1rem", flexShrink:0 }}>{n.icon}</span>
                {sideOpen && <span>{n.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Simulation status in sidebar */}
        {sideOpen && (
          <div style={{ padding:"0.8rem 1rem", borderTop:"1px solid var(--border2)" }}>
            <div style={{ fontSize:"0.65rem", fontFamily:"var(--font-head)", letterSpacing:"0.1em", color:"var(--text3)", marginBottom:6 }}>SIMULATION</div>
            {hasData ? (
              <>
                <div style={{ fontSize:"0.75rem", color: isRunning?"var(--green2)":"var(--text3)", marginBottom:4 }}>
                  {isRunning ? `● Running — ${elapsed}s` : "● Stopped"}
                </div>
                {isRunning && (
                  <div className="progress-track" style={{ marginBottom:4 }}>
                    <div className="progress-fill" style={{ width:`${progressPct}%`, background:"var(--solar)" }}/>
                  </div>
                )}
                {scenarioName && <div style={{ fontSize:"0.68rem", color:"var(--text3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{scenarioName}</div>}
                {isRunning && (
                  <button className="btn btn-ghost" style={{ width:"100%", marginTop:8, padding:"4px 0", fontSize:"0.72rem" }}
                    onClick={stopScenario}>
                    ■ Stop simulation
                  </button>
                )}
                {reportReady && (
                  <button className="btn btn-solar" style={{ width:"100%", marginTop:8, padding:"6px 0", fontSize:"0.72rem" }}
                    onClick={downloadReport}>
                    ↓ Download report
                  </button>
                )}
              </>
            ) : (
              <div style={{ fontSize:"0.72rem", color:"var(--text3)" }}>
                No active simulation
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:8, fontSize:"0.68rem", color: mlOnline?"var(--green2)":"var(--text3)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background: mlOnline?"var(--green)":"var(--text3)", display:"inline-block" }}/>
              {mlOnline ? "Flask online" : "Flask offline"}
            </div>
          </div>
        )}

        <button onClick={() => setSideOpen(v => !v)}
          style={{ position:"absolute", top:16, right:-12, width:24, height:24, borderRadius:"50%", background:"var(--card2)", border:"1px solid var(--border2)", cursor:"pointer", color:"var(--text2)", fontSize:"0.7rem", display:"flex", alignItems:"center", justifyContent:"center", zIndex:20 }}>
          {sideOpen ? "◀" : "▶"}
        </button>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative", zIndex:1 }}>

        {/* Header */}
        <header style={{ height:60, borderBottom:"1px solid var(--border2)", background:"var(--header-bg)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.5rem", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontFamily:"var(--font-head)", fontSize:"0.72rem", letterSpacing:"0.12em", color:"var(--text3)" }}>
              {NAV.find(n => n.id === active)?.icon} {NAV.find(n => n.id === active)?.label.toUpperCase()}
            </div>
            {isRunning && (
              <div className="badge badge-solar" style={{ gap:5 }}>
                <span className="live-dot"/> LIVE
              </div>
            )}
            {reportReady && !isRunning && (
              <div className="badge badge-green">✓ REPORT READY</div>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <Clock/>
            <div className="theme-toggle-wrap" onClick={toggle}>
              <span style={{ fontSize:"0.8rem" }}>{isDark?"🌙":"☀️"}</span>
              <div className="theme-slider"/>
              <span style={{ fontSize:"0.65rem", fontFamily:"var(--font-head)", letterSpacing:"0.06em" }}>{isDark?"DARK":"LIGHT"}</span>
            </div>
            {eff != null && (
              <div className="badge badge-green">⚡ {parseFloat(eff).toFixed(1)}% Efficient</div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width:32, height:32, borderRadius:"50%", border:"2px solid var(--solar)" }}/>
                : <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,var(--solar),var(--orange))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.78rem", fontWeight:700, color:"#000" }}>{initials}</div>
              }
              {sideOpen && <span style={{ fontSize:"0.82rem", color:"var(--text2)" }}>{user.name}</span>}
            </div>
            <button className="btn btn-ghost" style={{ padding:"6px 12px", fontSize:"0.78rem" }} onClick={onLogout}>Sign Out</button>
          </div>
        </header>

        {/* Content — pass sensorHook to every page */}
        <main style={{ flex:1, overflowY:"auto", padding:"1.5rem" }}>
          {active === "overview"    && <Overview           sensorHook={sensorHook}/>}
          {active === "analytics"   && <LiveAnalytics      sensorHook={sensorHook}/>}
          {active === "maintenance" && <MaintenanceReports sensorHook={sensorHook}/>}
          {active === "insights"    && <PredictiveInsights sensorHook={sensorHook}/>}
        </main>

        <footer style={{ height:36, borderTop:"1px solid var(--border2)", background:"var(--header-bg)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 1.5rem", flexShrink:0 }}>
          <span style={{ fontSize:"0.65rem", color:"var(--text3)", fontFamily:"var(--font-head)", letterSpacing:"0.06em" }}>SUNSOL v1.0 · RIT RAJARAMNAGAR · DEPT. OF IT · A.Y. 2025–26</span>
          <span style={{ fontSize:"0.65rem", color:"var(--text3)", fontFamily:"var(--font-head)" }}>
            Made with ♥ by <span style={{ color:"var(--solar)" }}>Team SunSol</span> · Abdulwahid · Tasmiya · Anushka · Pooja
          </span>
        </footer>
      </div>
    </div>
  );
}