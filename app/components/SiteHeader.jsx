"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TripModal from "./TripModal";
import AuthModal from "./AuthModal";
import AccountPanel from "./AccountPanel";
import loadScript from "./load-script";
import { useAuth } from "../lib/auth";
import { tripCount as storeTripCount, subscribeTrip } from "../lib/trip";

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

// "Explore" is a dropdown of ways to experience the parks. New activities are
// park-ANCHORED (dive/climb the parks) so they lean on the real park data spine
// rather than trying to be a standalone dive/climbing app.
const EXPLORE_MENU = [
  { icon: "🗺", label: "The Live Map", desc: "Parks, forests & state parks — live", href: "/explore" },
  { icon: "🛣", label: "Scenic Drives", desc: "Byways & road trips", href: "/scenic-drives" },
  { icon: "◉", label: "Trip Mode", desc: "Live on-trip: photos, checklist, alerts", href: "/trip-mode" },
  { icon: "🚢", label: "Cruises", desc: "Reach the parks by sea", href: "/cruises" },
  { icon: "🤿", label: "Diving the Parks", desc: "Dry Tortugas · Channel Islands", href: "/diving", soon: true },
  { icon: "🧗", label: "Climbing the Parks", desc: "Yosemite · Zion · Joshua Tree", href: "/climbing", soon: true },
];
const EXPLORE_KEYS = ["explore", "drives", "cruises", "diving", "climbing"];

// Book ▾ — everything you can reserve, split by category. "All bookings" is the
// full hub; each category deep-links to /book?cat=… which filters the grid there.
const BOOK_MENU = [
  { icon: "🗂", label: "All bookings", desc: "Everything you can reserve", href: "/book" },
  { icon: "🏡", label: "Stays", desc: "Lodges, cabins & vacation rentals", href: "/book?cat=stays" },
  { icon: "🏕", label: "Campgrounds & RV", desc: "Recreation.gov sites + RV parks", href: "/book?cat=camp" },
  { icon: "🚗", label: "Rental cars", desc: "For the drive & scenic byways", href: "/book?cat=cars" },
  { icon: "⚓", label: "Cruises", desc: "Reach the parks by sea", href: "/book?cat=cruises" },
  { icon: "🧭", label: "Tours & experiences", desc: "Guided hikes, rafting, climbs", href: "/book?cat=tours" },
  { icon: "🎫", label: "Permits & reservations", desc: "Timed-entry & wilderness permits", href: "/book?cat=permits" },
  { icon: "🚌", label: "Shuttles & transport", desc: "Park shuttles & gateway transfers", href: "/book?cat=shuttles" },
];

// Shop ▾ — the store by category. Trip Book lives here and is the one live product;
// The Park Buddy Store + the affiliate departments are opening in stages (Soon).
const SHOP_MENU = [
  { icon: "🛍", label: "All of the shop", desc: "Everything in the store", href: "/shop" },
  { icon: "📖", label: "Trip Book", desc: "Your trip, printed & bound — live", href: "/trip-book" },
  { icon: "🏔", label: "The Park Buddy Store", desc: "Posters, prints & merch", href: "/shop?cat=store", soon: true },
  { icon: "🎟", label: "Passes", desc: "America the Beautiful + park passes", href: "/shop?cat=passes", soon: true },
  { icon: "🎒", label: "Gear & Apparel", desc: "Packs, layers, footwear", href: "/shop?cat=gear", soon: true },
  { icon: "⛺", label: "Camp & Cook", desc: "Tents, bags, stoves", href: "/shop?cat=camp", soon: true },
  { icon: "🧭", label: "Navigation & Safety", desc: "GPS, satellite, first-aid", href: "/shop?cat=nav", soon: true },
  { icon: "🗺", label: "Maps & Guides", desc: "Topo maps & guidebooks", href: "/shop?cat=maps", soon: true },
  { icon: "🔭", label: "Optics & Cameras", desc: "Binoculars & scopes", href: "/shop?cat=optics", soon: true },
];

// Plain top-nav links (dropdowns for Explore/Book/Shop are rendered separately).
const LINKS = [
  { key: "pines", label: "Pines", href: "/pines" },
  { key: "book", label: "Book", href: "/book", menu: BOOK_MENU },
  { key: "shop", label: "Shop", href: "/shop", menu: SHOP_MENU },
  { key: "pro", label: "Pro", href: "/#pro" },
  { key: "learn", label: "Learn", href: "/#learn" },
];

