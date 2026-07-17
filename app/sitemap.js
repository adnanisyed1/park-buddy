import { SITE_URL } from "./layout";

// Static sitemap of the primary routes. Query-param pages (e.g. /park-status?park=)
// are intentionally excluded — their canonical points at the base path.
export default function sitemap() {
  const routes = [
    // "/" is the marketing landing page; "/explore" is the interactive map.
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/explore", priority: 1.0, changeFrequency: "daily" },
    { path: "/build-trip", priority: 0.9, changeFrequency: "weekly" },
    { path: "/parks", priority: 0.8, changeFrequency: "daily" },
    { path: "/book", priority: 0.6, changeFrequency: "weekly" },
    { path: "/shop", priority: 0.6, changeFrequency: "weekly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  ];
  return routes.map((r) => ({
    url: SITE_URL + r.path,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
