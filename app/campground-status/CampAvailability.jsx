"use client";

import { useEffect, useState } from "react";

// Live campsite availability + a "Book on Recreation.gov" popup. Recreation.gov
// can't be iframed and has no booking API, so this is the strongest compliant
// version: show the real open/reserved picture for a month, then pop their real
// booking page in a separate window (deep-linking is explicitly encouraged in
// their data-use terms). Booking always completes on recreation.gov.

const serif = "'Spectral', Georgia, serif";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function monthMeta(offset) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const y = base.getUTCFullYear(), mo = base.getUTCMonth();
  return { param: y + "-" + String(mo + 1).padStart(2, "0"), label: MONTHS[mo] + " " + y, y, mo };
}

function openBook(url) {
  if (!url) return;
  window.open(url, "recgov-book", "noopener,noreferrer,width=460,height=800");
}

export default function CampAvailability({ campgroundId, bookUrl, name }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(undefined); // undefined loading, null failed, obj ok
  const meta = monthMeta(offset);

  useEffect(() => {
    let on = true;
    setData(undefined);
    fetch("/api/availability?id=" + encodeURIComponent(campgroundId) + "&month=" + meta.param)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (on) setData(d && d.available ? d : null); })
      .catch(() => { if (on) setData(null); });
    return () => { on = false; };
  }, [campgroundId, meta.param]);

  // Build the month grid from the per-day open counts.
  const byDate = {};
  if (data && data.days) data.days.forEach((x) => { byDate[x.date] = x.open; });
  const firstDow = new Date(Date.UTC(meta.y, meta.mo, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(meta.y, meta.mo + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = meta.y + "-" + String(meta.mo + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    cells.push({ d, open: byDate[key] });
  }
  const peak = data ? data.peakOpen || 0 : 0;
  const fmtSoonest = data && data.soonest
    ? new Date(data.soonest.date + "T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
    : null;

  return (
    <div style={{ background: "#fffdf8", border: "1px solid #e2dac8", borderRadius: 20, padding: "18px 20px", marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.15rem", margin: 0, color: "#163a2b" }}>Campsite availability</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} aria-label="Previous month" style={{ border: "1px solid #e2dac8", background: offset === 0 ? "#f3efe7" : "#fffdf8", color: offset === 0 ? "#c9bf9f" : "#4c5443", borderRadius: 8, width: 28, height: 28, cursor: offset === 0 ? "default" : "pointer", fontFamily: "inherit" }}>‹</button>
          <span style={{ fontFamily: mono, fontSize: ".72rem", fontWeight: 700, color: "#4c5443", minWidth: 96, textAlign: "center" }}>{meta.label}</span>
          <button onClick={() => setOffset((o) => Math.min(5, o + 1))} disabled={offset >= 5} aria-label="Next month" style={{ border: "1px solid #e2dac8", background: offset >= 5 ? "#f3efe7" : "#fffdf8", color: offset >= 5 ? "#c9bf9f" : "#4c5443", borderRadius: 8, width: 28, height: 28, cursor: offset >= 5 ? "default" : "pointer", fontFamily: "inherit" }}>›</button>
        </div>
      </div>

      {/* Summary line */}
      <div style={{ fontSize: ".82rem", color: "#4c5443", marginTop: 8, minHeight: 20 }}>
        {data === undefined && "Checking Recreation.gov…"}
        {data === null && "Live availability isn't loading right now — use the button below to check on Recreation.gov."}
        {data && data.total === 0 && "This campground isn't showing bookable sites for this month."}
        {data && data.total > 0 && (data.openDayCount > 0
          ? <>Soonest opening <b style={{ color: "#163a2b" }}>{fmtSoonest}</b> · up to <b style={{ color: "#163a2b" }}>{peak}</b> of {data.total} sites open this month.</>
          : <>No open nights this month across {data.total} sites — try a later month or book a cancellation alert on Recreation.gov.</>)}
      </div>

      {/* Month grid — tinted by how many sites are open that day */}
      {data && data.total > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, maxWidth: 340 }}>
            {DOW.map((w, i) => <div key={"h" + i} style={{ textAlign: "center", fontFamily: mono, fontSize: ".54rem", color: "#8a8471", fontWeight: 700 }}>{w}</div>)}
            {cells.map((c, i) => {
              if (!c) return <div key={i} />;
              const open = c.open;
              const ratio = open != null && data.total ? open / data.total : 0;
              const bg = open == null ? "#f3efe7" : open === 0 ? "#efe3e0" : ratio > 0.3 ? "#dff0df" : "#f6ecd4";
              const fg = open == null ? "#b8b19b" : open === 0 ? "#b08a80" : "#3a5a3a";
              return (
                <div key={i} title={open == null ? "" : open + " of " + data.total + " open"} style={{ aspectRatio: "1/1", borderRadius: 7, background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  <span style={{ fontSize: ".64rem", fontWeight: 700, color: fg }}>{c.d}</span>
                  {open != null && open > 0 && <span style={{ fontFamily: mono, fontSize: ".46rem", color: fg }}>{open}</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontFamily: mono, fontSize: ".54rem", color: "#8a8471" }}>
            <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#dff0df", marginRight: 4 }} />open</span>
            <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#f6ecd4", marginRight: 4 }} />few left</span>
            <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#efe3e0", marginRight: 4 }} />full</span>
          </div>
        </div>
      )}

      {bookUrl && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => openBook(bookUrl)} style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: ".82rem", fontWeight: 800, color: "#15241c", background: "linear-gradient(120deg,#e4be78,#c79a4b)", padding: "10px 18px", borderRadius: 999 }}>Book on Recreation.gov ↗</button>
          <span style={{ fontSize: ".72rem", color: "#8a8471", lineHeight: 1.4 }}>Opens the official booking page in a new window — reservations complete on Recreation.gov.</span>
        </div>
      )}
    </div>
  );
}
