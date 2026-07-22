"use client";

// "Things to do" from Viator, for ANY place with coordinates — parks,
// forests, lakes, trails, campgrounds, towns (owner call 2026-07-22: every
// location must have things to do). One component, one pipeline
// (/api/tours by proximity), one honesty rule: the section renders NOTHING
// until real tours come back — an absent section beats an empty promise.
// Cards open OUR listing page (/tours/[code]); the affiliate exit to Viator
// lives there, on the booking CTA.
import { useEffect, useState } from "react";

const mono = { fontFamily: "var(--pb-mono)", lineHeight: 1, textTransform: "uppercase" };

export default function ToursNearby({ lat, lng, name, limit = 8, compact = false }) {
  const [tours, setTours] = useState(null);

  useEffect(() => {
    if (!isFinite(lat) || !isFinite(lng)) return;
    let dead = false;
    fetch(`/api/tours?lat=${Number(lat).toFixed(4)}&lng=${Number(lng).toFixed(4)}&limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!dead) setTours(d && Array.isArray(d.tours) ? d.tours : []); })
      .catch(() => { if (!dead) setTours([]); });
    return () => { dead = true; };
  }, [lat, lng, limit]);

  if (!tours || !tours.length) return null;

  return (
    <section style={{ marginTop: compact ? 26 : 46 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...mono, fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: "var(--pb-gold)" }}>Things to do</div>
          <h3 style={{ margin: "8px 0 0", fontFamily: "var(--pb-serif)", fontWeight: 500, fontSize: compact ? "1.3rem" : "clamp(1.4rem,2.6vw,1.9rem)", color: "var(--pb-ink)" }}>
            Guided here{name ? ` — near ${name}` : ""}
          </h3>
        </div>
        <p style={{ margin: 0, maxWidth: 340, fontSize: ".72rem", lineHeight: 1.5, color: "var(--pb-muted)" }}>
          Real tours from Viator's catalog. Booking earns Park Buddy a commission at no cost to you.
        </p>
      </div>
      <div style={{ marginTop: 18, display: "grid", gap: 12, gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 220 : 250}px, 1fr))` }}>
        {tours.map((t) => (
          <a key={t.code || t.url} href={t.code ? "/tours/" + t.code : t.url}
            {...(t.code ? {} : { target: "_blank", rel: "sponsored noopener noreferrer" })}
            style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit", background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, overflow: "hidden" }}>
            {t.photo ? (
              <img src={t.photo} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", display: "block" }} />
            ) : (
              <div aria-hidden style={{ width: "100%", aspectRatio: "16/10", background: "var(--pb-bg-2)" }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "12px 14px 14px", flex: 1 }}>
              <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: ".96rem", lineHeight: 1.3, color: "var(--pb-ink)" }}>{t.title}</div>
              <div style={{ ...mono, fontSize: 9.5, letterSpacing: ".06em", color: "var(--pb-muted)", display: "flex", gap: 9, flexWrap: "wrap" }}>
                {t.rating != null && <span>★ {t.rating}{t.reviews ? ` (${t.reviews})` : ""}</span>}
                {t.durationHours != null && <span>{t.durationHours} hr</span>}
              </div>
              <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                {t.fromPrice != null ? <span style={{ fontSize: ".88rem", fontWeight: 600, color: "var(--pb-ink)" }}>from ${Math.round(t.fromPrice)}</span> : <span />}
                <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-gold)" }}>
                  {t.code ? "See the tour →" : "Book on Viator →"}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
