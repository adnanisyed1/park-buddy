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
import SiteHeader from "../components/SiteHeader";
import PinesCompose from "./PinesCompose";
import { useAuth, openAuth, getAccessToken } from "../lib/auth";

const HEADER = 66; // standard platform header height (SiteHeader is fixed on top)

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
    return { v: severe ? "HOLD" : alerts.length ? "PREPARE" : "GO", alert: alerts[0] || null, temp: d.temp && d.temp.label ? d.temp.label : null };
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

  const screen = { feed: <Feed onPost={post} user={user} isWeb={isWeb} />, top: <Top openHub={openHub} />, hub: <Hub place={hub} onBack={() => setTab("places")} />, places: <Places openHub={openHub} />, you: <You user={user} onPost={post} /> }[tab];

  // feed is a full-bleed media stage; other screens are centered content columns.
  const wrap = tab === "feed"
    ? { maxWidth: isWeb ? 500 : "100%", margin: "0 auto", height: "calc(100dvh - " + HEADER + "px)" }
    : { maxWidth: 940, margin: "0 auto", padding: "0 0 104px" };

  return (
    <>
      <SiteHeader active="pines" solid />
      <div style={{ position: "fixed", top: HEADER, left: 0, right: 0, bottom: 0, overflowY: tab === "feed" ? "hidden" : "auto", WebkitOverflowScrolling: "touch", background: "var(--pb-bg)", fontFamily: "var(--pb-sans)" }}>
        <div style={wrap}>{screen}</div>
      </div>
      <FloatingTabs tab={tab} go={go} isWeb={isWeb} />
      {compose && <PinesCompose open={compose} onClose={() => setCompose(false)} onPosted={() => setTab("you")} />}
    </>
  );
}

