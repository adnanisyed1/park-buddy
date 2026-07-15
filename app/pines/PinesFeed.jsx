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

const HEADER = 102; // clears the floating SiteHeader island (fixed, inset ~14px + ~80px tall)

const C = { gold: "linear-gradient(120deg,#e8cf9a,#c9a35f)", go: "#4fd98a", prep: "#e8cf9a", hold: "#e08a6a", like: "#e0546a" };
const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const vColor = (v) => (v === "GO" ? C.go : v === "PREPARE" ? C.prep : v === "HOLD" ? C.hold : "#aab0ba");
const vShort = (v) => (v === "PREPARE" ? "PREP" : v);
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase" };
const arrowBtn = { cursor: "pointer", width: 38, height: 38, borderRadius: "50%", background: "rgba(6,14,10,.55)", WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", fontSize: "1rem", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" };

// ---- real photo via our pipeline (/api/photo?q=pipe|candidates), with cache + fade ----
const photoCache = {};
function usePhoto(q) {
  const key = q || "";
  const [url, setUrl] = useState(photoCache[key] || null);
  useEffect(() => {
    if (!key) return;
    if (photoCache[key] !== undefined) { if (photoCache[key]) setUrl(photoCache[key]); return; } // cached (incl. failed "") — don't refetch
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
  // 6-tab model: Feed (people/places you follow) · Pines (global discover) · ＋ ·
  // Campfire (place communities) · Gallery (browse every photo/reel) · Mine.
  const [tab, setTab] = useState("pines"); // open on discover so first paint always has content
  const [isWeb, setIsWeb] = useState(false);
  const [compose, setCompose] = useState(false);
  const [hub, setHub] = useState(null); // {type,id,name,q}
  const [lightbox, setLightbox] = useState(null); // a pine opened full-screen from Gallery

  useEffect(() => {
    const mq = window.matchMedia("(min-width:1000px)");
    const sync = () => setIsWeb(mq.matches);
    sync(); mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const post = () => { if (!user) { openAuth(); return; } setCompose(true); };
  const go = (t) => { if (t === "compose") return post(); setTab(t); };
  const openHub = (place) => { setHub(place); setTab("hub"); };

  const screen = {
    feed: <FeedPersonal user={user} onPost={post} openHub={openHub} goDiscover={() => setTab("pines")} goCampfire={() => setTab("campfire")} />,
    pines: <Discover onPost={post} user={user} isWeb={isWeb} />,
    campfire: <Campfire openHub={openHub} />,
    hub: <Hub place={hub} onBack={() => setTab("campfire")} />,
    gallery: <Gallery onOpen={setLightbox} />,
    mine: <You user={user} onPost={post} />,
  }[tab];

  // Pines (discover) is a full-bleed media stage; the rest are centered content columns.
  const fullBleed = tab === "pines";
  const wrap = fullBleed
    ? { maxWidth: isWeb ? 500 : "100%", margin: "0 auto", height: "calc(100dvh - " + HEADER + "px)" }
    : { maxWidth: 940, margin: "0 auto", padding: "0 0 104px" };

  return (
    <>
      <SiteHeader active="pines" solid />
      <div style={{ position: "fixed", top: HEADER, left: 0, right: 0, bottom: 0, overflowY: fullBleed ? "hidden" : "auto", WebkitOverflowScrolling: "touch", background: "var(--pb-bg)", fontFamily: "var(--pb-sans)" }}>
        <div style={wrap}>{screen}</div>
      </div>
      <FloatingTabs tab={tab} go={go} isWeb={isWeb} />
      {compose && <PinesCompose open={compose} onClose={() => setCompose(false)} onPosted={() => setTab("mine")} />}
      {lightbox && <PineLightbox list={lightbox.pines} start={lightbox.i} user={user} onClose={() => setLightbox(null)} />}
    </>
  );
}

/* ---------------- floating bottom tab bar (phone full-width · web centered pill) ---------------- */
function navIcon(id) {
  const p = {
    feed: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>,
    pines: <><path d="M12 3l5 8h-3l4 7H6l4-7H7z" /><line x1="12" y1="18" x2="12" y2="21" /></>,
    campfire: <><path d="M12 22a6 6 0 0 0 6-6c0-4-3-6-4-9-2 2-2 4-3 4-1 0-1-2-1-3-2 2-4 4-4 8a6 6 0 0 0 6 6z" /></>,
    gallery: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    you: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  }[id];
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19 }}>{p}</svg>;
}
function FloatingTabs({ tab, go, isWeb }) {
  const cur = tab === "hub" ? "campfire" : tab === "top" ? "pines" : tab;
  const T = (id, label, icon) => (
    <button key={id} onClick={() => go(id)} style={{ flex: isWeb ? "none" : 1, cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "var(--pb-sans)", fontSize: isWeb ? ".58rem" : ".52rem", fontWeight: 600, color: cur === id ? "var(--pb-gold)" : "var(--pb-muted)", padding: isWeb ? "6px 14px" : 0 }}>{navIcon(icon || id)}{label}</button>
  );
  const plus = (
    <button key="c" onClick={() => go("compose")} aria-label="Post" style={{ flex: isWeb ? "none" : 1, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: isWeb ? "0 8px" : 0 }}>
      <span style={{ width: isWeb ? 42 : 40, height: isWeb ? 42 : 40, borderRadius: 13, background: C.gold, color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.35rem", fontWeight: 700, boxShadow: "0 8px 22px -8px rgba(217,183,121,.8)" }}>＋</span>
    </button>
  );
  const shell = isWeb
    ? { position: "fixed", left: "50%", bottom: 20, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4, background: "rgba(8,19,13,.82)", WebkitBackdropFilter: "blur(18px)", backdropFilter: "blur(18px)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 10px", boxShadow: "0 24px 60px -24px rgba(0,0,0,.85)", zIndex: 90 }
    : { position: "fixed", left: 0, right: 0, bottom: 0, height: 62, display: "flex", alignItems: "center", background: "rgba(8,19,13,.94)", WebkitBackdropFilter: "blur(16px)", backdropFilter: "blur(16px)", borderTop: "1px solid var(--pb-line)", zIndex: 90 };
  return <nav style={shell}>{T("feed", "Feed")}{T("pines", "Pines")}{plus}{T("campfire", "Campfire")}{T("gallery", "Gallery")}{T("you", "Mine", "you")}</nav>;
}
function placeOf(p) { return { type: p.place_type || "park", id: p.place_id, name: p.place_name, q: p.place_name }; }
function heart(sz) { return <svg viewBox="0 0 24 24" fill={C.like} style={{ width: sz, height: sz }}><path d="M12 21s-7-4.6-9.2-9C1.3 8.6 3 5 6.4 5 8.4 5 12 7 12 7s3.6-2 5.6-2C21 5 22.7 8.6 21.2 12 19 16.4 12 21 12 21z" /></svg>; }

/* ---------------- Pines (global discover — full-bleed swipeable stage) ---------------- */
function Discover({ onPost, user, isWeb }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  const [idx, setIdx] = useState(0);
  const [verdict, setVerdict] = useState(null);
  const [like, setLike] = useState({ liked: false, count: 0 });
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  useEffect(() => { let on = true; fetch("/api/pines?limit=20").then((r) => r.json()).then((d) => on && setSt({ loading: false, pines: d.pines || [] })).catch(() => on && setSt({ loading: false, pines: [] })); return () => { on = false; }; }, []);
  // Clamp the index if the list shrinks, and never dereference an out-of-range pine.
  useEffect(() => { setIdx((i) => (st.pines.length && i >= st.pines.length ? 0 : i)); }, [st.pines.length]);
  const p = st.pines[idx] || st.pines[0];
  useEffect(() => { let on = true; setVerdict(null); if (p && p.display_lat != null && p.display_lng != null) fetchVerdict(p.display_lat, p.display_lng).then((v) => { if (on) setVerdict(v); }); return () => { on = false; }; }, [p && p.id]);
  // real like state for the active pine
  useEffect(() => {
    if (!p) return; setLike({ liked: false, count: p.like_count || 0 });
    (async () => { try { const t = await getAccessToken(); const r = await fetch("/api/pines/like?pine_id=" + p.id, t ? { headers: { Authorization: "Bearer " + t } } : {}); const d = await r.json().catch(() => ({})); setLike({ liked: !!d.liked, count: d.like_count != null ? d.like_count : (p.like_count || 0) }); } catch {} })();
  }, [p && p.id]);
  const toggleLike = async () => {
    if (!user || !p) { openAuth(); return; }
    const prev = like;
    setLike((l) => ({ liked: !l.liked, count: Math.max(0, l.count + (l.liked ? -1 : 1)) })); // optimistic
    try {
      const t = await getAccessToken();
      if (!t) { setLike(prev); openAuth(); return; } // never send "Bearer null"
      const r = await fetch("/api/pines/like", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ pine_id: p.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setLike(prev); return; } // roll back on server rejection
      if (d.like_count != null) setLike({ liked: !!d.liked, count: d.like_count });
    } catch { setLike(prev); }
  };

  // Advance/rewind through the feed — by tap, wheel/trackpad scroll, ↑/↓ keys, or swipe (phone).
  const n = st.pines.length;
  const advance = (dir) => { if (n < 2) return; setIdx((i) => (i + dir + n) % n); };
  const wheelLock = useRef(false);
  const onWheel = (e) => {
    if (Math.abs(e.deltaY) < 24 || wheelLock.current) return;
    wheelLock.current = true; advance(e.deltaY > 0 ? 1 : -1);
    setTimeout(() => { wheelLock.current = false; }, 520);
  };
  // Touch swipe (vertical) — reels-style up/down on phones. Tracks the drag and
  // flags it so the tap-to-advance overlay doesn't also fire on release.
  const touch = useRef({ y: 0, swiped: false });
  const onTouchStart = (e) => { const t = e.touches && e.touches[0]; if (!t) return; touch.current = { y: t.clientY, swiped: false }; };
  const onTouchMove = (e) => { const t = e.touches && e.touches[0]; if (t && Math.abs(t.clientY - touch.current.y) > 12) touch.current.swiped = true; };
  const onTouchEnd = (e) => {
    const t = e.changedTouches && e.changedTouches[0]; if (!t) return;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dy) > 42) advance(dy < 0 ? 1 : -1); // swipe up → next
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "ArrowDown") advance(1); else if (e.key === "ArrowUp") advance(-1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]); // eslint-disable-line

  if (st.loading) return <Center><span style={{ color: "var(--pb-muted)", ...micro }}>Loading Pines…</span></Center>;
  if (!st.pines.length) return <Center><Empty user={user} onPost={onPost} /></Center>;

  const src = p.image_url || p.poster_url;
  const vc = verdict ? vColor(verdict.v) : "#aab0ba";
  return (
    <div onWheel={onWheel} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ position: "relative", width: "100%", height: "100%", minHeight: 480, background: "#000", overflow: "hidden", touchAction: "pan-y", borderRadius: isWeb ? 20 : 0, border: isWeb ? "1px solid var(--pb-line)" : "none", marginTop: isWeb ? 18 : 0 }}>
      {src ? <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={p.place_name} />}
      {isWeb && n > 1 && (
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", zIndex: 7, display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => advance(-1)} aria-label="Previous" style={arrowBtn}>↑</button>
          <button onClick={() => advance(1)} aria-label="Next" style={arrowBtn}>↓</button>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(6,14,10,.5),transparent 22%,transparent 52%,rgba(6,14,10,.96))" }} />
      <div style={{ position: "absolute", left: 16, top: 14, zIndex: 6, display: "flex", gap: 4 }}>{st.pines.map((x, i) => <span key={i} style={{ width: i === idx ? 18 : 6, height: 3, borderRadius: 2, background: i === idx ? "var(--pb-gold)" : "rgba(255,255,255,.4)", transition: "width .3s" }} />)}</div>
      {verdict && (
        <div style={{ position: "absolute", top: 26, right: 14, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, background: "rgba(6,14,10,.55)", backdropFilter: "blur(10px)", border: "1px solid " + vc + "66", borderRadius: 14, padding: "8px 11px" }}>
          <span style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".06em", fontWeight: 700, color: vc }}>{verdict.v}{verdict.temp ? " · " + verdict.temp : ""}</span>
          <span style={{ fontFamily: mono, fontSize: ".44rem", letterSpacing: ".14em", textTransform: "uppercase", color: "#cfd6cf" }}>Conditions ›</span>
        </div>
      )}
      <div style={{ position: "absolute", right: 12, bottom: 150, zIndex: 6, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", color: "#fff" }}>
        <RailBtn aria={like.liked ? "Unlike" : "Like"} label={like.count} onClick={toggleLike} active={like.liked}><path d="M12 21s-7-4.6-9.2-9C1.3 8.6 3 5 6.4 5 8.4 5 12 7 12 7s3.6-2 5.6-2C21 5 22.7 8.6 21.2 12 19 16.4 12 21 12 21z" /></RailBtn>
        <RailBtn aria="Comments" label={p.comment_count || 0} onClick={() => setCommentsOpen(true)}><path d="M21 12a8 8 0 0 1-11.3 7.3L4 21l1.7-5.7A8 8 0 1 1 21 12z" /></RailBtn>
        <RailBtn aria="Share" onClick={() => { try { const u = location.origin + "/pines?pine=" + p.id; navigator.share ? navigator.share({ title: "Park Buddy Pines", url: u }).catch(() => {}) : (navigator.clipboard && navigator.clipboard.writeText(u).catch(() => {})); } catch {} }}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></RailBtn>
        <RailBtn aria="Report" onClick={() => setReportOpen(true)}><path d="M4 21V4M4 4h12l-2 4 2 4H4" /></RailBtn>
      </div>
      {commentsOpen && <CommentsSheet pine={p} user={user} onClose={() => setCommentsOpen(false)} />}
      {reportOpen && <ReportSheet pine={p} onClose={() => setReportOpen(false)} />}
      <div style={{ position: "absolute", left: 16, right: 70, bottom: 96, zIndex: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.5rem", color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>📍 {p.place_name || "Adventure"}</span>
          {p.verified && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, ...micro, fontSize: ".5rem", color: C.go, border: "1px solid " + C.go + "88", borderRadius: 999, padding: "3px 8px", background: "rgba(6,14,10,.4)" }}>✓ On-site</span>}
        </div>
        {p.caption && <div style={{ color: "rgba(255,255,255,.94)", fontSize: ".86rem", lineHeight: 1.5, margin: "9px 0 11px", textShadow: "0 1px 8px rgba(0,0,0,.5)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.caption}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/build-trip" style={{ fontSize: ".76rem", fontWeight: 700, background: C.gold, color: "var(--pb-bg)", borderRadius: 999, padding: "8px 14px", textDecoration: "none" }}>＋ Add to trip</Link>
          {p.place_type === "park" && <Link href={"/parks/" + p.place_id} style={{ fontSize: ".76rem", fontWeight: 600, background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.24)", borderRadius: 999, padding: "8px 14px", textDecoration: "none" }}>Conditions</Link>}
        </div>
      </div>
      {st.pines.length > 1 && <button onClick={() => { if (touch.current.swiped) { touch.current.swiped = false; return; } setIdx((i) => (i + 1) % st.pines.length); }} aria-label="Next Pine" tabIndex={-1} style={{ cursor: "pointer", position: "absolute", left: 0, right: 0, top: 90, bottom: 210, zIndex: 5, background: "transparent", border: "none" }} />}
    </div>
  );
}
function RailBtn({ children, label, onClick, active, aria }) {
  return <button onClick={onClick} aria-label={aria} style={{ cursor: "pointer", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#fff", fontSize: ".6rem", fontWeight: 600 }}><svg viewBox="0 0 24 24" fill={active ? C.like : "none"} stroke={active ? C.like : "#fff"} strokeWidth="2" style={{ width: 26, height: 26, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))" }}>{children}</svg>{label != null && label !== 0 ? <span>{label}</span> : null}</button>;
}

// UGC safety: a viewer flags a Pine. Reports go to /api/pines/report; repeatedly
// flagged Pines auto-hide pending admin review (DMCA notice-and-takedown path).
function ReportSheet({ pine, onClose }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const REASONS = ["Inappropriate or explicit", "Spam or scam", "Not this place / misleading", "Harassment or hate", "Copyright / it's not theirs", "Other"];
  const submit = async (reason) => {
    setBusy(true);
    try {
      const t = await getAccessToken();
      await fetch("/api/pines/report", { method: "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) }, body: JSON.stringify({ pine_id: pine.id, reason }) });
    } catch {}
    setBusy(false); setSent(true);
    setTimeout(onClose, 1500);
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--pb-bg,#0a1712)", borderTop: "1px solid rgba(217,183,121,.24)", borderRadius: "18px 18px 0 0", padding: "18px 18px 26px", boxShadow: "0 -20px 60px rgba(0,0,0,.6)" }}>
        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#cfe8d6", fontWeight: 600 }}>✓ Thanks — our team will review this Pine.</div>
        ) : (
          <>
            <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.15rem", color: "#f4f1ea", marginBottom: 4 }}>Report this Pine</div>
            <div style={{ fontSize: ".8rem", color: "#9fb0a6", marginBottom: 14 }}>Tell us what&apos;s wrong. Reports are reviewed, and repeatedly-flagged Pines are hidden automatically.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REASONS.map((r) => (
                <button key={r} disabled={busy} onClick={() => submit(r)} style={{ cursor: busy ? "default" : "pointer", textAlign: "left", fontFamily: "inherit", fontSize: ".9rem", fontWeight: 600, color: "#f4f1ea", background: "rgba(255,255,255,.05)", border: "1px solid rgba(217,183,121,.2)", borderRadius: 12, padding: "12px 14px" }}>{r}</button>
              ))}
            </div>
            <button onClick={onClose} style={{ cursor: "pointer", width: "100%", marginTop: 12, fontFamily: "inherit", fontSize: ".82rem", color: "#9fb0a6", background: "transparent", border: "none", padding: 8 }}>Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

function CommentsSheet({ pine, user, onClose }) {
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => fetch("/api/pines/comments?pine_id=" + pine.id).then((r) => r.json()).then((d) => setComments(d.comments || [])).catch(() => setComments([]));
  useEffect(() => { load(); }, [pine.id]); // eslint-disable-line
  useEffect(() => { const onKey = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const post = async () => {
    if (!user) { openAuth(); return; }
    const body = text.trim(); if (!body) return;
    setBusy(true); setErr("");
    try {
      const t = await getAccessToken();
      const r = await fetch("/api/pines/comments", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify({ pine_id: pine.id, body }) });
      if (r.ok) { setText(""); await load(); }
      else { const d = await r.json().catch(() => ({})); setErr(d.error || "Couldn't post that comment."); }
    } catch { setErr("Couldn't reach the server."); }
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
        {err && <div role="alert" style={{ margin: "0 16px", padding: "8px 12px", borderRadius: 10, background: "rgba(224,138,106,.12)", border: "1px solid " + C.hold + "66", color: C.hold, fontSize: ".78rem", lineHeight: 1.4 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--pb-line)" }}>
          <input value={text} onChange={(e) => { setText(e.target.value); if (err) setErr(""); }} onKeyDown={(e) => e.key === "Enter" && post()} maxLength={600} aria-label="Add a comment" placeholder={user ? "Add a comment…" : "Sign in to comment"} style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "10px 14px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".88rem", outline: "none" }} />
          <button onClick={post} disabled={busy} style={{ ...goldBtn(), padding: "10px 18px", flex: "none" }}>Post</button>
        </div>
      </div>
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
        <button onClick={onBack} aria-label="Back to Campfires" style={{ cursor: "pointer", position: "absolute", top: 20, left: 14, width: 32, height: 32, borderRadius: "50%", background: "rgba(6,14,10,.5)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", fontSize: "1rem" }}>‹</button>
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

/* ---------------- Campfire (place communities — searchable list → hub) ---------------- */
const cfSlug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function cfLoadScript(src) { return new Promise((res) => { if (typeof document === "undefined") return res(); if (document.querySelector('script[src="' + src + '"]')) return res(); const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = res; document.body.appendChild(el); }); }
function Campfire({ openHub }) {
  const [mine, setMine] = useState(null);
  const [all, setAll] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    (async () => {
      try { const t = await getAccessToken(); if (!t) { setMine([]); return; } const r = await fetch("/api/my-alerts", { headers: { Authorization: "Bearer " + t } }); const d = await r.json().catch(() => ({})); setMine((d.alerts || []).map((a) => ({ type: "park", id: a.park_id, name: a.park_name || a.park_id, q: a.park_name }))); } catch { setMine([]); }
    })();
  }, []);
  // Load the real, searchable place list once (parks + national forests + gateway towns).
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [pTxt, fTxt] = await Promise.all([
          fetch("/trip-data.js").then((r) => r.text()).catch(() => ""),
          fetch("/forest-data.js").then((r) => r.text()).catch(() => ""),
        ]);
        const pm = pTxt.match(/window\.TRIP_PARKS\s*=\s*(\[.*?\]);/);
        const fm = fTxt.match(/window\.FOREST_DATA\s*=\s*(\[[\s\S]*?\]);/);
        const rawParks = pm ? JSON.parse(pm[1]) : [];
        const parks = rawParks.map((p) => ({ type: "park", id: String(p.id), name: p.name + " National Park", q: p.name + " National Park", sub: "National Park" }));
        const forests = fm ? JSON.parse(fm[1]).map((f) => ({ type: "forest", id: cfSlug(f.name), name: f.name, q: f.name, sub: "National Forest" })) : [];
        let towns = [];
        try {
          await cfLoadScript("/gateway-towns.js");
          if (typeof window !== "undefined" && window.PB_GATEWAY) {
            const seen = new Set();
            towns = rawParks.map((p) => { const t = window.PB_GATEWAY(p.name); if (!t || t.lat == null || seen.has(t.town)) return null; seen.add(t.town); return { type: "town", id: cfSlug(t.town), name: t.town, q: t.town, sub: "Gateway town" }; }).filter(Boolean);
          }
        } catch {}
        if (on) setAll([...parks, ...forests, ...towns]);
      } catch {}
    })();
    return () => { on = false; };
  }, []);
  // Popular Campfires derived from the REAL park list so ids stay numeric — the same
  // scheme /parks/:id resolves and pines are tagged with (avoids 404s + empty hubs).
  const POPULAR = ["Yosemite", "Grand Teton", "Zion", "Glacier", "Rocky Mountain", "Yellowstone"];
  const popular = POPULAR.map((nm) => all.find((x) => x.type === "park" && x.name === nm + " National Park")).filter(Boolean);
  const term = q.trim().toLowerCase();
  const results = term ? all.filter((x) => x.name.toLowerCase().includes(term)).slice(0, 40) : null;
  return (
    <div style={{ padding: "50px 0 20px" }}>
      <div style={{ padding: "0 15px 10px" }}>
        <div style={{ ...micro, color: "var(--pb-gold-soft)" }}>One per park, forest &amp; gateway town</div>
        <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", color: "var(--pb-ink)" }}>Campfires</span>
      </div>
      <div style={{ margin: "0 15px", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.04)", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "9px 13px" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--pb-muted)" strokeWidth="2" style={{ width: 15, height: 15, flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} aria-label="Search parks, forests, towns" placeholder="Search parks, forests, towns" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".9rem" }} />
        {q && <button onClick={() => setQ("")} aria-label="Clear search" style={{ cursor: "pointer", background: "none", border: "none", color: "var(--pb-muted)", fontSize: "1rem", lineHeight: 1 }}>×</button>}
      </div>
      {results ? (
        results.length ? results.map((p) => <PlaceRow key={p.type + p.id} p={p} onClick={() => openHub(p)} />)
          : <p style={{ ...pad(), color: "var(--pb-ink-2)", lineHeight: 1.6, textAlign: "center" }}>{all.length ? "No place matches “" + q.trim() + ".” Try a park, forest or town name." : "Loading places…"}</p>
      ) : (
        <>
          {mine && mine.length > 0 && <>
            <div style={{ ...micro, color: "var(--pb-gold-soft)", padding: "18px 15px 4px" }}>Campfires you follow</div>
            {mine.map((p) => <PlaceRow key={"mine-" + p.id} p={p} onClick={() => openHub(p)} tag="following" />)}
          </>}
          <div style={{ ...micro, color: "var(--pb-gold-soft)", padding: "18px 15px 4px" }}>Popular Campfires</div>
          {popular.length ? popular.map((p) => <PlaceRow key={"pop-" + p.id} p={p} onClick={() => openHub(p)} />) : <p style={pad()}>Loading places…</p>}
        </>
      )}
      <div style={{ height: 14 }} />
    </div>
  );
}
function PlaceRow({ p, onClick, tag }) {
  const sub = p.sub || (p.name.includes("Forest") ? "National Forest" : p.name.toLowerCase().includes("town") ? "Gateway town" : "National Park");
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
  const review = (mine || []).filter((m) => m.status === "pending" || m.status === "processing").length;
  // Real stats only — Followers/Following aren't modeled yet, so we don't show fake 0s.
  const stats = [[String((mine || []).length), "Pines"], [String(live), "Live"], [String(review), "In review"]];
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

/* ---------------- Feed (personalized: your posts + places you follow) ---------------- */
function FeedPersonal({ user, onPost, openHub, goDiscover, goCampfire }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) { if (on) setSt({ loading: false, pines: [] }); return; }
      try {
        const t = await getAccessToken();
        const auth = t ? { headers: { Authorization: "Bearer " + t } } : {};
        // your own approved Pines
        const mine = ((await fetch("/api/pines?mine=1", auth).then((r) => r.json()).catch(() => ({}))).pines || []).filter((p) => p.status === "approved");
        // Pines from the Campfires (parks) you follow
        let placePines = [];
        try {
          const al = await fetch("/api/my-alerts", auth).then((r) => r.json()).catch(() => ({}));
          const parks = (al.alerts || []).slice(0, 8);
          const lists = await Promise.all(parks.map((a) => fetch("/api/pines?place=park:" + encodeURIComponent(a.park_id) + "&limit=8").then((r) => r.json()).then((d) => d.pines || []).catch(() => [])));
          placePines = lists.flat();
        } catch {}
        const map = new Map();
        [...mine, ...placePines].forEach((p) => { if (p && !map.has(p.id)) map.set(p.id, p); });
        const merged = [...map.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (on) setSt({ loading: false, pines: merged });
      } catch { if (on) setSt({ loading: false, pines: [] }); }
    })();
    return () => { on = false; };
  }, [user]);

  if (st.loading) return <Center><span style={{ color: "var(--pb-muted)", ...micro }}>Loading your feed…</span></Center>;
  if (!user) return <FeedEmpty title="Your feed lives here" body="Sign in to see Pines from the people and Campfires you follow — all in one place." cta="Sign in" onCta={() => openAuth()} goDiscover={goDiscover} />;
  if (!st.pines.length) return <FeedEmpty title="Your feed is quiet — for now" body="Follow a Campfire or post your first Pine, and fresh Adventures from your places will show up right here." cta="Browse Campfires" onCta={goCampfire} goDiscover={goDiscover} />;

  return (
    <div style={{ padding: "50px 0 20px", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ padding: "0 15px 4px" }}>
        <div style={{ ...micro, color: "var(--pb-gold-soft)" }}>People &amp; places you follow</div>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", marginTop: 3, color: "var(--pb-ink)" }}>Your feed</h2>
      </div>
      {st.pines.map((p) => <FeedCard key={p.id} p={p} openHub={openHub} />)}
    </div>
  );
}
function FeedCard({ p, openHub }) {
  const name = p.place_name || "Adventure";
  return (
    <div style={{ margin: "12px 15px 0", border: "1px solid var(--pb-line)", borderRadius: 16, overflow: "hidden", background: "var(--pb-surface)" }}>
      <button onClick={() => openHub(placeOf(p))} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "none", border: "none", padding: "11px 12px" }}>
        <span style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(150deg,#1f5e46,#0e2016)", border: "1px solid var(--pb-gold-2)", flex: "none" }} />
        <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: ".84rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {name}</b><span style={{ fontSize: ".62rem", color: "var(--pb-muted)" }}>{p.author_name || "A Park Buddy"}</span></span>
        {p.verified && <span style={{ ...micro, fontSize: ".46rem", color: C.go, border: "1px solid " + C.go + "66", borderRadius: 999, padding: "3px 7px", flex: "none" }}>✓ On-site</span>}
      </button>
      <div style={{ position: "relative", aspectRatio: "4/5", background: "#000" }}>
        {p.image_url || p.poster_url ? <img src={p.image_url || p.poster_url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={name} />}
        {p.poster_url && <span style={{ position: "absolute", top: 8, right: 8, color: "#fff", fontSize: ".7rem", textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>▶</span>}
      </div>
      {p.caption && <div style={{ fontSize: ".86rem", color: "var(--pb-ink-2)", lineHeight: 1.5, padding: "10px 13px 0" }}>{p.caption}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 13px 13px", color: "var(--pb-muted)", fontSize: ".78rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: C.like }}>{heart(14)}{p.like_count || 0}</span>
        <span>💬 {p.comment_count || 0}</span>
        {p.place_type === "park" && p.place_id && <Link href={"/parks/" + p.place_id} style={{ marginLeft: "auto", fontSize: ".72rem", fontWeight: 700, color: "var(--pb-gold)", textDecoration: "none" }}>Conditions ›</Link>}
      </div>
    </div>
  );
}
function FeedEmpty({ title, body, cta, onCta, goDiscover }) {
  return (
    <div style={{ padding: "70px 24px", textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: "2rem", marginBottom: 8 }}>🌲</div>
      <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", color: "var(--pb-ink)", margin: "0 0 10px" }}>{title}</h2>
      <p style={{ color: "var(--pb-ink-2)", lineHeight: 1.6, margin: "0 0 18px" }}>{body}</p>
      <FilmCard />
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onCta} style={goldBtn("auto")}>{cta}</button>
        <button onClick={goDiscover} style={{ ...goldBtn("auto"), background: "transparent", color: "var(--pb-ink)", border: "1px solid var(--pb-line-strong)" }}>Explore Pines</button>
      </div>
    </div>
  );
}

/* ---------------- Gallery (browse every photo & reel → lightbox) ---------------- */
function Gallery({ onOpen }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  useEffect(() => { let on = true; fetch("/api/pines?limit=60").then((r) => r.json()).then((d) => on && setSt({ loading: false, pines: d.pines || [] })).catch(() => on && setSt({ loading: false, pines: [] })); return () => { on = false; }; }, []);
  return (
    <div style={{ padding: "50px 0 20px" }}>
      <div style={{ padding: "0 15px 12px" }}>
        <div style={{ ...micro, color: "var(--pb-gold-soft)" }}>Every photo &amp; reel</div>
        <h2 style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.7rem", marginTop: 3, color: "var(--pb-ink)" }}>Gallery</h2>
      </div>
      {st.loading ? <p style={pad()}>Loading…</p> : !st.pines.length ? <p style={{ ...pad(), color: "var(--pb-ink-2)", lineHeight: 1.6 }}>No Pines yet — once Adventures roll in, every photo and reel shows up here to browse and pick from.</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, padding: "0 3px" }}>
          {st.pines.map((p, i) => (
            <button key={p.id + ":" + i} aria-label={"Open Pine from " + (p.place_name || "a place")} onClick={() => onOpen({ pines: st.pines, i })} style={{ cursor: "pointer", position: "relative", aspectRatio: "1", overflow: "hidden", background: "#000", border: "none", padding: 0 }}>
              {p.image_url || p.poster_url ? <img src={p.image_url || p.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={p.place_name} />}
              {p.poster_url && <span style={{ position: "absolute", top: 5, right: 5, color: "#fff", fontSize: ".6rem", textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>▶</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function PineLightbox({ list, start, user, onClose }) {
  const pines = list && list.length ? list : [];
  const [i, setI] = useState(start || 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const n = pines.length;
  const step = (d) => { if (n < 2) return; setCommentsOpen(false); setI((x) => (x + d + n) % n); };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") step(1); else if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]); // eslint-disable-line
  const touch = useRef({ x: 0 });
  const onTouchStart = (e) => { touch.current.x = e.touches[0].clientX; };
  const onTouchEnd = (e) => { const dx = e.changedTouches[0].clientX - touch.current.x; if (Math.abs(dx) > 44) step(dx < 0 ? 1 : -1); };
  const pine = pines[i];
  if (!pine) return null;
  const src = pine.image_url || pine.poster_url;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(4,7,5,.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ position: "relative", width: "min(440px,100%)", maxHeight: "92dvh", overflow: "hidden", borderRadius: 18, border: "1px solid var(--pb-line-strong)", background: "var(--pb-bg)" }}>
        <div style={{ position: "relative", aspectRatio: "4/5", background: "#000" }}>
          {src ? <img src={src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Photo q={pine.place_name} />}
          <button onClick={onClose} aria-label="Close" style={{ cursor: "pointer", position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: "50%", background: "rgba(6,14,10,.6)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", fontSize: "1rem", zIndex: 3 }}>×</button>
          {n > 1 && <>
            <button onClick={() => step(-1)} aria-label="Previous" style={{ ...arrowBtn, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", zIndex: 3 }}>‹</button>
            <button onClick={() => step(1)} aria-label="Next" style={{ ...arrowBtn, position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", zIndex: 3 }}>›</button>
            <div style={{ position: "absolute", top: 12, left: 14, zIndex: 3, ...micro, fontSize: ".5rem", color: "#fff", background: "rgba(6,14,10,.5)", borderRadius: 999, padding: "3px 8px" }}>{i + 1} / {n}</div>
          </>}
          <div style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}><div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.3rem", color: "#fff", textShadow: "0 2px 10px rgba(0,0,0,.6)" }}>📍 {pine.place_name || "Adventure"}</div></div>
        </div>
        <div style={{ padding: "12px 14px" }}>
          {pine.caption && <div style={{ fontSize: ".88rem", color: "var(--pb-ink-2)", lineHeight: 1.5, marginBottom: 8 }}>{pine.caption}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--pb-muted)", fontSize: ".8rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: C.like }}>{heart(14)}{pine.like_count || 0}</span>
            <button onClick={() => setCommentsOpen(true)} style={{ background: "none", border: "none", color: "var(--pb-muted)", cursor: "pointer", fontSize: ".8rem" }}>💬 {pine.comment_count || 0}</button>
            {pine.place_type === "park" && pine.place_id && <Link href={"/parks/" + pine.place_id} style={{ marginLeft: "auto", fontWeight: 700, color: "var(--pb-gold)", textDecoration: "none" }}>Conditions ›</Link>}
          </div>
        </div>
        {commentsOpen && <CommentsSheet pine={pine} user={user} onClose={() => setCommentsOpen(false)} />}
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
// The Pines brand film (click-to-play; streams from Supabase, only loads on press).
function FilmCard() {
  return (
    <div style={{ margin: "0 auto 20px", maxWidth: 440 }}>
      <div style={{ ...micro, color: "var(--pb-gold-soft)", marginBottom: 8 }}>▶ Watch — a minute in the wild</div>
      <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--pb-line-strong)", boxShadow: "0 24px 60px -30px rgba(0,0,0,.8)" }}>
        <video controls playsInline preload="none" poster="/media/pines-intro-poster.jpg" style={{ width: "100%", display: "block", aspectRatio: "16 / 9", background: "#000" }}>
          <source src="https://fsgmwersernbtjugkuhk.supabase.co/storage/v1/object/public/pines/pines-intro.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
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
      <FilmCard />
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
        <input type="email" placeholder="you@email.com" aria-label="Email for Pines early access" maxLength={254} value={email} onChange={(e) => { setEmail(e.target.value); setState(""); }}
          style={{ flex: "1 1 170px", minWidth: 0, background: "rgba(255,255,255,.04)", border: "1px solid " + (state === "error" ? "var(--pb-hold)" : "var(--pb-line-strong)"), borderRadius: 999, padding: "12px 16px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".9rem", outline: "none" }} />
        <button type="submit" disabled={state === "busy"} style={{ ...goldBtn(), padding: "12px 20px", flex: "1 1 auto", whiteSpace: "nowrap" }}>{state === "busy" ? "…" : "Get early access"}</button>
      </form>
      {state === "error" && msg && <div style={{ color: "var(--pb-hold)", fontSize: ".8rem", marginTop: 8 }}>{msg}</div>}
    </>
  );
}
