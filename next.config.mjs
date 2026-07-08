/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
