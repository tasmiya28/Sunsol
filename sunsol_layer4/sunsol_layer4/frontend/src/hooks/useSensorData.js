import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:5000";

export function useSensorData() {
  const [status,      setStatus]      = useState(null);   // /status response
  const [livePoints,  setLivePoints]  = useState([]);     // last 60 points
  const [predictions, setPredictions] = useState([]);     // all ML predictions
  const [mlOnline,    setMlOnline]    = useState(false);
  const [lastError,   setLastError]   = useState(null);
  const pollRef = useRef(null);

  // Derived convenience values from status
  const isRunning    = status?.scenario_active  ?? false;
  const hasData      = status?.has_data         ?? false;
  const reportReady  = status?.report_ready     ?? false;
  const elapsed      = status?.elapsed_seconds  ?? 0;
  const progressPct  = status?.progress_pct     ?? 0;
  const scenarioName = status?.scenario_name    ?? null;
  const latestPoint  = status?.live_snapshot    ?? null;
  const latestPred   = status?.latest_prediction ?? null;

  // ── Poll /status every 3s ───────────────────────────────
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
      setLastError("Flask offline — start: python app.py");
      return null;
    }
  }, []);

  // ── Poll /live-data every 3s when sim is running ─────────
  const pollLiveData = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/live-data?last=60`,
        { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      if (json.status === "ok") {
        setLivePoints(json.points || []);
      }
    } catch {}
  }, []);

  // ── Poll /predictions every 5s ───────────────────────────
  const pollPredictions = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/predictions`,
        { signal: AbortSignal.timeout(4000) });
      const json = await res.json();
      if (json.status === "ok") {
        setPredictions(json.predictions || []);
      }
    } catch {}
  }, []);

  // ── Combined polling loop ────────────────────────────────
  useEffect(() => {
    let tick = async () => {
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

  // ── Scenario control ─────────────────────────────────────
  async function startScenario(scenarioName, params) {
    try {
      const body = { scenario_name: scenarioName, ...params };
      const res  = await fetch(`${API}/scenario/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.status === "ok") await pollStatus();
      return json;
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }

  async function stopScenario() {
    try {
      const res  = await fetch(`${API}/scenario/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      await pollStatus();
      await pollPredictions();
      return json;
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }

  async function runSinglePredict(inputs) {
    try {
      const res  = await fetch(`${API}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
        signal: AbortSignal.timeout(5000),
      });
      return await res.json();
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }

  function downloadReport() {
    window.open(`${API}/download-report`, "_blank");
  }

  return {
    // State
    status, livePoints, predictions,
    mlOnline, lastError,
    // Derived
    isRunning, hasData, reportReady,
    elapsed, progressPct, scenarioName,
    latestPoint, latestPred,
    // Actions
    startScenario, stopScenario,
    runSinglePredict, downloadReport,
    // Manual refresh
    refresh: pollStatus,
  };
}