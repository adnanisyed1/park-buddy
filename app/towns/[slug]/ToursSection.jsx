"use client";

// "Things to do from {town}" — the first real storefront section: Viator's
// licensed catalog (photos, prices, ratings) rendered in our skin, handoff to
// Viator at booking. The whole section renders NOTHING until the API returns
// actual tours — no skeleton that never fills, no "coming soon" card. An
// absent section is honest; see LodgingOffers for the same principle.
import { useEffect, useState } from "react";

const mono = { fontFamily: "var(--pb-mono)", lineHeight: 1, textTransform: "uppercase" };

export default function ToursSection({ town, gutter, wrap }) {
  const [tours, setTours] = useState(null); // null = loading, [] = none

  useEffect(() => {
    let dead = false;
    fetch(`/api/tours?lat=${town.lat}&lng=${town.lng}&limit=8`)
      .then((r) => r.json())
      .then((d) => { if (!dead) setTours(Array.isArray(d.tours) ? d.tours : []); })
      .catch(() => { if (!dead) setTours([]); });
    return () => { dead = true; };
  }, [town.lat, town.lng]);

  if (!tours || !tours.length) return null;

  return (
    <section style={{ padding: `clamp(36px,6vh,72px) ${gutter}` }}>
      <div style={wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ ...mono, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: "var(--pb-gold)" }}>
              Things to do
            </div>
            <h2 style={{ margin: "10px 0 0", fontFamily: "var(--pb-serif)", fontWeight: 400, fontSize: "clamp(1.6rem,3vw,2.2rem)" }}>
              Guided from {town.name}
            </h2>
          </div>
          <p style={{ margin: 0, maxWidth: 380, fontSize: ".78rem", lineHeight: 1.5, color: "var(--pb-muted)",
            borderLeft: "2px solid var(--pb-line)", paddingLeft: 14 }}>
            Bookings run through Viator and earn Park Buddy a commission at no cost to you.
            Tours are theirs; the ordering here is simply best-rated first.
          </p>
        </div>

        <div style={{ marginTop: 24, display: "grid", gap: 14,
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {tours.map((t) => (
            <a key={t.code || t.url} href={t.url} target="_blank" rel="sponsored noopener noreferrer"
              style={{ display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit",
                background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 8, overflow: "hidden" }}>
              {t.photo ? (
                <img src={t.photo} alt="" loading="lazy"
                  style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", display: "block" }} />
              ) : (
                <div aria-hidden="true" style={{ width: "100%", aspectRatio: "16/10", background: "var(--pb-bg-2)" }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px 16px", flex: 1 }}>
                <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.02rem", lineHeight: 1.3 }}>
                  {t.title}
                </div>
                <div style={{ ...mono, fontSize: 10, letterSpacing: ".06em", color: "var(--pb-muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {t.rating != null && <span>★ {t.rating}{t.reviews ? ` (${t.reviews})` : ""}</span>}
                  {t.durationHours != null && <span>{t.durationHours} hr</span>}
                </div>
                <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  {t.fromPrice != null ? (
                    <span style={{ fontSize: ".92rem", fontWeight: 600 }}>
                      from ${Math.round(t.fromPrice)}
                    </span>
                  ) : <span />}
                  <span style={{ ...mono, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "var(--pb-gold)" }}>
                    Book on Viator →
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
