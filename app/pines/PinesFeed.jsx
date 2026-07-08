"use client";

// Pines — Park Buddy's social layer ("reels for the wild"), ported 1:1 from the
// Claude Design spec (~/Downloads/pines-preview.html + PINES-DESIGN-BRIEF.md).
// Ships BOTH layouts responsively: phone = bottom tab bar (Feed · Places · ＋ · You);
// web = left sidebar + centered ~520px feed + right rail. Screens: Feed, Top of the
// week, Place hub (Campfire), Compose, Places, You. Wired to REAL data — pines via
// /api/pines, imagery via /api/photo, live verdict/alerts via /api/conditions (the
// same NWS source Explore uses). Honesty first: no fabricated verdicts, likes, or
// earnings; every empty state tells the truth.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PinesCompose from "./PinesCompose";
import { useAuth, openAuth, getAccessToken } from "../lib/auth";

const C = { gold: "linear-gradient(120deg,#e8cf9a,#c9a35f)", go: "#4fd98a", prep: "#e8cf9a", hold: "#e08a6a", like: "#e0546a" };
const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const vColor = (v) => (v === "GO" ? C.go : v === "PREPARE" ? C.prep : v === "HOLD" ? C.hold : "#aab0ba");
const vShort = (v) => (v === "PREPARE" ? "PREP" : v);
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase" };

// ---- real photo via our pipeline (/api/photo?q=pipe|candidates), with cache + fade ----
const photoCache = {};
function usePhoto(q) {
  const key = q || "";
  const [url, setUrl] = useState(photoCache[key] || null);
  useEffect(() => {
    if (!key || photoCache[key] !== undefined && photoCache[key]) { if (photoCache[key]) setUrl(photoCache[key]); return; }
    let on = true;
    fetch("/api/photo?q=" + encodeURIComponent(key) + "&w=900")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const u = d && (d.thumb || d.image); photoCache[key] = u || ""; if (on && u) setUrl(u); })
      .catch(() => {});
    return () => { on = false; };
  }, [key]);
  return url;
}
function Photo({ q, style, rounded }) {
  const url = usePhoto(q);
  return (
    <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(135deg,#16321f 0 14px,#12291a 14px 28px)", ...style }}>
      {url && <img src={url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: rounded || 0 }} />}
    </div>
  );
}

// live verdict from the SAME source as Explore (NWS via /api/conditions) — derived
// honestly from real active alerts; null while unknown (never fabricated).
async function fetchVerdict(lat, lng) {
  try {
    const r = await fetch("/api/conditions?lat=" + lat + "&lng=" + lng);
    if (!r.ok) return null;
    const d = await r.json();
    const alerts = (d.weatherAlerts || []);
    const severe = alerts.some((a) => /warning|severe|red flag|evacuation/i.test(JSON.stringify(a)));
    return { v: severe ? "HOLD" : alerts.length ? "PREPARE" : "GO", alert: alerts[0] || null };
  } catch { return null; }
}

