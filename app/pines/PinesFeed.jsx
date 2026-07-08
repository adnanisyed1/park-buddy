"use client";

// Pines — full-screen vertical, scroll-snap feed of approved clips, on the shared
// design system (forest --pb-bg, champagne gold, the site header). Each slide is a
// place-anchored Pine: poster first, tap to play (Cloudflare iframe for the in-view
// slide), overlay with place · caption · verified badge · Add-to-trip / Conditions.
// Honest empty state until real clips exist. Capture/upload is the next increment.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import { useAuth, openAuth, getAccessToken } from "../lib/auth";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";

export default function PinesFeed() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, pines: [] });
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState("");
  const slideRefs = useRef([]);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetch("/api/pines?limit=20");
        const d = await r.json().catch(() => ({}));
        if (on) setState({ loading: false, pines: d.pines || [] });
      } catch { if (on) setState({ loading: false, pines: [] }); }
    })();
    return () => { on = false; };
  }, []);

  // Track which slide is centered → that's the "active" (playable) Pine.
  useEffect(() => {
    if (!state.pines.length) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          setActive(Number(e.target.getAttribute("data-i"))); setPlaying(false);
        }
      });
    }, { threshold: [0.6] });
    slideRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [state.pines.length]);

  const compose = async () => {
    if (!user) { openAuth(); return; }
    // Capture → Cloudflare upload → POST /api/pines is the next increment. Probe config
    // honestly so we never fake a post.
    try {
      const t = await getAccessToken();
      const r = await fetch("/api/pines/upload-url", { method: "POST", headers: { Authorization: "Bearer " + t } });
      if (r.status === 503) { setNotice("Pines recording is being set up — you'll be able to capture on-site clips here very soon."); return; }
      setNotice("Capture is almost ready — the on-site recorder lands in the next update.");
    } catch { setNotice("Capture is almost ready — the on-site recorder lands in the next update."); }
  };

  return (
    <>
      <SiteHeader active="pines" solid />

      {notice && (
        <div onClick={() => setNotice("")} style={{ position: "fixed", top: 78, left: "50%", transform: "translateX(-50%)", zIndex: 120, maxWidth: 360, textAlign: "center", background: "var(--pb-surface-2)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 16px", color: "var(--pb-ink-2)", fontSize: ".85rem", lineHeight: 1.5, cursor: "pointer", boxShadow: "var(--pb-shadow)" }}>{notice}</div>
      )}

      {state.loading ? (
        <div style={pageWrap("center")}><div style={{ color: "var(--pb-muted)", ...micro() }}>Loading Pines…</div></div>
      ) : state.pines.length === 0 ? (
        <div style={pageWrap("center")}><Empty user={user} onPost={compose} /></div>
      ) : (
        <>
          <main style={{ height: "100vh", overflowY: "auto", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch", background: "var(--pb-bg)" }}>
            {state.pines.map((p, i) => (
              <div key={p.id} data-i={i} ref={(el) => (slideRefs.current[i] = el)}
                style={{ height: "100vh", scrollSnapAlign: "start", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--pb-bg)" }}>
                {i === active && playing && p.iframe_url ? (
                  <iframe src={p.iframe_url + "?autoplay=true&muted=false"} allow="autoplay; fullscreen" style={{ width: "min(100%,520px)", height: "100%", border: "none" }} />
                ) : (
                  <button onClick={() => setPlaying(true)} aria-label="Play"
                    style={{ width: "min(100%,520px)", height: "100%", border: "none", cursor: "pointer", background: p.poster_url ? `var(--pb-bg) center/cover no-repeat url(${p.poster_url})` : "var(--pb-surface)", position: "relative" }}>
                    {i === active && (
                      <span style={{ position: "absolute", inset: 0, margin: "auto", width: 66, height: 66, borderRadius: "50%", background: "rgba(10,23,18,.55)", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ borderLeft: "20px solid var(--pb-gold)", borderTop: "12px solid transparent", borderBottom: "12px solid transparent", marginLeft: 5 }} />
                      </span>
                    )}
                  </button>
                )}
                <Overlay p={p} />
              </div>
            ))}
          </main>
          <button onClick={compose} style={{ position: "fixed", right: 18, bottom: 22, zIndex: 120, cursor: "pointer", fontFamily: "var(--pb-sans)", fontSize: ".85rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "12px 20px", boxShadow: "0 10px 30px -10px rgba(0,0,0,.6)" }}>＋ Post a Pine</button>
        </>
      )}
    </>
  );
}

function Overlay({ p }) {
  const parkHref = p.place_type === "park" ? "/parks/" + p.place_id : p.place_type ? "/" + p.place_type + "-status?id=" + p.place_id : null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, padding: "24px 18px 34px", background: "linear-gradient(0deg,rgba(8,19,13,.9),transparent)", pointerEvents: "none" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", pointerEvents: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {p.place_name && (parkHref
            ? <Link href={parkHref} style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", textDecoration: "none" }}>📍 {p.place_name}</Link>
            : <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)" }}>📍 {p.place_name}</span>)}
          {p.verified && <span style={{ ...micro(), color: "var(--pb-go, #4fd98a)", border: "1px solid rgba(79,217,138,.4)", borderRadius: 999, padding: "2px 7px" }}>✓ On-site</span>}
        </div>
        {p.caption && <p style={{ color: "var(--pb-ink)", opacity: 0.92, fontSize: ".92rem", lineHeight: 1.5, margin: "0 0 12px" }}>{p.caption}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/build-trip" style={pill(true)}>＋ Add to trip</Link>
          {parkHref && <Link href={parkHref} style={pill(false)}>Conditions</Link>}
        </div>
      </div>
    </div>
  );
}

function Empty({ user, onPost }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 440, padding: "0 24px" }}>
      <div style={{ fontSize: "2.4rem", marginBottom: 6 }}>🌲</div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem,6vw,2.8rem)", lineHeight: 1.05, color: "var(--pb-ink)", margin: "0 0 12px" }}>Pines are coming</h1>
      <p style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.6, margin: "0 0 22px" }}>
        Short, real clips from the parks — every one captured on-site and pinned to the exact place, right next to today's conditions. No stock, no fakes.
      </p>
      <button onClick={onPost} style={{ cursor: "pointer", fontFamily: "var(--pb-sans)", fontSize: ".95rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "13px 24px" }}>
        {user ? "Be the first to pin one" : "Sign in to pin one"}
      </button>
      <div style={{ ...micro(), color: "var(--pb-muted)", marginTop: 18 }}>Reels, but for the wild.</div>
    </div>
  );
}

function pageWrap(justify) {
  return { minHeight: "100vh", background: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: justify === "center" ? "center" : "flex-start", paddingTop: 76 };
}
function micro() { return { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase" }; }
function pill(gold) {
  return gold
    ? { fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "9px 16px", textDecoration: "none" }
    : { fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink)", background: "var(--pb-surface-2)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "9px 16px", textDecoration: "none" };
}
