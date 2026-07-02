// Tiny runtime script loader for the shared legacy globals (trip-data.js,
// pb-verdict.js, auth.js, ask-parkbuddy.js, …) used by natively-migrated pages.
// Each URL loads once per session; repeat calls resolve immediately.
const loaded = new Map(); // src -> Promise

export default function loadScript(src) {
  if (typeof document === "undefined") return Promise.resolve();
  if (loaded.has(src)) return loaded.get(src);
  const p = new Promise((resolve) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = false; // preserve call order for dependent chains
    el.onload = () => resolve(true);
    el.onerror = () => resolve(false); // graceful: callers must handle missing globals
    document.body.appendChild(el);
  });
  loaded.set(src, p);
  return p;
}
