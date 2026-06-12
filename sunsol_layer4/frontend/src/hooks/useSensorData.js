import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:5000";

export function useSensorData() {
  const [status,      setStatus]      = useState(null);
  const [livePoints,  setLivePoints]  = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [mlOnline,    setMlOnline]    = useState(false);
  const [lastError,   setLastError]   = useState(null);
  const pollRef   = useRef(null);
  const reportRef = useRef(null); // separate interval for report polling

  // ── Derived values — safe defaults, never null ────────────
  const isRunning    = status?.scenario_active   ?? false;
  const hasData      = status?.has_data          ?? false;
  const reportReady  = status?.report_ready      ?? false;
  const reportError  = status?.report_error      ?? null;
  const elapsed      = status?.elapsed_seconds   ?? 0;
  const progressPct  = status?.progress_pct      ?? 0;
  const scenarioName = status?.scenario_name     ?? null;
  const latestPoint  = status?.live_snapshot     ?? null;
  const latestPred   = status?.latest_prediction ?? null;

  // ── /status ──────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/status`,
        { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setStatus(json);
      setMlOnline(true);
      setLastError(null);
      return json;
    } catch (e) {
      setMlOnline(false);
      setLastError("Flask offline — run: python app.py");
      return null;
    }
  }, []);

  // ── /live-data ────────────────────────────────────────────
  const pollLiveData = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/live-data?last=300`,
        { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      if (json.status === "ok" && json.points?.length) {
        setLivePoints(json.points);
      }
    } catch {}
  }, []);

  // ── /predictions ──────────────────────────────────────────
  const pollPredictions = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/predictions`,
        { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      if (json.status === "ok") {
        setPredictions(json.predictions || []);
        setStatus(prev => prev
          ? { ...prev, next_in_seconds: json.next_in_seconds }
          : prev);
      }
    } catch {}
  }, []);

  // ── /report-status — polls after sim ends until ready ────
  const pollReportStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/report-status`,
        { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      if (json.report_ready) {
        // Inject report_ready into status state
        setStatus(prev => prev ? { ...prev, report_ready: true } : prev);
        // Stop polling once ready
        if (reportRef.current) {
          clearInterval(reportRef.current);
          reportRef.current = null;
        }
      }
      return json;
    } catch {}
  }, []);

  // ── Main polling loop (every 3s) ──────────────────────────
  useEffect(() => {
    const tick = async () => {
      const s = await pollStatus();
      if (s?.has_data || s?.scenario_active) {
        await pollLiveData();
        await pollPredictions();
      }
    };
    tick();
    pollRef.current = setInterval(tick, 3000);
    return () => clearInterval(pollRef.current);
  }, [pollStatus, pollLiveData, pollPredictions]);

  // ── Start report-status polling when sim ends ─────────────
  useEffect(() => {
    if (!isRunning && hasData && !reportReady) {
      // Sim just ended — poll report-status every 2s until ready
      if (!reportRef.current) {
        pollReportStatus(); // immediate first check
        reportRef.current = setInterval(pollReportStatus, 2000);
      }
    }
    if (reportReady && reportRef.current) {
      clearInterval(reportRef.current);
      reportRef.current = null;
    }
  }, [isRunning, hasData, reportReady, pollReportStatus]);

  // ── Actions ───────────────────────────────────────────────
  async function startScenario(name, params) {
    try {
      const res  = await fetch(`${API}/scenario/start`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scenario_name: name, ...params }),
      });
      const json = await res.json();
      if (json.status === "ok") {
        setLivePoints([]);
        setPredictions([]);
        setStatus(prev => prev
          ? { ...prev, report_ready: false, has_data: false, scenario_active: true }
          : prev);
        await pollStatus();
      }
      return json;
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }

  async function stopScenario() {
    try {
      const res  = await fetch(`${API}/scenario/stop`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      });
      const json = await res.json();
      await pollStatus();
      await pollLiveData();
      await pollPredictions();
      // Immediately start report polling
      pollReportStatus();
      return json;
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }

  // ── Download — hidden anchor, avoids popup blockers ────
  function downloadReport(format = "pdf") {
    const url = `${API}/download-report?format=${format}`;
    const ext = format === "pdf" ? ".pdf" : ".xlsx";
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `SunSol_${(scenarioName || "Report").replace(/ /g,"_")}${ext}`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 400);
  }

  async function runSinglePredict(inputs) {
    try {
      const res = await fetch(`${API}/predict`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(inputs),
        signal:  AbortSignal.timeout(5000),
      });
      return await res.json();
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }

  return {
    status, livePoints, predictions,
    mlOnline, lastError,
    isRunning, hasData, reportReady, reportError,
    elapsed, progressPct, scenarioName,
    latestPoint, latestPred,
    startScenario, stopScenario,
    runSinglePredict, downloadReport,
    refresh: pollStatus,
  };
}
