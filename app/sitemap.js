import { SITE_URL } from "./layout";

// Static sitemap of the primary routes. Query-param pages (e.g. /park-status?park=)
// are intentionally excluded — their canonical points at the base path.
export default function sitemap() {
  const routes = [
    // "/" IS the map now; /explore 307s here and is intentionally not listed.
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/plan", priority: 0.9, changeFrequency: "weekly" },
    { path: "/build-trip", priority: 0.9, changeFrequency: "weekly" },
    { path: "/park-status", priority: 0.7, changeFrequency: "daily" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  ];
  return routes.map((r) => ({
    url: SITE_URL + r.path,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
