import { useState } from "react";

const MOCK_ALERTS = [
  { id: 1, type: "dust", sev: "warn", msg: "Moderate dust accumulation detected", time: "2 min ago", resolved: false },
  { id: 2, type: "tilt", sev: "warn", msg: "Panel tilt angle 5° above optimal", time: "18 min ago", resolved: false },
  { id: 3, type: "temp", sev: "info", msg: "Temperature within normal range", time: "1 hr ago", resolved: true },
  { id: 4, type: "voltage", sev: "ok", msg: "Voltage output stable at 26.5V", time: "2 hr ago", resolved: true },
  { id: 5, type: "dust", sev: "danger", msg: "Heavy dust — immediate cleaning required", time: "Yesterday", resolved: true },
];

const MOCK_LOGS = [
  { id: 1, action: "Panel cleaned", by: "Abdulwahid Shaikh", time: "2026-03-01 10:30", notes: "Full surface wipe, efficiency improved by 12%" },
  { id: 2, action: "Tilt angle adjusted", by: "Tasmiya Pathan", time: "2026-02-28 14:15", notes: "Adjusted from 18° to 22° for February" },
  { id: 3, action: "Sensor calibration", by: "Anushka Bamane", time: "2026-02-25 09:00", notes: "BH1750 and DHT22 recalibrated" },
  { id: 4, action: "System inspection", by: "Pooja Hankare", time: "2026-02-20 11:45", notes: "All connections verified, no faults found" },
];

const sevStyle = {
  danger: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: "#f87171", dot: "var(--red)" },
  warn: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)", color: "#fb923c", dot: "var(--orange)" },
  ok: { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)", color: "var(--green2)", dot: "var(--green)" },
  info: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", color: "#60a5fa", dot: "var(--blue)" },
};

