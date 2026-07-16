"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TripModal from "./TripModal";
import AuthModal from "./AuthModal";
import AccountPanel from "./AccountPanel";
import loadScript from "./load-script";
import { useAuth } from "../lib/auth";
import { tripCount as storeTripCount, subscribeTrip } from "../lib/trip";
import { EXPLORE_MENU, BOOK_MENU, SHOP_MENU } from "../lib/nav-menus";
import PbTabBar from "./PbTabBar";

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
const EXPLORE_KEYS = ["explore", "drives", "cruises", "diving", "climbing"];

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
  return (
    <div onMouseEnter={onOpen} onMouseLeave={onClose} style={{ position: "relative" }}>
      <Link href={href} style={{ display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none", color: isActive ? "var(--pb-gold)" : "inherit", transition: "color .3s", cursor: "pointer" }}>
        {label} <span style={{ fontSize: ".6rem", opacity: 0.8, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
      </Link>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: -14, paddingTop: 12 }}>
          <div style={{ width: 300, background: "rgba(11,23,16,.97)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", backdropFilter: "blur(20px) saturate(1.4)", border: "1px solid var(--pb-line)", borderRadius: 16, padding: 8, boxShadow: "0 30px 70px -30px rgba(0,0,0,.85)" }}>
            {menu.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={onClose}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(217,183,121,.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 11px", borderRadius: 11, textDecoration: "none", transition: "background .2s" }}
              >
                <span style={{ fontSize: "1.15rem", width: 22, textAlign: "center", flex: "none" }}>{m.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".86rem", fontWeight: 600, color: "var(--pb-ink)" }}>
                    {m.label}
                    {m.soon && <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".5rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "1px 6px" }}>Soon</span>}
                  </span>
                  <span style={{ display: "block", fontSize: ".72rem", color: "var(--pb-muted)", marginTop: 1 }}>{m.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// mobileChromeless: on phones (≤860px), hide the floating top island (logo + nav
// pill + hamburger) but keep the platform bottom bar + modals. Pines uses this so
// its own top toggle can own the top edge (memory/project-mobile-nav-redesign.md).
export default function SiteHeader({ active, solid = false, tripCount = null, onTripClick, acctSlot = false, mobileChromeless = false }) {
  const [openKey, setOpenKey] = useState(null); // which top-nav dropdown is open ("explore" | "book" | "shop")
  const [menuOpen, setMenuOpen] = useState(false);
  const exActive = EXPLORE_KEYS.includes(active);

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
  const openAccount = () => { setMenuOpen(false); openAuth(); };
  const displayName = user ? ((user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || (user.email || "").split("@")[0]) : "";
  const avatar = user && user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture);

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
      <Logo className={mobileChromeless ? "pb-chromeless" : undefined} />
      <div
        className={mobileChromeless ? "pb-nav-pill pb-chromeless" : "pb-nav-pill"}
        style={{
          flex: 1, minWidth: 0, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
          padding: "8px 12px 8px 20px",
          background: solid ? "var(--pb-bg)" : "rgba(9,17,12,.6)",
          WebkitBackdropFilter: "blur(22px) saturate(1.4)",
          backdropFilter: "blur(22px) saturate(1.4)",
          border: "1px solid var(--pb-line-strong)",
          borderRadius: 22,
          boxShadow: "0 22px 54px -26px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05)",
        }}
      >
      <div className="pb-nav-links" style={{ display: "flex", alignItems: "center", gap: 26, fontSize: ".82rem", fontWeight: 500, color: "#c3c8d0" }}>
        {/* Explore ▾ — the ways to experience the parks */}
        <NavDropdown label="Explore" href="/explore" menu={EXPLORE_MENU} isActive={exActive} open={openKey === "explore"} onOpen={() => setOpenKey("explore")} onClose={() => setOpenKey(null)} />
        {LINKS.map((l) => (
          l.menu ? (
            <NavDropdown key={l.key} label={l.label} href={l.href} menu={l.menu} isActive={active === l.key} open={openKey === l.key} onOpen={() => setOpenKey(l.key)} onClose={() => setOpenKey(null)} />
          ) : l.key === "pines" ? (
            <Link
              key={l.key}
              href={l.href}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "7px 15px 7px 12px", fontWeight: 700, boxShadow: active === l.key ? "0 0 0 2px rgba(217,183,121,.35), 0 6px 18px -8px rgba(217,183,121,.7)" : "0 4px 14px -6px rgba(217,183,121,.55)", transition: "box-shadow .3s, transform .2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--pb-bg)" aria-hidden="true"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
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
      <div className="pb-nav-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {showTrip && (
          <button
            type="button"
            onClick={openTrip}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", color: "#e7e3d8", fontSize: ".82rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 15px" }}
          >
            🎒 My Trip
            <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".58rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "2px 7px" }}>{count}</span>
          </button>
        )}
        {user ? (
          <button type="button" onClick={openAuth} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", color: "#e7e3d8", fontSize: ".82rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "5px 13px 5px 5px" }}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
              : <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--pb-grad-gold)", color: "var(--pb-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".78rem" }}>{(displayName || "?").charAt(0).toUpperCase()}</span>}
            <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
          </button>
        ) : (
          <button type="button" onClick={openAuth} style={{ cursor: "pointer", fontFamily: "inherit", color: "#e7e3d8", fontSize: ".82rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 16px" }}>
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

      {/* Hamburger — only shows ≤860px (CSS), where the links + actions above hide. */}
      <button
        type="button"
        className="pb-hamburger"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        style={{ display: "none", marginLeft: "auto", cursor: "pointer", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 11, width: 42, height: 40, alignItems: "center", justifyContent: "center", color: "var(--pb-ink)", flex: "none" }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {menuOpen ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
        </svg>
      </button>
      </div>{/* /pb-nav-pill */}

      {/* Account menu ("me"). Navigation now lives in the bottom tab bar (PbTabBar),
          so the hamburger is just the account/utility drawer: who you are, My Trip,
          Ask, and the legal footer. */}
      {menuOpen && (
        <div
          className="pb-mobile-menu"
          style={{ position: "absolute", top: "100%", right: 0, width: "min(320px, calc(100vw - 24px))", maxHeight: "calc(100vh - 70px)", overflowY: "auto", background: "rgba(7,10,16,.98)", WebkitBackdropFilter: "blur(20px) saturate(1.3)", backdropFilter: "blur(20px) saturate(1.3)", border: "1px solid var(--pb-line)", borderRadius: 18, marginTop: 8, padding: "16px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 30px 70px -30px rgba(0,0,0,.85)" }}
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
            <button type="button" onClick={() => { setMenuOpen(false); openTrip(); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: "inherit", color: "#e7e3d8", fontSize: ".92rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 15px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>🎒 My Trip</span>
              <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "2px 7px" }}>{count}</span>
            </button>
          )}

          <button type="button" onClick={() => { setMenuOpen(false); askBuddy(); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", fontSize: ".92rem", fontWeight: 600, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", padding: "13px 17px", borderRadius: 12 }}>
            ✦ Ask Park Buddy
          </button>

          <div style={{ height: 1, background: "var(--pb-line)", margin: "2px 2px" }} />
          <div style={{ display: "flex", gap: 18, padding: "2px 4px" }}>
            <Link href="/terms" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", textDecoration: "none" }}>Terms</Link>
            <Link href="/privacy" onClick={() => setMenuOpen(false)} style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", textDecoration: "none" }}>Privacy</Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .pb-nav-links { display: none !important; }
          .pb-nav-actions { display: none !important; }
          .pb-hamburger { display: inline-flex !important; }
          /* Chromeless pages (Pines) draw their own top toggle — hide the island. */
          .pb-chromeless { display: none !important; }
        }
        /* The assistant loads globally so it is reachable everywhere; we hide its own
           teal FAB (off-brand vs the --pb-* system) and open it from the gold header
           button instead. */
        .pbask-fab { display: none !important; }
      `}</style>

      {/* Platform-wide trip planner dialog — auto-opens on any add-to-trip. */}
      <TripModal />
      {/* Platform-wide sign-in modal (signed out) + account panel (signed in). */}
      <AuthModal />
      <AccountPanel />

      {/* Phone-only bottom tab bar (Explore·Book·Ask·Pines·Shop) + section sheets. */}
      <PbTabBar active={active === "pines" ? "pines" : active === "book" ? "book" : active === "shop" ? "shop" : (exActive ? "explore" : null)} />
    </nav>
  );
}
