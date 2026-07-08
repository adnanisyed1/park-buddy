"use client";

// Pines — short vertical media (photo now, video with Cloudflare) for parks, on the
// shared design system. Instagram/TikTok-style bottom tab menu:
//   Feed  — full-screen vertical scroll-snap of approved Pines
//   Top   — Top 10 of the week (most-liked, last 7 days)
//   ＋     — post a Pine (photo compose)
//   Mine  — your own Pines with their review status
// Every Pine is place-anchored and captured on-site. Honest empty states throughout.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import PinesCompose from "./PinesCompose";
import { useAuth, openAuth, getAccessToken } from "../lib/auth";

const serif = "var(--pb-serif)", mono = "var(--pb-mono)";
const NAV_H = 62;

export default function PinesFeed() {
  const { user } = useAuth();
  const [tab, setTab] = useState("feed");
  const [compose, setCompose] = useState(false);

  const post = () => { if (!user) { openAuth(); return; } setCompose(true); };

  return (
    <>
      <SiteHeader active="pines" solid />

      <div style={{ background: "var(--pb-bg)", minHeight: "100vh" }}>
        {tab === "feed" && <FeedTab onPost={post} user={user} />}
        {tab === "top" && <TopTab />}
        {tab === "mine" && <MineTab user={user} onPost={post} />}
      </div>

      {/* bottom tab menu — Instagram/TikTok style */}
      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 130, height: NAV_H, display: "flex", alignItems: "stretch", background: "rgba(8,19,13,.82)", WebkitBackdropFilter: "blur(18px)", backdropFilter: "blur(18px)", borderTop: "1px solid var(--pb-line)" }}>
        <Tab label="Feed" icon="▦" on={tab === "feed"} onClick={() => setTab("feed")} />
        <Tab label="Top" icon="✦" on={tab === "top"} onClick={() => setTab("top")} />
        <PostTab onClick={post} />
        <Tab label="Mine" icon="◍" on={tab === "mine"} onClick={() => setTab("mine")} />
      </nav>

      <PinesCompose open={compose} onClose={() => setCompose(false)} onPosted={() => setTab("mine")} />
    </>
  );
}