export default function PinesFeed() {
  const { user } = useAuth();
  const [tab, setTab] = useState("feed");
  const [isWeb, setIsWeb] = useState(false);
  const [compose, setCompose] = useState(false);
  const [hub, setHub] = useState(null); // {type,id,name,q}

  useEffect(() => {
    const mq = window.matchMedia("(min-width:1000px)");
    const sync = () => setIsWeb(mq.matches);
    sync(); mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const post = () => { if (!user) { openAuth(); return; } setCompose(true); };
  const go = (t) => { if (t === "compose") return post(); setTab(t); };
  const openHub = (place) => { setHub(place); setTab("hub"); };

  const screen = { feed: <Feed onPost={post} user={user} />, top: <Top openHub={openHub} />, hub: <Hub place={hub} onBack={() => setTab("places")} />, places: <Places openHub={openHub} />, you: <You user={user} onPost={post} /> }[tab];

  if (isWeb) {
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "232px minmax(0,1fr) 312px", minHeight: "100vh", background: "var(--pb-bg)" }}>
          <Sidebar tab={tab} go={go} user={user} onPost={post} />
          <div style={{ borderLeft: "1px solid var(--pb-line)", borderRight: "1px solid var(--pb-line)", display: "flex", justifyContent: "center", padding: "26px 18px", background: "radial-gradient(120% 60% at 50% 0,#0e2016,#08130d 60%)" }}>
            <div style={{ width: "100%", maxWidth: 540 }}>
              <div style={{ borderRadius: 20, overflow: "hidden", border: "1px solid var(--pb-line)", background: "var(--pb-bg)", minHeight: 700 }}>{screen}</div>
            </div>
          </div>
          <Rail openHub={openHub} />
        </div>
        {compose && <PinesCompose open={compose} onClose={() => setCompose(false)} onPosted={() => setTab("you")} />}
      </>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--pb-bg)", fontFamily: "var(--pb-sans)" }}>
      <div style={{ position: "absolute", inset: "0 0 62px 0", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>{screen}</div>
      <TabBar tab={tab} go={go} />
      {compose && <PinesCompose open={compose} onClose={() => setCompose(false)} onPosted={() => setTab("you")} />}
    </div>
  );
}

/* ---------------- shells ---------------- */
function navIcon(id) {
  const p = { feed: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>, places: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>, you: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> }[id];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>{p}</svg>;
}
function TabBar({ tab, go }) {
  const cur = tab === "top" ? "feed" : tab === "hub" ? "places" : tab;
  const T = (id, label) => (
    <button onClick={() => go(id)} style={{ flex: 1, cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "var(--pb-sans)", fontSize: ".58rem", fontWeight: 600, color: cur === id ? "var(--pb-gold)" : "var(--pb-muted)" }}>{navIcon(id)}{label}</button>
  );
  return (
    <nav style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 62, display: "flex", alignItems: "center", background: "rgba(8,19,13,.94)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", borderTop: "1px solid var(--pb-line)", zIndex: 30 }}>
      {T("feed", "Feed")}{T("places", "Places")}
      <button onClick={() => go("compose")} aria-label="Post" style={{ flex: 1, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, background: C.gold, color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700, boxShadow: "0 8px 22px -8px rgba(217,183,121,.8)" }}>＋</span>
      </button>
      {T("you", "You")}
    </nav>
  );
}
function Sidebar({ tab, go, user, onPost }) {
  const cur = tab === "top" ? "feed" : tab === "hub" ? "places" : tab;
  const items = [["feed", "Feed"], ["places", "Places"], ["compose", "＋  Post"], ["you", "You"]];
  const name = user ? ((user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || "").split("@")[0]) : "Guest";
  return (
    <div style={{ padding: "22px 16px", display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 0, height: "100vh" }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 18px", textDecoration: "none" }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="var(--pb-bg)"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg></span>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.35rem", color: "var(--pb-ink)" }}>Pines</span>
      </Link>
      {items.map(([id, label]) => {
        const on = id === cur, gold = id === "compose";
        return <button key={id} onClick={() => go(id)} style={{ cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "var(--pb-sans)", fontSize: ".98rem", fontWeight: 600, border: "none", borderRadius: 12, padding: "12px 14px", margin: gold ? "6px 0" : 0, background: gold ? C.gold : on ? "rgba(217,183,121,.12)" : "transparent", color: gold ? "var(--pb-bg)" : on ? "var(--pb-ink)" : "var(--pb-ink-2)" }}>{label}</button>;
      })}
      <div style={{ flex: 1 }} />
      <button onClick={() => go("you")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px", borderTop: "1px solid var(--pb-line)", marginTop: 10, background: "none", border: "none", borderTopWidth: 1, cursor: "pointer", textAlign: "left" }}>
        <span style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(150deg,#1f5e46,#0e2016)", border: "1px solid var(--pb-gold-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, color: "var(--pb-gold)", fontWeight: 600 }}>{(name[0] || "?").toUpperCase()}</span>
        <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: ".84rem", fontWeight: 600, color: "var(--pb-ink)" }}>{name}</span>{user && <span style={{ display: "block", fontSize: ".6rem", color: "var(--pb-muted)" }}>{user.email}</span>}</span>
      </button>
    </div>
  );
}
function Rail({ openHub }) {
  const [top, setTop] = useState(null);
  useEffect(() => { fetch("/api/pines?sort=top").then((r) => r.json()).then((d) => setTop(d.pines || [])).catch(() => setTop([])); }, []);
  return (
    <div style={{ padding: "22px 16px", overflowY: "auto" }}>
      <div style={{ ...micro, color: "var(--pb-gold-soft)", marginBottom: 12 }}>Top of the week</div>
      {top === null ? <span style={{ color: "var(--pb-muted)", fontSize: ".8rem" }}>Loading…</span>
        : top.length === 0 ? <p style={{ color: "var(--pb-ink-2)", fontSize: ".8rem", lineHeight: 1.5 }}>No ranked Pines yet — the week's most-loved Adventures will show here.</p>
        : top.slice(0, 5).map((t, i) => (
          <button key={t.id} onClick={() => openHub(placeOf(t))} style={{ cursor: "pointer", width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "8px 0" }}>
            <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.2rem", color: "var(--pb-gold-soft)", width: 18, flex: "none" }}>{i + 1}</span>
            <span style={{ position: "relative", width: 40, height: 40, borderRadius: 9, overflow: "hidden", flex: "none" }}>{t.image_url || t.poster_url ? <img src={t.image_url || t.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={t.place_name} />}</span>
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: ".86rem", fontWeight: 600, color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.place_name || "Adventure"}</span></span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.like, fontSize: ".72rem", fontWeight: 600 }}>{heart(12)}{t.like_count || 0}</span>
          </button>
        ))}
      <div style={{ ...micro, letterSpacing: ".06em", textTransform: "none", color: "var(--pb-muted)", lineHeight: 1.6, marginTop: 18 }}>On-site &amp; verified. Real park photos only — honesty is the brand.</div>
    </div>
  );
}
function placeOf(p) { return { type: p.place_type || "park", id: p.place_id, name: p.place_name, q: p.place_name }; }
function heart(sz) { return <svg viewBox="0 0 24 24" fill={C.like} style={{ width: sz, height: sz }}><path d="M12 21s-7-4.6-9.2-9C1.3 8.6 3 5 6.4 5 8.4 5 12 7 12 7s3.6-2 5.6-2C21 5 22.7 8.6 21.2 12 19 16.4 12 21 12 21z" /></svg>; }