export default function MaintenanceReports({ sensorHook }) {
  const data = sensorHook?.latestPoint || {};
  const lastRecs = sensorHook?.latestPred?.recommendations || [];
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [logs, setLogs] = useState(MOCK_LOGS);
  const [note, setNote] = useState("");
  const [action, setAction] = useState("Panel cleaned");
  const [showAdd, setShowAdd] = useState(false);

  const active = alerts.filter(a => !a.resolved);
  const resolved = alerts.filter(a => a.resolved);

  const realAlerts = [];
  if (data?.dust > 150) realAlerts.push({ id: "r1", type: "dust", sev: "danger", msg: `Live: Heavy dust ${data.dust?.toFixed(0)} µg/m³`, time: "Now", resolved: false });
  if (data?.temperature > 45) realAlerts.push({ id: "r2", type: "temp", sev: "danger", msg: `Live: Overheating ${data.temperature}°C`, time: "Now", resolved: false });
  if (data?.efficiency < 70) realAlerts.push({ id: "r3", type: "eff", sev: "warn", msg: `Live: Low efficiency ${data.efficiency?.toFixed(1)}%`, time: "Now", resolved: false });
  if (data?.health_state === "Faulty") realAlerts.push({ id: "r4", type: "ml", sev: "danger", msg: "ML Model: Faulty panel detected — inspect immediately", time: "Now", resolved: false });

  function resolve(id) { setAlerts(a => a.map(x => x.id === id ? { ...x, resolved: true } : x)); }

  function addLog() {
    if (!note.trim()) return;
    setLogs(l => [{ id: Date.now(), action, by: "Current User", time: new Date().toLocaleString(), notes: note }, ...l]);
    setNote(""); setShowAdd(false);
  }

  const mlRecs = (lastRecs || []).filter(r => r.type === "danger" || r.type === "warning");

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "1.3rem", fontWeight: 900, letterSpacing: "0.05em" }}>
          MAINTENANCE <span style={{ color: "var(--solar)" }}>REPORTS</span>
        </h1>
        <p style={{ color: "var(--text3)", fontSize: "0.82rem", marginTop: 4 }}>System alerts, fault detection and maintenance history</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Active Alerts", value: active.length + realAlerts.length, color: "var(--red)", icon: "🚨" },
          { label: "Resolved", value: resolved.length, color: "var(--green)", icon: "✅" },
          { label: "Maintenance Logs", value: logs.length, color: "var(--blue)", icon: "📋" },
          { label: "Last Cleaned", value: "3 days ago", color: "var(--solar)", icon: "🧹" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="card fade-up" style={{ padding: "1.2rem", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: "1.8rem" }}>{icon}</div>
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--font-head)", letterSpacing: "0.08em" }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>

        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="sec-title">🚨 Active System Alerts</div>
          {realAlerts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.7rem", color: "var(--red)", fontFamily: "var(--font-head)", marginBottom: 8, letterSpacing: "0.1em" }}>🔴 LIVE ALERTS</div>
              {realAlerts.map(a => {
                const s = sevStyle[a.sev] || sevStyle.info;
                return (
                  <div key={a.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: "0.82rem", color: s.color }}>{a.msg}</div>
                    <span style={{ fontSize: "0.68rem", color: "var(--text3)", whiteSpace: "nowrap" }}>{a.time}</span>
                  </div>
                );
              })}
            </div>
          )}
          {active.length === 0 && realAlerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--green2)", fontSize: "0.85rem" }}>✅ No active alerts</div>
          ) : (
            active.map(a => {
              const s = sevStyle[a.sev] || sevStyle.info;
              return (
                <div key={a.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.82rem", color: s.color }}>{a.msg}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>{a.time}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.72rem" }} onClick={() => resolve(a.id)}>Resolve</button>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="sec-title">🤖 ML-Driven Recommendations</div>
          {mlRecs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--green2)", fontSize: "0.85rem" }}>✅ No critical ML alerts</div>
          ) : (
            mlRecs.map((r, i) => {
              const bc = r.type === "danger" ? "var(--red)" : "var(--orange)";
              return (
                <div key={i} style={{ padding: "12px 14px", borderRadius: "0 10px 10px 0", borderLeft: `3px solid ${bc}`, background: "rgba(255,255,255,0.02)", marginBottom: 10 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: bc, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text3)", lineHeight: 1.5 }}>{r.detail}</div>
                </div>
              );
            })
          )}
          <div style={{ marginTop: 16, padding: "12px", background: "rgba(245,158,11,0.05)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 6, fontFamily: "var(--font-head)", letterSpacing: "0.08em" }}>CURRENT ML STATUS</div>
            <div style={{ fontSize: "0.85rem" }}>
              State: <span style={{ color: "var(--solar)", fontWeight: 600 }}>{data?.health_state || "—"}</span>
              <span style={{ color: "var(--text3)", marginLeft: 12 }}>Efficiency: <span style={{ color: "var(--green)" }}>{data?.efficiency?.toFixed(1)}%</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div className="sec-title" style={{ margin: 0 }}>📋 Maintenance Log</div>
          <button className="btn btn-solar" style={{ padding: "8px 16px", fontSize: "0.8rem" }} onClick={() => setShowAdd(v => !v)}>
            {showAdd ? "✕ Cancel" : "+ Add Entry"}
          </button>
        </div>

        {showAdd && (
          <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.2rem", marginBottom: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>Action Type</label>
                <select className="input" value={action} onChange={e => setAction(e.target.value)} style={{ appearance: "none" }}>
                  {["Panel cleaned", "Tilt adjusted", "Sensor calibration", "System inspection", "Wiring check", "Manual override"].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>Notes</label>
                <input className="input" placeholder="Describe the action taken..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-solar" onClick={addLog}>Save Entry</button>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border2)" }}>
                {["Action", "Performed By", "Date/Time", "Notes"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontFamily: "var(--font-head)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border2)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px", color: "var(--solar)", fontWeight: 500 }}>{l.action}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)" }}>{l.by}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text3)", whiteSpace: "nowrap" }}>{l.time}</td>
                  <td style={{ padding: "10px 12px", color: "var(--text2)", fontSize: "0.78rem" }}>{l.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
        {[
          { label: "Next Recommended Cleaning", value: "In 4 days", detail: "Based on current dust accumulation rate", color: "var(--solar)", icon: "🧹" },
          { label: "Efficiency Loss (Dust)", value: `${((data?.dust || 0) / 300 * 30).toFixed(1)}%`, detail: "Estimated from current dust level", color: "var(--orange)", icon: "📉" },
          {
            label: "Temp Efficiency Loss",
            value: `${(Math.max(0, (data?.temperature || 0) - 25) * 0.38).toFixed(1)}%`,
            detail: "Panel temp above 25°C baseline",
            color: "var(--red)",
            icon: "🌡"
          },].map(({ label, value, detail, color, icon }) => (
            <div key={label} className="card fade-up" style={{ padding: "1.3rem" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>{icon}</div>
              <div className="sec-title">{label}</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color, fontFamily: "var(--font-head)", marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>{detail}</div>
            </div>
          ))}
      </div>
    </div>
  );
}