/* ---------------- Feed (vertical scroll-snap) ---------------- */
function FeedTab({ onPost, user }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    let on = true;
    fetch("/api/pines?limit=20").then((r) => r.json()).then((d) => { if (on) setSt({ loading: false, pines: d.pines || [] }); }).catch(() => on && setSt({ loading: false, pines: [] }));
    return () => { on = false; };
  }, []);

  useEffect(() => {
    if (!st.pines.length) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.6) { setActive(Number(e.target.getAttribute("data-i"))); setPlaying(false); } }), { threshold: [0.6] });
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [st.pines.length]);

  if (st.loading) return <Center><span style={{ color: "var(--pb-muted)", ...micro() }}>Loading Pines…</span></Center>;
  if (!st.pines.length) return <Center><Empty user={user} onPost={onPost} /></Center>;

  return (
    <div style={{ height: "100vh", overflowY: "auto", scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}>
      {st.pines.map((p, i) => (
        <div key={p.id} data-i={i} ref={(el) => (refs.current[i] = el)} style={{ height: "100vh", scrollSnapAlign: "start", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--pb-bg)" }}>
          {p.media_type === "video" && i === active && playing && p.iframe_url ? (
            <iframe src={p.iframe_url + "?autoplay=true"} allow="autoplay; fullscreen" style={{ width: "min(100%,520px)", height: "100%", border: "none" }} />
          ) : (
            <button onClick={() => p.media_type === "video" && setPlaying(true)} aria-label={p.media_type === "video" ? "Play" : ""}
              style={{ width: "min(100%,520px)", height: "100%", border: "none", cursor: p.media_type === "video" ? "pointer" : "default", background: (p.image_url || p.poster_url) ? `var(--pb-bg) center/cover no-repeat url(${p.image_url || p.poster_url})` : "var(--pb-surface)", position: "relative" }}>
              {p.media_type === "video" && i === active && <Play />}
            </button>
          )}
          <Overlay p={p} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Top of the week ---------------- */
function TopTab() {
  const [st, setSt] = useState({ loading: true, pines: [] });
  useEffect(() => {
    let on = true;
    fetch("/api/pines?sort=top").then((r) => r.json()).then((d) => on && setSt({ loading: false, pines: d.pines || [] })).catch(() => on && setSt({ loading: false, pines: [] }));
    return () => { on = false; };
  }, []);
  return (
    <Scroll>
      <h1 style={h1()}>Top of the week</h1>
      <p style={sub()}>The 10 most-loved Adventures from the last seven days.</p>
      {st.loading ? <span style={{ color: "var(--pb-muted)", ...micro() }}>Loading…</span>
        : !st.pines.length ? <Note>No ranked Pines yet — once Adventures start rolling in, the week's best show up here.</Note>
        : <div style={{ display: "grid", gap: 12, marginTop: 18 }}>{st.pines.map((p, i) => <RankRow key={p.id} p={p} rank={i + 1} />)}</div>}
    </Scroll>
  );
}

/* ---------------- Mine ---------------- */
function MineTab({ user, onPost }) {
  const [st, setSt] = useState({ loading: true, pines: [] });
  useEffect(() => {
    if (!user) { setSt({ loading: false, pines: [] }); return; }
    let on = true;
    (async () => {
      try {
        const t = await getAccessToken();
        const r = await fetch("/api/pines?mine=1", { headers: { Authorization: "Bearer " + t } });
        const d = await r.json().catch(() => ({}));
        if (on) setSt({ loading: false, pines: d.pines || [] });
      } catch { if (on) setSt({ loading: false, pines: [] }); }
    })();
    return () => { on = false; };
  }, [user]);

  if (!user) return <Scroll><h1 style={h1()}>Your Pines</h1><Note>Sign in to post Adventures and see the ones you've shared.</Note><button onClick={() => openAuth()} style={{ ...goldBtn(), width: "auto", marginTop: 14 }}>Sign in</button></Scroll>;
  return (
    <Scroll>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h1 style={h1()}>Your Pines</h1>
        <button onClick={onPost} style={{ ...goldBtn(), width: "auto", padding: "10px 16px" }}>＋ Post</button>
      </div>
      {st.loading ? <span style={{ color: "var(--pb-muted)", ...micro() }}>Loading…</span>
        : !st.pines.length ? <Note>No Adventures yet. Tap ＋ to pin your first — a real photo from a real place.</Note>
        : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>{st.pines.map((p) => <MineCard key={p.id} p={p} />)}</div>}
    </Scroll>
  );
}

/* ---------------- pieces ---------------- */
function Overlay({ p }) {
  const href = p.place_type === "park" ? "/parks/" + p.place_id : null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, padding: "24px 18px " + (NAV_H + 22) + "px", background: "linear-gradient(0deg,rgba(8,19,13,.92),transparent)", pointerEvents: "none" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", pointerEvents: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          {p.place_name && (href
            ? <Link href={href} style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.2rem", color: "var(--pb-ink)", textDecoration: "none" }}>📍 {p.place_name}</Link>
            : <span style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.2rem", color: "var(--pb-ink)" }}>📍 {p.place_name}</span>)}
          {p.verified && <Badge tone="go">✓ On-site</Badge>}
        </div>
        {p.caption && <p style={{ color: "var(--pb-ink)", opacity: 0.92, fontSize: ".92rem", lineHeight: 1.5, margin: "0 0 12px" }}>{p.caption}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/build-trip" style={pill(true)}>＋ Add to trip</Link>
          {href && <Link href={href} style={pill(false)}>Conditions</Link>}
        </div>
      </div>
    </div>
  );
}

function RankRow({ p, rank }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 14, padding: 10 }}>
      <span style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.5rem", color: "var(--pb-gold)", width: 30, textAlign: "center", flex: "none" }}>{rank}</span>
      <span style={{ width: 58, height: 58, borderRadius: 10, flex: "none", background: (p.image_url || p.poster_url) ? `#000 center/cover no-repeat url(${p.image_url || p.poster_url})` : "var(--pb-surface-2)" }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.place_name || "Adventure"}</div>
        <div style={{ fontSize: ".8rem", color: "var(--pb-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.caption}</div>
      </div>
      <span style={{ ...micro(), color: "var(--pb-gold-soft)", flex: "none" }}>♥ {p.like_count || 0}</span>
    </div>
  );
}

function MineCard({ p }) {
  const tone = p.status === "approved" ? "go" : p.status === "rejected" ? "hold" : "prepare";
  const label = p.status === "approved" ? "Live" : p.status === "rejected" ? "Not approved" : p.status === "processing" ? "Processing" : "In review";
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--pb-line)", background: "var(--pb-surface)" }}>
      <div style={{ aspectRatio: "1/1", background: (p.image_url || p.poster_url) ? `#000 center/cover no-repeat url(${p.image_url || p.poster_url})` : "var(--pb-surface-2)" }} />
      <div style={{ padding: "9px 11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: ".82rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.place_name || p.caption || "Adventure"}</span>
          <Badge tone={tone}>{label}</Badge>
        </div>
      </div>
    </div>
  );
}

function Tab({ label, icon, on, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, cursor: "pointer", background: "none", border: "none", fontFamily: "var(--pb-sans)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: on ? "var(--pb-gold)" : "var(--pb-ink-2)" }}>
      <span style={{ fontSize: "1.15rem", lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: ".62rem", fontWeight: 600, letterSpacing: ".02em" }}>{label}</span>
    </button>
  );
}
function PostTab({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Post a Pine" style={{ flex: 1, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ width: 42, height: 42, borderRadius: 13, background: "var(--pb-grad-gold)", color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 700, boxShadow: "0 6px 18px -6px rgba(217,183,121,.6)" }}>＋</span>
    </button>
  );
}

function Empty({ user, onPost }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 440, padding: "0 24px" }}>
      <div style={{ fontSize: "2.4rem", marginBottom: 6 }}>🌲</div>
      <h1 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(2rem,6vw,2.8rem)", lineHeight: 1.05, color: "var(--pb-ink)", margin: "0 0 12px" }}>Pines are coming</h1>
      <p style={{ color: "var(--pb-ink-2)", fontSize: "1rem", lineHeight: 1.6, margin: "0 0 22px" }}>Short, real Adventures from the parks — every one captured on-site and pinned to the exact place. No stock, no fakes.</p>
      <button onClick={onPost} style={goldBtn("auto")}>{user ? "Be the first to pin one" : "Sign in to pin one"}</button>
      <div style={{ ...micro(), color: "var(--pb-muted)", marginTop: 18 }}>Reels, but for the wild.</div>
    </div>
  );
}

function Play() {
  return <span style={{ position: "absolute", inset: 0, margin: "auto", width: 66, height: 66, borderRadius: "50%", background: "rgba(10,23,18,.55)", border: "1px solid var(--pb-line-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ borderLeft: "20px solid var(--pb-gold)", borderTop: "12px solid transparent", borderBottom: "12px solid transparent", marginLeft: 5 }} /></span>;
}
function Center({ children }) { return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: NAV_H }}>{children}</div>; }
function Scroll({ children }) { return <div style={{ maxWidth: 640, margin: "0 auto", padding: "96px 18px " + (NAV_H + 30) + "px" }}>{children}</div>; }
function Note({ children }) { return <p style={{ color: "var(--pb-ink-2)", fontSize: ".95rem", lineHeight: 1.6, marginTop: 14 }}>{children}</p>; }
function Badge({ tone, children }) {
  const c = tone === "go" ? "#4fd98a" : tone === "hold" ? "var(--pb-hold,#e08a6a)" : "var(--pb-prepare,#e8cf9a)";
  return <span style={{ ...micro(), color: c, border: "1px solid " + c + "55", borderRadius: 999, padding: "2px 8px", flex: "none" }}>{children}</span>;
}
function h1() { return { fontFamily: serif, fontWeight: 500, fontSize: "clamp(1.8rem,5vw,2.4rem)", lineHeight: 1.05, color: "var(--pb-ink)", margin: 0 }; }
function sub() { return { color: "var(--pb-ink-2)", fontSize: ".95rem", lineHeight: 1.55, margin: "8px 0 0" }; }
function micro() { return { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase" }; }
function goldBtn(w) { return { cursor: "pointer", width: w || "100%", fontFamily: "var(--pb-sans)", fontSize: ".92rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "13px 24px", display: "inline-block", textAlign: "center" }; }
function pill(gold) {
  return gold
    ? { fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 999, padding: "9px 16px", textDecoration: "none" }
    : { fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 600, color: "var(--pb-ink)", background: "var(--pb-surface-2)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "9px 16px", textDecoration: "none" };
}