/* ---------------- Feed ---------------- */
function Feed({ onPost, user }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState(null);
  useEffect(() => { let on = true; fetch("/api/pines?limit=20").then((r) => r.json()).then((d) => on && setSt({ loading: false, pines: d.pines || [] })).catch(() => on && setSt({ loading: false, pines: [] })); return () => { on = false; }; }, []);
  const p = st.pines[idx];
  useEffect(() => { setVerdict(null); if (p && p.display_lat != null && p.display_lng != null) fetchVerdict(p.display_lat, p.display_lng).then(setVerdict); }, [p && p.id]);

  if (st.loading) return <Center><span style={{ color: "var(--pb-muted)", ...micro }}>Loading Pines…</span></Center>;
  if (!st.pines.length) return <Center><Empty user={user} onPost={onPost} /></Center>;

  const src = p.image_url || p.poster_url;
  const vc = verdict ? vColor(verdict.v) : "#aab0ba";
  return (
    <div style={{ position: "relative", width: "100%", minHeight: "100vh", background: "#000" }}>
      {src ? <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={p.place_name} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(6,14,10,.5),transparent 22%,transparent 52%,rgba(6,14,10,.96))" }} />
      <div style={{ position: "absolute", left: 16, top: 46, zIndex: 6, display: "flex", gap: 4 }}>{st.pines.map((x, i) => <span key={i} style={{ width: i === idx ? 18 : 6, height: 3, borderRadius: 2, background: i === idx ? "var(--pb-gold)" : "rgba(255,255,255,.4)", transition: "width .3s" }} />)}</div>
      {verdict && (
        <div style={{ position: "absolute", top: 42, right: 14, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, background: "rgba(6,14,10,.55)", backdropFilter: "blur(10px)", border: "1px solid " + vc + "66", borderRadius: 14, padding: "8px 11px" }}>
          <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".06em", fontWeight: 700, color: vc }}>{verdict.v}</span>
          <span style={{ fontFamily: mono, fontSize: ".44rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#cfd6cf" }}>Conditions ›</span>
        </div>
      )}
      <div style={{ position: "absolute", right: 12, bottom: 150, zIndex: 6, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", color: "#fff" }}>
        <RailBtn label={p.like_count || 0}><path d="M12 21s-7-4.6-9.2-9C1.3 8.6 3 5 6.4 5 8.4 5 12 7 12 7s3.6-2 5.6-2C21 5 22.7 8.6 21.2 12 19 16.4 12 21 12 21z" /></RailBtn>
        <RailBtn label={p.comment_count || 0}><path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" /></RailBtn>
        <RailBtn><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></RailBtn>
      </div>
      <div style={{ position: "absolute", left: 16, right: 70, bottom: 96, zIndex: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>📍 {p.place_name || "Adventure"}</span>
          {p.verified && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...micro, fontSize: ".5rem", color: C.go, border: "1px solid " + C.go + "88", borderRadius: 999, padding: "3px 8px", background: "rgba(6,14,10,.4)" }}>✓ On-site</span>}
        </div>
        {p.caption && <div style={{ color: "rgba(255,255,255,.94)", fontSize: ".86rem", lineHeight: 1.5, margin: "9px 0 11px", textShadow: "0 1px 8px rgba(0,0,0,.5)" }}>{p.caption}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/build-trip" style={{ fontSize: ".76rem", fontWeight: 700, background: C.gold, color: "var(--pb-bg)", borderRadius: 999, padding: "8px 14px", textDecoration: "none" }}>＋ Add to trip</Link>
          {p.place_type === "park" && <Link href={"/parks/" + p.place_id} style={{ fontSize: ".76rem", fontWeight: 600, background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.24)", borderRadius: 999, padding: "8px 14px", textDecoration: "none" }}>Conditions</Link>}
        </div>
      </div>
      {st.pines.length > 1 && <button onClick={() => setIdx((idx + 1) % st.pines.length)} aria-label="Next" style={{ cursor: "pointer", position: "absolute", left: 0, right: 0, top: 90, bottom: 210, zIndex: 5, background: "transparent", border: "none" }} />}
    </div>
  );
}
function RailBtn({ children, label }) {
  return <button style={{ cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#fff", fontSize: ".6rem", fontWeight: 600 }}><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" style={{ width: 26, height: 26, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" }}>{children}</svg>{label != null && label !== 0 ? <span>{label}</span> : null}</button>;
}

/* ---------------- Top ---------------- */
function Top({ openHub }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  useEffect(() => { fetch("/api/pines?sort=top").then((r) => r.json()).then((d) => setSt({ loading: false, pines: d.pines || [] })).catch(() => setSt({ loading: false, pines: [] })); }, []);
  const P = st.pines;
  return (
    <div style={{ padding: "52px 0 20px" }}>
      <div style={{ padding: "0 15px 14px" }}>
        <div style={{ ...micro, color: "var(--pb-gold-soft)" }}>Last 7 days · most loved</div>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "2rem", lineHeight: 1.02, marginTop: 4, color: "var(--pb-ink)" }}>Top of the week</h2>
      </div>
      {st.loading ? <p style={pad()}>Loading…</p> : !P.length ? <p style={{ ...pad(), color: "var(--pb-ink-2)", lineHeight: 1.6 }}>No ranked Pines yet. Once Adventures start rolling in, the week's most-loved show up here — get pinned and you could be #1.</p> : (
        <>
          <button onClick={() => openHub(placeOf(P[0]))} style={{ cursor: "pointer", display: "block", textAlign: "left", position: "relative", margin: "0 15px", width: "calc(100% - 30px)", borderRadius: 18, overflow: "hidden", border: "1px solid var(--pb-line-strong)", aspectRatio: "5/4", background: "#000" }}>
            {P[0].image_url || P[0].poster_url ? <img src={P[0].image_url || P[0].poster_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={P[0].place_name} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(6,14,10,.95),transparent 60%)" }} />
            <span style={{ position: "absolute", top: 12, left: 12, fontFamily: serif, fontWeight: 700, fontSize: "3.4rem", lineHeight: .8, color: "var(--pb-gold)", textShadow: "0 4px 20px rgba(0,0,0,.6)" }}>1</span>
            <span style={{ position: "absolute", top: 14, right: 12, ...micro, fontSize: ".5rem", color: "var(--pb-bg)", background: C.gold, borderRadius: 999, padding: "4px 10px" }}>★ #1 this week</span>
            <div style={{ position: "absolute", left: 14, right: 14, bottom: 13 }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.6rem", color: "#fff" }}>{P[0].place_name || "Adventure"}</div><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}><span style={{ display: "flex", alignItems: "center", gap: 5, color: "#fff", fontSize: ".82rem", fontWeight: 600 }}>{heart(15)}{P[0].like_count || 0}</span></div></div>
          </button>
          <div style={{ marginTop: 14 }}>{P.slice(1).map((t, i) => (
            <button key={t.id} onClick={() => openHub(placeOf(t))} style={{ cursor: "pointer", width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 13, background: "none", border: "none", borderTop: "1px solid var(--pb-line)", padding: "13px 15px" }}>
              <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", color: "var(--pb-gold-soft)", width: 30, flex: "none" }}>{i + 2}</span>
              <span style={{ position: "relative", width: 48, height: 48, borderRadius: 11, overflow: "hidden", flex: "none" }}>{t.image_url || t.poster_url ? <img src={t.image_url || t.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={t.place_name} />}</span>
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontFamily: serif, fontWeight: 600, fontSize: "1.1rem", color: "var(--pb-ink)" }}>{t.place_name || "Adventure"}</span></span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: C.like, fontSize: ".78rem", fontWeight: 600 }}>{heart(14)}{t.like_count || 0}</span>
            </button>
          ))}</div>
          <div style={{ textAlign: "center", padding: "18px 15px 8px", ...micro, letterSpacing: ".1em", color: "var(--pb-muted)" }}>Featured Adventures earn a bonus. Get pinned.</div>
        </>
      )}
    </div>
  );
}

/* ---------------- Place hub (Campfire) ---------------- */
function Hub({ place, onBack }) {
  const pl = place || { type: "park", name: "a place", q: "national park" };
  const [pins, setPins] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const cover = usePhoto(pl.q || pl.name);
  useEffect(() => {
    if (!pl.id) { setPins([]); return; }
    fetch("/api/pines?place=" + encodeURIComponent((pl.type || "park") + ":" + pl.id)).then((r) => r.json()).then((d) => setPins(d.pines || [])).catch(() => setPins([]));
  }, [pl.id]);
  return (
    <div>
      <div style={{ position: "relative", height: 170 }}>
        <Photo q={pl.q || pl.name} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,var(--pb-bg),transparent 65%)" }} />
        <button onClick={onBack} style={{ cursor: "pointer", position: "absolute", top: 20, left: 14, width: 32, height: 32, borderRadius: "50%", background: "rgba(6,14,10,.5)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", fontSize: "1rem" }}>‹</button>
      </div>
      <div style={{ padding: "0 15px", marginTop: -40, position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
          <div><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", lineHeight: 1.02, color: "var(--pb-ink)" }}>{pl.name} Campfire</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <span style={{ fontSize: ".76rem", fontWeight: 700, background: C.gold, color: "var(--pb-bg)", borderRadius: 999, padding: "8px 16px", cursor: "pointer" }}>Follow</span>
          {pl.type === "park" && pl.id && <Link href={"/parks/" + pl.id} style={{ fontSize: ".76rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 16px", textDecoration: "none" }}>Live conditions ›</Link>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 22, padding: "14px 15px 0", borderBottom: "1px solid var(--pb-line)", marginTop: 14 }}>
        {["Pines", "Talk", "Live"].map((t, i) => <span key={t} style={{ fontSize: ".84rem", fontWeight: 600, color: i === 0 ? "var(--pb-ink)" : "var(--pb-muted)", paddingBottom: 9, borderBottom: i === 0 ? "2px solid var(--pb-gold-2)" : "none" }}>{t}</span>)}
      </div>
      {pins === null ? <p style={pad()}>Loading…</p> : !pins.length ? (
        <p style={{ ...pad(), color: "var(--pb-ink-2)", lineHeight: 1.6 }}>No Pines from {pl.name} yet. Be the first — capture one on-site and pin it here.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, padding: "3px 3px 0" }}>
          {pins.map((p) => <div key={p.id} style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: "#000" }}>{p.image_url || p.poster_url ? <img src={p.image_url || p.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={p.place_name} />}</div>)}
        </div>
      )}
      <div style={{ height: 14 }} />
    </div>
  );
}

