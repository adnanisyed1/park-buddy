"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./about.module.css";

// The About page as an idiomatic React component (no embed pipeline). The static
// markup below server-renders into the initial HTML — good for SEO — while the
// scroll reveals, hero parallax and count-up stats run client-side in the effect.
const cx = (...names) => names.filter(Boolean).join(" ");

export default function About() {
  const rootRef = useRef(null);
  const navRef = useRef(null);
  const ridgeRef = useRef(null);
  const sunRef = useRef(null);
  const skyRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Layered ridge silhouette behind the hero.
    if (ridgeRef.current) {
      ridgeRef.current.style.height = "52%";
      ridgeRef.current.innerHTML =
        '<div style="position:absolute;left:-6%;right:-6%;bottom:0;height:70%;background:#2c5d52;opacity:.55;clip-path:polygon(0 60%,18% 44%,34% 56%,52% 38%,70% 54%,86% 42%,100% 56%,100% 100%,0 100%)"></div>' +
        '<div style="position:absolute;left:-6%;right:-6%;bottom:0;height:50%;background:#173f30;opacity:.9;clip-path:polygon(0 70%,22% 58%,44% 70%,64% 56%,82% 66%,100% 58%,100% 100%,0 100%)"></div>' +
        '<div style="position:absolute;left:-6%;right:-6%;bottom:0;height:34%;background:#0f2c20;clip-path:polygon(0 60%,30% 50%,60% 60%,100% 50%,100% 100%,0 100%)"></div>';
    }

    function countOne(stat) {
      const b = stat.querySelector("b[data-count]");
      if (!b || b._done) return;
      b._done = true;
      const target = +b.getAttribute("data-count");
      const suffix = b.getAttribute("data-suffix") || "";
      let t0 = null;
      const dur = 1400;
      function step(ts) {
        t0 = t0 || ts;
        const p = Math.min(1, (ts - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(target * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // Scroll reveals + count-up (stats also carry the reveal class).
    const revealEls = [].slice.call(root.querySelectorAll("." + styles.rv));
    const isStat = (el) => el.classList.contains(styles.stat);
    let io;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (ents) => {
          ents.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add(styles.in);
              if (isStat(en.target)) countOne(en.target);
              io.unobserve(en.target);
            }
          });
        },
        { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
      );
      revealEls.forEach((e) => { if (!e.classList.contains(styles.in)) io.observe(e); });
    } else {
      revealEls.forEach((e) => e.classList.add(styles.in));
    }
    // Kick off any stats already in view.
    root.querySelectorAll("." + styles.stat).forEach((s) => {
      if (s.getBoundingClientRect().top < window.innerHeight) countOne(s);
    });

    // Sticky-nav solidify.
    const onScrollNav = () => {
      if (navRef.current) {
        navRef.current.classList.toggle(
          styles.solid,
          (window.scrollY || document.documentElement.scrollTop) > 40
        );
      }
    };
    window.addEventListener("scroll", onScrollNav, { passive: true });
    onScrollNav();

    // Hero parallax.
    const onScrollParallax = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      if (sunRef.current) sunRef.current.style.transform = "translateY(" + y * 0.35 + "px)";
      if (ridgeRef.current) ridgeRef.current.style.transform = "translateY(" + y * 0.12 + "px)";
      if (skyRef.current) skyRef.current.style.transform = "translateY(" + y * 0.05 + "px)";
    };
    window.addEventListener("scroll", onScrollParallax, { passive: true });

    // Safety net: reveal everything even if the observer never fires.
    const safety = setTimeout(() => {
      root.querySelectorAll("." + styles.rv).forEach((e) => e.classList.add(styles.in));
      root.querySelectorAll("." + styles.stat).forEach(countOne);
    }, 2600);

    return () => {
      if (io) io.disconnect();
      window.removeEventListener("scroll", onScrollNav);
      window.removeEventListener("scroll", onScrollParallax);
      clearTimeout(safety);
    };
  }, []);

  return (
    <div className={styles.page} ref={rootRef}>
      <nav className={styles.nav} ref={navRef}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mk}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#15241c">
              <path d="M12 2l5 9h-3l5 9H5l5-9H7z"></path>
              <rect x="11" y="18" width="2" height="4"></rect>
            </svg>
          </span>
          ParkBuddy
        </Link>
        <div className={styles.navlinks}>
          <Link href="/explore">Map</Link>
          <Link href="/plan">Plan a Trip</Link>
          <Link href="/build-trip">Build a Trip</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroSky} ref={skyRef}></div>
        <div className={styles.heroSun} ref={sunRef}></div>
        <div className={styles.heroRidge} ref={ridgeRef}></div>
        <div className={styles.heroGrain}></div>
        <div className={styles.heroIn}>
          <span className={cx(styles.eyebrow, styles.rv, styles.in)}>
            <span className={styles.dot}></span>Our story
          </span>
          <h1 className={cx(styles.rv, styles.in, styles.d1)}>
            The wild, <em>made simple.</em>
          </h1>
          <p className={cx(styles.rv, styles.in, styles.d2)}>
            ParkBuddy is the home for everyone who loves the outdoors — from a spontaneous Saturday
            at the lake to a once-in-a-lifetime national-parks road trip. Discover, plan, and collect
            every adventure in one beautiful place.
          </p>
        </div>
        <div className={styles.scrollcue}>
          <span>Scroll</span>
          <span className={styles.bar}></span>
        </div>
      </header>

      <section className={styles.band}>
        <div className={styles.wrap}>
          <div className={cx(styles.kicker, styles.rv)}>Why we built it</div>
          <p className={cx(styles.statement, styles.rv, styles.d1)}>
            Planning the outdoors is <span className={styles.hl}>scattered</span> across a dozen apps.
            We bring it into <span className={styles.hl}>one trail.</span>
          </p>
          <p className={cx(styles.bodyLg, styles.rv, styles.d2)}>
            Maps in one tab, weather in another, trail reviews somewhere else, a spreadsheet for the
            budget. ParkBuddy unites live park conditions, real-road trip planning, and a collectible
            Trip Passport — so the only thing you have to focus on is the journey.
          </p>
        </div>
      </section>

      <section className={cx(styles.band, styles.green)}>
        <div className={styles.wrap}>
          <div className={cx(styles.kicker, styles.rv)}>What we do</div>
          <p className={cx(styles.lead, styles.rv, styles.d1)}>
            Three steps, <em>endless trails.</em>
          </p>
          <div className={styles.trio}>
            <div className={cx(styles.feat, styles.rv, styles.d1)}>
              <span className={styles.num}>01</span>
              <div className={styles.ic}>🧭</div>
              <h3>Discover</h3>
              <p>Find the best parks, lakes, and wild places near any city — with live weather, alerts, and official conditions on an elegant map.</p>
            </div>
            <div className={cx(styles.feat, styles.rv, styles.d2)}>
              <span className={styles.num}>02</span>
              <div className={styles.ic}>🗺️</div>
              <h3>Plan</h3>
              <p>Build a road trip that follows real roads. Get drive times, dates, and a transparent cost estimate you can adjust to your real prices.</p>
            </div>
            <div className={cx(styles.feat, styles.rv, styles.d3)}>
              <span className={styles.num}>03</span>
              <div className={styles.ic}>🛂</div>
              <h3>Collect</h3>
              <p>Every finished itinerary becomes a digital Trip Passport. Earn a stamp for each park you visit and watch your collection grow.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.band}>
        <div className={cx(styles.wrap, styles.showcase)}>
          <div className={styles.rv}>
            <div className={styles.kicker}>The Trip Passport</div>
            <p className={styles.lead}>
              Your adventures, <em>beautifully kept.</em>
            </p>
            <p className={styles.bodyLg}>
              Real national-park visitors collect cancellation stamps in a passport book. We made it
              digital. Each trip you plan becomes a collectible card with your route, dates, and parks
              — ready to carry in your pocket and share with friends.
            </p>
          </div>
          <div className={cx(styles.passCard, styles.rv, styles.d2)}>
            <div className={styles.shimmer}></div>
            <div className={styles.foil}>National Parks · Trip Passport</div>
            <div className={styles.bn}>ParkBuddy</div>
            <div className={styles.stamps}>
              <div className={styles.stamp} style={{ "--r": "-6deg" }}>🏜️</div>
              <div className={styles.stamp} style={{ "--r": "4deg" }}>🌲</div>
              <div className={styles.stamp} style={{ "--r": "-3deg" }}>⛰️</div>
              <div className={styles.stamp} style={{ "--r": "6deg" }}>🦅</div>
            </div>
          </div>
        </div>
      </section>

      <section className={cx(styles.band, styles.green)}>
        <div className={styles.wrap}>
          <div className={cx(styles.kicker, styles.rv)}>The mission</div>
          <p className={cx(styles.lead, styles.rv, styles.d1)}>
            Get more people <em>outside</em> — more often.
          </p>
          <div className={styles.stats}>
            <div className={cx(styles.stat, styles.rv, styles.d1)}>
              <b data-count="63">0</b><span>National parks</span>
            </div>
            <div className={cx(styles.stat, styles.rv, styles.d2)}>
              <b data-count="400" data-suffix="+">0</b><span>Protected places</span>
            </div>
            <div className={cx(styles.stat, styles.rv, styles.d3)}>
              <b data-count="100" data-suffix="%">0</b><span>Live official data</span>
            </div>
            <div className={cx(styles.stat, styles.rv, styles.d4)}>
              <b data-count="1" data-suffix=" app">0</b><span>For every adventure</span>
            </div>
          </div>
        </div>
      </section>

      <section className={cx(styles.band, styles.ctaBand)}>
        <div className={styles.wrap}>
          <h2 className={styles.rv}>
            Your next <em>wild</em> is waiting.
          </h2>
          <div className={cx(styles.ctaRow, styles.rv, styles.d1)}>
            <Link href="/explore" className={cx(styles.btn, styles.gold)}>Explore the map</Link>
            <Link href="/build-trip" className={cx(styles.btn, styles.ghost)}>Build a trip</Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>ParkBuddy · Discover · Plan · Collect</footer>
    </div>
  );
}
