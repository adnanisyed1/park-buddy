"use client";

// The trail underfoot — a fixed rail at the bottom of the landing page that
// treats the page as a 1.0-mile trail: a gold line fills as you scroll, a
// little gull glides along it, waypoint dots mark each section (click = jump
// there), and the label counts down "how much trail is left".
//
// Craft notes (Emil / Apple playbook):
//   · scroll → position is DIRECT MANIPULATION: the bird and fill mirror the
//     scroll 1:1 via transform writes on refs inside one rAF — no per-scroll
//     React renders, no easing lag between finger and feedback
//   · transform/opacity only (fill = scaleX, bird = translateX from a cached
//     track width); the label is a text swap, throttled to whole hundredths
//   · translucent chrome per the Apple materials rule: blur + semi-opaque
//     background, content scrolls underneath
//   · the bird's wing-bob is the only autonomous motion and it's disabled
//     under prefers-reduced-motion; scroll-mirroring itself is fine there
//     (it's user-driven, not vestibular)
//   · desktop only — on phones the bottom edge belongs to PbTabBar
import { useEffect, useRef, useState } from "react";

const TRAIL_MI = 1.0;

export default function ScrollTrail() {
  const barRef = useRef(null), fillRef = useRef(null), birdRef = useRef(null),
    labelRef = useRef(null), trackRef = useRef(null);
  const dotEls = useRef({});
  const geom = useRef({ total: 1, trackW: 0 });
  const [stops, setStops] = useState([]);

  useEffect(() => {
    const measure = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      geom.current.total = total;
      geom.current.trackW = trackRef.current ? trackRef.current.clientWidth : 0;
      const els = [...document.querySelectorAll("[data-trail-stop]")];
      setStops(els.map((el) => ({
        label: el.getAttribute("data-trail-stop"),
        pct: Math.min(1, Math.max(0, (el.getBoundingClientRect().top + window.scrollY - 140) / total)),
        el,
      })));
    };

    // Synchronous on scroll: the browser coalesces scroll events per frame,
    // and an rAF gate stalls in throttled rendering contexts.
    const paint = () => {
      const { total, trackW } = geom.current;
      const p = Math.min(1, Math.max(0, window.scrollY / total));
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      if (birdRef.current) birdRef.current.style.transform = `translateX(${p * trackW}px)`;
      if (labelRef.current) {
        const left = (1 - p) * TRAIL_MI;
        labelRef.current.textContent = p > 0.985 ? "Trail's end — worth it" : left.toFixed(1) + " mi to go";
      }
      if (barRef.current) barRef.current.style.opacity = window.scrollY > 80 ? "1" : "0";
      for (const [pct, el] of Object.entries(dotEls.current)) {
        if (el) el.dataset.passed = p >= parseFloat(pct) ? "1" : "0";
      }
    };
    measure();
    paint();
    // Sections grow as photos/videos load — re-measure when the page's height
    // settles, not just on window resize.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { measure(); paint(); }) : null;
    ro && ro.observe(document.body);
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", paint);
      window.removeEventListener("resize", measure);
      ro && ro.disconnect();
    };
  }, []);

  const jump = (stop) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stop.el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <div ref={barRef} className="pbst" role="navigation" aria-label="Page trail — jump to a section">
      <span ref={labelRef} className="pbst-label">1.0 mi to go</span>
      <div ref={trackRef} className="pbst-track">
        <span className="pbst-dash" aria-hidden />
        <span ref={fillRef} className="pbst-fill" aria-hidden />
        {stops.map((s) => (
          <button key={s.label} className="pbst-dot" style={{ left: s.pct * 100 + "%" }}
            ref={(el) => { dotEls.current[s.pct] = el; }}
            title={s.label} aria-label={"Jump to " + s.label} onClick={() => jump(s)} />
        ))}
        <span ref={birdRef} className="pbst-birdwrap" aria-hidden>
          <svg className="pbst-bird" viewBox="0 0 22 9" width="20" height="9">
            <path d="M1 7 Q 6 1 11 7 M11 7 Q 16 1 21 7" fill="none" stroke="var(--pb-gold)" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <span className="pbst-cap" aria-hidden>⛰</span>
      <style dangerouslySetInnerHTML={{ __html: `
        .pbst { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
          display: flex; align-items: center; gap: 16px; padding: 9px clamp(20px,4vw,44px) 11px;
          background: rgba(10,20,14,.55); border-top: 1px solid rgba(217,183,121,.22);
          backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%);
          opacity: 0; transition: opacity .4s ease; pointer-events: auto; }
        .pbst-label { flex: none; width: 108px; font-family: var(--pb-mono); font-size: .58rem;
          letter-spacing: .14em; text-transform: uppercase; color: #e8cf9a; font-variant-numeric: tabular-nums; }
        .pbst-track { position: relative; flex: 1; height: 18px; }
        .pbst-dash { position: absolute; left: 0; right: 0; top: 50%; border-top: 1.5px dashed rgba(232,207,154,.35); }
        .pbst-fill { position: absolute; left: 0; right: 0; top: 50%; margin-top: -1px; height: 2px;
          background: linear-gradient(90deg,#e8cf9a,#c9a35f); transform: scaleX(0); transform-origin: left;
          box-shadow: 0 0 8px rgba(217,183,121,.5); }
        .pbst-dot { position: absolute; top: 50%; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px;
          border-radius: 50%; border: 1.5px solid rgba(232,207,154,.55); background: rgba(10,20,14,.9);
          cursor: pointer; padding: 0; transition: transform .16s var(--pb-ease-out), background .25s ease, border-color .25s ease; }
        .pbst-dot[data-passed="1"] { background: #c9a35f; border-color: #e8cf9a; }
        .pbst-dot:active { transform: scale(0.85); }
        @media (hover: hover) and (pointer: fine) { .pbst-dot:hover { transform: scale(1.5); } }
        .pbst-dot:focus-visible { outline: 2px solid #e8cf9a; outline-offset: 3px; }
        .pbst-birdwrap { position: absolute; left: 0; top: 50%; margin-top: -14px; will-change: transform; }
        .pbst-bird { display: block; margin-left: -10px; animation: pbstBob 1.6s ease-in-out infinite alternate;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
        @keyframes pbstBob { from { transform: translateY(0); } to { transform: translateY(-3px); } }
        .pbst-cap { flex: none; font-size: .8rem; color: rgba(232,207,154,.6); }
        @media (prefers-reduced-motion: reduce) { .pbst-bird { animation: none; } }
        @media (max-width: 900px) { .pbst { display: none; } }
      ` }} />
    </div>
  );
}
