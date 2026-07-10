"use client";

import { useEffect, useRef, useState } from "react";
import "./studio.css";
import { MARKUP, mountStudio } from "./studioSource";
import SiteHeader from "../components/SiteHeader";
import loadScript from "../components/load-script";
import { getStops, getMeta } from "../lib/trip";
import { getPhotos, getStory, distMiles, addCrumb } from "../lib/tripmode";

// Trip Book Studio — a living travel-diary keepsake. Ported 1:1 from the Claude
// Design preview (see studioSource.js): a 3-step hub (living diary → theme &
// settings with a live openable preview → a real openable 3D hardcover). The
// engine is imperative, so we inject its markup and run it on mount; the swaps
// (server-cached /api/photo, real photo capture, localStorage persistence) live
// in studioSource.js. This wrapper also feeds it the user's REAL trip — stops,
// Trip Mode photos + stories, and trip meta — falling back to the curated demo.

function fmtTime(ts) {
  try {
    const d = new Date(ts);
    if (isNaN(d)) return "";
    const day = d.toLocaleDateString([], { weekday: "short" });
    const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return day + " · " + t;
  } catch { return ""; }
}
function fmtDates(start, end) {
  try {
    if (!start) return "";
    const s = new Date(start + "T00:00:00");
    const e = end ? new Date(end + "T00:00:00") : null;
    if (isNaN(s)) return "";
    const mo = (d) => d.toLocaleDateString([], { month: "long" });
    const yr = (e || s).getFullYear();
    if (e && !isNaN(e)) {
      if (mo(s) === mo(e)) return `${mo(s)} ${s.getDate()}–${e.getDate()}, ${yr}`;
      return `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}, ${yr}`;
    }
    return `${mo(s)} ${s.getDate()}, ${yr}`;
  } catch { return ""; }
}

// Compose the Studio's data model from the real trip. Returns null when the user
// has no trip at all → the engine keeps its curated Colorado Plateau demo.
function buildRealData() {
  let stops = [], meta = {}, photos = {}, stories = {};
  try { stops = getStops() || []; } catch {}
  try { meta = getMeta() || {}; } catch {}
  try { photos = getPhotos() || {}; } catch {}
  try { stories = getStory() || {}; } catch {}

  // getMeta() always returns a default tripName, so it can't signal "has a trip"
  // — only real stops or captured photos do. No trip → null → the demo shows.
  if (!stops.length && !Object.keys(photos).length) return null;

  const q = (name) => [name + " National Park", name];
  const entries = [];

  stops.forEach((s, si) => {
    const name = s.name;
    const list = photos[name] || [];
    const story = stories[name] || "";
    if (list.length) {
      list.forEach((p, pi) =>
        entries.push({
          type: pi === 0 ? "Remember this" : "On the road",
          ic: pi === 0 ? "✨" : "📷",
          place: name,
          time: p.ts ? fmtTime(p.ts) : "",
          w: "",
          cap: pi === 0 ? story || p.note || "" : p.note || "",
          userImg: p.url,
          q: q(name),
        })
      );
    } else {
      // no captures yet — still seat the stop in the book with a real park photo
      entries.push({
        type: si === 0 ? "Departure" : "Remember this",
        ic: si === 0 ? "🚗" : "✨",
        place: name,
        time: "",
        w: "",
        cap: story || "",
        userImg: null,
        q: q(name),
      });
    }
  });

  // custom photo-stops that aren't in the itinerary (e.g. a town, a pullout)
  Object.keys(photos).forEach((name) => {
    if (stops.some((s) => s.name === name)) return;
    (photos[name] || []).forEach((p) =>
      entries.push({
        type: "Remember this", ic: "✨", place: name,
        time: p.ts ? fmtTime(p.ts) : "", w: "", cap: p.note || "",
        userImg: p.url, q: q(name),
      })
    );
  });

  const trip = {};
  if (meta.tripName) trip.title = meta.tripName;
  const dates = fmtDates(meta.startDate, meta.endDate);
  if (dates) trip.dates = dates;
  // eyebrow region = the states you crossed, else a neutral label
  const states = [...new Set(stops.map((s) => s.state).filter(Boolean))];
  trip.region = states.length ? states.join(" · ") : "A Park Buddy Trip";
  // Trip Mode status line = the real route
  if (stops.length >= 2) trip.modeLine = stops[0].name + " → " + stops[stops.length - 1].name + " · " + stops.length + " stops";
  else if (stops.length === 1) trip.modeLine = stops[0].name;
  else if (meta.tripName) trip.modeLine = meta.tripName;

  // moment prompts = gentle nudges for stops that have no photo yet
  const prompts = [];
  stops.forEach((s) => {
    if (!(photos[s.name] && photos[s.name].length)) {
      prompts.push({
        type: "Remember this", ic: "✨",
        title: "Add " + s.name + " to your book",
        msg: "Capture a moment at " + s.name + " — it becomes a spread automatically.",
        place: s.name, w: "", q: q(s.name),
      });
    }
  });

  return { entries, trip, prompts };
}

