"use client";

import { useEffect, useRef } from "react";

// Mounts one of your original ParkPulse pages inside Next.js, running its real
// markup + CSS + scripts unchanged. This is the faithful migration: nothing about
// your map / weather / trip logic was rewritten — it just lives under React routing now.
export default function EmbeddedSite({ page }) {
  const ref = useRef(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return; // guard against React 18 strict-mode double effect
    booted.current = true;

    const base = `/embed/${page}`;
    const added = []; // track injected <head> nodes for cleanup

    // Cache-busting strategy:
    //   Old approach used Date.now() on EVERY asset with cache:"no-store", which
    //   guaranteed freshness but re-downloaded all markup/css/scripts on every
    //   page load — no browser caching at all. Now only the tiny manifest.json is
    //   fetched no-store; the heavy body/css/scripts are cached by the browser and
    //   busted by a stable per-deploy version. Set NEXT_PUBLIC_ASSET_VERSION (e.g.
    //   to $COMMIT_REF on Netlify) so a new deploy invalidates them; the manifest
    //   may also carry its own "version" field, which wins when present.
    const buildVersion = process.env.NEXT_PUBLIC_ASSET_VERSION || "1";
    let v = buildVersion; // may be refined from the manifest below
    const bust = (u) => (u && u.charAt(0) === "/") ? (u + (u.indexOf("?") < 0 ? "?" : "&") + "v=" + v) : u;

    function injectStyle(css) {
      const el = document.createElement("style");
      el.setAttribute("data-embed", page);
      el.textContent = css;
      document.head.appendChild(el);
      added.push(el);
    }
    function injectLink(href) {
      if (document.querySelector(`link[href="${href}"]`)) return;
      const el = document.createElement("link");
      el.rel = "stylesheet";
      el.href = href;
      document.head.appendChild(el);
      added.push(el);
    }
    function loadScript(src) {
      return new Promise((res) => {
        const el = document.createElement("script");
        el.src = src;
        el.async = false; // preserve execution order
        el.onload = res;
        el.onerror = res; // keep going even if an optional lib fails
        document.body.appendChild(el);
        added.push(el);
      });
    }

    (async () => {
      // Only the manifest is fetched fresh every time (it's tiny and tells us the
      // current asset set + version). Body/CSS are then requested WITH the version
      // query param so the browser can cache them across loads within a deploy.
      const manifest = await fetch(`${base}/manifest.json`, { cache: "no-store" }).then((r) => r.json());
      if (manifest.version) v = String(manifest.version);
      const [body, css] = await Promise.all([
        fetch(bust(`${base}/body.html`)).then((r) => r.text()),
        fetch(bust(`${base}/style.css`)).then((r) => r.text()),
      ]);

      // baseline so the page's `body{...}` (remapped to #embed-root) lays out full-height
      injectStyle("html,body{margin:0;padding:0;height:100%}#embed-root{min-height:100vh}");
      (manifest.cssLinks || []).forEach(injectLink);
      injectStyle(css);

      if (ref.current) {
        if (manifest.bodyClass) ref.current.className = manifest.bodyClass;
        ref.current.innerHTML = body; // markup only — scripts were extracted out
      }

      // run the page's scripts in original order, then fire the lifecycle events
      // the original code listens for (DOMContentLoaded / load).
      for (const src of manifest.scripts || []) {
        // eslint-disable-next-line no-await-in-loop
        await loadScript(bust(src));
      }
      try { document.dispatchEvent(new Event("DOMContentLoaded")); } catch (e) {}
      try { window.dispatchEvent(new Event("load")); } catch (e) {}
    })();

    return () => {
      booted.current = false; // allow a clean re-boot (React strict-mode remount) instead of leaving a torn-down page
      added.forEach((el) => el.parentNode && el.parentNode.removeChild(el));
    };
  }, [page]);

  return <div id="embed-root" ref={ref} />;
}