function Logo() {
  return (
    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--pb-ink)" }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--pb-grad-gold)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(217,183,121,.35)" }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="var(--pb-bg)"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
      </span>
      <span style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.4rem", letterSpacing: ".01em" }}>Park Buddy</span>
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

export default function SiteHeader({ active, solid = false, tripCount = null, onTripClick, acctSlot = false }) {
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
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "15px clamp(16px,4vw,54px)",
        background: solid ? "var(--pb-bg)" : "rgba(7,10,16,.55)",
        WebkitBackdropFilter: solid ? "none" : "blur(18px) saturate(1.3)",
        backdropFilter: solid ? "none" : "blur(18px) saturate(1.3)",
        borderBottom: "1px solid var(--pb-line)",
        fontFamily: "var(--pb-sans)",
      }}
    >
      <Logo />
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
        style={{ display: "none", cursor: "pointer", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 11, width: 42, height: 40, alignItems: "center", justifyContent: "center", color: "var(--pb-ink)", flex: "none" }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {menuOpen ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
        </svg>
      </button>

      {/* Full mobile menu panel — one column, everything the desktop bar carries. */}
      {menuOpen && (
        <div
          className="pb-mobile-menu"
          style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: "calc(100vh - 70px)", overflowY: "auto", background: "rgba(7,10,16,.98)", WebkitBackdropFilter: "blur(20px) saturate(1.3)", backdropFilter: "blur(20px) saturate(1.3)", borderBottom: "1px solid var(--pb-line)", padding: "10px clamp(16px,4vw,54px) 22px", display: "flex", flexDirection: "column", gap: 4 }}
        >
          {[{ label: "Explore", menu: EXPLORE_MENU }, { label: "Book", menu: BOOK_MENU }, { label: "Shop", menu: SHOP_MENU }].map((sec, si) => (
            <div key={sec.label}>
              {si > 0 && <div style={{ height: 1, background: "var(--pb-line)", margin: "10px 4px" }} />}
              <div style={{ fontFamily: "var(--pb-mono)", fontSize: ".56rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)", padding: "12px 4px 6px" }}>{sec.label}</div>
              {sec.menu.map((m) => (
                <Link key={m.href} href={m.href} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 6px", borderRadius: 11, textDecoration: "none" }}>
                  <span style={{ fontSize: "1.15rem", width: 22, textAlign: "center", flex: "none" }}>{m.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: ".95rem", fontWeight: 600, color: "var(--pb-ink)" }}>
                      {m.label}
                      {m.soon && <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".5rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "1px 6px" }}>Soon</span>}
                    </span>
                    <span style={{ display: "block", fontSize: ".76rem", color: "var(--pb-muted)", marginTop: 1 }}>{m.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          ))}
          <div style={{ height: 1, background: "var(--pb-line)", margin: "10px 4px" }} />
          {LINKS.filter((l) => !l.menu).map((l) => (
            <Link key={l.key} href={l.href} onClick={() => setMenuOpen(false)} style={{ padding: "12px 6px", textDecoration: "none", fontSize: "1rem", fontWeight: 600, color: active === l.key ? "var(--pb-gold)" : "var(--pb-ink)" }}>
              {l.label}
            </Link>
          ))}
          <div style={{ height: 1, background: "var(--pb-line)", margin: "10px 4px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
            {showTrip && (
              <button type="button" onClick={() => { setMenuOpen(false); openTrip(); }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", color: "#e7e3d8", fontSize: ".9rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 15px" }}>
                🎒 My Trip
                <span style={{ fontFamily: "var(--pb-mono)", fontSize: ".62rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", borderRadius: 999, padding: "2px 7px" }}>{count}</span>
              </button>
            )}
            <button type="button" onClick={openAccount} style={{ cursor: "pointer", fontFamily: "inherit", color: "#e7e3d8", fontSize: ".9rem", fontWeight: 600, background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 12, padding: "12px 16px" }}>
              {user ? "Account" : "Sign in"}
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); askBuddy(); }} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: ".9rem", fontWeight: 600, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", padding: "13px 17px", borderRadius: 12 }}>
              ✦ Ask Park Buddy
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .pb-nav-links { display: none !important; }
          .pb-nav-actions { display: none !important; }
          .pb-hamburger { display: inline-flex !important; }
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
    </nav>
  );
}
