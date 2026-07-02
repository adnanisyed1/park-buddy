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
};

export default nextConfig;
