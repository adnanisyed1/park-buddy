"use client";

// The full tour listing, on Park Buddy — gallery, schedule strip, inclusions,
// itinerary, meeting point, cancellation. Data is Basic-access product
// content + the recurring availability schedule; the honest ceiling of that
// tier is "runs most days at 8:00 AM from $139.99", never "available on your
// date" (that's Full access, application pending). Checkout hands off to
// Viator via the affiliate-tagged productUrl — required by Basic terms, and
// the same disclosure language as the town-page section.
import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import BuddyLoader from "../../components/BuddyLoader";
import useDarkBody from "../../lib/useDarkBody";

const serif = "var(--pb-serif)", sans = "var(--pb-sans)", mono = "var(--pb-mono)";

const DAY_FULL = { Mon: "Mondays", Tue: "Tuesdays", Wed: "Wednesdays", Thu: "Thursdays", Fri: "Fridays", Sat: "Saturdays", Sun: "Sundays" };

function fmtTime(t) {
  const m = /^(\d{2}):(\d{2})/.exec(t || "");
  if (!m) return t;
  const h = parseInt(m[1], 10);
  return (h % 12 || 12) + (m[2] !== "00" ? ":" + m[2] : "") + (h < 12 ? " AM" : " PM");
}

export default function TourListing({ code }) {
  useDarkBody();
  const [t, setT] = useState(null);
  const [err, setErr] = useState(false);
  const [hero, setHero] = useState(0);
  useEffect(() => {
    let on = true;
    fetch("/api/tour?code=" + encodeURIComponent(code))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!on) return; if (d && d.title) { setT(d); document.title = d.title + " · Park Buddy"; } else setErr(true); })
      .catch(() => on && setErr(true));
    return () => { on = false; };
  }, [code]);

  const S = { maxWidth: 980, margin: "0 auto", padding: "0 clamp(18px,4vw,36px)" };

  return (
    <div className="pb-forcedark" style={{ minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: sans }}>
      <SiteHeader active="book" />
      <main style={{ paddingTop: 96, paddingBottom: 90 }}>
        {!t && !err && <BuddyLoader text="Fetching this tour…" minHeight="50vh" />}
        {err && (
          <div style={{ ...S, textAlign: "center", padding: "18vh 20px" }}>
            <div style={{ fontFamily: serif, fontSize: "1.6rem" }}>We couldn't load this tour.</div>
            <p style={{ color: "var(--pb-ink-2)", marginTop: 10 }}>It may have been retired by its operator. The town page's tour list always shows what's live.</p>
          </div>
        )}
        {t && (
          <>
            {/* gallery */}
            <div style={{ ...S }}>
              <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", border: "1px solid var(--pb-line-strong)", aspectRatio: "16/8", background: "#0d1d13" }}>
                {t.images[hero] && <img src={t.images[hero]} alt={t.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,transparent 55%,rgba(6,14,10,.85))" }} />
                <div style={{ position: "absolute", left: 22, right: 22, bottom: 18 }}>
                  <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".18em", color: "var(--pb-gold-soft)" }}>GUIDED TOUR · VIA VIATOR</div>
                  <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: "clamp(1.4rem,3.4vw,2.3rem)", margin: "6px 0 0", lineHeight: 1.08, textShadow: "0 2px 14px rgba(0,0,0,.6)" }}>{t.title}</h1>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontFamily: mono, fontSize: ".64rem", color: "var(--pb-ink-2)" }}>
                    {t.rating != null && <span style={{ color: "var(--pb-gold)" }}>★ {t.rating}{t.reviews ? ` (${t.reviews.toLocaleString()} reviews)` : ""}</span>}
                    {t.durationHours != null && <span>{t.durationHours} hours</span>}
                    {t.freeCancellation && <span style={{ color: "var(--pb-go)" }}>Free cancellation</span>}
                  </div>
                </div>
              </div>
              {t.images.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
                  {t.images.slice(0, 8).map((u, i) => (
                    <button key={u} onClick={() => setHero(i)} aria-label={"Photo " + (i + 1)}
                      style={{ flex: "none", width: 86, height: 56, borderRadius: 9, overflow: "hidden", padding: 0, cursor: "pointer", border: i === hero ? "2px solid var(--pb-gold)" : "1px solid var(--pb-line)", opacity: i === hero ? 1 : 0.75 }}>
                      <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* schedule + booking rail */}
            <div style={{ ...S, marginTop: 26 }}>
              <div className="pbt-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20, alignItems: "start" }}>
                <div>
                  {t.schedule && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                      <span style={chip}>{t.schedule.daily ? "Runs daily" : t.schedule.days.length ? "Runs " + t.schedule.days.map((d) => DAY_FULL[d] || d).join(", ") : "Seasonal schedule"}</span>
                      {t.schedule.startTimes.slice(0, 4).map((st) => <span key={st} style={chip}>Departs {fmtTime(st)}</span>)}
                    </div>
                  )}
                  <p style={{ fontSize: ".95rem", lineHeight: 1.65, color: "var(--pb-ink-2)", whiteSpace: "pre-line" }}>{t.description}</p>

                  {t.stops.length > 0 && (
                    <>
                      <h2 style={h2}>The itinerary</h2>
                      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                        {t.stops.map((s, i) => (
                          <li key={i} style={{ display: "flex", gap: 11, fontSize: ".88rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>
                            <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", color: "var(--pb-gold)", fontFamily: serif, fontSize: ".72rem", display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                    </>
                  )}

                  {(t.inclusions.length > 0 || t.exclusions.length > 0) && (
                    <>
                      <h2 style={h2}>What's included</h2>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                        {t.inclusions.map((x) => <li key={x} style={{ display: "flex", gap: 9, fontSize: ".86rem", color: "var(--pb-ink-2)" }}><span style={{ color: "var(--pb-go)" }}>✓</span>{x}</li>)}
                        {t.exclusions.map((x) => <li key={x} style={{ display: "flex", gap: 9, fontSize: ".86rem", color: "var(--pb-muted)" }}><span style={{ color: "var(--pb-hold)" }}>✕</span>{x}</li>)}
                      </ul>
                    </>
                  )}

                  {t.meetingPoint && (
                    <>
                      <h2 style={h2}>Meeting point</h2>
                      <p style={{ fontSize: ".86rem", lineHeight: 1.55, color: "var(--pb-ink-2)" }}>{t.meetingPoint}</p>
                    </>
                  )}
                </div>

                {/* booking card */}
                <div style={{ position: "sticky", top: 96, background: "var(--pb-surface)", border: "1px solid var(--pb-line-strong)", borderRadius: 18, padding: "20px 20px 18px" }}>
                  {t.schedule && t.schedule.fromPrice != null && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".14em", color: "var(--pb-muted)" }}>FROM</span>
                      <div style={{ fontFamily: serif, fontSize: "2rem", color: "var(--pb-ink)", lineHeight: 1 }}>${t.schedule.fromPrice.toFixed(2)}<span style={{ fontSize: ".85rem", color: "var(--pb-muted)" }}> / person</span></div>
                    </div>
                  )}
                  {t.productUrl ? (
                    <a href={t.productUrl} target="_blank" rel="noopener sponsored" className="pbl-btn"
                      style={{ display: "block", textAlign: "center", fontFamily: sans, fontWeight: 700, fontSize: ".95rem", color: "var(--pb-bg)", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", borderRadius: 12, padding: "13px", textDecoration: "none" }}>
                      Check dates &amp; book on Viator →
                    </a>
                  ) : (
                    <div style={{ fontSize: ".8rem", color: "var(--pb-muted)" }}>Booking link unavailable right now.</div>
                  )}
                  <p style={{ fontSize: ".7rem", lineHeight: 1.5, color: "var(--pb-muted)", marginTop: 12 }}>
                    Dates, live availability and checkout run on Viator. Booking there earns Park Buddy a commission at no cost to you.
                  </p>
                  {t.cancellationNote && <p style={{ fontSize: ".7rem", lineHeight: 1.5, color: "var(--pb-ink-2)", marginTop: 8, borderTop: "1px solid var(--pb-line)", paddingTop: 10 }}>{t.cancellationNote}</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 820px) { .pbt-grid { grid-template-columns: 1fr !important; } }
      ` }} />
    </div>
  );
}

const chip = { fontFamily: "var(--pb-mono)", fontSize: ".62rem", letterSpacing: ".06em", color: "var(--pb-gold)", border: "1px solid var(--pb-line-strong)", background: "rgba(217,183,121,.07)", borderRadius: 999, padding: "6px 12px" };
const h2 = { fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.25rem", color: "var(--pb-ink)", margin: "26px 0 12px" };
