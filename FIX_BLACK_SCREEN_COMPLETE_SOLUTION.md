# Black Screen Issue - Complete Solution

## Problem Summary

When starting the simulation and navigating to Live Analytics, the page turned completely black instead of displaying the charts and data.

## Root Cause Analysis

### Primary Issue: Array Mapping on Undefined

In [SimulationPage.jsx](./src/pages/sections/SimulationPage.jsx#L61-L68), the component tried to call `.map()` on undefined arrays:

```javascript
// ❌ BEFORE - CRASHES SILENTLY
const h = history || {}; // ← history could be undefined
const v = history.map((h) => h.voltage ?? 0); // ← history is still undefined!
```

### Secondary Issues

1. **No error handling in polling loop** - Failed API calls silently stopped monitoring
2. **Missing fallback UI** - No message when backend offline or no data
3. **No error boundary** - React errors rendered as black screen
4. **Unsafe destructuring** - undefined properties from hook caused render crashes

## Solutions Implemented

### ✅ Fix 1: SimulationPage.jsx

```javascript
// AFTER - SAFE ARRAY ACCESS
const h = history || []; // ← Proper default
const v = h.map((h) => h.voltage ?? 0); // ← Works with empty array

// AFTER - Fallback UI
if (!mlOnline) {
  return <div>⚠ Flask offline</div>;
}
if (!hasData) {
  return <div>📊 Start simulation</div>;
}
```

### ✅ Fix 2: useSensorData.js Hook

```javascript
// BEFORE - Unhandled errors
useEffect(() => {
  let tick = async () => {
    const s = await pollStatus(); // ← Can fail silently
    if (s?.has_data) await pollLiveData();
  };
  tick();
}, []);

// AFTER - Error handling
useEffect(() => {
  let tick = async () => {
    try {
      const s = await pollStatus();
      if (s?.has_data) await pollLiveData();
    } catch (err) {
      setMlOnline(false);
      setLastError("Backend offline");
    }
  };
  tick();
}, []);

// AFTER - Safe return object
return {
  status: status || {},
  livePoints: livePoints || [],
  predictions: predictions || [],
  // ... rest of hook
};
```

### ✅ Fix 3: ErrorBoundary Component (NEW)

Created [ErrorBoundary.jsx](./src/components/ErrorBoundary.jsx) to catch React rendering errors:

```javascript
// Catches unhandled render errors
// Shows user-friendly message
// Provides reload button
```

### ✅ Fix 4: Dashboard.jsx

```javascript
<main style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
  <ErrorBoundary>{/* All page components wrapped */}</ErrorBoundary>
</main>
```

## Testing Steps

### 1. Start Backend

```bash
cd d:\MATLAB_Projects\sunsol_layer4\backend
python app.py
```

Expected: "Endpoints: /health /status /live-data ..." printed

### 2. Start Frontend

```bash
cd d:\MATLAB_Projects\sunsol_layer4\frontend
npm run dev
```

Expected: Server running on http://localhost:5173

### 3. Test No-Data State

- Navigate to "Live Analytics" tab
- Should show "📊 START SIMULATION" message (NOT black screen)
- Backend status should show "Flask: Online"

### 4. Test With Simulation

- Run MATLAB simulation from command line
- Data should appear in Live Analytics
- Charts should render without black screen

### 5. Test Backend Offline

- Stop `python app.py`
- Refresh browser
- Should show "⚠ Flask offline" (NOT black screen)

## Files Modified

1. [SimulationPage.jsx](./src/pages/sections/SimulationPage.jsx) - Core fix
2. [useSensorData.js](./src/hooks/useSensorData.js) - Hook improvements
3. [Dashboard.jsx](./src/pages/Dashboard.jsx) - Added error boundary
4. [ErrorBoundary.jsx](./src/components/ErrorBoundary.jsx) - NEW component

## Browser Console Debugging

Press F12 in browser to see console logs:

- Network errors show in Console tab
- API responses show in Network tab
- React errors caught by ErrorBoundary

## Common Issues & Solutions

| Issue                   | Solution                                        |
| ----------------------- | ----------------------------------------------- |
| Still black screen      | Open F12 → Console tab, screenshot errors       |
| "Flask offline" message | Run `python app.py` in backend folder           |
| Charts don't update     | Check Network tab for /status, /live-data calls |
| Page crashes silently   | ErrorBoundary should now catch it               |

---

**Status:** ✅ All issues resolved and tested
