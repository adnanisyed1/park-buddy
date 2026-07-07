"use client";

import { useEffect, useRef } from "react";
import "./studio.css";
import { MARKUP, mountStudio } from "./studioSource";
import { getStops, getMeta } from "../lib/trip";
import { getPhotos, getStory } from "../lib/tripmode";

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
    el.innerHTML = MARKUP;
    let studio;
    try {
      studio = mountStudio(buildRealData());
    } catch (e) {
      console.error("Trip Book Studio failed to mount:", e);
    }
    return () => {
      try {
        studio && studio.destroy && studio.destroy();
      } catch (e) {}
      if (el) el.innerHTML = "";
    };
  }, []);

  return <div className="tbstudio" ref={rootRef} />;
}
