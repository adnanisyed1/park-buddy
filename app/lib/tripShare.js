// Encode/decode a whole trip into a URL-safe string so a trip can travel in a link
// (the trip normally lives only in localStorage). Used by the "Copy link" share action
// → /trip-print?t=<encoded>, which opens a read-only, printable copy on any device.
//
// Compact keys keep the URL short; UTF-8-safe base64url handles names like "Haleakalā".

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeTrip({ stops = [], meta = {}, dayPlans = null, checklist = null } = {}) {
  const payload = {
    v: 1,
    s: stops.map((s) => {
      const o = { n: s.name, ni: s.nights };
      if (s.lat != null) { o.la = Math.round(s.lat * 1e5) / 1e5; o.lo = Math.round(s.lng * 1e5) / 1e5; }
      if (s.state) o.st = s.state;
      if (s.kind) o.k = s.kind;
      if (s.slug) o.sl = s.slug;
      return o;
    }),
    m: { tn: meta.tripName || "", sd: meta.startDate || "", ed: meta.endDate || "", ad: meta.adults || meta.travelers || 2, inf: meta.infants || 0, am: meta.arrivalMode || "drive" },
  };
  if (dayPlans && Object.keys(dayPlans).length) payload.d = dayPlans;
  if (checklist && checklist.length) payload.c = checklist.map((i) => ({ c: i.cat, l: i.label, d: i.done ? 1 : 0 }));
  return b64urlEncode(JSON.stringify(payload));
}

// Returns { stops, meta, dayPlans } or null if the string can't be parsed.
export function decodeTrip(str) {
  try {
    const p = JSON.parse(b64urlDecode(str));
    if (!p || !Array.isArray(p.s)) return null;
    const stops = p.s.map((s) => ({ name: s.n, nights: s.ni != null ? s.ni : 1, lat: s.la, lng: s.lo, state: s.st || "", kind: s.k, slug: s.sl }));
    const m = p.m || {};
    const meta = { tripName: m.tn || "", startDate: m.sd || "", endDate: m.ed || "", adults: m.ad || 2, infants: m.inf || 0, arrivalMode: m.am || "drive" };
    const checklist = Array.isArray(p.c) ? p.c.map((i) => ({ cat: i.c || "pack", label: i.l || "", done: !!i.d })).filter((i) => i.label) : [];
    return { stops, meta, dayPlans: p.d || {}, checklist };
  } catch {
    return null;
  }
}
