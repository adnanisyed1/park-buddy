// Build an .ics calendar from a planned trip: a multi-day all-day event per base
// ("Base: Zion — 2 nights") plus one event per planned day-block (timed when the block
// has a time, else all-day). Import into Apple/Google/Outlook Calendar.

function pad(n) { return String(n).padStart(2, "0"); }
// A local (floating) datetime stamp: YYYYMMDDTHHMMSS — no timezone, so it lands at the
// same wall-clock time wherever the traveler is (right for an itinerary).
function dtLocal(iso, time) {
  const d = iso.replace(/-/g, "");
  if (!time) return d; // all-day → DATE value
  return d + "T" + time.replace(":", "") + "00";
}
function addDaysISO(iso, n) {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
}
function esc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }

const TYPE_EMOJI = { drive: "🚗", stay: "🛏", meal: "🍽", scenic: "⛰", hike: "🥾", sight: "📸" };

// stamp = a fixed YYYYMMDDTHHMMSSZ string for DTSTAMP (pass one in; Date.now is avoided).
export function buildIcs({ tripName = "My trip", stops = [], dayRanges = [], dayPlans = {}, stamp = "20200101T000000Z" } = {}) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Park Buddy//Trip//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:" + esc(tripName)];
  let uid = 0;
  const ev = (parts) => { lines.push("BEGIN:VEVENT", "UID:pb-" + (++uid) + "-" + stamp + "@parkbuddy", "DTSTAMP:" + stamp, ...parts, "END:VEVENT"); };

  stops.forEach((s, i) => {
    const arrive = dayRanges[i] && dayRanges[i].arrive;
    if (!arrive) return;
    const nights = Math.max(1, s.nights || 1);
    // All-day base event spanning the nights (DTEND is exclusive → arrive + nights).
    ev([
      "DTSTART;VALUE=DATE:" + dtLocal(arrive),
      "DTEND;VALUE=DATE:" + dtLocal(addDaysISO(arrive, nights)),
      "SUMMARY:" + esc("🏕 Base: " + s.name + " — " + nights + " night" + (nights === 1 ? "" : "s")),
      s.state ? "LOCATION:" + esc(s.name + ", " + s.state) : "LOCATION:" + esc(s.name),
    ]);
    // One event per planned block, on its day.
    const blocks = (dayPlans[s.name] || []).slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    blocks.forEach((b) => {
      const dayISO = addDaysISO(arrive, b.day || 0);
      const emoji = TYPE_EMOJI[b.type] || "•";
      const summary = esc(emoji + " " + b.name);
      if (b.time) {
        const start = dtLocal(dayISO, b.time);
        // default 1h; end minute math kept simple (rolls the hour).
        const [h, m] = b.time.split(":").map(Number);
        const endH = pad((h + 1) % 24), endM = pad(m || 0);
        ev(["DTSTART:" + start, "DTEND:" + dtLocal(dayISO, endH + ":" + endM), "SUMMARY:" + summary]);
      } else {
        ev(["DTSTART;VALUE=DATE:" + dtLocal(dayISO), "SUMMARY:" + summary]);
      }
    });
  });

  lines.push("END:VCALENDAR");
  // RFC 5545 line endings.
  return lines.join("\r\n");
}
