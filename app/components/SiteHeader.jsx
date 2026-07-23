"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TripModal from "./TripModal";
import AuthModal from "./AuthModal";
import AccountPanel from "./AccountPanel";
import loadScript from "./load-script";
import { useAuth } from "../lib/auth";
import { useTheme, setTheme } from "../lib/theme";
import { tripCount as storeTripCount, subscribeTrip } from "../lib/trip";
import { EXPLORE_MENU, BOOK_MENU, SHOP_MENU } from "../lib/nav-menus";
import PbTabBar, { PATHS, DEFAULT_ICON, Ico } from "./PbTabBar";

// The one header for the whole platform (Phase A of the design-system rollout).
// Extracted from the approved landing page's glass nav so it matches exactly, and
// built entirely on the --pb-* design tokens (see DESIGN.md). "Plan a trip" is
// intentionally gone — Ask Park Buddy is the planner. Drop <SiteHeader /> at the
// top of any page for instant cross-platform consistency.
//
// Props:
//   active     — optional key to highlight the current section ("explore" | "drives" | ...)
//   solid      — if true, use a solid bar (for pages that scroll under it); default glass.
//   tripCount  — if a number, show a "My Trip" pill with the count (explore uses this).
//   onTripClick— click handler for the My Trip pill.
//   acctSlot   — if true, render the #pp-acct-slot that auth.js mounts the real
//                account / Sign-in UI into (explore), instead of the static button.

// Explore / Book / Shop menus now live in a shared data module so the /shop
// storefront can reuse the exact same destinations (see app/lib/nav-menus.js).

// Friendly name for the current page, shown in the phone top-bar bubble ("where you
// are"). Keyed off the first path segment; dynamic detail pages fall back to a
// section label rather than an id.
const SECTION_NAMES = {
  explore: "The Live Map", "build-trip": "Trip Studio", "trip-mode": "Trip Mode",
  "scenic-drives": "Scenic Drives", towns: "Gateway Towns", cruises: "Cruises", book: "Book", shop: "Shop",
  trips: "My Trips", "trip-book": "Trip Book", "trip-book-styles": "Trip Book", "trip-print": "Trip Book",
  parks: "Park", forests: "Forest", "state-parks": "State Park", lakes: "Lakes",
  "trail-status": "Trail", "lake-status": "Lake", "campground-status": "Campground", "todo-status": "To-Do",
  ski: "Ski", offroad: "Off-Road", about: "About", diving: "Diving", climbing: "Climbing", pines: "Pines",
};
function sectionName(pathname) {
  const p = pathname || "/";
  if (p === "/") return "Home";
  const seg = p.split("/").filter(Boolean)[0] || "";
  return SECTION_NAMES[seg] || (seg ? seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ") : "Park Buddy");
}

// Which top-nav tab (explore | pines | book | shop) the current route belongs to, so
// we can highlight the whole tab you're on. Explore is the umbrella for the map and
// all its experiences + park/place detail pages; null = no section (home, legal…).
const TAB_OF = {
  book: "book",
  shop: "shop", "trip-book": "shop", "trip-book-styles": "shop", "trip-print": "shop",
  pines: "pines",
  explore: "explore", "build-trip": "explore", "scenic-drives": "explore", "trip-mode": "explore",
  towns: "explore",
  cruises: "explore", diving: "explore", climbing: "explore", parks: "explore", forests: "explore",
  "state-parks": "explore", lakes: "explore", "trail-status": "explore", "lake-status": "explore",
  "campground-status": "explore", "todo-status": "explore", ski: "explore", offroad: "explore", trips: "explore",
};
function activeTab(pathname) {
  const seg = (pathname || "/").split("/").filter(Boolean)[0] || "";
  return TAB_OF[seg] || null;
}

// Plain top-nav links (dropdowns for Explore/Book/Shop are rendered separately).
const LINKS = [
  { key: "pines", label: "Pines", href: "/pines" },
  { key: "book", label: "Book", href: "/book", menu: BOOK_MENU },
  { key: "shop", label: "Shop", href: "/shop", menu: SHOP_MENU },
];

function Logo({ className }) {
  return (
    <Link href="/" aria-label="The Park Buddy — home" className={className} style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "var(--pb-ink)" }}>
      <img
        src="/brand/the-park-buddy-badge.png"
        alt="The Park Buddy"
        width={76}
        height={76}
        style={{ height: 76, width: 76, objectFit: "contain", display: "block", filter: "drop-shadow(0 3px 14px rgba(0,0,0,.45))" }}
      />
    </Link>
  );
}

