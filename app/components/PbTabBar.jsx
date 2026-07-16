"use client";

// Phone-only platform navigation: a fixed bottom tab bar (Explore · Book · Ask ·
// Pines · Shop) where the section tabs open a slide-up sheet ABOVE the bar with a
// 2-up grid of options and a Live / Coming-soon toggle. Ask opens the assistant in
// place; Pines is a direct link. This mirrors the landing embed (public/embed/home/
// s0.js) so the whole platform shares one mobile nav. Desktop is untouched (hidden
// ≥861px — matches the SiteHeader hamburger breakpoint so nav never disappears in
// the tablet range). Design spec: memory/project-mobile-nav-redesign.md.
import { useState } from "react";
import Link from "next/link";
import loadScript from "./load-script";
import { EXPLORE_MENU, BOOK_MENU, SHOP_MENU } from "../lib/nav-menus";

const gold = "linear-gradient(120deg,#e8cf9a,#c9a35f)";

// Per-destination line icons (match the landing sheet). Fallback = compass-clock.
const PATHS = {
  "/explore": <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  "/build-trip": <><circle cx="12" cy="12" r="9" /><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" /></>,
  "/scenic-drives": <path d="M6 3 4 21M18 3l2 18M12 5v3M12 11v2M12 16v3" />,
  "/trip-mode": <path d="M12 2 4.5 20l7.5-4 7.5 4z" />,
  "/cruises": <path d="M4 15h16l-2.2 5H6.2zM12 4v8M8 8h8" />,
  "/diving": <path d="M3 15c2 0 2 2 4.5 2S9 15 12 15s2 2 4.5 2S18 15 21 15M3 10c2 0 2 2 4.5 2S9 10 12 10s2 2 4.5 2S18 10 21 10" />,
  "/climbing": <path d="M3 20 10 8l4 6 2.5-4 4.5 10z" />,
  "/book": <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /></>,
  "/book?cat=stays": <path d="M4 11 12 4l8 7M6 10v10h12V10" />,
  "/book?cat=camp": <path d="M12 4 3 20h18zM12 4v16" />,
  "/book?cat=cars": <path d="M4 13l2-6h12l2 6M4 13h16v4H4zM7 17v2M17 17v2" />,
  "/book?cat=cruises": <path d="M4 15h16l-2.2 5H6.2zM12 4v8M8 8h8" />,
  "/book?cat=tours": <path d="M6 3v18M6 4h11l-2 3 2 3H6" />,
  "/book?cat=permits": <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4H5a2 2 0 0 1 0-4 2 2 0 0 0 0-4z" />,
  "/book?cat=shuttles": <><rect x="4" y="5" width="16" height="12" rx="2" /><path d="M4 11h16M8 17v2M16 17v2" /></>,
  "/shop": <><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
  "/trip-book": <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M18 6v14" /></>,
  "/shop?cat=store": <path d="M4 7l3-3 5 3 5-3 3 3-3 2v11H7V9z" />,
  "/shop?cat=passes": <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4H5a2 2 0 0 1 0-4 2 2 0 0 0 0-4z" />,
  "/shop?cat=gear": <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 7h12l-1 14H7z" />,
  "/shop?cat=camp": <path d="M12 4 3 20h18zM12 4v16" />,
  "/shop?cat=nav": <><circle cx="12" cy="12" r="9" /><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" /></>,
  "/shop?cat=maps": <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  "/shop?cat=optics": <><circle cx="7" cy="14" r="3.5" /><circle cx="17" cy="14" r="3.5" /><path d="M10.5 13h3M7 10.5 9 5h2M17 10.5 15 5h-2" /></>,
};
const Ico = ({ d, size = 24, sw = 1.6 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const DEFAULT_ICON = <><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></>;

const TAB_D = {
  explore: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  book: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 3v4M16 3v4" /></>,
  shop: <><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></>,
};
const PINE = <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor"><path d="M12 3l5 8h-3l4 7H6l4-7H7z" /></svg>;
const SPARK = <svg viewBox="0 0 24 24" width="26" height="26" fill="#0a1712"><path d="M12 2.5l2.3 6.1 6.2.4-4.8 3.9 1.6 6-5.3-3.3L6.5 18.9l1.6-6L3.3 9l6.2-.4z" /></svg>;

const SECTIONS = { explore: ["Explore", EXPLORE_MENU], book: ["Book", BOOK_MENU], shop: ["Shop", SHOP_MENU] };

export default function PbTabBar({ active }) {
  const [sheet, setSheet] = useState(null); // "explore" | "book" | "shop" | null
  const [seg, setSeg] = useState("live");

  const openAsk = () => {
    const fire = () => { const f = document.querySelector(".pbask-fab"); if (f) f.click(); };
    loadScript("/ask-parkbuddy.js").then(fire).catch(fire);
    fire();
  };
  const openSheet = (key) => { setSeg("live"); setSheet(key); };
  const close = () => setSheet(null);

  const secData = sheet ? SECTIONS[sheet] : null;
  const items = secData ? secData[1] : [];
  const shown = items.filter((m) => (seg === "soon" ? m.soon : !m.soon));

  const TabBtn = ({ k, label, d }) => (
    <button type="button" onClick={() => openSheet(k)} style={tabStyle(active === k)}>
      <Ico d={d} size={23} sw={1.7} /><span style={lbl}>{label}</span>
    </button>
  );

  return (
    <>
      <style>{`
        .pbtabbar,.pbtab-sheet,.pbtab-scrim{display:none}
        @media(max-width:860px){
          .pbtabbar{display:grid!important}
          body{padding-bottom:76px}
          .pbask-fab{display:none!important}
        }
        @keyframes pbboxin{to{opacity:1;transform:none}}
        .pbtab-box{opacity:0;transform:translateY(12px);animation:pbboxin .44s cubic-bezier(.22,1,.36,1) forwards}
        .pbtab-box:active{transform:scale(.97)}
        @media(hover:hover){.pbtab-box:hover{transform:translateY(-3px);border-color:rgba(217,183,121,.5)!important;background:rgba(217,183,121,.06)!important}}
      `}</style>

      <nav className="pbtabbar" aria-label="Primary" style={barStyle}>
        <TabBtn k="explore" label="Explore" d={TAB_D.explore} />
        <TabBtn k="book" label="Book" d={TAB_D.book} />
        <button type="button" onClick={openAsk} aria-label="Ask Park Buddy" style={askWrap}>
          <span style={askCircle}>{SPARK}</span><span style={lbl}>Ask</span>
        </button>
        <Link href="/pines" style={{ ...tabStyle(active === "pines"), textDecoration: "none" }}>{PINE}<span style={lbl}>Pines</span></Link>
        <TabBtn k="shop" label="Shop" d={TAB_D.shop} />
      </nav>

      {sheet && (
        <>
          <div onClick={close} style={scrimStyle} />
          <div role="dialog" aria-label={secData[0]} style={sheetStyle}>
            <div style={{ padding: "10px 0 2px" }}><div style={grip} /></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 12px" }}>
              <span style={sheetTitle}>{secData[0]}</span>
              <button type="button" onClick={close} aria-label="Close" style={xBtn}><Ico d={<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>} size={17} sw={2} /></button>
            </div>
            <div style={{ padding: "0 20px 12px" }}>
              <div style={segWrap}>
                <button type="button" onClick={() => setSeg("live")} style={segBtn(seg === "live")}>Live</button>
                <button type="button" onClick={() => setSeg("soon")} style={segBtn(seg === "soon")}>Coming soon</button>
              </div>
            </div>
            <div style={gridStyle}>
              {shown.length ? shown.map((m, i) => (
                <Link key={m.href} href={m.href} onClick={close} className="pbtab-box" style={{ ...boxStyle, animationDelay: i * 40 + "ms" }}>
                  {m.soon && <span style={soonChip}>Soon</span>}
                  <span style={boxIc}><Ico d={PATHS[m.href] || DEFAULT_ICON} size={30} /></span>
                  <span style={boxTitle}>{m.label}</span>
                  <span style={boxDesc}>{m.desc}</span>
                </Link>
              )) : <div style={emptyState}>More {secData[0].toLowerCase()} is on the way.</div>}
            </div>
          </div>
        </>
      )}
    </>
  );
}

const barStyle = { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 230, gridTemplateColumns: "repeat(5,1fr)", alignItems: "end", background: "rgba(7,13,9,.96)", WebkitBackdropFilter: "blur(18px)", backdropFilter: "blur(18px)", borderTop: "1px solid var(--pb-line)", padding: "9px 4px calc(10px + env(safe-area-inset-bottom))" };
const lbl = { fontSize: ".6rem", fontFamily: "var(--pb-sans)" };
const tabStyle = (on) => ({ cursor: "pointer", background: "transparent", border: "none", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: on ? "var(--pb-gold)" : "#7f8a82", padding: "4px 0" });
const askWrap = { cursor: "pointer", background: "transparent", border: "none", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#d9b779" };
const askCircle = { width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(140deg,#f0dcac,#c9a35f)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: -24, border: "4px solid var(--pb-bg)", boxShadow: "0 8px 20px -6px rgba(217,183,121,.7)" };

const scrimStyle = { position: "fixed", inset: 0, zIndex: 210, background: "rgba(4,8,6,.58)", display: "block" };
const sheetStyle = { position: "fixed", left: 0, right: 0, bottom: 66, zIndex: 220, maxHeight: "calc(88vh - 66px)", background: "rgba(9,17,12,.99)", WebkitBackdropFilter: "blur(24px) saturate(1.3)", backdropFilter: "blur(24px) saturate(1.3)", border: "1px solid var(--pb-line-strong)", borderBottom: "none", borderRadius: "22px 22px 0 0", boxShadow: "0 -30px 60px -28px rgba(0,0,0,.9)", display: "flex", flexDirection: "column" };
const grip = { width: 42, height: 4, borderRadius: 99, background: "rgba(255,255,255,.18)", margin: "0 auto" };
const sheetTitle = { fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.7rem", color: "var(--pb-ink)" };
const xBtn = { cursor: "pointer", width: 38, height: 38, borderRadius: 11, background: "transparent", border: "1px solid var(--pb-line-strong)", color: "#e7e3d8", display: "flex", alignItems: "center", justifyContent: "center" };
const segWrap = { display: "inline-flex", gap: 2, background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line)", borderRadius: 99, padding: 3 };
const segBtn = (on) => ({ cursor: "pointer", fontFamily: "inherit", padding: "7px 16px", border: "none", borderRadius: 99, fontSize: ".78rem", fontWeight: on ? 700 : 600, background: on ? gold : "transparent", color: on ? "#0a1712" : "#aeb4bd" });
const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "2px 16px calc(22px + env(safe-area-inset-bottom))" };
const boxStyle = { position: "relative", display: "flex", flexDirection: "column", gap: 9, padding: "16px 15px", borderRadius: 16, background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line)", textDecoration: "none", transition: "transform .18s ease,border-color .22s,background .22s" };
const boxIc = { width: 32, height: 32, color: "var(--pb-gold)" };
const boxTitle = { fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.24rem", lineHeight: 1.04, color: "var(--pb-ink)" };
const boxDesc = { fontSize: ".75rem", lineHeight: 1.35, color: "#8a938c" };
const soonChip = { position: "absolute", top: 12, right: 12, fontFamily: "var(--pb-mono)", fontSize: ".46rem", letterSpacing: ".12em", color: "#c9a35f", border: "1px solid var(--pb-line-strong)", borderRadius: 99, padding: "2px 7px" };
const emptyState = { gridColumn: "1/-1", textAlign: "center", color: "#7f8a82", padding: "46px 12px", fontSize: ".92rem" };
