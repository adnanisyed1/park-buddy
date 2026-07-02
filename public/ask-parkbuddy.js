/* Park Buddy — "Ask Park Buddy" AI trip-planning widget.
   A floating chat button + panel that POSTs to /api/agent (the server-side
   NPS-grounded agent). Plain web component, teal theme, no build step.
   Drop <script src="/ask-parkbuddy.js"></script> on any page and it mounts. */
(function () {
  if (window.__pbAsk) return;
  window.__pbAsk = true;

  var GOLD = '#c79a4b', GOLD2 = '#e4be78', TEAL = '#2c5562', TEALD = '#16303a',
      CREAM = '#fbf6ea', PAPER = '#fffdf7', INK = '#1a2b21', HEAD = '#1d3941', MUTED = '#8c8473', LINE = '#e7ddca';
  var SANS = "'Hanken Grotesk',system-ui,sans-serif", SERIF = "'Spectral',Georgia,serif";

  var history = []; // [{role, content}]

  function css() {
    if (document.getElementById('pbask-css')) return;
    var s = document.createElement('style'); s.id = 'pbask-css';
    s.textContent =
      '.pbask-fab{position:fixed;right:18px;bottom:18px;z-index:99000;display:flex;align-items:center;gap:9px;background:linear-gradient(150deg,' + TEAL + ',' + TEALD + ');color:' + CREAM + ';border:1px solid rgba(228,190,120,.45);border-radius:999px;padding:13px 18px;font-family:' + SANS + ';font-weight:800;font-size:.9rem;cursor:pointer;box-shadow:0 16px 38px -14px rgba(8,18,12,.6)}' +
      '.pbask-fab .spark{font-size:1.05rem}' +
      '.pbask-panel{position:fixed;right:18px;bottom:18px;z-index:99001;width:min(390px,calc(100vw - 28px));height:min(580px,calc(100vh - 36px));background:' + CREAM + ';border:1px solid ' + LINE + ';border-radius:22px;box-shadow:0 40px 90px -34px rgba(8,18,12,.7);display:none;flex-direction:column;overflow:hidden;font-family:' + SANS + '}' +
      '.pbask-panel.open{display:flex}' +
      '.pbask-head{background:linear-gradient(135deg,' + TEAL + ',' + TEALD + ');color:' + CREAM + ';padding:15px 17px;display:flex;align-items:center;gap:11px}' +
      '.pbask-head .lg{width:34px;height:34px;flex:none;border-radius:10px;background:rgba(228,190,120,.18);display:flex;align-items:center;justify-content:center;font-size:1.1rem}' +
      '.pbask-head b{font-family:' + SERIF + ';font-weight:700;font-size:1.08rem;display:block}' +
      '.pbask-head small{color:rgba(251,246,234,.7);font-size:.72rem}' +
      '.pbask-x{margin-left:auto;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:' + CREAM + ';width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:.95rem}' +
      '.pbask-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:11px;background:' + CREAM + '}' +
      '.pbask-msg{max-width:84%;padding:11px 14px;border-radius:15px;font-size:.9rem;line-height:1.5}' +
      '.pbask-msg.bot{align-self:flex-start;background:' + PAPER + ';border:1px solid ' + LINE + ';color:' + INK + ';border-bottom-left-radius:5px}' +
      '.pbask-msg.user{align-self:flex-end;background:linear-gradient(135deg,' + TEAL + ',' + TEALD + ');color:' + CREAM + ';border-bottom-right-radius:5px}' +
      '.pbask-msg b{color:' + HEAD + '}.pbask-msg.user b{color:#fff}.pbask-msg ul{margin:6px 0 0;padding-left:18px}.pbask-msg li{margin:3px 0}' +
      '.pbask-sugs{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}' +
      '.pbask-sug{background:' + PAPER + ';border:1px solid ' + LINE + ';color:' + TEAL + ';font-family:inherit;font-weight:700;font-size:.78rem;padding:8px 12px;border-radius:999px;cursor:pointer;text-align:left}' +
      '.pbask-sug:hover{border-color:' + GOLD + '}' +
      '.pbask-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 15px;background:' + PAPER + ';border:1px solid ' + LINE + ';border-radius:15px}' +
      '.pbask-typing span{width:7px;height:7px;border-radius:50%;background:' + GOLD + ';animation:pbaskb 1s infinite}' +
      '.pbask-typing span:nth-child(2){animation-delay:.15s}.pbask-typing span:nth-child(3){animation-delay:.3s}' +
      '@keyframes pbaskb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}' +
      '.pbask-foot{border-top:1px solid ' + LINE + ';padding:11px;display:flex;gap:8px;background:' + PAPER + '}' +
      '.pbask-mic{flex:none;border:1px solid ' + LINE + ';border-radius:12px;background:#fff;color:' + TEAL + ';font-size:1.05rem;width:44px;cursor:pointer}' +
      '.pbask-mic.rec{background:#d9534f;border-color:#d9534f;color:#fff;animation:pbaskrec 1.1s infinite}' +
      '@keyframes pbaskrec{0%{box-shadow:0 0 0 0 rgba(217,83,79,.5)}70%{box-shadow:0 0 0 8px rgba(217,83,79,0)}100%{box-shadow:0 0 0 0 rgba(217,83,79,0)}}' +
      '.pbask-act{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;background:rgba(47,125,79,.1);border:1px solid rgba(47,125,79,.3);color:#256b41;font-size:.78rem;font-weight:700;padding:8px 12px;border-radius:11px}' +
      '.pbask-foot input{flex:1;min-width:0;border:1px solid ' + LINE + ';border-radius:12px;padding:11px 13px;font-family:inherit;font-size:.9rem;color:' + INK + ';background:#fff;outline:none}' +
      '.pbask-foot input:focus{border-color:' + GOLD + ';box-shadow:0 0 0 3px rgba(199,154,75,.16)}' +
      '.pbask-send{flex:none;border:none;border-radius:12px;background:linear-gradient(120deg,' + GOLD2 + ',' + GOLD + ');color:#15241c;font-size:1.1rem;width:44px;cursor:pointer}' +
      '.pbask-note{font-size:.66rem;color:' + MUTED + ';text-align:center;padding:0 0 8px;background:' + PAPER + '}';
    document.head.appendChild(s);
  }

  // tiny, safe markdown-ish: **bold** + "- " bullets, everything escaped first
  function fmt(t) {
    var esc = String(t).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
    var lines = esc.split('\n'), out = '', inList = false;
    lines.forEach(function (ln) {
      var m = ln.match(/^\s*[-*]\s+(.*)/);
      if (m) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + m[1] + '</li>'; }
      else { if (inList) { out += '</ul>'; inList = false; } if (ln.trim()) out += '<div>' + ln + '</div>'; }
    });
    if (inList) out += '</ul>';
    return out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }

  // Apply server-emitted actions to the trip-builder on this page (if present).
  function applyActions(actions) {
    if (!actions || !actions.length) return;
    var T = window.PBTrip;
    if (!T) {
      // Not on the Build a Trip page — carry the actions over and go build them there.
      var buildy = actions.filter(function (a) { return a.name === 'build_itinerary' || a.name === 'add_park' || a.name === 'set_trip_details' || a.name === 'add_checklist_items' || a.name === 'generate_checklist'; });
      if (buildy.length) {
        try { sessionStorage.setItem('pb_agent_actions', JSON.stringify(buildy)); } catch (e) {}
        note('\u2713 Taking you to Build a Trip to set this up\u2026');
        setTimeout(function () { location.href = '/build-trip'; }, 900);
      } else {
        note("\uD83D\uDCCD Open the \u201cBuild a Trip\u201d page to build this into a real itinerary.");
      }
      return;
    }
    actions.forEach(function (a) { runAction(T, a); });
  }
  function runAction(T, a) {
    var inp = a.input || {};
    try {
      if (a.name === 'build_itinerary') {
        var r = T.buildTrip(inp.parks || [], { name: inp.tripName, startDate: inp.startDate, travelers: inp.travelers });
        note('\u2713 Built your trip: ' + ((r.added || []).join(' \u2192 ') || 'no parks matched'));
      } else if (a.name === 'add_park') {
        var ra = T.addPark(inp.park, inp.nights);
        note(ra.ok ? ('\u2713 Added ' + ra.name) : ('\u2715 ' + (ra.error || 'could not add')));
      } else if (a.name === 'set_trip_details') {
        T.setBasics({ name: inp.tripName, startDate: inp.startDate, travelers: inp.travelers });
        note('\u2713 Updated trip details');
      } else if (a.name === 'generate_checklist') {
        T.generateChecklist(); note('\u2713 Drafted your Pack & Go checklist below');
      } else if (a.name === 'add_checklist_items') {
        if (window.PBChecklist) { var rc = window.PBChecklist.addItems(inp.items || []); window.PBChecklist.open(); note('\u2713 Added to your checklist: ' + ((rc.added || []).join(', ') || 'nothing new')); }
        else { note('\u2715 Checklist is on the Build a Trip page \u2014 open it to add items.'); }
      } else if (a.name === 'save_passport') {
        T.downloadPassport(); note('\u2713 Opened your Trip Passport PDF');
      }
    } catch (e) {}
  }
  // If the agent sent us here from another page, apply the carried actions once ready.
  function pickupCarried() {
    var raw; try { raw = sessionStorage.getItem('pb_agent_actions'); } catch (e) { return; }
    if (!raw) return;
    try { sessionStorage.removeItem('pb_agent_actions'); } catch (e) {}
    var acts; try { acts = JSON.parse(raw); } catch (e) { return; }
    if (!acts || !acts.length) return;
    var tries = 0;
    (function wait() {
      if (window.PBTrip) { acts.forEach(function (a) { runAction(window.PBTrip, a); }); return; }
      if (tries++ < 40) setTimeout(wait, 250);
    })();
  }
  function note(text) {
    var d = document.createElement('div'); d.className = 'pbask-act'; d.textContent = text;
    bodyEl.appendChild(d); bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  var bodyEl, inputEl;
  function add(role, text) {
    var d = document.createElement('div');
    d.className = 'pbask-msg ' + (role === 'user' ? 'user' : 'bot');
    d.innerHTML = role === 'user' ? String(text).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) : fmt(text);
    bodyEl.appendChild(d); bodyEl.scrollTop = bodyEl.scrollHeight;
    return d;
  }
  function typing(on) {
    var ex = bodyEl.querySelector('.pbask-typing');
    if (on && !ex) { var t = document.createElement('div'); t.className = 'pbask-typing'; t.innerHTML = '<span></span><span></span><span></span>'; bodyEl.appendChild(t); bodyEl.scrollTop = bodyEl.scrollHeight; }
    else if (!on && ex) ex.remove();
  }

  async function send(text) {
    text = (text || inputEl.value).trim(); if (!text) return;
    inputEl.value = '';
    var sg = bodyEl.querySelector('.pbask-sugs'); if (sg) sg.remove();
    add('user', text);
    history.push({ role: 'user', content: text });
    typing(true);
    try {
      var ctx = {};
      try { if (window.PBTrip) ctx.trip = window.PBTrip.state(); } catch (e) {}
      try { if (window.PBChecklist) ctx.checklist = window.PBChecklist.state(); } catch (e) {}
      var r = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(0, -1), context: ctx }),
      });
      var data = await r.json();
      typing(false);
      var reply = data.reply || data.error || 'Sorry, something went wrong.';
      add('bot', reply);
      if (data.reply) history.push({ role: 'assistant', content: data.reply });
      applyActions(data.actions);
    } catch (e) {
      typing(false);
      add('bot', "I couldn't reach the planner just now. Once the site is deployed with the AI key set, this works live.");
    }
  }

  function greet() {
    add('bot', "Hi! I'm Park Buddy. Tell me what kind of trip you're dreaming of and I'll suggest parks — grounded in real National Park Service info.");
    var wrap = document.createElement('div'); wrap.className = 'pbask-sugs';
    ['Colorado park for fall hiking with kids', "Quiet desert park that's not too hot", 'Best park near Las Vegas for a weekend'].forEach(function (q) {
      var b = document.createElement('button'); b.className = 'pbask-sug'; b.textContent = q;
      b.onclick = function () { send(q); }; wrap.appendChild(b);
    });
    bodyEl.appendChild(wrap);
  }

  function mount() {
    css();
    var fab = document.createElement('button'); fab.className = 'pbask-fab';
    fab.innerHTML = '<span class="spark">\u2728</span> Ask Park Buddy';
    var panel = document.createElement('div'); panel.className = 'pbask-panel';
    panel.innerHTML =
      '<div class="pbask-head"><span class="lg">\uD83E\uDDED</span><div><b>Ask Park Buddy</b><small>AI trip planner \u00b7 real NPS data</small></div><button class="pbask-x" title="Close">\u2715</button></div>' +
      '<div class="pbask-body"></div>' +
      '<div class="pbask-note">Grounded in National Park Service data \u00b7 not live weather</div>' +
      '<div class="pbask-foot"><button class="pbask-mic" title="Speak">\uD83C\uDFA4</button><input type="text" placeholder="Describe your trip\u2026" maxlength="240"><button class="pbask-send" title="Send">\u2191</button></div>';
    document.body.appendChild(fab); document.body.appendChild(panel);
    bodyEl = panel.querySelector('.pbask-body'); inputEl = panel.querySelector('input');

    var opened = false;
    function open() { panel.classList.add('open'); fab.style.display = 'none'; if (!opened) { opened = true; greet(); } inputEl.focus(); }
    function close() { panel.classList.remove('open'); fab.style.display = ''; }
    fab.onclick = open;
    panel.querySelector('.pbask-x').onclick = close;
    panel.querySelector('.pbask-send').onclick = function () { send(); };
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });

    // Voice: browser Web Speech API \u2192 transcribe into the input, then auto-send.
    var mic = panel.querySelector('.pbask-mic');
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { mic.style.display = 'none'; }
    else {
      var rec = null, reclive = false;
      mic.onclick = function () {
        if (reclive) { try { rec.stop(); } catch (e) {} return; }
        rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
        var finalT = ''; reclive = true; mic.classList.add('rec'); var ph = inputEl.placeholder; inputEl.placeholder = 'Listening\u2026';
        rec.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalT += e.results[i][0].transcript; } inputEl.value = t; };
        rec.onerror = function () { reclive = false; mic.classList.remove('rec'); inputEl.placeholder = ph; };
        rec.onend = function () { reclive = false; mic.classList.remove('rec'); inputEl.placeholder = ph; var v = (finalT || inputEl.value).trim(); if (v) { inputEl.value = v; send(); } };
        try { rec.start(); } catch (e) { reclive = false; mic.classList.remove('rec'); inputEl.placeholder = ph; }
      };
    }
  }

  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  pickupCarried();
})();
