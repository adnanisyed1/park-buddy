/* ParkBuddy — Trip Itinerary PDF (the printable "Trip Passport").
   Builds a clean, branded, print-optimized document from the live trip
   (window.trip + s0.js globals) and the Pack & Go checklist, then opens it
   full-screen with a "Save as PDF" button (browser print → Save as PDF).
   Exposes window.__ppItinerary.download(). Loaded on the Build a Trip page. */
(function () {
  if (window.__ppItinerary) return;

  var GOLD = '#c79a4b', GOLD2 = '#e4be78', TEAL = '#2c5562', TEALD = '#16303a', HEAD = '#1d3941',
      CREAM = '#fffdf7', PAPER = '#fff', INK = '#1a2b21', MUTED = '#8c8473', LINE = '#e7ddca', GO = '#2f7d4f';
  var SANS = "'Hanken Grotesk',system-ui,-apple-system,sans-serif", SERIF = "'Spectral',Georgia,serif";

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function txt(id) { var e = document.getElementById(id); return e ? (e.value != null && e.tagName === 'INPUT' ? e.value : e.textContent).trim() : ''; }

  function gatherStops() {
    var T = window.trip || {}, out = [];
    (T.stops || []).forEach(function (s, i) {
      if (s.hidden) return;
      var p = s.pid && window.byId ? window.byId[s.pid] : null;
      var ll = null;
      try { ll = (typeof window.stopLL === 'function') ? window.stopLL(s) : (p ? [p.lat, p.lng] : (typeof s.lat === 'number' ? [s.lat, s.lng] : null)); } catch (e) {}
      var cond = ''; var cb = document.getElementById('cond-' + i); if (cb) { cond = cb.textContent.replace(/\s+/g, ' ').trim(); }
      out.push({
        name: p ? p.name : (s.name || 'Stop'),
        sub: p ? (p.state + ' \u00b7 National Park') : (s.kind ? s.kind : 'Custom stop'),
        nights: (s.nights != null ? s.nights : (window.defNights ? window.defNights(s) : 2)),
        lodge: s.lodge || '', ll: ll, cond: cond, park: !!s.pid
      });
    });
    return out;
  }
  function staticMap(stops) {
    var key = window.GMAPS_KEY || ''; if (!key) return '';
    var pts = stops.filter(function (s) { return s.ll && typeof s.ll[0] === 'number'; });
    if (!pts.length) return '';
    var markers = pts.map(function (s, i) { return 'markers=color:0x2c5562%7Clabel:' + (i + 1) + '%7C' + s.ll[0] + ',' + s.ll[1]; }).join('&');
    var path = pts.length > 1 ? '&path=color:0xc79a4bcc%7Cweight:3%7C' + pts.map(function (s) { return s.ll[0] + ',' + s.ll[1]; }).join('%7C') : '';
    var url = 'https://maps.googleapis.com/maps/api/staticmap?size=640x300&scale=2&maptype=terrain&' + markers + path + '&key=' + encodeURIComponent(key);
    return '<div class="sec" id="itin-mapsec"><div class="sec-h">Your route</div><img class="routemap" src="' + url + '" alt="Trip route map" referrerpolicy="no-referrer"></div>';
  }
  function carrySheet() {
    var rows = [
      ['\uD83C\uDD98', 'Emergency', 'Dial 911. Save each park\u2019s visitor-center &amp; ranger dispatch number before you lose signal.'],
      ['\uD83D\uDCF6', 'Go offline', 'Download offline maps &amp; this itinerary \u2014 cell service is patchy or absent in most parks.'],
      ['\uD83C\uDFAB', 'Reservations', 'Carry your park pass / timed-entry confirmation, lodging &amp; campsite bookings, and rental-car docs.'],
      ['\uD83D\uDCA7', 'Essentials', 'Water (~1 gal/person/day), layers, sun protection, first-aid, headlamp, and a full tank of gas.'],
      ['\uD83D\uDC3B', 'Wildlife &amp; rules', 'Keep 100 yds from predators / 25 yds from other wildlife. Check fire &amp; pet rules per park.'],
      ['\u267B\uFE0F', 'Leave No Trace', 'Pack out all trash, stay on trails, and never move firewood between parks.']
    ].map(function (r) { return '<div class="cg"><b>' + r[0] + ' ' + r[1] + '</b><p>' + r[2] + '</p></div>'; }).join('');
    return '<div class="sec"><div class="sec-h">Good to know &amp; carry</div><div class="carry">' + rows + '</div></div>';
  }
  function legs() { try { return (typeof window.legsData === 'function') ? window.legsData() : []; } catch (e) { return []; } }
  function checklist() { try { return JSON.parse(localStorage.getItem('pb_checklist_v1')) || []; } catch (e) { return []; } }

  function build() {
    var name = txt('tripname') || 'My national-parks trip';
    var startStr = txt('startdate'), endStr = txt('enddate'), travelers = txt('travelers') || '2';
    var stats = { stops: txt('st-stops') || '0', days: txt('st-days') || '0', miles: txt('st-miles') || '0', cost: txt('st-cost') || '$0' };
    var stops = gatherStops(), L = legs();
    var mapSec = staticMap(stops);
    var start = startStr ? new Date(startStr + 'T00:00') : null;
    var fmt = function (d) { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };

    // day-by-day rows
    var acc = 0, dayN = 1, rows = '';
    stops.forEach(function (s, i) {
      if (i > 0 && L[i - 1]) {
        var lg = L[i - 1];
        rows += '<div class="leg"><span class="legline"></span>\u2193 Drive ' + (lg.mi ? Math.round(lg.mi).toLocaleString() + ' mi' : '') + (lg.hours ? ' \u00b7 ' + (Math.round(lg.hours * 10) / 10) + ' h' : '') + '</div>';
      }
      var n = Math.max(s.nights, 0);
      var arrival = start ? new Date(start.getTime() + acc * 86400000) : null;
      var dayLabel = n > 0 ? ('Nights ' + dayN + (n > 1 ? '\u2013' + (dayN + n - 1) : '')) : ('Day ' + dayN);
      var dateLabel = arrival ? (fmt(arrival) + (n > 1 ? ' \u2013 ' + fmt(new Date(arrival.getTime() + (n - 1) * 86400000)) : '')) : '';
      rows += '<div class="stop"><div class="snum">' + (i + 1) + '</div><div class="sbody">' +
        '<div class="sday">' + dayLabel + (dateLabel ? ' \u00b7 ' + esc(dateLabel) : '') + '</div>' +
        '<div class="sname">' + esc(s.name) + '</div><div class="ssub">' + esc(s.sub) + '</div>' +
        (s.cond ? '<div class="scond">\uD83C\uDF24\uFE0F ' + esc(s.cond) + '</div>' : '') +
        (s.lodge ? '<div class="slodge">\uD83C\uDFE8 ' + esc(s.lodge) + '</div>' : '') +
        '</div></div>';
      acc += Math.max(n, 1); dayN += n;
    });
    if (!rows) rows = '<div class="empty">No stops yet \u2014 add parks to your trip first.</div>';

    // cost lines
    var costRows = '', cl = document.getElementById('costlines');
    if (cl) { [].forEach.call(cl.children, function (r) { var t = r.textContent.replace(/\s+/g, ' ').trim(); if (t) costRows += '<div class="costrow">' + esc(t) + '</div>'; }); }

    // checklist grouped
    var items = checklist(), cats = [['pack', '\uD83C\uDF92 Pack before you leave'], ['grab', '\uD83D\uDED2 Grab on the way'], ['do', '\uD83D\uDCCD Do at the destination']];
    var checkHtml = '';
    cats.forEach(function (c) {
      var its = items.filter(function (x) { return x.cat === c[0]; });
      if (!its.length) return;
      checkHtml += '<div class="ckcol"><div class="ckh">' + c[1] + '</div>' + its.map(function (it) {
        return '<div class="ckit"><span class="ckbox">' + (it.done ? '\u2713' : '') + '</span><span>' + esc(it.label) + (it.note ? ' <em>\u2014 ' + esc(it.note) + '</em>' : '') + '</span></div>';
      }).join('') + '</div>';
    });

    var holder = '';
    try { var pr = JSON.parse(localStorage.getItem('pp_prefs') || '{}'); holder = (pr && pr.name) || ''; } catch (e) {}

    var dateRange = (startStr && endStr) ? (start ? fmt(start) : startStr) + ' \u2013 ' + endStr : (startStr ? 'from ' + startStr : 'Dates TBD');

    return '<div class="itin-doc" id="itin-doc">' +
      '<div class="itin-toolbar"><button class="it-print">\u2193 Save as PDF</button><button class="it-x">Close</button></div>' +
      '<div class="itin-page">' +
        '<div class="cover">' +
          '<div class="cv-top"><span class="cv-logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="' + GOLD2 + '"><path d="M12 2l5 9h-3l5 9H5l5-9H7z"/><rect x="11" y="18" width="2" height="4"/></svg></span><span class="cv-brand">ParkBuddy</span><span class="cv-tag">Trip Passport</span></div>' +
          '<div class="cv-name">' + esc(name) + '</div>' +
          '<div class="cv-dates">' + esc(dateRange) + ' \u00b7 ' + esc(travelers) + ' traveler' + (travelers === '1' ? '' : 's') + (holder ? ' \u00b7 ' + esc(holder) : '') + '</div>' +
          '<div class="cv-stats"><div class="cs"><b>' + esc(stats.stops) + '</b><span>Stops</span></div><div class="cs"><b>' + esc(stats.days) + '</b><span>Days</span></div><div class="cs"><b>' + esc(stats.miles) + '</b><span>Drive mi</span></div><div class="cs"><b>' + esc(stats.cost) + '</b><span>Est. cost</span></div></div>' +
        '</div>' +
        mapSec +
        '<div class="sec"><div class="sec-h">The itinerary</div><div class="itin-list">' + rows + '</div></div>' +
        (costRows ? '<div class="sec"><div class="sec-h">Estimated budget</div><div class="costbox">' + costRows + '<div class="costtotal"><span>Estimated total</span><b>' + esc(stats.cost) + '</b></div></div></div>' : '') +
        (checkHtml ? '<div class="sec"><div class="sec-h">Pack &amp; Go checklist</div><div class="ckgrid">' + checkHtml + '</div></div>' : '') +
        carrySheet() +
        '<div class="itin-foot">Generated by ParkBuddy \u00b7 live conditions, real-road planning &amp; the gear and stays that fit \u00b7 parkbuddy</div>' +
      '</div>' +
    '</div>';
  }

  function css() {
    if (document.getElementById('itin-css')) return;
    var s = document.createElement('style'); s.id = 'itin-css';
    s.textContent =
      '.itin-doc{position:fixed;inset:0;z-index:100050;background:' + TEALD + ';overflow-y:auto;font-family:' + SANS + ';color:' + INK + '}' +
      '.itin-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:10px;padding:14px clamp(14px,3vw,28px);background:linear-gradient(180deg,rgba(11,28,34,.92),rgba(11,28,34,.7))}' +
      '.itin-toolbar button{border:none;font-family:inherit;font-weight:800;font-size:.86rem;padding:11px 18px;border-radius:11px;cursor:pointer}' +
      '.it-print{background:linear-gradient(120deg,' + GOLD2 + ',' + GOLD + ');color:#15241c;box-shadow:0 4px 0 #9c7330}.it-print:active{transform:translateY(2px);box-shadow:0 1px 0 #9c7330}' +
      '.it-x{background:rgba(255,255,255,.14);color:#fbf6ea;border:1px solid rgba(255,255,255,.25)}' +
      '.itin-page{max-width:780px;margin:18px auto 60px;background:' + CREAM + ';border-radius:8px;box-shadow:0 30px 80px -40px rgba(0,0,0,.7);overflow:hidden}' +
      '.cover{background:linear-gradient(150deg,' + TEAL + ',' + TEALD + ');color:#fbf6ea;padding:clamp(26px,4vw,42px) clamp(24px,4vw,44px) clamp(24px,3vw,34px);position:relative}' +
      '.cv-top{display:flex;align-items:center;gap:9px;margin-bottom:22px}.cv-logo{width:34px;height:34px;border-radius:10px;background:rgba(228,190,120,.16);display:flex;align-items:center;justify-content:center}.cv-brand{font-family:' + SERIF + ';font-weight:700;font-size:1.15rem}.cv-tag{margin-left:auto;font-size:.64rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:' + GOLD2 + ';border:1px solid rgba(228,190,120,.4);padding:5px 11px;border-radius:999px}' +
      '.cv-name{font-family:' + SERIF + ';font-weight:800;font-size:clamp(1.9rem,4vw,2.8rem);line-height:1.05;letter-spacing:-.02em}' +
      '.cv-dates{color:rgba(251,246,234,.78);font-size:.92rem;font-weight:600;margin-top:10px}' +
      '.cv-stats{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}.cv-stats .cs{flex:1;min-width:84px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:13px;padding:13px 10px;text-align:center}.cv-stats .cs b{display:block;font-family:' + SERIF + ';font-weight:800;font-size:1.5rem;color:' + GOLD2 + '}.cv-stats .cs span{font-size:.6rem;text-transform:uppercase;letter-spacing:.07em;color:rgba(251,246,234,.7);font-weight:700}' +
      '.sec{padding:clamp(20px,3vw,30px) clamp(24px,4vw,44px);border-top:1px solid ' + LINE + '}' +
      '.sec-h{font-family:' + SERIF + ';font-weight:700;font-size:1.3rem;color:' + HEAD + ';margin-bottom:16px}' +
      '.itin-list{position:relative}' +
      '.stop{display:flex;gap:14px;align-items:flex-start;padding:4px 0}' +
      '.snum{width:32px;height:32px;flex:none;border-radius:50%;background:linear-gradient(150deg,' + TEAL + ',' + TEALD + ');color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.86rem;border:2px solid ' + GOLD2 + '}' +
      '.sbody{flex:1;padding-bottom:6px}.sday{font-size:.64rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:' + GOLD + '}.sname{font-family:' + SERIF + ';font-weight:700;font-size:1.16rem;color:' + HEAD + ';margin-top:1px}.ssub{font-size:.8rem;color:' + MUTED + ';margin-top:1px}.slodge{font-size:.82rem;color:' + TEAL + ';font-weight:600;margin-top:5px}' +
      '.leg{margin:2px 0 6px 16px;padding-left:18px;font-size:.78rem;color:' + MUTED + ';font-weight:600}' +
      '.empty{color:' + MUTED + ';font-style:italic;padding:14px 0}' +
      '.costbox{background:' + PAPER + ';border:1px solid ' + LINE + ';border-radius:13px;padding:6px 16px}.costrow{font-size:.88rem;color:#3a463c;padding:9px 0;border-bottom:1px solid #f1ead9}.costtotal{display:flex;justify-content:space-between;align-items:center;padding:12px 0 6px;font-family:' + SERIF + ';font-weight:700}.costtotal b{font-size:1.3rem;color:' + TEAL + '}' +
      '.ckgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px}.ckcol .ckh{font-size:.74rem;font-weight:800;color:' + HEAD + ';margin-bottom:9px}.ckit{display:flex;gap:8px;align-items:flex-start;font-size:.82rem;color:#3a463c;line-height:1.35;margin-bottom:7px}.ckit em{color:' + MUTED + ';font-style:italic}.ckbox{flex:none;width:16px;height:16px;border:1.5px solid ' + GOLD + ';border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:' + GO + ';margin-top:1px}' +
      '.itin-foot{padding:20px clamp(24px,4vw,44px) 30px;font-size:.72rem;color:' + MUTED + ';text-align:center;border-top:1px solid ' + LINE + '}' +
      '.routemap{width:100%;border-radius:13px;border:1px solid ' + LINE + ';display:block}' +
      '.scond{font-size:.76rem;color:' + GO + ';font-weight:600;margin-top:5px;background:rgba(47,125,79,.08);border:1px solid rgba(47,125,79,.2);border-radius:8px;padding:5px 9px;display:inline-block}' +
      '.carry{display:grid;grid-template-columns:1fr 1fr;gap:14px}.cg b{font-size:.86rem;color:' + HEAD + ';display:block;margin-bottom:3px}.cg p{font-size:.8rem;color:#3a463c;line-height:1.45}' +
      '@media(max-width:620px){.carry{grid-template-columns:1fr}}' +
      '@media(max-width:620px){.ckgrid{grid-template-columns:1fr}}' +
      '@media print{body{background:#fff}body>*{display:none!important}.itin-doc{position:static!important;background:#fff;overflow:visible}.itin-doc{display:block!important}.itin-toolbar{display:none!important}.itin-page{box-shadow:none;margin:0;max-width:none;border-radius:0}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cv-stats .cs,.snum{-webkit-print-color-adjust:exact;print-color-adjust:exact}.stop,.ckcol{break-inside:avoid}.carry .cg,.routemap{break-inside:avoid}@page{margin:12mm}}';
    document.head.appendChild(s);
  }

  function download() {
    css();
    var old = document.getElementById('itin-doc'); if (old) old.remove();
    var host = document.createElement('div'); host.innerHTML = build();
    var doc = host.firstChild; document.body.appendChild(doc);
    doc.querySelector('.it-x').onclick = function () { doc.remove(); };
    doc.querySelector('.it-print').onclick = function () { window.print(); };
    // route map needs the Static Maps API enabled; if it 404s, hide the section cleanly
    var rm = doc.querySelector('.routemap');
    if (rm) rm.onerror = function () { var sec = document.getElementById('itin-mapsec'); if (sec) sec.style.display = 'none'; };
  }

  window.__ppItinerary = { download: download, open: download };
})();
