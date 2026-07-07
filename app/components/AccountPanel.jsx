"use client";

// The signed-in account experience — a roomy right-side slide-in (the "Explore
// panel" feel). Home view = a BENTO GRID of category tiles (no hidden scroll
// tabs); tap a tile to open that section in place (← back to the grid). Portaled
// to <body>. Built one section at a time; Preferences is live, the rest fill in.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "../lib/auth";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" };
const field = { width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 11, padding: "11px 13px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".9rem", outline: "none" };
const ghostBtn = { cursor: "pointer", fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".8rem", color: "#e7e3d8", background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 14px" };

const TILES = [
  { key: "prefs", label: "Preferences", icon: "⚙", desc: "Interests, units, map & home region" },
  { key: "trips", label: "My Itineraries", icon: "🧭", desc: "Your saved trips" },
  { key: "orders", label: "Books & Orders", icon: "📖", desc: "Trip Books you've made & ordered" },
  { key: "alerts", label: "Alerts", icon: "🔔", desc: "Follow parks · route alerts" },
  { key: "passport", label: "Passport", icon: "🎫", desc: "Places you've visited" },
  { key: "plan", label: "Your Plan", icon: "✦", desc: "Park Buddy plan & Pro" },
];
const INTERESTS = ["Hiking", "Wildlife", "Photography", "Camping", "Scenic drives", "Family"];

export default function AccountPanel() {
  const auth = useAuth();
  const { user, open, closeAuth } = auth;
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState("home");
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setView("home"); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") { if (view !== "home") setView("home"); else closeAuth(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, view, closeAuth]);

  if (!mounted || !open || !user) return null;

  const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || "").split("@")[0];
  const avatar = user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture);
  const initial = (name || "?").charAt(0).toUpperCase();
  const current = TILES.find((t) => t.key === view);

  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) closeAuth(); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(4,7,5,.6)", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "flex-end", fontFamily: "var(--pb-sans)" }}>
      <div style={{ width: "min(460px,100%)", height: "100%", background: "var(--pb-bg)", borderLeft: "1px solid var(--pb-line-strong)", boxShadow: "-40px 0 90px -40px rgba(0,0,0,.9)", display: "flex", flexDirection: "column", animation: "pbslide .28s cubic-bezier(.16,.8,.24,1)" }}>
        <style>{"@keyframes pbslide{from{transform:translateX(30px);opacity:.4}to{transform:none;opacity:1}}"}</style>

        {/* header: profile on home, back + title on a section */}
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 20px", borderBottom: "1px solid var(--pb-line)" }}>
          {view === "home" ? (
            <>
              {avatar
                ? <img src={avatar} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--pb-line-strong)" }} />
                : <span style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--pb-grad-gold)", color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontWeight: 700, fontSize: "1.25rem", flex: "none" }}>{initial}</span>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.2rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: ".8rem", color: "var(--pb-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setView("home")} aria-label="Back" style={{ cursor: "pointer", width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "transparent", color: "var(--pb-ink)", fontSize: "1.1rem", lineHeight: 1, flex: "none" }}>‹</button>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.2rem", color: "var(--pb-ink)", flex: 1 }}>{current ? current.icon + " " + current.label : "Account"}</div>
            </>
          )}
          <button onClick={closeAuth} aria-label="Close" style={{ cursor: "pointer", width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "transparent", color: "var(--pb-ink-2)", fontSize: "1.1rem", lineHeight: 1, flex: "none" }}>×</button>
        </div>

        {/* content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {view === "home" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {TILES.map((t) => (
                <button key={t.key} onClick={() => setView(t.key)}
                  style={{ cursor: "pointer", textAlign: "left", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 16, padding: "16px 15px", display: "flex", flexDirection: "column", gap: 8, minHeight: 118, transition: "border-color .2s, transform .2s", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--pb-line-strong)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--pb-line)"; e.currentTarget.style.transform = "none"; }}>
                  <span style={{ fontSize: "1.5rem" }}>{t.icon}</span>
                  <span style={{ marginTop: "auto" }}>
                    <span style={{ display: "block", fontSize: ".98rem", fontWeight: 600, color: "var(--pb-ink)" }}>{t.label}</span>
                    <span style={{ display: "block", fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 2, lineHeight: 1.35 }}>{t.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {view === "prefs" && <Preferences auth={auth} />}
          {view === "trips" && <Soon title="My Itineraries" body="Save multiple named trips and jump back into any of them. Building this next — it needs the multi-trip save we're adding." link={{ href: "/build-trip", label: "Build a trip →" }} onClose={closeAuth} />}
          {view === "orders" && <Soon title="Trip Books & Orders" body="Every book you design and every print order, in one place. Wiring this to your account now." link={{ href: "/trip-book", label: "Design a Trip Book →" }} onClose={closeAuth} />}
          {view === "alerts" && <Soon title="Alerts & Subscriptions" body="Follow any park, forest or state park — and subscribe to a whole itinerary to get alerts for every stop along the way (weather flips, road & permit changes). Coming as we build it out." link={{ href: "/explore", label: "Browse places →" }} onClose={closeAuth} />}
          {view === "passport" && <Soon title="Trip Passport" body="A real travel log that auto-stamps the places you actually visit (from Trip Mode's live location) — no manual check-ins. Building the visited-places record next." link={{ href: "/trip-mode", label: "Open Trip Mode →" }} onClose={closeAuth} />}
          {view === "plan" && <Soon title="Your Plan" body="Manage your Park Buddy plan and Pro features here once subscriptions are live." link={{ href: "/#pro", label: "See Pro →" }} onClose={closeAuth} />}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--pb-line)", flex: "none" }}>
          <button style={{ ...ghostBtn, width: "100%" }} onClick={() => auth.signOut()}>Sign out</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Preferences({ auth }) {
  const [prefs, setLocal] = useState(() => auth.getPrefs());
  const save = (patch) => { const next = { ...prefs, ...patch }; setLocal(next); auth.setPrefs(next); };
  const interests = prefs.interests || [];
  const toggleInterest = (i) => save({ interests: interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i] });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div style={{ ...micro, marginBottom: 9 }}>What you love</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INTERESTS.map((i) => {
            const on = interests.includes(i);
            return <button key={i} onClick={() => toggleInterest(i)} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem", fontWeight: 600, borderRadius: 999, padding: "8px 14px", border: "1px solid " + (on ? "transparent" : "var(--pb-line-strong)"), background: on ? "var(--pb-grad-gold)" : "transparent", color: on ? "var(--pb-bg)" : "var(--pb-ink-2)" }}>{i}</button>;
          })}
        </div>
        <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 8 }}>We use these to suggest parks made for you.</div>
      </div>

      <Seg label="Distance" value={prefs.units || "mi"} opts={[["mi", "Miles"], ["km", "Kilometers"]]} onPick={(v) => save({ units: v })} />
      <Seg label="Temperature" value={prefs.temp || "f"} opts={[["f", "°F"], ["c", "°C"]]} onPick={(v) => save({ temp: v })} />
      <Seg label="Default map" value={prefs.mapStyle || "standard"} opts={[["standard", "Standard"], ["terrain", "Terrain"], ["satellite", "Satellite"]]} onPick={(v) => save({ mapStyle: v })} />

      <div>
        <div style={{ ...micro, marginBottom: 9 }}>Home region</div>
        <input style={field} placeholder="e.g. Utah, or Pacific Northwest" value={prefs.homeRegion || ""} onChange={(e) => save({ homeRegion: e.target.value })} />
        <div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 8 }}>Used to surface parks & conditions near you first.</div>
      </div>

      <div style={{ ...micro, letterSpacing: ".06em", textTransform: "none", color: "var(--pb-muted)", lineHeight: 1.5 }}>Preferences sync to your account automatically.</div>
    </div>
  );
}

function Seg({ label, value, opts, onPick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: ".9rem", color: "var(--pb-ink-2)" }}>{label}</span>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {opts.map(([v, lbl]) => {
          const on = value === v;
          return <button key={v} onClick={() => onPick(v)} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".78rem", fontWeight: 600, borderRadius: 8, padding: "7px 12px", border: "1px solid " + (on ? "transparent" : "var(--pb-line-strong)"), background: on ? "var(--pb-grad-gold)" : "transparent", color: on ? "var(--pb-bg)" : "var(--pb-ink-2)" }}>{lbl}</button>;
        })}
      </div>
    </div>
  );
}

function Soon({ title, body, link, onClose }) {
  return (
    <div style={{ padding: "4px 2px" }}>
      <p style={{ color: "var(--pb-ink-2)", fontSize: ".92rem", lineHeight: 1.6, margin: "0 0 16px" }}>{body}</p>
      {link && <Link href={link.href} onClick={onClose} style={{ ...ghostBtn, display: "inline-block", textDecoration: "none" }}>{link.label}</Link>}
      <div style={{ ...micro, letterSpacing: ".1em", marginTop: 18 }}>Building this — one section at a time</div>
    </div>
  );
}