/* ---------------- Places ---------------- */
function Places({ openHub }) {
  const [mine, setMine] = useState(null);
  useEffect(() => {
    (async () => {
      try { const t = await getAccessToken(); if (!t) { setMine([]); return; } const r = await fetch("/api/my-alerts", { headers: { Authorization: "Bearer " + t } }); const d = await r.json().catch(() => ({})); setMine((d.alerts || []).map((a) => ({ type: "park", id: a.park_id, name: a.park_name || a.park_id, q: a.park_name }))); } catch { setMine([]); }
    })();
  }, []);
  const popular = [
    { name: "Yosemite National Park", id: "yose", q: "Yosemite Valley" }, { name: "Grand Teton National Park", id: "grte", q: "Grand Teton National Park" },
    { name: "Zion National Park", id: "zion", q: "Zion National Park" }, { name: "Glacier National Park", id: "glac", q: "Glacier National Park (U.S.)" },
    { name: "Rocky Mountain National Park", id: "romo", q: "Rocky Mountain National Park" }, { name: "Acadia National Park", id: "acad", q: "Acadia National Park" },
  ];
  return (
    <div style={{ padding: "50px 0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 15px 10px" }}>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", color: "var(--pb-ink)" }}>Places</span>
      </div>
      <div style={{ margin: "0 15px", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "11px 13px", color: "var(--pb-muted)", fontSize: ".82rem" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>Search parks, forests, towns
      </div>
      {mine && mine.length > 0 && <>
        <div style={{ ...micro, color: "var(--pb-gold-soft)", padding: "18px 15px 4px" }}>Your Campfires</div>
        {mine.map((p) => <PlaceRow key={p.id} p={p} onClick={() => openHub(p)} tag="following" />)}
      </>}
      <div style={{ ...micro, color: "var(--pb-gold-soft)", padding: "18px 15px 4px" }}>Popular parks</div>
      {popular.map((p) => <PlaceRow key={p.id} p={p} onClick={() => openHub(p)} />)}
      <div style={{ height: 14 }} />
    </div>
  );
}
function PlaceRow({ p, onClick, tag }) {
  const sub = p.name.includes("Forest") ? "National Forest" : p.name.toLowerCase().includes("town") ? "Gateway town" : "National Park";
  return (
    <button onClick={onClick} style={{ cursor: "pointer", width: "calc(100% - 30px)", textAlign: "left", display: "flex", alignItems: "center", gap: 11, margin: "9px 15px 0", padding: 9, border: "1px solid var(--pb-line)", borderRadius: 13, background: "var(--pb-surface)" }}>
      <span style={{ position: "relative", width: 44, height: 44, borderRadius: 10, overflow: "hidden", flex: "none" }}><Photo q={p.q || p.name} /></span>
      <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".86rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name.replace(" National Park", " NP")}</b><span style={{ fontSize: ".64rem", color: "var(--pb-muted)" }}>{sub}</span></span>
      {tag && <span style={{ ...micro, fontSize: ".5rem", color: "var(--pb-gold-soft)", flex: "none" }}>{tag}</span>}
    </button>
  );
}

/* ---------------- You ---------------- */
function You({ user, onPost }) {
  const [mine, setMine] = useState(null);
  useEffect(() => {
    if (!user) { setMine([]); return; }
    (async () => { try { const t = await getAccessToken(); const r = await fetch("/api/pines?mine=1", { headers: { Authorization: "Bearer " + t } }); const d = await r.json().catch(() => ({})); setMine(d.pines || []); } catch { setMine([]); } })();
  }, [user]);
  if (!user) return <div style={{ padding: "60px 20px" }}><h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", color: "var(--pb-ink)" }}>Your Pines</h2><p style={{ color: "var(--pb-ink-2)", lineHeight: 1.6, margin: "10px 0 16px" }}>Sign in to post Adventures and track the ones you've shared.</p><button onClick={() => openAuth()} style={goldBtn()}>Sign in</button></div>;
  const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || "").split("@")[0];
  const live = (mine || []).filter((m) => m.status === "approved").length;
  const stats = [[String((mine || []).length), "Pines"], ["0", "Followers"], ["0", "Following"], [String(live), "Live"]];
  return (
    <div style={{ padding: "50px 0 20px" }}>
      <div style={{ padding: "0 15px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 66, height: 66, borderRadius: "50%", flex: "none", background: "linear-gradient(150deg,#1f5e46,#0e2016)", border: "2px solid var(--pb-gold-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontWeight: 600, fontSize: "1.8rem", color: "var(--pb-gold)" }}>{(name[0] || "?").toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", lineHeight: 1, color: "var(--pb-ink)" }}>{name}</div><div style={{ fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div></div>
        </div>
        <div style={{ display: "flex", marginTop: 14, border: "1px solid var(--pb-line)", borderRadius: 14, overflow: "hidden" }}>
          {stats.map((s, i) => <div key={i} style={{ flex: 1, textAlign: "center", padding: "11px 4px", borderLeft: i ? "1px solid var(--pb-line)" : "none" }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.3rem", color: "var(--pb-ink)" }}>{s[0]}</div><div style={{ ...micro, fontSize: ".48rem", color: "var(--pb-muted)", marginTop: 2 }}>{s[1]}</div></div>)}
        </div>
        <div style={{ marginTop: 14, borderRadius: 16, overflow: "hidden", border: "1px solid var(--pb-line-strong)", background: "linear-gradient(150deg,rgba(31,94,70,.2),rgba(14,32,22,.7))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 15px 0" }}><span style={{ ...micro, color: "var(--pb-gold-soft)" }}>Creator earnings</span></div>
          <div style={{ display: "flex", padding: "10px 15px 15px" }}>
            {[["$0", "This month"], ["$0", "Lifetime"], ["—", "Next payout"]].map((e, i) => <div key={i} style={{ flex: 1, borderLeft: i ? "1px solid var(--pb-line)" : "none", paddingLeft: i ? 12 : 0 }}><div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.5rem", background: "linear-gradient(120deg,#f0dcae,#c9a35f)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{e[0]}</div><div style={{ ...micro, fontSize: ".46rem", color: "var(--pb-muted)", marginTop: 2 }}>{e[1]}</div></div>)}
          </div>
          <div style={{ ...micro, letterSpacing: ".04em", textTransform: "none", color: "var(--pb-muted)", padding: "0 15px 13px", lineHeight: 1.5 }}>You'll earn when your Pines drive real bookings — rev-share, tips &amp; bounties are rolling out.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, padding: "16px 15px 0", borderBottom: "1px solid var(--pb-line)", marginTop: 14 }}>
        {["Pines", "Posts", "Saved"].map((t, i) => <span key={t} style={{ fontSize: ".82rem", fontWeight: 600, color: i === 0 ? "var(--pb-ink)" : "var(--pb-muted)", paddingBottom: 9, borderBottom: i === 0 ? "2px solid var(--pb-gold-2)" : "none" }}>{t}</span>)}
      </div>
      {mine === null ? <p style={pad()}>Loading…</p> : !mine.length ? (
        <div style={{ padding: "22px 15px", textAlign: "center" }}><p style={{ color: "var(--pb-ink-2)", lineHeight: 1.6, margin: "0 0 14px" }}>No Adventures yet. Pin your first — a real photo from a real place.</p><button onClick={onPost} style={goldBtn("auto")}>＋ Post a Pine</button></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, padding: 3 }}>
          {mine.map((m) => { const stc = m.status === "approved" ? C.go : m.status === "rejected" ? C.hold : C.prep; const lbl = m.status === "approved" ? "Live" : m.status === "rejected" ? "Rejected" : m.status === "processing" ? "Processing" : "Review"; return (
            <div key={m.id} style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: "#000" }}>
              {m.image_url || m.poster_url ? <img src={m.image_url || m.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={m.place_name} />}
              <span style={{ position: "absolute", top: 5, left: 5, ...micro, fontSize: ".44rem", color: stc, background: "rgba(6,14,10,.7)", border: "1px solid " + stc + "88", borderRadius: 999, padding: "2px 6px" }}>{lbl}</span>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

/* ---------------- shared ---------------- */
function Center({ children }) { return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>{children}</div>; }
function pad() { return { padding: "22px 15px", color: "var(--pb-muted)", fontSize: ".9rem" }; }
function goldBtn(w) { return { cursor: "pointer", width: w || "auto", fontFamily: "var(--pb-sans)", fontSize: ".92rem", fontWeight: 700, color: "var(--pb-bg)", background: C.gold, border: "none", borderRadius: 999, padding: "12px 24px" }; }
function Empty({ user, onPost }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 440 }}>
      <div style={{ fontSize: "2.4rem", marginBottom: 6 }}>🌲</div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem,6vw,2.8rem)", lineHeight: 1.05, color: "var(--pb-ink)", margin: "0 0 12px" }}>Pines are coming</h1>
      <p style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.6, margin: "0 0 22px" }}>Short, real Adventures from the parks — every one captured on-site and pinned to the exact place, next to today's conditions. No stock, no fakes.</p>
      <button onClick={onPost} style={goldBtn()}>{user ? "Be the first to pin one" : "Sign in to pin one"}</button>
      <div style={{ ...micro, color: "var(--pb-muted)", marginTop: 18 }}>Reels, but for the wild.</div>
    </div>
  );
}
