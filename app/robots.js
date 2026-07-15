import { SITE_URL, IS_PROD } from "./layout";

export default function robots() {
  // Dev/staging deployments must never be indexed (no duplicate content, no
  // leaking a half-finished site into search) — block everything off-production.
  if (!IS_PROD) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // API routes are for the app, not for crawlers.
      disallow: "/api/",
    },
    sitemap: SITE_URL + "/sitemap.xml",
    host: SITE_URL,
  };
}
