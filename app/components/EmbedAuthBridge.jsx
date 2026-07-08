"use client";

// Bridges the legacy embedded pages (public/embed/*) to the REAL React auth so
// sign-in looks & works the same everywhere. Two flavors of legacy sign-in exist:
//   • the landing (#signInBtn) — a cosmetic stub in the embed's own script.
//   • /plan & /park-status — auth.js's floating Google-only widget (#pp-acct).
// This mounts the real AuthModal + AccountPanel and:
//   - hijacks #signInBtn (capture-phase, beating the stub) when present, OR
//   - injects a matching "Sign in" pill and hides #pp-acct when it's not.
// The button reflects signed-in state (name → opens the account panel). auth.js
// stays loaded on those pages (it supplies the shared Supabase client + trip
// sync); only its visible widget is hidden.
import { useEffect } from "react";
import { initAuth, subscribeAuth, getUser, openAuth } from "../lib/auth";
import AuthModal from "./AuthModal";
import AccountPanel from "./AccountPanel";

const PILL_ID = "pb-embed-signin";

export default function EmbedAuthBridge() {
  useEffect(() => {
    initAuth();

    // Capture-phase: intercept either trigger before its own handler fires.
    const onClick = (e) => {
      const hit = e.target && e.target.closest && e.target.closest("#signInBtn, #" + PILL_ID);
      if (hit) { e.preventDefault(); e.stopImmediatePropagation(); openAuth(); }
    };
    document.addEventListener("click", onClick, true);

    const label = () => {
      const u = getUser();
      if (!u) return "Sign in";
      const name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || "").split("@")[0];
      return name.length > 16 ? name.slice(0, 15) + "…" : name;
    };

    // Ensure a trigger exists: prefer the embed's own #signInBtn; otherwise inject
    // a floating pill (top-right, where auth.js put its widget) and hide #pp-acct.
    const ensure = () => {
      const native = document.getElementById("signInBtn");
      if (native) { native.textContent = label(); return true; }

      const acct = document.getElementById("pp-acct");
      if (acct) acct.style.display = "none";

      let pill = document.getElementById(PILL_ID);
      if (!pill) {
        pill = document.createElement("button");
        pill.id = PILL_ID;
        pill.style.cssText = "position:fixed;top:15px;right:16px;z-index:250;cursor:pointer;font-family:var(--pb-sans,Inter,sans-serif);font-size:.82rem;font-weight:600;color:#e7e3d8;background:rgba(16,32,23,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(217,183,121,.34);border-radius:999px;padding:9px 17px";
        document.body.appendChild(pill);
      }
      pill.textContent = label();
      return true;
    };

    let tries = 0, t = null;
    const tick = () => { ensure(); if (tries++ < 60) t = setTimeout(tick, 150); }; // keep pill in sync as the embed boots
    tick();
    const unsub = subscribeAuth(ensure);

    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(t);
      unsub();
      const pill = document.getElementById(PILL_ID);
      if (pill) pill.remove();
    };
  }, []);

  return (<><AuthModal /><AccountPanel /></>);
}