export default function TripBook() {
  const rootRef = useRef(null);
  const [reserve, setReserve] = useState(null);

  useEffect(() => {
    // The ported inline styles reference fonts by their literal family names,
    // but next/font self-hosts them under hashed names — so load the literal
    // families for this page (the app isn't CSP-restricted).
    const FID = "tb-studio-fonts";
    if (!document.getElementById(FID)) {
      const l = document.createElement("link");
      l.id = FID;
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap";
      document.head.appendChild(l);
    }

    const el = rootRef.current;
    if (!el) return;
    // Recolor the ported studio to the Park Buddy palette: its near-black base and
    // top-bar glass → dark-green (--pb-bg #0a1712). Gold accents, cream book pages
    // and the Cormorant serif already match Park Buddy, so this is all it takes.
    el.innerHTML = MARKUP
      .split("#0e0e0c").join("#0a1712")
      .split("rgba(14,14,12").join("rgba(10,23,18");
    // The studio ships its own "Trip Book" top bar; the page now renders the real
    // Park Buddy header above it, so demote the studio bar to a sub-bar — hide its
    // brand block and drop it below the site header, keeping the stepper + action.
    try {
      const hdr = el.querySelector("header");
      if (hdr) {
        hdr.style.top = "56px";
        hdr.style.zIndex = "30";
        if (hdr.firstElementChild) hdr.firstElementChild.style.display = "none";
      }
    } catch {}
    let studio;
    let watchId = null;
    try {
      studio = mountStudio(buildRealData());
    } catch (e) {
      console.error("Trip Book Studio failed to mount:", e);
    }

    // Replace the demo "Added to cart" toast with the real Reserve flow. The
    // order buttons live in the injected markup, so re-bind them after mount.
    if (studio) {
      const openReserve = () => {
        try {
          const theme = (studio.THEMES[studio.sel] || {}).name || "";
          const pr = studio.PRINTS[studio.S.print] || ["", ""];
          setReserve({
            theme, size: pr[0], price: pr[1], title: studio.S.title || "",
            dates: studio.S.dates || "", dedication: studio.S.ded || "",
            entries: (studio.entries || []).map((e) => ({ type: e.type, place: e.place, cap: e.cap, userImg: e.userImg, q: e.q })),
          });
        } catch (e) {}
      };
      const ob = document.getElementById("orderBtn");
      if (ob) ob.onclick = openReserve;
      const ta = document.getElementById("topAction");
      if (ta) ta.onclick = () => {
        if (studio.step < 2) studio.setStep(studio.step + 1);
        else openReserve();
      };

      // "Print-ready PDF" — generate the Lulu-spec interior PDF and download it,
      // so the traveler can preview exactly what gets printed.
      if (!document.getElementById("tb-pdf-btn")) {
        const dl = document.createElement("button");
        dl.id = "tb-pdf-btn";
        dl.textContent = "⬇ Print-ready PDF";
        dl.style.cssText = "cursor:pointer;font-family:inherit;font-size:.78rem;font-weight:600;color:#f4f1ea;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.35);border-radius:999px;padding:9px 16px";
        dl.onclick = async () => {
          const prev = dl.textContent; dl.textContent = "Preparing…"; dl.disabled = true;
          try {
            const payload = {
              title: studio.S.title, dates: studio.S.dates, dedication: studio.S.ded,
              entries: (studio.entries || []).map((e) => ({ place: e.place, cap: e.cap, userImg: e.userImg, q: e.q })),
            };
            const r = await fetch("/api/interior-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Couldn't build the PDF."); }
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "trip-book-interior.pdf";
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
          } catch (e) { alert(e.message || "Couldn't build the PDF."); }
          finally { dl.textContent = prev; dl.disabled = false; }
        };
        const cb = document.getElementById("closeBook");
        if (cb && cb.parentElement) cb.parentElement.appendChild(dl);
      }
    }

    // Live GPS: on a real trip, offer to use the traveler's location and turn the
    // diary prompt into a real arrival ("You've reached <stop>"). Reuses the same
    // coord resolution + arrival threshold as /trip-mode.
    if (studio) {
      (async () => {
        let raw = [];
        try { raw = getStops() || []; } catch {}
        if (!raw.length) return; // demo → no geofencing
        const coord = {};
        try {
          await loadScript("/trip-data.js");
          // key by both the dataset's short name AND "<name> National Park" so a
          // stop stored either way resolves (the dataset uses short names).
          (window.TRIP_PARKS || []).forEach((p) => {
            if (p && p.name) { coord[p.name] = { lat: p.lat, lng: p.lng }; coord[p.name + " National Park"] = { lat: p.lat, lng: p.lng }; }
          });
        } catch {}
        const findCoord = (s) => {
          if (s.lat != null) return s;
          const bare = s.name.replace(/\s+national park$/i, "").trim();
          return coord[s.name] || coord[bare] || null;
        };
        const geoStops = raw
          .map((s) => { const c = findCoord(s); return c && c.lat != null ? { name: s.name, lat: c.lat, lng: c.lng, q: [s.name + " National Park", s.name] } : null; })
          .filter(Boolean);
        if (!geoStops.length) return;

        const setText = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
        const showPrompt = (p) => {
          const cardEl = document.getElementById("promptCard"); if (cardEl) cardEl.style.display = "";
          setText("promptIcon", p.ic); setText("promptTitle", p.title); setText("promptMsg", p.msg);
          const cs = document.getElementById("capStamp");
          try { if (cs) cs.innerHTML = studio.stamp(p.place, p.w || ""); } catch {}
          studio._ap = p;
        };
        const notified = {};
        const onPos = (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const btn = document.getElementById("tb-loc-btn"); if (btn) btn.textContent = "📍 Location on";
          try { addCrumb(c.lat, c.lng); } catch {}
          let near = null, nd = Infinity;
          geoStops.forEach((s) => { const d = distMiles(c.lat, c.lng, s.lat, s.lng); if (d < nd) { nd = d; near = s; } });
          if (near && nd <= 2) {
            showPrompt({ type: "Remember this", ic: "📍", title: "You've reached " + near.name, msg: "You made it — grab a photo for your book.", place: near.name, w: "", q: near.q });
            setText("tripModeLine", "You're at " + near.name);
            if (!notified[near.name]) {
              notified[near.name] = true;
              try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("You've reached " + near.name + " 📸", { body: "Snap a photo for your trip book." }); } catch {}
            }
          } else if (near) {
            setText("tripModeLine", "Nearest: " + near.name + " · " + (nd < 10 ? nd.toFixed(1) : Math.round(nd)) + " mi");
          }
        };
        const onErr = (err) => { const btn = document.getElementById("tb-loc-btn"); if (btn) btn.textContent = err && err.code === 1 ? "Location denied" : "Location error"; };
        const startGeo = () => {
          const btn = document.getElementById("tb-loc-btn");
          if (!navigator.geolocation) { if (btn) btn.textContent = "Location unavailable"; return; }
          if (btn) btn.textContent = "📍 Locating…";
          try { if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch {}
          watchId = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
        };

        if (!document.getElementById("tb-loc-btn")) {
          const anchor = document.getElementById("tripModeLine");
          const row = anchor ? anchor.parentElement : null;
          if (row) {
            row.style.flexWrap = "wrap";
            const b = document.createElement("button");
            b.id = "tb-loc-btn";
            b.textContent = "📍 Use my location";
            b.style.cssText = "cursor:pointer;font-family:var(--pb-mono),monospace;font-size:.54rem;letter-spacing:.1em;text-transform:uppercase;color:#0e0e0c;background:linear-gradient(120deg,#e8cf9a,#c9a35f);border:none;border-radius:999px;padding:6px 12px;margin-left:auto";
            b.onclick = startGeo;
            row.appendChild(b);
          }
        }
      })();
    }

    return () => {
      try {
        studio && studio.destroy && studio.destroy();
      } catch (e) {}
      try {
        if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      } catch (e) {}
      if (el) el.innerHTML = "";
    };
  }, []);

  return (
    <>
      <SiteHeader acctSlot />
      <div className="tbstudio" ref={rootRef} />
      {reserve && <ReserveModal data={reserve} onClose={() => setReserve(null)} />}
    </>
  );
}

