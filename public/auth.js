/* ParkBuddy — accounts, Google sign-in, cloud sync & Account module (Supabase).
   ------------------------------------------------------------------
   - Welcome modal greets visitors: "Continue with Google" / "Continue as a guest".
   - Avatar (top-right) opens a full Account panel:
       • For you      — pick interests, get personalized park ideas
       • My itineraries
       • Subscriptions & alerts
       • Account settings
   - Guests opening the panel see a "sign in to personalize" prompt.
   - Signed-in users sync trips, settings, interests & favorites across devices.
   - Safe to ship before configuring (placeholder keys → does nothing).

   Loads AFTER the Supabase browser client (CDN) and supabase-config.js. */
(function () {
  var TRACK = ["pp_trip2", "pp_map_trip", "pp_favorites", "pp_prefs", "pp_stamped", "pp_passports"];

  function configured() {
    var u = window.SUPABASE_URL, k = window.SUPABASE_ANON_KEY;
    return !!u && !!k && u.indexOf("YOUR_") !== 0 && k.indexOf("YOUR_") !== 0 &&
           typeof window.supabase !== "undefined";
  }
  if (window.__ppAuth) { try { window.__ppAuth.render(); } catch (e) {} return; }
  if (!configured()) { return; }

  var supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  var user = null, pushT = null;

  // ---------- palette / fonts ----------
  var FONT = "'Hanken Grotesk',system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  var SERIF = "'Spectral',Georgia,serif";
  var GREEN = "#2c5562", INK = "#1d3941", GOLD = "#c79a4b", CREAM = "#fffdf7", MUTED = "#8c8473", LINE = "#ece3d0";
  var GOOGLE_SVG = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.3 6.6v5.5h7c4.1-3.8 6.6-9.4 6.6-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.7 0-10.5-3.8-12.2-9.1H4.5v5.7C8.1 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.8l7.3-5.7z"/><path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.2-6.2C34.9 4.1 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.2l7.3 5.7c1.7-5.2 6.5-9.2 12.2-9.2z"/></svg>';
  var TREE_SVG = '<svg width="26" height="26" viewBox="0 0 24 24" fill="' + GOLD + '"><path d="M12 2l5 9h-3l5 9H5l5-9H7z"/><rect x="11" y="18" width="2" height="4"/></svg>';

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---------- preferences ----------
  function getPrefs() { try { return JSON.parse(localStorage.getItem("pp_prefs") || "{}") || {}; } catch (e) { return {}; } }
  function setPrefs(p) { try { localStorage.setItem("pp_prefs", JSON.stringify(p)); } catch (e) {} }

  // ---------- cloud sync ----------
  function gather() {
    var o = {};
    TRACK.forEach(function (k) { var v = localStorage.getItem(k); if (v != null) { try { o[k] = JSON.parse(v); } catch (e) { o[k] = v; } } });
    return o;
  }
  function pushCloud() {
    if (!user) return;
    clearTimeout(pushT);
    pushT = setTimeout(function () {
      supa.from("user_data").upsert({ id: user.id, data: gather(), updated_at: new Date().toISOString() }).then(function () {}, function () {});
    }, 600);
  }
  function pullCloud() {
    if (!user) return Promise.resolve(false);
    return supa.from("user_data").select("data").eq("id", user.id).maybeSingle().then(function (res) {
      var data = res && res.data && res.data.data;
      if (!data || !Object.keys(data).length) { pushCloud(); return false; }
      var changed = false;
      TRACK.forEach(function (k) {
        if (data[k] != null) { var nv = JSON.stringify(data[k]); if (localStorage.getItem(k) !== nv) { localStorage.setItem(k, nv); changed = true; } }
      });
      return changed;
    }, function () { return false; });
  }
  (function patchStorage() {
    var orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) { orig(k, v); if (user && TRACK.indexOf(k) >= 0) pushCloud(); };
  })();

  // ---------- personalized ideas ----------
  var INTERESTS = ["Hiking", "Wildlife", "Photography", "Camping", "Scenic drives", "Family"];
  var IDEAS = {
    "Hiking": [{ n: "Zion National Park", d: "Angels Landing & the Narrows — iconic canyon hikes." }, { n: "Grand Canyon National Park", d: "South Kaibab switchbacks and rim-to-rim trails." }, { n: "Rocky Mountain National Park", d: "Alpine lakes and 60+ peaks above 12,000 ft." }],
    "Wildlife": [{ n: "Yellowstone National Park", d: "Bison, wolves and steaming geothermal basins." }, { n: "Denali National Park", d: "Grizzlies, caribou and the continent's tallest peak." }, { n: "Everglades National Park", d: "Alligators, manatees and wading birds." }],
    "Photography": [{ n: "Arches National Park", d: "2,000+ stone arches glowing at golden hour." }, { n: "Yosemite National Park", d: "El Capitan, Half Dome and valley waterfalls." }, { n: "Grand Teton National Park", d: "Jagged peaks mirrored in Snake River bends." }],
    "Camping": [{ n: "Joshua Tree National Park", d: "Dark-sky desert camps among boulder gardens." }, { n: "Acadia National Park", d: "Coastal sites under Cadillac Mountain sunrises." }, { n: "Sequoia National Park", d: "Sleep beneath the world's largest trees." }],
    "Scenic drives": [{ n: "Glacier National Park", d: "Going-to-the-Sun Road over the Continental Divide." }, { n: "Shenandoah National Park", d: "105 miles of Skyline Drive overlooks." }, { n: "Great Smoky Mountains National Park", d: "Misty ridgelines and Newfound Gap." }],
    "Family": [{ n: "Yellowstone National Park", d: "Geysers and easy boardwalks kids love." }, { n: "Acadia National Park", d: "Tide pools, carriage roads and gentle trails." }, { n: "Mammoth Cave National Park", d: "Tours of the world's longest cave system." }]
  };
  function ideasHtml(prefs) {
    var sel = prefs.interests || [];
    if (!sel.length) return '<div style="color:' + MUTED + ';font-size:.85rem;background:#fff;border:1px dashed #ddd2bb;border-radius:12px;padding:16px;text-align:center">Pick one or more interests above and we\u2019ll suggest parks made for you.</div>';
    var seen = {}, cards = [];
    sel.forEach(function (it) {
      (IDEAS[it] || []).forEach(function (p) {
        if (seen[p.n]) return; seen[p.n] = 1;
        cards.push('<a href="/park-status?park=' + encodeURIComponent(p.n) + '" style="display:block;text-decoration:none;background:#fff;border:1px solid ' + LINE + ';border-radius:13px;padding:13px 15px;transition:border-color .15s">' +
          '<div style="font-size:.66rem;color:' + GOLD + ';font-weight:700;text-transform:uppercase;letter-spacing:.06em">' + esc(it) + '</div>' +
          '<div style="font-family:' + SERIF + ';font-weight:700;color:' + INK + ';font-size:1.02rem;margin:2px 0 3px">' + esc(p.n.replace(" National Park", "")) + '</div>' +
          '<div style="color:' + MUTED + ';font-size:.83rem;line-height:1.4">' + esc(p.d) + '</div></a>');
      });
    });
    return cards.join("");
  }

  function tripCounts() {
    var maps = 0, stops = 0;
    try { maps = (JSON.parse(localStorage.getItem("pp_map_trip") || "[]") || []).length; } catch (e) {}
    try { var t = JSON.parse(localStorage.getItem("pp_trip2") || "{}"); stops = (t && t.s ? t.s.length : 0); } catch (e) {}
    return { maps: maps, stops: stops };
  }

  // ---------- styles ----------
  function ensureStyles() {
    if (document.getElementById("pp-style")) return;
    var st = document.createElement("style");
    st.id = "pp-style";
    st.textContent =
      "@keyframes ppCardIn{from{transform:translateY(10px) scale(.97)}to{transform:none}}" +
      "@keyframes ppDrawerIn{from{transform:translateX(100%)}to{transform:none}}" +
      ".pp-sectitle{font-size:.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:" + GOLD + ";margin:0 0 9px}" +
      ".pp-sec{padding:18px 20px;border-bottom:1px solid #f0e8d7}" +
      ".pp-chips{display:flex;flex-wrap:wrap;gap:8px}" +
      ".pp-chip{font-family:" + FONT + ";font-size:.82rem;font-weight:600;padding:7px 13px;border-radius:999px;cursor:pointer;border:1px solid #ddd2bb;background:#fff;color:" + INK + "}" +
      ".pp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid #f3ecdd}" +
      ".pp-row:last-child{border-bottom:none}" +
      ".pp-sw{width:42px;height:25px;border-radius:999px;border:none;cursor:pointer;position:relative;flex:none;transition:background .18s}" +
      ".pp-sw>span{position:absolute;top:3px;left:3px;width:19px;height:19px;border-radius:999px;background:#fff;transition:left .18s;box-shadow:0 1px 3px rgba(0,0,0,.3)}" +
      ".pp-btn{width:100%;padding:11px;border-radius:10px;border:none;font-family:" + FONT + ";font-weight:600;font-size:.86rem;cursor:pointer}";
    document.head.appendChild(st);
  }
  function styleChip(el, on) {
    el.style.background = on ? GREEN : "#fff";
    el.style.color = on ? "#fff" : INK;
    el.style.borderColor = on ? GREEN : "#ddd2bb";
  }
  function swHtml(key, on, label, sub) {
    return '<div class="pp-row"><div><div style="font-weight:600;color:' + INK + ';font-size:.88rem">' + label + '</div>' +
      (sub ? '<div style="color:' + MUTED + ';font-size:.76rem;margin-top:2px">' + sub + '</div>' : '') + '</div>' +
      '<button class="pp-sw" data-sw="' + key + '" aria-pressed="' + (on ? "true" : "false") + '" style="background:' + (on ? GREEN : "#cfc7b4") + '"><span style="left:' + (on ? "20px" : "3px") + '"></span></button></div>';
  }

  function signIn() { supa.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("#")[0] } }); }

  // ---------- welcome modal ----------
  function closeWelcome() {
    var o = document.getElementById("pp-welcome"); if (!o) return;
    o.style.opacity = "0"; setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 200);
  }
  function showWelcome() {
    ensureStyles();
    if (!document.body || document.getElementById("pp-welcome")) return;
    var ov = document.createElement("div");
    ov.id = "pp-welcome";
    ov.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(18,28,22,.55);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);opacity:1;transition:opacity .22s ease;font-family:" + FONT;
    var card = document.createElement("div");
    card.style.cssText = "background:" + CREAM + ";width:100%;max-width:392px;box-sizing:border-box;border-radius:22px;padding:34px 30px 28px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.32);border:1px solid " + LINE + ";animation:ppCardIn .28s cubic-bezier(.2,.8,.3,1)";
    card.innerHTML =
      '<div style="width:60px;height:60px;border-radius:18px;background:' + GREEN + ';display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 6px 18px rgba(29,74,55,.3)">' + TREE_SVG + '</div>' +
      '<h2 style="font-family:' + SERIF + ';font-weight:700;font-size:1.5rem;color:' + INK + ';margin:0 0 8px;letter-spacing:-.01em">Welcome to ParkBuddy</h2>' +
      '<p style="color:' + MUTED + ';font-size:.92rem;line-height:1.5;margin:0 auto 22px;max-width:300px">Sign in to save your trips, itineraries &amp; favorites across all your devices — or keep exploring as a guest.</p>' +
      '<button id="pp-w-google" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:13px;border-radius:12px;border:1px solid #dcd3bf;background:#fff;color:' + INK + ';font-family:inherit;font-weight:600;font-size:.95rem;cursor:pointer">' + GOOGLE_SVG + 'Continue with Google</button>' +
      '<button id="pp-w-guest" style="width:100%;margin-top:11px;padding:13px;border-radius:12px;border:none;background:transparent;color:' + GREEN + ';font-family:inherit;font-weight:600;font-size:.92rem;cursor:pointer">Continue as a guest</button>' +
      '<div style="margin-top:16px;color:#a79f8c;font-size:.74rem;line-height:1.45">Guests can use everything. Your data stays in this browser until you sign in.</div>';
    ov.appendChild(card);
    document.body.appendChild(ov);
    card.querySelector("#pp-w-google").onclick = function () { signIn(); };
    card.querySelector("#pp-w-guest").onclick = function () { try { localStorage.setItem("pp_welcomed", "1"); } catch (e) {} closeWelcome(); };
  }

  // ---------- account drawer ----------
  function closeAccount() {
    var o = document.getElementById("pp-acct-panel"); if (!o) return;
    o.style.opacity = "0"; setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 200);
  }
  function accountInnerHtml() {
    var prefs = getPrefs();
    if (!user) {
      var rows = [
        ["\u2728", "Personalized park ideas", "Tell us what you love and get parks picked for you."],
        ["\u2691", "Save & build itineraries", "Keep your trips and pick up on any device."],
        ["\u23F0", "Alerts & subscriptions", "Weather, closures and trip reminders by email."]
      ].map(function (r) {
        return '<div style="display:flex;gap:13px;align-items:flex-start;padding:13px 0;border-bottom:1px solid #f3ecdd"><span style="font-size:1.2rem;line-height:1.2">' + r[0] + '</span><div><div style="font-weight:700;color:' + INK + ';font-size:.92rem">' + r[1] + '</div><div style="color:' + MUTED + ';font-size:.82rem;margin-top:2px;line-height:1.4">' + r[2] + '</div></div></div>';
      }).join("");
      return '<div style="background:' + GREEN + ';color:#fff;padding:30px 24px 26px;position:relative">' +
        '<button class="pp-close" aria-label="Close" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:999px;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:18px;cursor:pointer">&times;</button>' +
        '<div style="width:54px;height:54px;border-radius:16px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;margin-bottom:14px">' + TREE_SVG + '</div>' +
        '<div style="font-family:' + SERIF + ';font-weight:700;font-size:1.42rem;line-height:1.2">Sign in to personalize<br>your ParkBuddy</div>' +
        '<div style="color:rgba(255,255,255,.8);font-size:.88rem;margin-top:8px;line-height:1.5">Create itineraries, save favorites, and get the best park ideas — made for you.</div></div>' +
        '<div style="padding:18px 22px 8px">' + rows + '</div>' +
        '<div style="padding:6px 22px 24px"><button id="pp-acct-google" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:13px;border-radius:12px;border:1px solid #dcd3bf;background:#fff;color:' + INK + ';font-family:' + FONT + ';font-weight:600;font-size:.95rem;cursor:pointer">' + GOOGLE_SVG + 'Continue with Google</button>' +
        '<div style="text-align:center;color:#a79f8c;font-size:.74rem;margin-top:12px">No password needed — secure sign-in with Google.</div></div>';
    }
    // signed in
    var meta = user.user_metadata || {};
    var name = prefs.name || meta.full_name || meta.name || (user.email || "Explorer").split("@")[0];
    var pic = meta.avatar_url || meta.picture || "";
    var initial = (name[0] || "U").toUpperCase();
    var tc = tripCounts();
    var alerts = prefs.alerts || {};

    var header = '<div style="background:' + GREEN + ';color:#fff;padding:24px 22px 22px;position:relative">' +
      '<button class="pp-close" aria-label="Close" style="position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:999px;border:none;background:rgba(255,255,255,.15);color:#fff;font-size:18px;cursor:pointer">&times;</button>' +
      '<div style="display:flex;align-items:center;gap:13px">' +
        '<div style="width:50px;height:50px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;flex:none">' + (pic ? '<img src="' + esc(pic) + '" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover" alt="">' : initial) + '</div>' +
        '<div style="min-width:0"><div style="font-family:' + SERIF + ';font-weight:700;font-size:1.2rem">' + esc(name) + '</div>' +
        (user.email ? '<div style="color:rgba(255,255,255,.78);font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(user.email) + '</div>' : '') + '</div></div></div>';

    var forYou = '<div class="pp-sec"><div class="pp-sectitle">For you</div>' +
      '<div style="color:' + MUTED + ';font-size:.82rem;margin-bottom:11px">Pick what you love — we\u2019ll tailor park ideas.</div>' +
      '<div class="pp-chips">' + INTERESTS.map(function (it) {
        var on = (prefs.interests || []).indexOf(it) >= 0;
        return '<button class="pp-chip" data-int="' + it + '" style="background:' + (on ? GREEN : "#fff") + ';color:' + (on ? "#fff" : INK) + ';border-color:' + (on ? GREEN : "#ddd2bb") + '">' + it + '</button>';
      }).join("") + '</div>' +
      '<div id="pp-ideas" style="margin-top:14px;display:grid;gap:10px">' + ideasHtml(prefs) + '</div></div>';

    var itin = '<div class="pp-sec"><div class="pp-sectitle">My itineraries</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:12px">' +
        '<div style="flex:1;background:#fff;border:1px solid ' + LINE + ';border-radius:12px;padding:13px"><div style="font-family:' + SERIF + ';font-weight:700;font-size:1.4rem;color:' + GREEN + '">' + tc.maps + '</div><div style="color:' + MUTED + ';font-size:.76rem">parks in map trip</div></div>' +
        '<div style="flex:1;background:#fff;border:1px solid ' + LINE + ';border-radius:12px;padding:13px"><div style="font-family:' + SERIF + ';font-weight:700;font-size:1.4rem;color:' + GREEN + '">' + tc.stops + '</div><div style="color:' + MUTED + ';font-size:.76rem">stops in trip builder</div></div></div>' +
      '<a href="/build-trip" class="pp-btn" style="display:block;text-align:center;text-decoration:none;background:' + GOLD + ';color:' + INK + '">' + (tc.maps || tc.stops ? "Open trip builder" : "Start your first itinerary") + '</a></div>';

    var subs = '<div class="pp-sec"><div class="pp-sectitle">Subscriptions &amp; alerts</div>' +
      swHtml("weather", alerts.weather !== false, "Weather &amp; closure alerts", "Severe weather and park closures for your trips.") +
      swHtml("ideas", !!alerts.ideas, "Weekly park ideas", "Fresh suggestions for the interests you picked.") +
      swHtml("reminders", !!alerts.reminders, "Trip reminders", "Countdown and packing nudges before you go.") +
      '<div class="pp-row"><div><div style="font-weight:600;color:' + INK + ';font-size:.88rem">Plan</div><div style="color:' + MUTED + ';font-size:.76rem;margin-top:2px">Free — all core features included.</div></div>' +
      '<span style="font-size:.74rem;font-weight:700;color:' + MUTED + ';background:#f1ead9;border-radius:999px;padding:5px 11px">Pro · soon</span></div></div>';

    var settings = '<div class="pp-sec" style="border-bottom:none"><div class="pp-sectitle">Account settings</div>' +
      '<label style="display:block;color:' + MUTED + ';font-size:.78rem;margin-bottom:5px">Display name</label>' +
      '<input id="pp-name" value="' + esc(prefs.name || meta.full_name || meta.name || "") + '" placeholder="Your name" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #ddd2bb;border-radius:10px;font-family:' + FONT + ';font-size:.9rem;margin-bottom:14px">' +
      '<button id="pp-clear" class="pp-btn" style="background:#fff;border:1px solid #e3d8c2;color:#9a5a4a;margin-bottom:9px">Clear my saved trips &amp; settings</button>' +
      '<button id="pp-signout" class="pp-btn" style="background:' + GREEN + ';color:#fff">Sign out</button></div>';

    return header + forYou + itin + subs + settings;
  }
  function wireAccount(panel) {
    panel.querySelectorAll(".pp-close").forEach(function (b) { b.onclick = closeAccount; });
    var g = panel.querySelector("#pp-acct-google"); if (g) g.onclick = function () { signIn(); };
    panel.querySelectorAll(".pp-chip").forEach(function (c) {
      c.onclick = function () {
        var p = getPrefs(), arr = p.interests || [], k = c.getAttribute("data-int"), i = arr.indexOf(k), on = i < 0;
        if (on) arr.push(k); else arr.splice(i, 1);
        p.interests = arr; setPrefs(p); styleChip(c, on);
        var grid = panel.querySelector("#pp-ideas"); if (grid) grid.innerHTML = ideasHtml(p);
      };
    });
    panel.querySelectorAll(".pp-sw").forEach(function (s) {
      s.onclick = function () {
        var p = getPrefs(); p.alerts = p.alerts || {};
        var key = s.getAttribute("data-sw"); var on = !(s.getAttribute("aria-pressed") === "true");
        p.alerts[key] = on; setPrefs(p);
        s.setAttribute("aria-pressed", on ? "true" : "false");
        s.style.background = on ? GREEN : "#cfc7b4";
        s.firstChild.style.left = on ? "20px" : "3px";
      };
    });
    var nm = panel.querySelector("#pp-name");
    if (nm) nm.addEventListener("input", function () { var p = getPrefs(); p.name = nm.value.trim(); setPrefs(p); });
    var cl = panel.querySelector("#pp-clear");
    if (cl) cl.onclick = function () {
      if (!confirm("Clear your saved trips and settings? This can't be undone.")) return;
      ["pp_trip2", "pp_map_trip", "pp_favorites"].forEach(function (k) { localStorage.removeItem(k); });
      pushCloud(); closeAccount();
    };
    var so = panel.querySelector("#pp-signout"); if (so) so.onclick = function () { supa.auth.signOut(); };
  }
  function openAccount() {
    ensureStyles();
    if (!document.body || document.getElementById("pp-acct-panel")) return;
    closeWelcome();
    var ov = document.createElement("div");
    ov.id = "pp-acct-panel";
    ov.style.cssText = "position:fixed;inset:0;z-index:100001;display:flex;justify-content:flex-end;background:rgba(18,28,22,.5);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:1;transition:opacity .2s ease;font-family:" + FONT;
    var panel = document.createElement("div");
    panel.style.cssText = "width:min(430px,100%);height:100%;background:" + CREAM + ";overflow-y:auto;box-shadow:-12px 0 44px rgba(0,0,0,.28);animation:ppDrawerIn .3s cubic-bezier(.2,.8,.3,1)";
    panel.innerHTML = accountInnerHtml();
    ov.appendChild(panel);
    document.body.appendChild(ov);
    ov.addEventListener("click", function (e) { if (e.target === ov) closeAccount(); });
    wireAccount(panel);
  }

  // ---------- top-right control ----------
  // Prefer mounting INTO the page header (inline with the nav) so it never
  // floats over existing buttons; fall back to a fixed pin if no header.
  function mountTarget() {
    var slot = document.getElementById("pp-acct-slot");
    if (slot) return slot;
    var header = document.querySelector("#embed-root header") || document.querySelector("header");
    if (!header) return null;
    var nav = header.querySelector("nav");
    if (nav) return nav;
    var groups = header.querySelectorAll(":scope > div");
    if (groups.length >= 2) return groups[groups.length - 1];
    return header;
  }
  function buildControl() {
    if (user) {
      var meta = user.user_metadata || {};
      var name = (getPrefs().name || meta.full_name || meta.name || user.email || "U");
      var pic = meta.avatar_url || meta.picture || "";
      var btn = document.createElement("button");
      btn.setAttribute("aria-label", "Open account");
      btn.style.cssText = "width:36px;height:36px;border-radius:999px;border:2px solid " + CREAM + ";cursor:pointer;overflow:hidden;background:" + GREEN + ";color:#fff;font-weight:700;font-size:14px;box-shadow:0 1px 5px rgba(0,0,0,.25);padding:0;display:flex;align-items:center;justify-content:center";
      btn.innerHTML = pic ? '<img src="' + esc(pic) + '" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover" alt="">' : (name[0] || "U").toUpperCase();
      btn.onclick = openAccount;
      return btn;
    }
    var pill = document.createElement("button");
    pill.style.cssText = "display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:" + CREAM + ";color:" + INK + ";font-family:" + FONT + ";font-weight:600;font-size:.8rem;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.18);white-space:nowrap";
    pill.innerHTML = GOOGLE_SVG + "Sign in";
    pill.onclick = openAccount;
    return pill;
  }
  function topRight() {
    var ex = document.getElementById("pp-acct"); if (ex) ex.remove();
    if (!document.body) return;
    var ctrl = buildControl();
    var wrap = document.createElement("span");
    wrap.id = "pp-acct";
    var t = mountTarget();
    if (t) {
      wrap.style.cssText = "display:inline-flex;align-items:center;margin-left:4px;font-family:" + FONT;
      t.appendChild(wrap);
    } else {
      wrap.style.cssText = "position:fixed;top:13px;right:15px;z-index:99990;font-family:" + FONT;
      document.body.appendChild(wrap);
    }
    wrap.appendChild(ctrl);
  }

  function render() { topRight(); }
  function maybeWelcome() { if (!user) { try { if (!localStorage.getItem("pp_welcomed")) showWelcome(); } catch (e) {} } }

  window.__ppAuth = { render: render, supa: supa, openAccount: openAccount, showWelcome: showWelcome };

  function mount() { render(); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  supa.auth.getSession().then(function (res) {
    user = (res && res.data && res.data.session) ? res.data.session.user : null;
    render();
    if (user) {
      closeWelcome();
      pullCloud().then(function (changed) {
        if (changed && !sessionStorage.getItem("pp_resynced")) { sessionStorage.setItem("pp_resynced", "1"); location.reload(); }
      });
    } else { sessionStorage.removeItem("pp_resynced"); }
  });

  supa.auth.onAuthStateChange(function (evt, session) {
    user = session ? session.user : null;
    render();
    if (user) closeWelcome();
    if (evt === "SIGNED_OUT") { sessionStorage.removeItem("pp_resynced"); location.reload(); }
  });
})();
