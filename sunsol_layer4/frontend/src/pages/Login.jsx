import { useState, useRef } from "react";
import ParticleBackground from "../components/ParticleBackground";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [agree, setAgree] = useState(false);
  const [showTC, setShowTC] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef([]);

  function generateOtp() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setCountdown(60);
    setSuccess(`OTP sent to ${email} → (Demo: ${code})`);
    return code;
  }

  function handleSendOtp() {
    if (!email.includes("@")) { setError("Enter a valid email"); return; }
    setError(""); generateOtp(); setMode("otp");
  }

  function handleOtpChange(i, val) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
    if (!val && i > 0) otpRefs.current[i - 1]?.focus();
  }

  function handleVerifyOtp() {
    const entered = otp.join("");
    if (entered === generatedOtp) {
      setSuccess("✅ Verified! Logging in…");
      setTimeout(() => onLogin({ name: name || email.split("@")[0], email, avatar: null }), 800);
    } else {
      setError("❌ Incorrect OTP. Try again.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    }
  }

  function handleGoogleLogin() {
    setLoading(true);
    setTimeout(() => {
      onLogin({ name: "Demo User", email: "demo@gmail.com", avatar: "https://ui-avatars.com/api/?name=Demo+User&background=f59e0b&color=000" });
    }, 1200);
  }

  function handleLogin(e) {
    e.preventDefault(); setError("");
    if (!email || !password) { setError("Fill in all fields"); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({ name: email.split("@")[0], email, avatar: null });
    }, 1000);
  }

  function handleRegister(e) {
    e.preventDefault(); setError("");
    if (!name || !email || !password) { setError("Fill all fields"); return; }
    if (!agree) { setError("Please accept Terms & Conditions"); return; }
    handleSendOtp();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <ParticleBackground />
      <div className="solar-bg" />
      <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />

      <div className="fade-up z1" style={{ width: "100%", maxWidth: "440px", padding: "1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 1rem", background: "linear-gradient(135deg,#f59e0b,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", boxShadow: "0 0 40px rgba(245,158,11,0.4)" }}>☀</div>
          <div style={{ fontFamily: "var(--font-head)", fontSize: "1.8rem", fontWeight: 900, letterSpacing: "0.05em" }}>
            SUN<span style={{ color: "var(--solar)" }}>SOL</span>
          </div>
          <div style={{ color: "var(--text3)", fontSize: "0.8rem", marginTop: 4, fontFamily: "var(--font-head)", letterSpacing: "0.1em" }}>
            AI-DRIVEN SOLAR OPTIMIZATION
          </div>
        </div>

        <div className="card" style={{ padding: "2rem" }}>
          {mode === "otp" ? (
            <>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.1rem", marginBottom: 8 }}>VERIFY OTP</h2>
              <p style={{ color: "var(--text2)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                Enter 6-digit code sent to <strong style={{ color: "var(--solar)" }}>{email}</strong>
              </p>
              {success && <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "var(--green2)", marginBottom: "1rem" }}>{success}</div>}
              {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "#f87171", marginBottom: "1rem" }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: "1.5rem" }}>
                {otp.map((d, i) => (
                  <input key={i} ref={el => otpRefs.current[i] = el}
                    value={d} maxLength={1} onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => e.key === "Backspace" && !otp[i] && i > 0 && otpRefs.current[i - 1]?.focus()}
                    style={{ width: 48, height: 56, textAlign: "center", fontSize: "1.4rem", fontWeight: 700, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border2)", borderRadius: 10, color: "var(--solar)", outline: "none", fontFamily: "var(--font-head)", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = "var(--solar)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                  />
                ))}
              </div>
              <button className="btn btn-solar" style={{ width: "100%", marginBottom: "1rem" }} onClick={handleVerifyOtp}>Verify & Login</button>
              <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text2)" }}>
                {countdown > 0
                  ? <span>Resend in <strong style={{ color: "var(--solar)" }}>{countdown}s</strong></span>
                  : <span style={{ cursor: "pointer", color: "var(--solar)" }} onClick={() => { const c = generateOtp(); setSuccess(`OTP resent → Demo: ${c}`); }}>Resend OTP</span>
                }
              </div>
              <button className="btn btn-ghost" style={{ width: "100%", marginTop: "1rem" }} onClick={() => { setMode("register"); setError(""); setSuccess(""); }}>← Back</button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4, marginBottom: "1.5rem" }}>
                {["login", "register"].map(m => (
                  <button key={m} onClick={() => { setMode(m); setError(""); }}
                    style={{ flex: 1, padding: "9px", border: "none", cursor: "pointer", borderRadius: 8, fontFamily: "var(--font-head)", fontSize: "0.7rem", letterSpacing: "0.08em", fontWeight: 700, transition: "all 0.2s", background: mode === m ? "linear-gradient(135deg,var(--solar),var(--orange))" : "transparent", color: mode === m ? "#000" : "var(--text3)" }}>
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "#f87171", marginBottom: "1rem" }}>{error}</div>}
              {success && <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "var(--green2)", marginBottom: "1rem" }}>{success}</div>}
              <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {mode === "register" && (
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: 6, display: "block" }}>Full Name</label>
                      <input className="input" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: 6, display: "block" }}>Email Address</label>
                    <input className="input" type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: 6, display: "block" }}>Password</label>
                    <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  {mode === "register" && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <input type="checkbox" id="agree" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--solar)", cursor: "pointer" }} />
                      <label htmlFor="agree" style={{ fontSize: "0.8rem", color: "var(--text2)", cursor: "pointer", lineHeight: 1.5 }}>
                        I agree to the{" "}
                        <span style={{ color: "var(--solar)", textDecoration: "underline", cursor: "pointer" }} onClick={() => setShowTC(true)}>Terms & Conditions</span>
                        {" "}and Privacy Policy
                      </label>
                    </div>
                  )}
                  <button className="btn btn-solar" style={{ width: "100%" }} type="submit" disabled={loading}>
                    {loading ? "⏳ Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
                  </button>
                </div>
              </form>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "1.2rem 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
                <span style={{ color: "var(--text3)", fontSize: "0.75rem" }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
              </div>
              <button className="btn" onClick={handleGoogleLogin} disabled={loading}
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border2)", color: "var(--text)", padding: "11px", borderRadius: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
              {mode === "login" && (
                <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", color: "var(--text3)" }}>
                  <span style={{ color: "var(--solar)", cursor: "pointer" }} onClick={() => setMode("register")}>Don't have an account? Register</span>
                </p>
              )}
            </>
          )}
        </div>
        <p style={{ textAlign: "center", color: "var(--text3)", fontSize: "0.72rem", marginTop: "1.5rem" }}>
          SunSol v1.0 · RIT Rajaramnagar · Team: Abdulwahid, Tasmiya, Anushka, Pooja
        </p>
      </div>

      {showTC && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div className="card" style={{ maxWidth: 500, width: "100%", padding: "2rem", maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--solar)", marginBottom: "1rem" }}>TERMS & CONDITIONS</h3>
            <div style={{ color: "var(--text2)", fontSize: "0.85rem", lineHeight: 1.7 }}>
              <p><strong style={{ color: "var(--text)" }}>1. Data Collection</strong><br />SunSol collects solar panel sensor data for optimization purposes.</p><br />
              <p><strong style={{ color: "var(--text)" }}>2. Data Usage</strong><br />Data is used solely to improve efficiency. No data is sold to third parties.</p><br />
              <p><strong style={{ color: "var(--text)" }}>3. Academic Use</strong><br />This system is developed for academic research at RIT Rajaramnagar.</p><br />
              <p><strong style={{ color: "var(--text)" }}>4. Disclaimer</strong><br />SunSol is a research prototype. Always verify AI recommendations with qualified engineers.</p>
            </div>
            <button className="btn btn-solar" style={{ width: "100%", marginTop: "1.5rem" }} onClick={() => { setAgree(true); setShowTC(false); }}>Accept & Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
