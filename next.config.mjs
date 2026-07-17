/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cache-bust the /embed assets (body.html, s0.js, style.css) on every deploy.
  // These are fetched with ?v=NEXT_PUBLIC_ASSET_VERSION; if it never changes the
  // browser serves stale copies forever. Inline a unique value at build time:
  // Vercel's commit SHA per deploy, or a build timestamp locally.
  env: {
    // IMPORTANT: ignore an unsubstituted placeholder like "$COMMIT_REF" (Netlify
    // syntax) — Vercel does NOT expand $VARs in env values, so a leftover
    // NEXT_PUBLIC_ASSET_VERSION=$COMMIT_REF would freeze the /embed cache key
    // forever and strand a user on a stale (possibly blank) homepage. Only accept
    // a concrete version; otherwise use Vercel's per-deploy commit SHA (or a build
    // timestamp locally). Owner can also just delete that stale env var in Vercel.
    NEXT_PUBLIC_ASSET_VERSION: (() => {
      const v = process.env.NEXT_PUBLIC_ASSET_VERSION;
      if (v && !v.startsWith("$") && v !== "1") return v;
      return process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());
    })(),
  },
  images: {
    // NPS photos come from these hosts — allow next/image to optimize them
    remotePatterns: [
      { protocol: "https", hostname: "**.nps.gov" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
  // Baseline security headers (defense-in-depth) + a REPORT-ONLY Content-Security-
  // Policy. Report-only blocks nothing — it just makes the browser report what a
  // real (enforcing) policy WOULD block, so we can enumerate the true allowlist from
  // live traffic before ever flipping to enforce. Notes on the sources below:
  //   script-src 'unsafe-inline'  — REQUIRED: the /embed pipeline uses inline
  //     onmouseover/onclick handlers, and Next injects inline bootstrap scripts.
  //   'unsafe-eval'               — Google Maps JS historically needs it.
  //   img-src https:              — photo-heavy app (Wikimedia/NPS/AWS/Maps tiles);
  //     allow any HTTPS image rather than enumerate every host (low risk for images).
  //   connect-src supabase + wss  — auth/storage + realtime WebSocket.
  //   videodelivery / cloudflarestream — Pines video (Cloudflare Stream).
  //   stripe                      — Checkout redirect + Stripe.js.
  // Most external APIs (weather.gov, overpass, openai, lulu, recreation.gov…) are
  // fetched SERVER-side in /api routes, so the browser never contacts them → no CSP
  // entry needed. To enforce later: verify zero violations across all pages, then
  // rename the header key to "Content-Security-Policy".
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https://videodelivery.net https://*.cloudflarestream.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com https://videodelivery.net https://*.cloudflarestream.com",
      "frame-src 'self' https://checkout.stripe.com https://js.stripe.com https://*.videodelivery.net",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "form-action 'self' https://checkout.stripe.com",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
      {
        // The /embed shell (body.html, s0.js, style.css, manifest.json) changes every
        // deploy. It must always revalidate, or the browser/CDN serves a stale copy —
        // which pointed at deleted /media video files and broke the hero video.
        source: "/embed/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
  // Retire the legacy embed pages. /plan is now Trip Studio (/build-trip) and
  // /park-status is now the React park page (/parks/:id). 301 so old bookmarks,
  // SEO links, and any stray in-app reference land on the current page.
  async redirects() {
    return [
      { source: "/plan", destination: "/build-trip", permanent: true },
      // Old ?park=<numericId> deep-links to the matching React park page; anything
      // else (?park=<name>, ?dest=, no param) falls through to the parks index so it
      // never 404s.
      { source: "/park-status", has: [{ type: "query", key: "park", value: "(?<parkId>\\d+)" }], destination: "/parks/:parkId", permanent: true },
      { source: "/park-status", destination: "/parks", permanent: true },
    ];
  },
};

export default nextConfig;