// A hover dropdown for the top nav — the parent link is still clickable (goes to
// the hub), and hovering reveals the category menu. Used by Explore/Book/Shop.
function NavDropdown({ label, href, menu, isActive, open, onOpen, onClose }) {
  // Same Live / Coming-soon split as the mobile section sheets: a segmented toggle
  // filters the list so you can see what's live now vs what's on the way. Only shown
  // when the menu actually has upcoming items (e.g. Book is all-live → no toggle).
  const [seg, setSeg] = useState("live");
  const hasSoon = menu.some((m) => m.soon);
  useEffect(() => { if (!open) setSeg("live"); }, [open]); // reset each time it reopens
  const shown = hasSoon ? menu.filter((m) => (seg === "soon" ? m.soon : !m.soon)) : menu;
  return (
    // No position:relative here on purpose — the panel below anchors to the sections
    // pill (which IS position:relative) so every section's dropdown opens in the SAME
    // place and spans the full pill width, for one consistent mega-menu.
    <div onMouseEnter={onOpen} onMouseLeave={onClose}>
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        // Active section wears the gold bubble — the one highlight language
        // across the platform nav AND the page-section tabs (see pillTabs).
        style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", padding: "7px 14px", borderRadius: 999, fontWeight: isActive ? 700 : 500, color: isActive ? "var(--pb-bg)" : "inherit", background: isActive ? "var(--pb-grad-gold)" : "transparent", border: "1px solid transparent", boxShadow: isActive ? "0 4px 14px -6px rgba(217,183,121,.55)" : "none", transition: "color .3s, background .2s, box-shadow .2s", cursor: "pointer" }}
      >
        {label} <span style={{ fontSize: ".6rem", opacity: 0.8, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
      </Link>
      {open && (
        <div onMouseEnter={onOpen} onMouseLeave={onClose} style={{ position: "absolute", top: "100%", left: 0, right: 0, paddingTop: 14, zIndex: 90 }}>
          <div style={{ width: "100%", background: "var(--pb-glass-strong)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", backdropFilter: "blur(20px) saturate(1.4)", border: "1px solid var(--pb-line-strong)", borderRadius: 20, padding: 14, boxShadow: "0 30px 70px -30px rgba(0,0,0,.85)" }}>
            {hasSoon && (
              <div style={{ display: "inline-flex", gap: 2, background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: 3, margin: "2px 2px 10px" }}>
                {[["live", "Live"], ["soon", "Coming soon"]].map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSeg(k)}
                    style={{ cursor: "pointer", fontFamily: "inherit", padding: "6px 14px", border: "none", borderRadius: 999, fontSize: ".72rem", fontWeight: seg === k ? 700 : 600, background: seg === k ? "var(--pb-grad-gold)" : "transparent", color: seg === k ? "var(--pb-bg)" : "#aeb4bd", transition: "background .2s, color .2s" }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            )}
            {shown.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {shown.map((m) => (
                  <Link key={m.href} href={m.href} onClick={onClose} className="pb-megabox" style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, padding: "14px 14px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line)", textDecoration: "none" }}>
                    {m.soon && <span style={{ position: "absolute", top: 11, right: 11, fontFamily: "var(--pb-mono)", fontSize: ".46rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "2px 6px" }}>Soon</span>}
                    <span style={{ width: 28, height: 28, color: "var(--pb-gold)" }}><Ico d={PATHS[m.href] || DEFAULT_ICON} size={28} /></span>
                    <span style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.14rem", lineHeight: 1.05, color: "var(--pb-ink)" }}>{m.label}</span>
                    <span style={{ fontSize: ".72rem", lineHeight: 1.35, color: "var(--pb-muted)" }}>{m.desc}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--pb-muted)", fontSize: ".82rem", padding: "30px 12px" }}>More {label.toLowerCase()} is on the way.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// mobileChromeless: on phones (≤860px), hide the floating top island (logo + nav
// pill + hamburger) but keep the platform bottom bar + modals. Pines uses this so
// its own top toggle can own the top edge (memory/project-mobile-nav-redesign.md).
// pillTabs: a page can hand the island its own section tabs —
//   { items: [{key,label}], active, on, onSelect }. While `on` is false the pill
//   shows the platform nav as always; when it flips true the SAME pill animates
//   its width and crossfades into the page tabs (one bar morphing, never two
//   bars swapping), and morphs back when `on` returns to false. Desktop only —
//   the pill is display:none under 860px.
export default function SiteHeader({ active, solid = false, tripCount = null, onTripClick, acctSlot = false, mobileChromeless = false, hideTabBar = false, bare = false, pillTabs = null }) {
  const [openKey, setOpenKey] = useState(null); // which top-nav dropdown is open ("explore" | "book" | "shop")
  const [menuOpen, setMenuOpen] = useState(false);
  // Hover-intent: the dropdown anchors below the pill, so moving the mouse from a tab
  // into the panel briefly crosses a gap. Delay the close so it survives that gap; any
  // re-entry (the panel, or another tab) cancels the pending close.
  const closeTimer = useRef(null);
  const openDrop = (key) => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } setOpenKey(key); };
  const closeDrop = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setOpenKey(null), 200); };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // The header owns the trip badge for every page: it reads the shared trip store
  // and re-renders on any change. A page can still pass an explicit `tripCount`
  // (Explore drives its own live count); otherwise we show the store's count.
  const [storeCount, setStoreCount] = useState(0);
  useEffect(() => {
    const sync = () => setStoreCount(storeTripCount());
    sync();
    return subscribeTrip(sync);
  }, []);
  const count = tripCount != null ? tripCount : storeCount;
  const showTrip = tripCount != null || storeCount > 0;

  // Load the self-contained Ask Park Buddy assistant on every page that has the
  // header, so the flagship AI is reachable in-context (no full reload to /#ask).
  // loadScript is idempotent (once per session) and the widget guards its own
  // double-init; we hide its off-brand teal FAB below and open it from the gold
  // header button instead — matching how Explore already drives it.
  useEffect(() => { loadScript("/ask-parkbuddy.js"); }, []);
  // My Trip pill: pages with their own trip UI (Explore) pass onTripClick; every
  // other page opens the shared trip planner modal.
  const openTrip = () => { if (onTripClick) onTripClick(); else if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pb:trip-open")); };

  // Lock body scroll while the mobile menu is open so the page behind it doesn't
  // scroll under the panel. Cleaned up on close/unmount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  // Open the account/sign-in panel auth.js mounts (used by the mobile menu, where
  // the desktop #pp-acct-slot pill is hidden). Falls back to home if auth isn't
  // loaded on this page (parity with the static desktop "Sign in").
  // React auth store — supersedes the legacy auth.js on React pages. "Sign in"
  // and the account pill both open the one AuthModal (which shows sign-in when
  // signed out, the account panel when signed in).
  const { user, openAuth } = useAuth();
  const theme = useTheme(); // "light" | "dark" — for the account-menu toggle
  const openAccount = () => { setMenuOpen(false); openAuth(); };
  // Phone top-bar bubble: shows the current section ("where you are") and, when
  // tapped, opens the platform "Go anywhere" tile sheet (the same sheet the bottom
  // Explore tab opens — PbTabBar listens for this event).
  const pathname = usePathname();
  const here = sectionName(pathname);
  const tab = activeTab(pathname); // which section tab to highlight ("explore" | "book" | "shop" | "pines" | null)
  const openGo = () => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("pb:open-sheet", { detail: "go" })); };
  const displayName = user ? ((user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || "").split("@")[0]) : "";
  const avatar = user && user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture);

  // Morphing pill (see pillTabs above). Width is measured, not guessed: lock
  // the current width in px, then transition to the target layer's natural
  // width while the layers crossfade. Overflow is clipped only while the tabs
  // own the pill — the nav state needs overflow visible for its dropdowns.
  const pillRef = useRef(null), navLayRef = useRef(null), altLayRef = useRef(null);
  const [altOn, setAltOn] = useState(false);
  const prevOnRef = useRef(false);
  const PILL_PAD = 68; // 34px horizontal padding each side
  useEffect(() => {
    const on = !!(pillTabs && pillTabs.on);
    if (on === prevOnRef.current) return;
    prevOnRef.current = on;
    const pill = pillRef.current, nav = navLayRef.current, alt = altLayRef.current;
    if (!pill || !nav || !alt) { setAltOn(on); return; }
    pill.style.width = pill.getBoundingClientRect().width + "px";
    pill.style.overflow = "hidden";
    requestAnimationFrame(() => {
      pill.style.width = ((on ? alt.scrollWidth : nav.scrollWidth) + PILL_PAD) + "px";
      setAltOn(on);
    });
    const done = (e) => {
      if (e.propertyName !== "width") return;
      if (!prevOnRef.current) { pill.style.width = ""; pill.style.overflow = ""; }
      pill.removeEventListener("transitionend", done);
    };
    pill.addEventListener("transitionend", done);
  }, [pillTabs && pillTabs.on]);
  // While the tabs own the pill, a tab change shifts the bubble (bold + padding)
  // — re-fit the width so nothing clips.
  useEffect(() => {
    if (!(pillTabs && pillTabs.on)) return;
    const pill = pillRef.current, alt = altLayRef.current;
    if (pill && alt) pill.style.width = (alt.scrollWidth + PILL_PAD) + "px";
  }, [pillTabs && pillTabs.on, pillTabs && pillTabs.active]);

  const askBuddy = async () => {
    // Open the assistant in-context. Ensure its script is loaded (idempotent) before
    // clicking, so it works even if the mount effect hasn't resolved yet — and only
    // fall back to the home hero if the widget genuinely can't be brought up.
    let fab = typeof document !== "undefined" && document.querySelector(".pbask-fab, #askPill");
    if (!fab && typeof window !== "undefined") {
      await loadScript("/ask-parkbuddy.js");
      fab = document.querySelector(".pbask-fab, #askPill");
    }
    if (fab) fab.click();
    else if (typeof window !== "undefined") window.location.href = "/#ask";
  };

  return (
    <nav
      className="pb-nav-float"
      style={{
        position: "fixed", top: "clamp(8px,1.4vw,14px)", left: "clamp(8px,1.6vw,18px)", right: "clamp(8px,1.6vw,18px)", zIndex: 100,
        display: "flex", alignItems: "center", gap: "clamp(10px,1.4vw,18px)",
        fontFamily: "var(--pb-sans)",
      }}
    >
      <Logo className={[mobileChromeless ? "pb-chromeless" : "", bare ? "pb-bare-hide" : ""].filter(Boolean).join(" ") || undefined} />

      {/* Phone-only "you are here" bubble — the current section name; tap to open the
          platform "Go anywhere" tile sheet. Hidden on Pines (mobileChromeless) and on
          desktop (the pill takes over). */}
      <button
        type="button"
        className={mobileChromeless ? "pb-mobile-bubble pb-chromeless" : "pb-mobile-bubble"}
        onClick={openGo}
        aria-label={"You're in " + here + " — open the menu"}
        style={{
          display: "none", flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 9, cursor: "pointer",
          fontFamily: "var(--pb-sans)", color: "var(--pb-ink)",
          background: solid ? "var(--pb-bg)" : "var(--pb-glass)",
          WebkitBackdropFilter: "blur(22px) saturate(1.4)", backdropFilter: "blur(22px) saturate(1.4)",
          border: "1px solid var(--pb-line-strong)", borderRadius: 22, padding: "13px 16px",
          boxShadow: "0 22px 54px -26px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pb-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".92rem", fontWeight: 600 }}>{here}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--pb-muted)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      <div
        ref={pillRef}
        className={mobileChromeless ? "pb-nav-pill pb-chromeless" : "pb-nav-pill"}
        style={{
          flex: "none", marginLeft: "auto", position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 28,
          padding: "10px 34px",
          background: solid ? "var(--pb-bg)" : "var(--pb-glass)",
          WebkitBackdropFilter: "blur(22px) saturate(1.4)",
          backdropFilter: "blur(22px) saturate(1.4)",
          border: "1px solid var(--pb-line-strong)",
          borderRadius: 22,
          boxShadow: "0 22px 54px -26px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05)",
          transition: "width .4s cubic-bezier(.16,.8,.24,1)",
        }}
      >
      <div ref={navLayRef} className="pb-nav-links" style={{ display: "flex", alignItems: "center", gap: 16, fontSize: ".82rem", fontWeight: 500, color: "var(--pb-ink-2)", whiteSpace: "nowrap", opacity: altOn ? 0 : 1, pointerEvents: altOn ? "none" : "auto", transition: "opacity .22s ease" }}>
        {/* Explore ▾ — the ways to experience the parks */}
        <NavDropdown label="Explore" href="/explore" menu={EXPLORE_MENU} isActive={tab === "explore"} open={openKey === "explore"} onOpen={() => openDrop("explore")} onClose={closeDrop} />
        {LINKS.map((l) => (
          l.menu ? (
            <NavDropdown key={l.key} label={l.label} href={l.href} menu={l.menu} isActive={tab === l.key} open={openKey === l.key} onOpen={() => openDrop(l.key)} onClose={closeDrop} />
          ) : l.key === "pines" ? (
            // The gold bubble is now the ACTIVE-SECTION highlight, not Pines
            // branding (owner call 2026-07-22) — Pines wears it only when
            // you are actually in Pines, like every other section.
            <Link
              key={l.key}
              href={l.href}
              aria-current={tab === "pines" ? "page" : undefined}
              style={tab === "pines"
                ? { display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "7px 15px 7px 12px", fontWeight: 700, boxShadow: "0 4px 14px -6px rgba(217,183,121,.55)", transition: "box-shadow .3s, transform .2s" }
                : { display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", color: "inherit", fontWeight: 500, transition: "color .3s" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
              Pines
            </Link>
          ) : (
            <Link
              key={l.key}
              href={l.href}
              style={{ textDecoration: "none", color: active === l.key ? "var(--pb-gold)" : "inherit", transition: "color .3s" }}
            >
              {l.label}
            </Link>
          )
        ))}
      </div>
      {/* Page-section tabs layer — crossfades in when pillTabs.on (the morph).
          Absolutely centered at max-content width so its natural width is
          measurable for the pill's width animation. The gold bubble marks the
          ACTIVE section — the same treatment Pines used to wear permanently. */}
      {pillTabs && (
        <div ref={altLayRef} role="tablist" aria-label="Page sections"
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "max-content",
            display: "flex", alignItems: "center", gap: 4,
            opacity: altOn ? 1 : 0, pointerEvents: altOn ? "auto" : "none", transition: "opacity .22s ease" }}>
          {pillTabs.items.map((t) => {
            const on = pillTabs.active === t.key;
            return (
              <button key={t.key} role="tab" aria-selected={on}
                onClick={() => pillTabs.onSelect && pillTabs.onSelect(t.key)}
                style={{ cursor: "pointer", border: "none", fontFamily: "inherit", fontSize: ".8rem", whiteSpace: "nowrap",
                  borderRadius: 999, padding: "7px 13px", fontWeight: on ? 700 : 500,
                  color: on ? "var(--pb-bg)" : "var(--pb-ink-2)",
                  background: on ? "var(--pb-grad-gold)" : "transparent",
                  boxShadow: on ? "0 4px 14px -6px rgba(217,183,121,.55)" : "none",
                  transition: "color .25s, background .25s, box-shadow .25s, font-weight .25s" }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      </div>{/* /pb-nav-pill — sections only, sits between the logo and the account */}

      {/* Account cluster — kept visually separate from the section nav (Sign in /
          account / Ask / My Trip), pushed to the right. */}
      <div className="pb-nav-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Desktop theme toggle — icon-only sun/moon; mirrors the account-drawer toggle. */}
        <button
          type="button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "50%", background: "var(--pb-glass)", WebkitBackdropFilter: "blur(22px) saturate(1.4)", backdropFilter: "blur(22px) saturate(1.4)", border: "1px solid var(--pb-line-strong)", color: "var(--pb-ink)", flex: "none" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {theme === "light"
              ? <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              : <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18" /></>}
          </svg>
        </button>
        {showTrip && (
          <button
            type="button"
            onClick={openTrip}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", color: "var(--pb-ink)", fontSize: ".82rem", fontWeight: 600, background: "var(--pb-glass)", WebkitBackdropFilter: "blur(22px) saturate(1.4)", backdropFilter: "blur(22px) saturate(1.4)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 15px" }}
          >
            🎒 My Trip
            <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".58rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "2px 7px" }}>{count}</span>
          </button>
        )}
        {user ? (
          <button type="button" onClick={openAuth} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", color: "var(--pb-ink)", fontSize: ".82rem", fontWeight: 600, background: "var(--pb-glass)", WebkitBackdropFilter: "blur(22px) saturate(1.4)", backdropFilter: "blur(22px) saturate(1.4)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "5px 13px 5px 5px" }}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
              : <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--pb-grad-gold)", color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".78rem" }}>{(displayName || "?").charAt(0).toUpperCase()}</span>}
            <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
          </button>
        ) : (
          <button type="button" onClick={openAuth} style={{ cursor: "pointer", fontFamily: "inherit", color: "var(--pb-ink)", fontSize: ".82rem", fontWeight: 600, background: "var(--pb-glass)", WebkitBackdropFilter: "blur(22px) saturate(1.4)", backdropFilter: "blur(22px) saturate(1.4)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 16px" }}>
            Sign in
          </button>
        )}
        <button
          type="button"
          onClick={askBuddy}
          style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 600, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", padding: "9px 17px", borderRadius: 999 }}
        >
          Ask Park Buddy
        </button>
      </div>

      {/* Phone-only account hamburger — sits OUTSIDE the bubble (per design: the bubble
          is where-you-are + nav, the hamburger is your account). Shown ≤860px. */}
      <button
        type="button"
        className={mobileChromeless ? "pb-mobile-burger pb-chromeless" : "pb-mobile-burger"}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        style={{ display: "none", flex: "none", cursor: "pointer", background: solid ? "var(--pb-bg)" : "var(--pb-glass)", WebkitBackdropFilter: "blur(22px) saturate(1.4)", backdropFilter: "blur(22px) saturate(1.4)", border: "1px solid var(--pb-line-strong)", borderRadius: 14, width: 50, height: 48, alignItems: "center", justifyContent: "center", color: "var(--pb-ink)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {menuOpen ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
        </svg>
      </button>

      {/* Account menu ("me"). Navigation now lives in the bottom tab bar (PbTabBar),
          so the hamburger is just the account/utility drawer: who you are, My Trip,
          Ask, and the legal footer. */}
      {menuOpen && (
        <div
          className="pb-mobile-menu"
          style={{ position: "absolute", top: "100%", right: 0, width: "min(320px, calc(100vw - 24px))", maxHeight: "calc(100vh - 70px)", overflowY: "auto", background: "var(--pb-glass-strong)", WebkitBackdropFilter: "blur(20px) saturate(1.3)", backdropFilter: "blur(20px) saturate(1.3)", border: "1px solid var(--pb-line)", borderRadius: 18, marginTop: 8, padding: "16px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 30px 70px -30px rgba(0,0,0,.85)" }}
        >
          {/* Identity header */}
          <button type="button" onClick={openAccount} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "rgba(255,255,255,.03)", border: "1px solid var(--pb-line)", borderRadius: 14, padding: "12px 14px", fontFamily: "inherit" }}>
            {user
              ? (avatar
                  ? <img src={avatar} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
                  : <span style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--pb-grad-gold)", color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "1.1rem", flex: "none" }}>{(displayName || "?").charAt(0).toUpperCase()}</span>)
              : <span style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(217,183,121,.12)", border: "1px solid var(--pb-line-strong)", color: "var(--pb-gold)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" /></svg>
                </span>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: user ? ".98rem" : ".95rem", fontWeight: 700, color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user ? displayName : "Sign in"}</span>
              <span style={{ display: "block", fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 1 }}>{user ? "View account & settings" : "Save trips, get park alerts"}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pb-muted)" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          {showTrip && (
            <button type="button" onClick={() => { setMenuOpen(false); openTrip(); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: "inherit", color: "var(--pb-ink)", fontSize: ".92rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 15px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>🎒 My Trip</span>
              <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "2px 7px" }}>{count}</span>
            </button>
          )}

          <button type="button" onClick={() => { setMenuOpen(false); askBuddy(); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", fontSize: ".92rem", fontWeight: 600, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", padding: "13px 17px", borderRadius: 12 }}>
            ✦ Ask Park Buddy
          </button>

          {/* Theme toggle — Light / Dark (rolling out platform-wide one page at a time). */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 4px 2px" }}>
            <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-muted)" }}>Theme</span>
            <div style={{ display: "inline-flex", gap: 2, background: "rgba(127,138,130,.14)", border: "1px solid var(--pb-line)", borderRadius: 999, padding: 3 }}>
              {[["light", "Light", "M12 3v2M12 19v2M5 12H3M21 12h-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18"], ["dark", "Dark", "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"]].map(([k, lbl, d]) => (
                <button key={k} type="button" onClick={() => setTheme(k)} aria-pressed={theme === k} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: ".76rem", fontWeight: theme === k ? 700 : 600, border: "none", borderRadius: 999, padding: "6px 12px", background: theme === k ? "var(--pb-grad-gold)" : "transparent", color: theme === k ? "var(--pb-bg)" : "var(--pb-ink-2)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={k === "dark" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{k === "dark" ? <path d={d} /> : <><circle cx="12" cy="12" r="4" /><path d={d} /></>}</svg>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "var(--pb-line)", margin: "2px 2px" }} />
          <div style={{ display: "flex", gap: 18, padding: "2px 4px" }}>
            <Link href="/terms" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", textDecoration: "none" }}>Terms</Link>
            <Link href="/privacy" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", textDecoration: "none" }}>Privacy</Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          /* Phone: the desktop pill + account cluster give way to the where-you-are
             bubble + an account hamburger sitting outside it. */
          .pb-nav-pill { display: none !important; }
          .pb-nav-actions { display: none !important; }
          .pb-mobile-bubble { display: flex !important; }
          .pb-mobile-burger { display: inline-flex !important; }
          /* Chromeless pages (Pines) draw their own top toggle — hide the island. */
          .pb-chromeless { display: none !important; }
        }
        /* Desktop mega-menu boxes (mirror the phone section-sheet tiles). */
        .pb-megabox { transition: transform .16s ease, border-color .22s, background .22s; }
        @media (hover: hover) {
          .pb-megabox:hover { transform: translateY(-3px); border-color: rgba(217,183,121,.5) !important; background: rgba(217,183,121,.06) !important; }
        }
        /* The assistant loads globally so it is reachable everywhere; we hide its own
           teal FAB (off-brand vs the --pb-* system) and open it from the gold header
           button instead. */
        .pbask-fab { display: none !important; }
        ${bare ? `/* Bare mode (immersive pages like Book Studio): hide the nav island
             on every size so the page can supply its own header; the modals and
             assistant that also live here keep working. Only renders on the bare page,
             so plain class selectors are safe — no child-combinator, which would trip a
             server/client escaping mismatch (hydration error). */
          .pb-nav-pill, .pb-nav-actions, .pb-mobile-bubble,
          .pb-mobile-burger, .pb-mobile-menu, .pb-bare-hide { display: none !important; }` : ""}
      `}</style>

      {/* Platform-wide trip planner dialog — auto-opens on any add-to-trip. */}
      <TripModal />
      {/* Platform-wide sign-in modal (signed out) + account panel (signed in). */}
      <AuthModal />
      <AccountPanel />

      {/* Phone-only bottom tab bar (Explore·Book·Ask·Pines·Shop) + section sheets.
          hideTabBar: an immersive page (e.g. Book Studio) supplies its own bottom bar. */}
      {!hideTabBar && <PbTabBar active={tab} />}
    </nav>
  );
}
