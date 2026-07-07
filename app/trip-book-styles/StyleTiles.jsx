"use client";

import { useEffect, useState } from "react";
import "./tbs.css";

/* ------------------------------------------------------------------ */
/*  Sample trip content — real Utah "Mighty 5" parks so /api/photo     */
/*  returns real, warm photography. Stories are illustrative.          */
/* ------------------------------------------------------------------ */
const TRIP = {
  title: "Six Days Through the Colorado Plateau",
  dates: "May 12–18, 2026",
  stats: { photos: 47, miles: 1204, states: 2, days: 6 },
  dedication: "For the one who said yes to the detour.",
  stops: [
    { name: "Arches National Park", q: "Delicate Arch|Arches National Park", place: "Delicate Arch", coord: "38.74° N", weather: "71° · Clear",
      story: "We hit the trail before the light did, and the sandstone turned the color of a struck match. Nobody said a word for the last quarter mile." },
    { name: "Canyonlands National Park", q: "Island in the Sky Canyonlands|Canyonlands National Park", place: "Island in the Sky", coord: "38.45° N", weather: "64° · High haze",
      story: "You could see three days of driving from one overlook. We just stood there and let the wind do the talking." },
    { name: "Capitol Reef National Park", q: "Capitol Reef National Park|Cathedral Valley", place: "Cathedral Valley", coord: "38.42° N", weather: "47° · Clear",
      story: "No signal, no other headlights — just the temples and more stars than we had names for." },
    { name: "Bryce Canyon National Park", q: "Bryce Canyon amphitheater|Bryce Canyon National Park", place: "Sunset Point", coord: "37.62° N", weather: "52° · Golden hour",
      story: "The hoodoos went copper, then rose, then violet in about eleven minutes. We watched every second." },
    { name: "Zion National Park", q: "Zion Canyon|Zion National Park", place: "Canyon Overlook", coord: "37.27° N", weather: "78° · Clear",
      story: "The last stop before home. We drove out slow, windows down, already planning the next one." },
  ],
};

/* photo fetch — same pipeline the rest of the app uses */
function usePhotos(stops) {
  const [map, setMap] = useState({});
  useEffect(() => {
    let on = true;
    stops.forEach((s) => {
      fetch("/api/photo?q=" + encodeURIComponent(s.q) + "&w=1600&v=6")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (on && d && d.found) setMap((m) => ({ ...m, [s.name]: d.image || d.thumb })); })
        .catch(() => {});
    });
    return () => { on = false; };
  }, [stops]);
  return map;
}

export default function StyleTiles() {
  const [view, setView] = useState("warm");
  const photos = usePhotos(TRIP.stops);
  const photoFor = (name) => photos[name] || null;

  return (
    <div className="tbs-root">
      <header className="tbs-bar">
        <div className="tbs-bar-l">
          <span className="tbs-kicker">Park Buddy · Trip Book</span>
          <span className="tbs-bar-sub">Two directions — same trip, real photos. Pick one to take into full design.</span>
        </div>
        <div className="tbs-seg" role="tablist">
          <button className={view === "warm" ? "on" : ""} onClick={() => setView("warm")}>Warm &amp; Personal</button>
          <button className={view === "bold" ? "on" : ""} onClick={() => setView("bold")}>Bold &amp; Modern</button>
        </div>
      </header>

      <main className="tbs-stage">
        {view === "warm" ? <Warm photoFor={photoFor} /> : <Bold photoFor={photoFor} />}
      </main>
    </div>
  );
}

/* =================================================================== */
/*  DIRECTION A — WARM & PERSONAL                                       */
/*  paper, warm serif, joyful photos, generous air — a modern album    */
/* =================================================================== */
function Warm({ photoFor }) {
  const [s0, s1, s2] = TRIP.stops;
  return (
    <section className="warm">
      {/* cover */}
      <div className="w-cover">
        <span className="w-label">A Park Buddy Trip Book</span>
        <h1 className="w-title">{TRIP.title}</h1>
        <span className="w-dates">{TRIP.dates}</span>
        <Figure className="w-hero" url={photoFor(s0.name)} />
        <div className="w-stats">
          {statList().map((s) => (
            <div key={s.l}><b>{s.n}</b><span>{s.l}</span></div>
          ))}
        </div>
      </div>

      {/* a spread */}
      <div className="w-spread">
        <div className="w-spread-photo"><Figure url={photoFor(s1.name)} /></div>
        <div className="w-spread-text">
          <span className="w-plno">Stop 02 — {s1.place}</span>
          <p className="w-story">{s1.story}</p>
          <span className="w-meta">{s1.coord} · {s1.weather}</span>
          <div className="w-mini"><Figure url={photoFor(s2.name)} /></div>
        </div>
      </div>

      <p className="w-ded">“{TRIP.dedication}”</p>
    </section>
  );
}

/* =================================================================== */
/*  DIRECTION B — BOLD & MODERN                                         */
/*  white ground, massive type, full-bleed photos, one hot accent      */
/* =================================================================== */
function Bold({ photoFor }) {
  const [s0, s1, s2, s3] = TRIP.stops;
  return (
    <section className="bold">
      {/* cover — full-bleed photo, huge overlapping title */}
      <div className="b-cover">
        <Figure className="b-cover-photo" url={photoFor(s3.name)} dark />
        <div className="b-cover-type">
          <span className="b-kick">Trip Book / No. 0247</span>
          <h1 className="b-title">SIX&nbsp;DAYS<br/>ON THE<br/><em>PLATEAU</em></h1>
          <span className="b-dates">{TRIP.dates}</span>
        </div>
      </div>

      {/* stat band */}
      <div className="b-stats">
        {statList().map((s) => (
          <div key={s.l}><b>{s.n}</b><span>{s.l}</span></div>
        ))}
      </div>

      {/* diptych spread */}
      <div className="b-spread">
        <div className="b-big"><Figure url={photoFor(s0.name)} dark /></div>
        <div className="b-side">
          <span className="b-plno">02 / {s0.place}</span>
          <p className="b-story">{s0.story}</p>
          <span className="b-meta">{s0.coord} — {s0.weather}</span>
        </div>
      </div>
      <div className="b-duo">
        <Figure url={photoFor(s1.name)} dark />
        <Figure url={photoFor(s2.name)} dark />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
// deterministic comma grouping — same output on server and client (no locale)
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function statList() {
  return [
    { n: fmt(TRIP.stats.days), l: "Days" },
    { n: fmt(TRIP.stats.miles), l: "Miles" },
    { n: fmt(TRIP.stops.length), l: "Parks" },
    { n: fmt(TRIP.stats.photos), l: "Photos" },
  ];
}

function Figure({ url, className = "", dark = false }) {
  return (
    <div className={"tbs-fig " + className + (dark ? " tbs-fig--dark" : "")}>
      {url ? <img src={url} alt="" loading="lazy" /> : <div className="tbs-fig-ph" />}
    </div>
  );
}
