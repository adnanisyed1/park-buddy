/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cache-bust the /embed assets (body.html, s0.js, style.css) on every deploy.
  // These are fetched with ?v=NEXT_PUBLIC_ASSET_VERSION; if it never changes the
  // browser serves stale copies forever. Inline a unique value at build time:
  // Vercel's commit SHA per deploy, or a build timestamp locally.
  env: {
    NEXT_PUBLIC_ASSET_VERSION:
      process.env.NEXT_PUBLIC_ASSET_VERSION ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      String(Date.now()),
  },
  images: {
    // NPS photos come from these hosts — allow next/image to optimize them
    remotePatterns: [
      { protocol: "https", hostname: "**.nps.gov" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
  // Baseline security headers (defense-in-depth). A full Content-Security-Policy is
  // intentionally deferred: the legacy /embed pipeline + Google Maps + inline styles
  // need the allowlist enumerated first, or it breaks the site.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
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
};

export default nextConfig;
