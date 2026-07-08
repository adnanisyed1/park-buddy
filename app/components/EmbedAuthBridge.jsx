"use client";

// Bridges the legacy embedded pages (public/embed/*) to the REAL React auth.
// Those pages ship their own "Sign in" button (#signInBtn) wired to a cosmetic
// stub in their own script. This mounts the real AuthModal + AccountPanel and
// hijacks that button (capture-phase, so it wins over the stub's handler) to
// open the real drawer — same sign-in on the landing as everywhere else. When
// signed in, the button shows the user's name and opens the account panel.
import { useEffect } from "react";
import { initAuth, subscribeAuth, getUser, openAuth } from "../lib/auth";
import AuthModal from "./AuthModal";
import AccountPanel from "./AccountPanel";

export default function EmbedAuthBridge() {
  useEffect(() => {
    initAuth();

    // Capture-phase click: intercept the embed's Sign-in button before its own
    // onclick fires, and open the real drawer instead.
    const onClick = (e) => {
      const btn = e.target && e.target.closest && e.target.closest("#signInBtn");
      if (btn) { e.preventDefault(); e.stopImmediatePropagation(); openAuth(); }
    };
    document.addEventListener("click", onClick, true);

    // Reflect signed-in state on the embed's button (it's injected async, so poll
    // briefly until it exists, then keep it in sync with auth changes).
    const applyLabel = () => {
      const btn = document.getElementById("signInBtn");
      if (!btn) return false;
      const u = getUser();
      if (u) {
        const name = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || (u.email || "").split("@")[0];
        btn.textContent = name.length > 16 ? name.slice(0, 15) + "…" : name;
      } else {
        btn.textContent = "Sign in";
      }
      return true;
    };
    let tries = 0, t = null;
    const tick = () => { if (!applyLabel() && tries++ < 100) t = setTimeout(tick, 100); };
    tick();
    const unsub = subscribeAuth(applyLabel);

    return () => { document.removeEventListener("click", onClick, true); clearTimeout(t); unsub(); };
  }, []);

  return (<><AuthModal /><AccountPanel /></>);
}