/* ---------------- floating bottom tab bar (phone full-width · web centered pill) ---------------- */
function navIcon(id) {
  const p = { feed: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>, places: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>, you: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> }[id];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 19, height: 19 }}>{p}</svg>;
}
function FloatingTabs({ tab, go, isWeb }) {
  const cur = tab === "top" ? "feed" : tab === "hub" ? "places" : tab;
  const T = (id, label) => (
    <button key={id} onClick={() => go(id)} style={{ flex: isWeb ? "none" : 1, cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "var(--pb-sans)", fontSize: ".58rem", fontWeight: 600, color: cur === id ? "var(--pb-gold)" : "var(--pb-muted)", padding: isWeb ? "6px 18px" : 0 }}>{navIcon(id)}{label}</button>
  );
  const plus = (
    <button key="c" onClick={() => go("compose")} aria-label="Post" style={{ flex: isWeb ? "none" : 1, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: isWeb ? "0 10px" : 0 }}>
      <span style={{ width: isWeb ? 42 : 44, height: isWeb ? 42 : 44, borderRadius: 14, background: C.gold, color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.45rem", fontWeight: 700, boxShadow: "0 8px 22px -8px rgba(217,183,121,.8)" }}>＋</span>
    </button>
  );
  const shell = isWeb
    ? { position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, background: "rgba(8,19,13,.82)", WebkitBackdropFilter: "blur(18px)", backdropFilter: "blur(18px)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 10px", boxShadow: "0 24px 60px -24px rgba(0,0,0,.85)", zIndex: 90 }
    : { position: "fixed", left: 0, right: 0, bottom: 0, height: 62, display: "flex", alignItems: "center", background: "rgba(8,19,13,.94)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", borderTop: "1px solid var(--pb-line)", zIndex: 90 };
  return <nav style={shell}>{T("feed", "Feed")}{T("places", "Places")}{plus}{T("you", "Mine")}</nav>;
}
function placeOf(p) { return { type: p.place_type || "park", id: p.place_id, name: p.place_name, q: p.place_name }; }
function heart(sz) { return <svg viewBox="0 0 24 24" fill={C.like} style={{ width: sz, height: sz }}><path d="M12 21s-7-4.6-9.2-9C1.3 8.6 3 5 6.4 5 8.4 5 12 7 12 7s3.6-2 5.6-2C21 5 22.7 8.6 21.2 12 19 16.4 12 21 12 21z" /></svg>; }

/* ---------------- Feed ---------------- */
function Feed({ onPost, user, isWeb }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState(null);
  const [like, setLike] = useState({ liked: false, count: 0 });
  const [commentsOpen, setCommentsOpen] = useState(false);
  useEffect(() => { let on = true; fetch("/api/pines?limit=20").then((r) => r.json()).then((d) => on && setSt({ loading: false, pines: d.pines || [] })).catch(() => on && setSt({ loading: false, pines: [] })); return () => { on = false; }; }, []);
  const p = st.pines[idx];
  useEffect(() => { setVerdict(null); if (p && p.display_lat != null && p.display_lng != null) fetchVerdict(p.display_lat, p.display_lng).then(setVerdict); }, [p && p.id]);
  // real like state for the active pine
  useEffect(() => {
    if (!p) return; setLike({ liked: false, count: p.like_count || 0 });
    (async () => { try { const t = await getAccessToken(); const r = await fetch("/api/pines/like?pine_id=" + p.id, t ? { headers: { Authorization: "Bearer " + t } } : {}); const d = await r.json().catch(() => ({})); setLike({ liked: !!d.liked, count: d.like_count != null ? d.like_count : (p.like_count || 0) }); } catch {} })();
  }, [p && p.id]);
  const toggleLike = async () => {
    if (!user) { openAuth(); return; }
    setLike((l) => ({ liked: !l.liked, count: l.count + (l.liked ? -1 : 1) })); // optimistic
    try { const t = await getAccessToken(); const r = await fetch("/api/pines/like", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ pine_id: p.id }) }); const d = await r.json().catch(() => ({})); if (d.like_count != null) setLike({ liked: !!d.liked, count: d.like_count }); } catch {}
  };

  if (st.loading) return <Center><span style={{ color: "var(--pb-muted)", ...micro }}>Loading Pines…</span></Center>;
  if (!st.pines.length) return <Center><Empty user={user} onPost={onPost} /></Center>;

  const src = p.image_url || p.poster_url;
  const vc = verdict ? vColor(verdict.v) : "#aab0ba";
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 480, background: "#000", overflow: "hidden", borderRadius: isWeb ? 20 : 0, border: isWeb ? "1px solid var(--pb-line)" : "none", marginTop: isWeb ? 18 : 0 }}>
      {src ? <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={p.place_name} />}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(6,14,10,.5),transparent 22%,transparent 52%,rgba(6,14,10,.96))" }} />
      <div style={{ position: "absolute", left: 16, top: 14, zIndex: 6, display: "flex", gap: 4 }}>{st.pines.map((x, i) => <span key={i} style={{ width: i === idx ? 18 : 6, height: 3, borderRadius: 2, background: i === idx ? "var(--pb-gold)" : "rgba(255,255,255,.4)", transition: "width .3s" }} />)}</div>
      {verdict && (
        <div style={{ position: "absolute", top: 26, right: 14, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, background: "rgba(6,14,10,.55)", backdropFilter: "blur(10px)", border: "1px solid " + vc + "66", borderRadius: 14, padding: "8px 11px" }}>
          <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".06em", fontWeight: 700, color: vc }}>{verdict.v}{verdict.temp ? " · " + verdict.temp : ""}</span>
          <span style={{ fontFamily: mono, fontSize: ".44rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#cfd6cf" }}>Conditions ›</span>
        </div>
      )}
      <div style={{ position: "absolute", right: 12, bottom: 150, zIndex: 6, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", color: "#fff" }}>
        <RailBtn label={like.count} onClick={toggleLike} active={like.liked}><path d="M12 21s-7-4.6-9.2-9C1.3 8.6 3 5 6.4 5 8.4 5 12 7 12 7s3.6-2 5.6-2C21 5 22.7 8.6 21.2 12 19 16.4 12 21 12 21z" /></RailBtn>
        <RailBtn label={p.comment_count || 0} onClick={() => setCommentsOpen(true)}><path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" /></RailBtn>
        <RailBtn onClick={() => { try { navigator.share ? navigator.share({ title: "Park Buddy Pines", url: location.href }) : navigator.clipboard.writeText(location.href); } catch {} }}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></RailBtn>
      </div>
      {commentsOpen && <CommentsSheet pine={p} user={user} onClose={() => setCommentsOpen(false)} />}
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
function RailBtn({ children, label, onClick, active }) {
  return <button onClick={onClick} style={{ cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#fff", fontSize: ".6rem", fontWeight: 600 }}><svg viewBox="0 0 24 24" fill={active ? C.like : "none"} stroke={active ? C.like : "#fff"} strokeWidth="2" style={{ width: 26, height: 26, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" }}>{children}</svg>{label != null && label !== 0 ? <span>{label}</span> : null}</button>;
}

function CommentsSheet({ pine, user, onClose }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/pines/comments?pine_id=" + pine.id).then((r) => r.json()).then((d) => setComments(d.comments || [])).catch(() => setComments([]));
  useEffect(() => { load(); }, [pine.id]); // eslint-disable-line
  const post = async () => {
    if (!user) { openAuth(); return; }
    const body = text.trim(); if (!body) return;
    setBusy(true);
    try { const t = await getAccessToken(); const r = await fetch("/api/pines/comments", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ pine_id: pine.id, body }) }); if (r.ok) { setText(""); await load(); } } catch {}
    setBusy(false);
  };
  const fmt = (d) => { try { return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" }); } catch { return ""; } };
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(4,7,5,.5)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: "var(--pb-bg)", borderTop: "1px solid var(--pb-line-strong)", borderRadius: "22px 22px 0 0", maxHeight: "80%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--pb-line)" }}>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.15rem", color: "var(--pb-ink)" }}>Comments</span>
          <button onClick={onClose} aria-label="Close" style={{ cursor: "pointer", width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "transparent", color: "var(--pb-ink-2)" }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 16px", flex: 1 }}>
          {comments === null ? <p style={{ color: "var(--pb-muted)", fontSize: ".85rem", padding: "12px 0" }}>Loading…</p>
            : !comments.length ? <p style={{ color: "var(--pb-ink-2)", fontSize: ".9rem", lineHeight: 1.6, padding: "16px 0", textAlign: "center" }}>No comments yet. Be the first to say something.</p>
            : comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--pb-line)" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", flex: "none", background: "linear-gradient(150deg,#1f5e46,#0e2016)", border: "1px solid var(--pb-gold-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: serif, fontSize: ".75rem", color: "var(--pb-gold)" }}>{(c.author_name || "?")[0].toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: ".8rem", color: "var(--pb-ink)" }}><b>{c.author_name || "Someone"}</b> <span style={{ color: "var(--pb-muted)", fontSize: ".7rem" }}>· {fmt(c.created_at)}</span></div><div style={{ fontSize: ".88rem", color: "var(--pb-ink-2)", lineHeight: 1.45, marginTop: 2 }}>{c.body}</div></div>
              </div>
            ))}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--pb-line)" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} placeholder={user ? "Add a comment…" : "Sign in to comment"} style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "10px 14px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".88rem", outline: "none" }} />
          <button onClick={post} disabled={busy} style={{ ...goldBtn(), padding: "10px 18px", flex: "none" }}>Post</button>
        </div>
      </div>
    </div>
  );
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
          <FollowButton place={pl} />
          {pl.type === "park" && pl.id && <Link href={"/parks/" + pl.id} style={{ fontSize: ".76rem", fontWeight: 600, color: "var(--pb-ink)", background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 16px", textDecoration: "none" }}>Live conditions ›</Link>}
        </div>
      </div>
      <HubTabs pl={pl} pins={pins} />
      <div style={{ height: 14 }} />
    </div>
  );
}

function FollowButton({ place }) {
  const { user } = useAuth();
  const [state, setState] = useState(""); // "" | busy | done
  const follow = async () => {
    if (!user) { openAuth(); return; }
    if (place.type !== "park" || !place.id) { setState("done"); return; } // only parks have alert follows today
    setState("busy");
    try { const r = await fetch("/api/park-alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, park_id: place.id, park_name: place.name, alert_verdict: true }) }); setState(r.ok ? "done" : ""); } catch { setState(""); }
  };
  return <button onClick={follow} disabled={state === "busy"} style={{ cursor: "pointer", fontFamily: "var(--pb-sans)", fontSize: ".76rem", fontWeight: 700, background: state === "done" ? "rgba(255,255,255,.05)" : C.gold, color: state === "done" ? "var(--pb-ink)" : "var(--pb-bg)", border: state === "done" ? "1px solid var(--pb-line-strong)" : "none", borderRadius: 999, padding: "8px 16px" }}>{state === "done" ? "✓ Following" : state === "busy" ? "…" : "Follow"}</button>;
}

function HubTabs({ pl, pins }) {
  const [sub, setSub] = useState("talk"); // Talk is first & default
  return (
    <>
      <div style={{ display: "flex", gap: 22, padding: "14px 15px 0", borderBottom: "1px solid var(--pb-line)", marginTop: 14 }}>
        {["talk", "pines", "live"].map((t) => <button key={t} onClick={() => setSub(t)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--pb-sans)", fontSize: ".84rem", fontWeight: 600, textTransform: "capitalize", color: sub === t ? "var(--pb-ink)" : "var(--pb-muted)", paddingBottom: 9, borderBottom: sub === t ? "2px solid var(--pb-gold-2)" : "2px solid transparent" }}>{t}</button>)}
      </div>
      {sub === "talk" && (
        <div style={{ padding: "10px 15px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "11px 13px", color: "var(--pb-muted)", fontSize: ".82rem" }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(150deg,#1f5e46,#0e2016)", border: "1px solid var(--pb-gold-2)", flex: "none" }} />Start a conversation at {pl.name}…
          </div>
          <p style={{ ...pad(), color: "var(--pb-ink-2)", lineHeight: 1.6, textAlign: "center" }}>No conversations yet. Be the first — share what's happening on the ground: trail conditions, a buddy request, a wildlife sighting.</p>
        </div>
      )}
      {sub === "pines" && (
        pins === null ? <p style={pad()}>Loading…</p> : !pins.length ? <p style={{ ...pad(), color: "var(--pb-ink-2)", lineHeight: 1.6 }}>No Pines from {pl.name} yet. Be the first — capture one on-site and pin it here.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, padding: "3px 3px 0" }}>
            {pins.map((p) => <div key={p.id} style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: "#000" }}>{p.image_url || p.poster_url ? <img src={p.image_url || p.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={p.place_name} />}</div>)}
          </div>
        )
      )}
      {sub === "live" && (
        <div style={{ ...pad(), color: "var(--pb-ink-2)", lineHeight: 1.6 }}>{pl.type === "park" && pl.id ? <>See the full live conditions — weather, alerts, air quality — on the park's status page. <Link href={"/parks/" + pl.id} style={{ color: "var(--pb-gold)" }}>Open conditions ›</Link></> : "Live conditions appear here once this place is linked."}</div>
      )}
    </>
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
function Center({ children }) { return <div style={{ height: "100%", minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>{children}</div>; }
function pad() { return { padding: "22px 15px", color: "var(--pb-muted)", fontSize: ".9rem" }; }
function goldBtn(w) { return { cursor: "pointer", width: w || "auto", fontFamily: "var(--pb-sans)", fontSize: ".92rem", fontWeight: 700, color: "var(--pb-bg)", background: C.gold, border: "none", borderRadius: 999, padding: "12px 24px" }; }
function Empty({ user, onPost }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 460 }}>
      <div style={{ ...micro, color: "var(--pb-gold-soft)", marginBottom: 10 }}>Coming soon · early access</div>
      <div style={{ fontSize: "2.4rem", marginBottom: 6 }}>🌲</div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem,6vw,2.9rem)", lineHeight: 1.04, color: "var(--pb-ink)", margin: "0 0 12px" }}>Reels, but for the wild.</h1>
      <p style={{ color: "var(--pb-ink-2)", fontSize: "1.02rem", lineHeight: 1.6, margin: "0 0 22px" }}>Short, real Adventures from the parks — every one captured on-site, pinned to the exact place, next to today's live conditions. No stock, no fakes.</p>
      <Waitlist />
      <div style={{ margin: "18px 0 0", display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
        <span style={{ height: 1, width: 40, background: "var(--pb-line)" }} /><span style={micro}>or</span><span style={{ height: 1, width: 40, background: "var(--pb-line)" }} />
      </div>
      <button onClick={onPost} style={{ ...goldBtn(), background: "transparent", color: "var(--pb-ink)", border: "1px solid var(--pb-line-strong)", marginTop: 16 }}>{user ? "Post the first Pine" : "Sign in to post"}</button>
    </div>
  );
}

function Waitlist() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState(""); // "" | busy | done | error
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setState("error"); setMsg("Enter a valid email."); return; }
    setState("busy");
    try {
      const r = await fetch("/api/pines-waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), source: "pines-feed" }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setState("done"); } else { setState("error"); setMsg(d.error || "Something went wrong."); }
    } catch { setState("error"); setMsg("Couldn't reach the waitlist."); }
  };
  if (state === "done") return <div style={{ ...micro, letterSpacing: ".04em", textTransform: "none", color: C.go, fontSize: ".9rem" }}>✓ You're on the list — we'll email you the moment Pines opens.</div>;
  return (
    <>
      <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 380, margin: "0 auto", justifyContent: "center" }}>
        <input type="email" placeholder="you@email.com" value={email} onChange={(e) => { setEmail(e.target.value); setState(""); }}
          style={{ flex: "1 1 170px", minWidth: 0, background: "rgba(255,255,255,.04)", border: "1px solid " + (state === "error" ? "var(--pb-hold)" : "var(--pb-line-strong)"), borderRadius: 999, padding: "12px 16px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".9rem", outline: "none" }} />
        <button type="submit" disabled={state === "busy"} style={{ ...goldBtn(), padding: "12px 20px", flex: "1 1 auto", whiteSpace: "nowrap" }}>{state === "busy" ? "…" : "Get early access"}</button>
      </form>
      {state === "error" && msg && <div style={{ color: "var(--pb-hold)", fontSize: ".8rem", marginTop: 8 }}>{msg}</div>}
    </>
  );
}
