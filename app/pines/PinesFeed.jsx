"use client";

// Pines — full-viewport vertical, scroll-snap feed of approved clips. Each slide is a
// place-anchored Pine: poster first, tap to play (Cloudflare iframe player for the
// in-view slide), overlay with place · caption · verified badge · Add-to-trip / Conditions.
// Honest empty state until real clips exist. Capture/upload is the next increment (needs
// the Cloudflare account) — the compose button explains status rather than faking it.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
        if (on) setState({ loading: false, pines: d.pines || [], configured: d.configured });
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
          const i = Number(e.target.getAttribute("data-i"));
          setActive(i); setPlaying(false);
        }
      });
    }, { threshold: [0.6] });
    slideRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [state.pines.length]);

  const compose = async () => {
    if (!user) { openAuth(); return; }
    // Capture → Cloudflare upload → POST /api/pines is the next increment (needs the
    // Cloudflare account). Probe config honestly so we never fake a post.
    try {
      const t = await getAccessToken();
      const r = await fetch("/api/pines/upload-url", { method: "POST", headers: { Authorization: "Bearer " + t } });
      if (r.status === 503) { setNotice("Pines recording is being set up — you'll be able to capture on-site clips here very soon."); return; }
      setNotice("Capture is almost ready — the on-site recorder lands in the next update.");
    } catch { setNotice("Capture is almost ready — the on-site recorder lands in the next update."); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#04070a", fontFamily: "var(--pb-sans)", overflow: "hidden" }}>
      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "linear-gradient(180deg,rgba(4,7,10,.7),transparent)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--pb-grad-gold)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#04070a"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
          </span>
          <b style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.05rem", color: "var(--pb-ink)" }}>Pines</b>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={compose} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 700, color: "#04070a", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "8px 15px" }}>＋ Post a Pine</button>
          <Link href="/explore" style={{ fontFamily: "inherit", fontSize: ".8rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 999, padding: "8px 15px", textDecoration: "none" }}>Explore</Link>
        </div>
      </div>

      {notice && (
        <div onClick={() => setNotice("")} style={{ position: "absolute", top: 62, left: "50%", transform: "translateX(-50%)", zIndex: 30, maxWidth: 340, textAlign: "center", background: "rgba(16,32,23,.92)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 16px", color: "var(--pb-ink-2)", fontSize: ".85rem", lineHeight: 1.5, cursor: "pointer" }}>{notice}</div>
      )}

      {state.loading ? (
        <Center><div style={{ color: "var(--pb-muted)", ...micro() }}>Loading Pines…</div></Center>
      ) : state.pines.length === 0 ? (
        <Empty user={user} onPost={compose} />
      ) : (
        <div style={{ height: "100%", overflowY: "auto", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}>
          {state.pines.map((p, i) => (
            <div key={p.id} data-i={i} ref={(el) => (slideRefs.current[i] = el)}
              style={{ height: "100%", scrollSnapAlign: "start", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
              {i === active && playing && p.iframe_url ? (
                <iframe src={p.iframe_url + "?autoplay=true&muted=false"} allow="autoplay; fullscreen" style={{ width: "min(100%,520px)", height: "100%", border: "none" }} />
              ) : (
                <button onClick={() => setPlaying(true)} aria-label="Play"
                  style={{ width: "min(100%,520px)", height: "100%", border: "none", cursor: "pointer", background: p.poster_url ? `#000 center/cover no-repeat url(${p.poster_url})` : "#0a1712", position: "relative" }}>
                  {i === active && (
                    <span style={{ position: "absolute", inset: 0, margin: "auto", width: 66, height: 66, borderRadius: "50%", background: "rgba(4,7,10,.5)", border: "1px solid rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ borderLeft: "20px solid #fff", borderTop: "12px solid transparent", borderBottom: "12px solid transparent", marginLeft: 5 }} />
                    </span>
                  )}
                </button>
              )}
              <Overlay p={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Overlay({ p }) {
  const parkHref = p.place_type === "park" ? "/parks/" + p.place_id : p.place_type ? "/" + p.place_type + "-status?id=" + p.place_id : null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, padding: "24px 18px 30px", background: "linear-gradient(0deg,rgba(4,7,10,.82),transparent)", pointerEvents: "none" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", pointerEvents: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {p.place_name && (parkHref
            ? <Link href={parkHref} style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "#fff", textDecoration: "none" }}>📍 {p.place_name}</Link>
            : <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.25rem", color: "#fff" }}>📍 {p.place_name}</span>)}
          {p.verified && <span style={{ ...micro(), color: "#4fd98a", border: "1px solid #4fd98a55", borderRadius: 999, padding: "2px 7px" }}>✓ On-site</span>}
        </div>
        {p.caption && <p style={{ color: "rgba(255,255,255,.9)", fontSize: ".92rem", lineHeight: 1.5, margin: "0 0 12px" }}>{p.caption}</p>}
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
    <Center>
      <div style={{ textAlign: "center", maxWidth: 420, padding: "0 24px" }}>
        <div style={{ fontSize: "2.4rem", marginBottom: 6 }}>🌲</div>
        <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem,6vw,2.8rem)", lineHeight: 1.05, color: "var(--pb-ink)", margin: "0 0 12px" }}>Pines are coming</h1>
        <p style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.6, margin: "0 0 22px" }}>
          Short, real clips from the parks — every one captured on-site and pinned to the exact place, right next to today's conditions. No stock, no fakes.
        </p>
        <button onClick={onPost} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".95rem", fontWeight: 700, color: "#04070a", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "13px 24px" }}>
          {user ? "Be the first to pin one" : "Sign in to pin one"}
        </button>
        <div style={{ ...micro(), color: "var(--pb-muted)", marginTop: 18 }}>Reels, but for the wild.</div>
      </div>
    </Center>
  );
}

function Center({ children }) {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>;
}
function micro() { return { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase" }; }
function pill(gold) {
  return gold
    ? { fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 700, color: "#04070a", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "9px 16px", textDecoration: "none" }
    : { fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 999, padding: "9px 16px", textDecoration: "none" };
}
