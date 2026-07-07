"use client";

// The one auth overlay. Signed out → sign-in options (Google, Apple, email +
// password, magic link). Signed in → account: Preferences, Notifications, My
// stuff. Opened via the store's openAuth() (header "Sign in" / avatar). Portaled
// to <body> because the header nav's backdrop-filter traps fixed children.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../lib/auth";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 14 };
const field = { width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 11, padding: "12px 13px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".92rem", outline: "none" };
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" };
const goldBtn = { cursor: "pointer", width: "100%", fontFamily: "var(--pb-sans)", fontWeight: 700, fontSize: ".92rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "13px 18px" };
const ghostBtn = { cursor: "pointer", fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".86rem", color: "#e7e3d8", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "11px 16px" };

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
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(16px,7vh,90px) 16px", background: "rgba(4,7,5,.72)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", overflowY: "auto", fontFamily: "var(--pb-sans)" }}
    >
      <div style={{ width: "100%", maxWidth: 400, ...card, borderColor: "var(--pb-line-strong)", boxShadow: "var(--pb-shadow)", padding: "clamp(20px,4vw,28px)", position: "relative" }}>
        <button onClick={closeAuth} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, cursor: "pointer", width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "transparent", color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1 }}>×</button>
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

  const submit = async () => {
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
      <div style={{ textAlign: "center", padding: "8px 4px" }}>
        <div style={{ fontSize: "2rem" }}>✉️</div>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", margin: "8px 0 6px", color: "var(--pb-ink)" }}>Check your inbox</h2>
        <p style={{ color: "var(--pb-ink-2)", fontSize: ".92rem", lineHeight: 1.5 }}>We sent a {mode === "magic" ? "sign-in link" : "confirmation link"} to <b style={{ color: "var(--pb-ink)" }}>{email}</b>. Open it on this device to continue.</p>
        <button style={{ ...ghostBtn, marginTop: 16 }} onClick={() => setSent(false)}>← Back</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...micro, color: "var(--pb-gold-soft)" }}>Park Buddy</div>
      <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.6rem", margin: "4px 0 4px", color: "var(--pb-ink)" }}>{signup ? "Create your account" : "Welcome back"}</h2>
      <p style={{ color: "var(--pb-ink-2)", fontSize: ".88rem", lineHeight: 1.5, margin: "0 0 18px" }}>Sync your trips, favorites &amp; Trip Passport across devices.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <button style={{ ...ghostBtn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#1a1a1a", borderColor: "transparent" }} onClick={() => oauth(auth.signInGoogle)}>{GOOGLE} Continue with Google</button>
        <button style={{ ...ghostBtn, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#000", color: "#fff", borderColor: "#333" }} onClick={() => oauth(auth.signInApple)}>{APPLE} Continue with Apple</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
        <span style={{ flex: 1, height: 1, background: "var(--pb-line)" }} /><span style={micro}>or</span><span style={{ flex: 1, height: 1, background: "var(--pb-line)" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <input style={field} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode === "password" && (
          <input style={field} type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        )}
        {err && <div style={{ color: "var(--pb-hold)", fontSize: ".82rem" }}>{err}</div>}
        <button style={goldBtn} disabled={busy} onClick={submit}>
          {busy ? "…" : mode === "magic" ? "Email me a sign-in link" : signup ? "Create account" : "Sign in"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 13, flexWrap: "wrap" }}>
        <button onClick={() => { setMode(mode === "magic" ? "password" : "magic"); setErr(""); }} style={{ background: "none", border: "none", color: "var(--pb-gold)", cursor: "pointer", fontSize: ".8rem", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
          {mode === "magic" ? "Use a password instead" : "Email me a link instead"}
        </button>
        {mode === "password" && (
          <button onClick={() => { setSignup(!signup); setErr(""); }} style={{ background: "none", border: "none", color: "var(--pb-ink-2)", cursor: "pointer", fontSize: ".8rem", fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
            {signup ? "Have an account? Sign in" : "New here? Create account"}
          </button>
        )}
      </div>
      <p style={{ ...micro, letterSpacing: ".06em", textTransform: "none", color: "var(--pb-muted)", marginTop: 16, lineHeight: 1.5 }}>By continuing you agree to our terms. We never post anything or share your email.</p>
    </div>
  );
}
