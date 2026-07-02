// Shared Overpass (OpenStreetMap) client for /api/water and /api/trails.
//
// IMPORTANT: this uses Node's native `https` module, NOT `fetch`. In the Next
// server runtime, the patched global `fetch` hung on these Overpass POSTs until
// the timeout fired (the identical request works in a standalone Node script) —
// so both /api/water and /api/trails always returned empty on the deployed site.
// Going straight to `node:https` sidesteps that entirely.
//
// Also required: an `Accept: application/json` header (overpass-api.de returns
// HTTP 406 without it), and a short per-mirror timeout so a slow/dead mirror
// doesn't blow past Netlify's 26s function budget.

import https from "node:https";

// maps.mail.ru is consistently fast (~2.5s); overpass-api.de is canonical but
// throttles/queues under load (seen at 4–10s), so it's the fallback.
const ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const PER_REQUEST_MS = 11000; // 2 mirrors × 11s ≈ 22s worst case (< 26s cap)

// Fresh non-keepalive agent, forced IPv4 — avoids a stuck-socket hang seen when
// the runtime's default agent tries IPv6 first / reuses dead pooled connections.
const agent = new https.Agent({ keepAlive: false, family: 4 });

function httpsPost(urlStr, body, ms) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        agent,
        family: 4,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          Accept: "application/json",
          "User-Agent": "ParkBuddy/1.0 (https://theparkbuddy.netlify.app)",
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, text: data }));
      }
    );
    req.on("error", reject);
    req.setTimeout(ms, () => req.destroy(new Error("timeout")));
    req.write(body);
    req.end();
  });
}

export async function overpass(query) {
  let lastErr = null;
  const body = "data=" + encodeURIComponent(query);
  for (const url of ENDPOINTS) {
    try {
      const { status, text } = await httpsPost(url, body, PER_REQUEST_MS);
      if (status === 200) {
        const data = JSON.parse(text);
        if (data && Array.isArray(data.elements)) return data;
        lastErr = "ok but no elements @ " + url;
      } else {
        lastErr = "HTTP " + status + " @ " + url;
      }
    } catch (e) {
      lastErr = (e && e.message ? e.message : "err") + " @ " + url;
    }
  }
  overpass.lastErr = lastErr; // surfaced by ?debug=1 in the routes
  return null;
}
