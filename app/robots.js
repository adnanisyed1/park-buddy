import { SITE_URL } from "./layout";

export default function robots() {
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