// Honest reservation flow — captures the edition + buyer, no charge. Becomes real
// checkout once Lulu (print) + Stripe (payment) are wired; POSTs to /api/book-order.
function ReserveModal({ data, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ship, setShip] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done
  const [error, setError] = useState("");

  const priceNum = parseFloat(String(data.price).replace(/[^0-9.]/g, "")) || 0;
  const total = priceNum ? "$" + (priceNum * qty).toFixed(0) : data.price;

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setStatus("sending");
    const headers = { "Content-Type": "application/json" };
    const payload = JSON.stringify({
      email: email.trim(), name, shipping: ship, quantity: qty, note,
      title: data.title, theme: data.theme, size: data.size, price: data.price,
      dates: data.dates, dedication: data.dedication, entries: data.entries,
    });

    // 1) Always record the reservation (waitlist / order intent).
    let reserved = false;
    try {
      const r = await fetch("/api/book-order", { method: "POST", headers, body: payload });
      const d = await r.json().catch(() => ({}));
      reserved = r.ok && d.ok;
    } catch {}

    // 2) If payments are live, send them to Stripe Checkout; otherwise fall back
    //    to the honest "you're reserved" confirmation.
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers, body: payload });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.url) { window.location.href = d.url; return; }
      if (reserved) { setStatus("done"); return; }
      setStatus("idle");
      setError(d.error || "Couldn't complete that right now. Please try again.");
    } catch {
      if (reserved) { setStatus("done"); return; }
      setStatus("idle");
      setError("Network error — please try again.");
    }
  };

  return (
    <div className="tbres-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tbres-card" role="dialog" aria-modal="true">
        {status === "done" ? (
          <div className="tbres-done">
            <div className="ic">✨</div>
            <h3>You&rsquo;re on the list</h3>
            <p>We&rsquo;ve reserved your edition of &ldquo;{data.title || "your Trip Book"}&rdquo;. We&rsquo;ll email {email} the moment printed books go live — no charge yet.</p>
            <div style={{ marginTop: 18 }}><button className="tbres-btn" onClick={onClose}>Done</button></div>
          </div>
        ) : (
          <>
            <div className="tbres-kicker">Reserve your copy</div>
            <div className="tbres-title">{data.title || "Your Trip Book"}</div>
            <div className="tbres-sum">
              <span>Theme <b>{data.theme}</b></span>
              <span>Size <b>{data.size}</b></span>
              <span>Hardcover <b>{data.price}</b></span>
            </div>
            <div className="tbres-total"><span>Est. total</span><b>{total}</b></div>

            <div className="tbres-field">
              <label>Your name</label>
              <input className="tbres-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Rivera" />
            </div>
            <div className="tbres-field">
              <label>Email *</label>
              <input className="tbres-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>
            <div className="tbres-row">
              <div className="tbres-field" style={{ flex: "0 0 92px" }}>
                <label>Copies</label>
                <input className="tbres-input" type="number" min="1" max="20" value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))} />
              </div>
              <div className="tbres-field">
                <label>Ship to (optional)</label>
                <input className="tbres-input" value={ship} onChange={(e) => setShip(e.target.value)} placeholder="City, State" />
              </div>
            </div>
            <div className="tbres-field">
              <label>Note (optional)</label>
              <textarea className="tbres-ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you'd like us to know" />
            </div>

            <p className="tbres-note">This reserves your edition — you won&rsquo;t be charged. Printed books are made on demand; we&rsquo;ll email you to complete the order when fulfillment is live.</p>
            {error && <div className="tbres-err">{error}</div>}
            <div className="tbres-actions">
              <button className="tbres-btn" disabled={status === "sending"} onClick={submit}>
                {status === "sending" ? "Reserving…" : "Reserve my copy"}
              </button>
              <button className="tbres-cancel" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
