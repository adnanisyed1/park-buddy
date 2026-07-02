/* ParkBuddy — page transitions disabled.
   Navigation is now instant with no veil, fade, or wipe. This file only keeps a
   no-op __ppTrans API so existing callers (e.g. landing tiles) still navigate. */
(function () {
  if (window.__ppTrans) return;
  function go(href) { if (href) location.href = href; }
  function noop() {}
  window.__ppTrans = { reveal: noop, cover: function (x, y, cb) { if (typeof cb === "function") cb(); }, go: go };
})();
