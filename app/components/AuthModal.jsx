"use client";

// The one signed-OUT auth overlay — a right-side slide-in drawer matching the
// landing page's sign-in (public/embed/home) and the Account panel's feel, so
// the sign-in looks the same on every page. Options: Google, Apple, email +
// password, magic link. Signed IN → AccountPanel. Opened via the store's
// openAuth() (header "Sign in"). Portaled to <body> because the header nav's
// backdrop-filter traps fixed children.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../lib/auth";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const field = { width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 15px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".9rem", outline: "none" };
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" };
const goldBtn = { cursor: "pointer", width: "100%", fontFamily: "var(--pb-sans)", fontWeight: 700, fontSize: ".92rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "13px 18px" };
const oauthBtn = { cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".88rem", color: "var(--pb-ink)", background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px" };

const LOGO = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--pb-bg)"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
);
const GOOGLE = (
  <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.7 2.5-7.6 2.5-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C41.4 36 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z" /></svg>
);
const APPLE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.6 2.1-3.9 2.2-4-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9s-2.1-.9-3.4-.9C4 6.9 2.2 8.3 1.3 10.4c-1.9 3.3-.5 8.2 1.4 10.9.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.5-.9s2.1.9 3.5.9c1.4 0 2.4-1.3 3.3-2.6 1-1.5 1.5-3 1.5-3.1-.1 0-2.9-1.1-2.9-4.3zM13.9 4.5c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z" /></svg>
);

export default function AuthModal() {
  const auth = useAuth();
  const { user, open, closeAuth } = auth;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") closeAuth(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeAuth]);

  // Signed-out only — the signed-in experience is AccountPanel (slide-in).
  if (!mounted || !open || user) return null;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) closeAuth(); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(4,7,5,.6)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "flex-end", fontFamily: "var(--pb-sans)" }}
    >
      <div style={{ width: "min(440px,100%)", height: "100%", background: "var(--pb-bg)", borderLeft: "1px solid var(--pb-line-strong)", boxShadow: "-40px 0 90px -40px rgba(0,0,0,.9)", overflowY: "auto", padding: "clamp(24px,4vw,34px)", animation: "pbslide .28s cubic-bezier(.16,.8,.24,1)" }}>
        <style>{"@keyframes pbslide{from{transform:translateX(30px);opacity:.4}to{transform:none;opacity:1}}"}</style>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--pb-grad-gold)", display: "flex", alignItems: "center", justifyContent: "center" }}>{LOGO}</span>
            <b style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.15rem", color: "var(--pb-ink)" }}>Park Buddy</b>
          </div>
          <button onClick={closeAuth} aria-label="Close" style={{ cursor: "pointer", width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "rgba(9,22,15,.7)", color: "var(--pb-gold)", fontSize: ".95rem", lineHeight: 1 }}>✕</button>
        </div>

        <SignIn auth={auth} />
      </div>
    </div>,
    document.body
  );
}

function SignIn({ auth }) {
  const [mode, setMode] = useState("password"); // "password" | "magic"
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const oauth = async (fn) => { setErr(""); try { const { error } = await fn(); if (error) setErr(error.message); } catch (e) { setErr(e.message || "Sign-in failed."); } };

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErr("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter a valid email address."); return; }
    setBusy(true);
    try {
      if (mode === "magic") {
        const { error } = await auth.signInMagicLink(email.trim());
        if (error) setErr(error.message); else setSent(true);
      } else {
        if (pw.length < 6) { setErr("Password must be at least 6 characters."); setBusy(false); return; }
        const { data, error } = signup ? await auth.signUpPassword(email.trim(), pw) : await auth.signInPassword(email.trim(), pw);
        if (error) setErr(error.message);
        else if (signup && data && data.user && !data.session) setSent(true); // email confirmation required
        else auth.closeAuth();
      }
    } catch (e) { setErr(e.message || "Something went wrong."); }
    setBusy(false);
  };

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "24px 4px" }}>
        <div style={{ fontSize: "2rem" }}>✉️</div>
        <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: "1.7rem", margin: "10px 0 6px", color: "var(--pb-ink)" }}>Check your inbox</h3>
        <p style={{ color: "var(--pb-ink-2)", fontSize: ".9rem", lineHeight: 1.55 }}>We sent a {mode === "magic" ? "sign-in link" : "confirmation link"} to <b style={{ color: "var(--pb-ink)" }}>{email}</b>. Open it on this device to continue.</p>
        <button style={{ ...oauthBtn, marginTop: 18, width: "auto", padding: "10px 18px" }} onClick={() => setSent(false)}>← Back</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".24em", textTransform: "uppercase", color: "var(--pb-gold-soft)" }}>{signup ? "Join Park Buddy" : "Welcome back"}</div>
      <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: "2rem", lineHeight: 1.05, margin: "8px 0 0", color: "var(--pb-ink)" }}>{signup ? "Create account" : "Sign in"}</h3>
      <p style={{ color: "var(--pb-ink-2)", fontSize: ".88rem", lineHeight: 1.55, fontWeight: 300, margin: "6px 0 0" }}>Your trips, checklists and alerts — synced across every device.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        <button style={oauthBtn} onClick={() => oauth(auth.signInGoogle)}>{GOOGLE} Continue with Google</button>
        <button style={oauthBtn} onClick={() => oauth(auth.signInApple)}>{APPLE} Continue with Apple</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
        <span style={{ flex: 1, height: 1, background: "var(--pb-line)" }} /><span style={micro}>or</span><span style={{ flex: 1, height: 1, background: "var(--pb-line)" }} />
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <input style={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "password" && (
          <input style={field} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        )}
        {err && <div style={{ color: "var(--pb-hold)", fontSize: ".82rem" }}>{err}</div>}
        <button style={{ ...goldBtn, marginTop: 2 }} type="submit" disabled={busy}>
          {busy ? "…" : mode === "magic" ? "Email me a sign-in link" : signup ? "Create account →" : "Sign in →"}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={() => { setMode(mode === "magic" ? "password" : "magic"); setErr(""); }} style={{ background: "none", border: "none", color: "var(--pb-gold)", cursor: "pointer", fontSize: ".82rem", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
          {mode === "magic" ? "Use a password instead" : "Email me a link instead"}
        </button>
        {mode === "password" && (
          <button onClick={() => { setSignup(!signup); setErr(""); }} style={{ background: "none", border: "none", color: "var(--pb-ink-2)", cursor: "pointer", fontSize: ".82rem", fontFamily: "inherit", padding: 0 }}>
            {signup ? <>Have an account? <b style={{ color: "var(--pb-gold)" }}>Sign in</b></> : <>New to Park Buddy? <b style={{ color: "var(--pb-gold)" }}>Create account</b></>}
          </button>
        )}
      </div>
      <div style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".04em", color: "var(--pb-muted)", lineHeight: 1.5, marginTop: 22, textAlign: "center" }}>By continuing you agree to our Terms &amp; Privacy. We never sell your data.</div>
    </div>
  );
}
