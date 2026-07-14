/* Park Buddy — "Ask Park Buddy" AI trip-planning widget.
   A floating chat button + panel that POSTs to /api/agent (the server-side
   NPS-grounded agent). Plain web component, Park Buddy dark theme, no build step.
   Drop <script src="/ask-parkbuddy.js"></script> on any page and it mounts. */
(function () {
  if (window.__pbAsk) return;
  window.__pbAsk = true;

  // Park Buddy design system (globals.css tokens): dark forest + champagne gold,
  // Cormorant Garamond display serif, Inter body, Space Mono micro-labels.
  var GOLD = '#e8cf9a', GOLD2 = '#c9a35f', GOLDSOFT = '#d9b779',
      BG = '#0a1712', SURFACE = '#0b1710', SURFACE2 = '#0e2016',
      INK = '#f4f1ea', INK2 = '#aab0ba', MUTED = '#7f8a82', GREEN = '#8fd6a6',
      LINE = 'rgba(217,183,121,0.16)', LINE2 = 'rgba(217,183,121,0.30)';
  var SANS = "var(--pb-sans,'Inter',system-ui,sans-serif)",
      SERIF = "var(--pb-serif,'Cormorant Garamond',Georgia,serif)",
      MONO = "var(--pb-mono,'Space Mono',ui-monospace,monospace)";

  // The Park Buddy brand mark used everywhere: a dark (forest) pine inside a gold box
  // (see app/components/SiteHeader.jsx Logo). Same SVG path so it matches 1:1.
  function pineSvg(px) {
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="' + BG + '" aria-hidden="true"><path d="M12 2l5 9h-3l5 9H5l5-9H7z"/><rect x="11" y="18" width="2" height="4"/></svg>';
  }

  var history = []; // [{role, content}]

  // --- Voice: live speech-in (transcribe as you talk) + speech-out (read replies back) ---
  var ttsOn = true; try { ttsOn = localStorage.getItem('pb_ask_tts') !== '0'; } catch (e) {}
  var voiceMode = false;   // the current turn came from the mic → speak the reply + re-listen (hands-free)
  var panelOpen = false;
  var startListen = function () {}; // real impl assigned in mount() once the DOM exists
  var pickedVoice = null;
  function loadVoice() {
    try {
      if (!window.speechSynthesis) return;
      var vs = window.speechSynthesis.getVoices() || [];
      pickedVoice = vs.filter(function (v) { return /^en(-|_)US/i.test(v.lang); })
        .sort(function (a, b) { return (/natural|samantha|google|aria|jenny/i.test(b.name) ? 1 : 0) - (/natural|samantha|google|aria|jenny/i.test(a.name) ? 1 : 0); })[0]
        || vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
    } catch (e) {}
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadVoice();
    try { window.speechSynthesis.onvoiceschanged = loadVoice; } catch (e) {}
  }
  // Strip the light markdown so it reads naturally aloud.
  function forSpeech(t) { return String(t).replace(/\*\*/g, '').replace(/^\s*[-*]\s+/gm, '').replace(/[#_`>]/g, '').replace(/\s+/g, ' ').trim(); }
  function speak(text, after) {
    if (!ttsOn || !window.speechSynthesis) { if (after) after(); return; }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(forSpeech(text).slice(0, 650));
      u.lang = 'en-US'; u.rate = 1.03; u.pitch = 1;
      if (pickedVoice) u.voice = pickedVoice;
      u.onend = function () { if (after) after(); };
      u.onerror = function () { if (after) after(); };
      window.speechSynthesis.speak(u);
    } catch (e) { if (after) after(); }
  }
  function stopSpeaking() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }

  function css() {
    if (document.getElementById('pbask-css')) return;
    var s = document.createElement('style'); s.id = 'pbask-css';
    s.textContent =
      '.pbask-fab{position:fixed;right:18px;bottom:18px;z-index:99000;display:flex;align-items:center;gap:9px;background:linear-gradient(150deg,#123822,' + BG + ');color:' + INK + ';border:1px solid ' + LINE2 + ';border-radius:999px;padding:13px 18px;font-family:' + SANS + ';font-weight:600;font-size:.9rem;cursor:pointer;box-shadow:0 16px 40px -14px rgba(0,0,0,.7)}' +
      '.pbask-fab .pbask-mark{width:24px;height:24px;flex:none;border-radius:7px;background:linear-gradient(120deg,' + GOLD + ',' + GOLD2 + ');display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(217,183,121,.4)}' +
      '.pbask-panel{position:fixed;right:18px;bottom:18px;z-index:99001;width:min(390px,calc(100vw - 28px));height:min(580px,calc(100vh - 36px));background:' + SURFACE + ';border:1px solid ' + LINE + ';border-radius:22px;box-shadow:0 40px 100px -40px rgba(0,0,0,.9);display:none;flex-direction:column;overflow:hidden;font-family:' + SANS + '}' +
      '.pbask-panel.open{display:flex}' +
      '.pbask-head{background:linear-gradient(135deg,' + SURFACE2 + ',' + BG + ');color:' + INK + ';padding:15px 17px;display:flex;align-items:center;gap:11px;border-bottom:1px solid ' + LINE + '}' +
      '.pbask-head .lg{width:34px;height:34px;flex:none;border-radius:9px;background:linear-gradient(120deg,' + GOLD + ',' + GOLD2 + ');box-shadow:0 0 18px rgba(217,183,121,.35);display:flex;align-items:center;justify-content:center}' +
      '.pbask-head b{font-family:' + SERIF + ';font-weight:600;font-size:1.28rem;line-height:1.05;display:block;color:' + INK + ';letter-spacing:.01em}' +
      '.pbask-head small{color:' + MUTED + ';font-family:' + MONO + ';font-size:.6rem;letter-spacing:.14em;text-transform:uppercase}' +
      '.pbask-x{background:rgba(255,255,255,.06);border:1px solid ' + LINE + ';color:' + INK2 + ';width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:.95rem}' +
      '.pbask-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:11px;background:' + BG + '}' +
      '.pbask-msg{max-width:86%;padding:11px 14px;border-radius:16px;font-size:.9rem;line-height:1.55;word-break:break-word;overflow-wrap:anywhere}' +
      '.pbask-msg.bot{align-self:flex-start;background:rgba(255,255,255,.03);border:1px solid ' + LINE + ';color:' + INK + ';border-bottom-left-radius:5px}' +
      '.pbask-msg.bot>div+div{margin-top:8px}' +               // breathing room between paragraphs
      '.pbask-msg.bot>div+ul,.pbask-msg.bot ul+div{margin-top:8px}' +
      '.pbask-msg.user{align-self:flex-end;background:' + 'linear-gradient(135deg,' + GOLD + ',' + GOLD2 + ');color:' + BG + ';font-weight:500;border-bottom-right-radius:5px}' +
      // Live "you are speaking" bubble: fully readable, pulsing gold ring, grows to show
      // the WHOLE message as you talk, with a clear listening label.
      '.pbask-msg.user.live{max-width:92%;opacity:1;font-style:normal;animation:pbasklive 1.4s ease-in-out infinite}' +
      '@keyframes pbasklive{0%,100%{box-shadow:0 0 0 2px rgba(232,207,154,.3)}50%{box-shadow:0 0 0 2px rgba(232,207,154,.8)}}' +
      '.pbask-msg.user.live::after{content:"\\1F3A4 Listening\\2026";display:block;font-family:' + MONO + ';font-size:.58rem;font-weight:700;letter-spacing:.08em;opacity:.85;margin-top:6px}' +
      '.pbask-spk{margin-left:auto;background:rgba(255,255,255,.06);border:1px solid ' + LINE + ';color:' + INK2 + ';width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:.9rem}' +
      '.pbask-spk.off{opacity:.5}' +
      '.pbask-msg b{color:' + GOLD + '}.pbask-msg.user b{color:' + BG + '}.pbask-msg ul{margin:6px 0 0;padding-left:18px}.pbask-msg li{margin:3px 0}' +
      '.pbask-sugs{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}' +
      '.pbask-sug{background:rgba(255,255,255,.03);border:1px solid ' + LINE + ';color:' + GOLD + ';font-family:' + SANS + ';font-weight:600;font-size:.78rem;padding:8px 12px;border-radius:999px;cursor:pointer;text-align:left}' +
      '.pbask-sug:hover{border-color:' + LINE2 + ';background:rgba(232,207,154,.06)}' +
      '.pbask-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 15px;background:rgba(255,255,255,.03);border:1px solid ' + LINE + ';border-radius:15px}' +
      '.pbask-typing span{width:7px;height:7px;border-radius:50%;background:' + GOLD + ';animation:pbaskb 1s infinite}' +
      '.pbask-typing span:nth-child(2){animation-delay:.15s}.pbask-typing span:nth-child(3){animation-delay:.3s}' +
      '@keyframes pbaskb{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}' +
      '.pbask-foot{border-top:1px solid ' + LINE + ';padding:11px;display:flex;gap:8px;background:' + SURFACE + '}' +
      '.pbask-mic{flex:none;border:1px solid ' + LINE2 + ';border-radius:12px;background:rgba(255,255,255,.04);color:' + GOLD + ';font-size:1.05rem;width:44px;cursor:pointer}' +
      '.pbask-mic.rec{background:#c0473a;border-color:#c0473a;color:#fff;animation:pbaskrec 1.1s infinite}' +
      '@keyframes pbaskrec{0%{box-shadow:0 0 0 0 rgba(192,71,58,.5)}70%{box-shadow:0 0 0 8px rgba(192,71,58,0)}100%{box-shadow:0 0 0 0 rgba(192,71,58,0)}}' +
      '.pbask-act{align-self:flex-start;display:inline-flex;align-items:center;gap:7px;background:rgba(143,214,166,.1);border:1px solid rgba(143,214,166,.3);color:' + GREEN + ';font-family:' + MONO + ';font-size:.68rem;letter-spacing:.04em;font-weight:700;padding:8px 12px;border-radius:11px}' +
      '.pbask-foot input{flex:1;min-width:0;border:1px solid ' + LINE2 + ';border-radius:12px;padding:11px 13px;font-family:' + SANS + ';font-size:.9rem;color:' + INK + ';background:rgba(255,255,255,.04);outline:none;color-scheme:dark}' +
      '.pbask-foot input::placeholder{color:' + MUTED + '}' +
      '.pbask-foot input:focus{border-color:' + GOLD + ';box-shadow:0 0 0 3px rgba(232,207,154,.16)}' +
      '.pbask-send{flex:none;border:none;border-radius:12px;background:linear-gradient(120deg,' + GOLD + ',' + GOLD2 + ');color:' + BG + ';font-size:1.1rem;width:44px;cursor:pointer;box-shadow:0 6px 18px -8px rgba(217,183,121,.6)}' +
      '.pbask-note{font-size:.62rem;font-family:' + MONO + ';letter-spacing:.06em;color:' + MUTED + ';text-align:center;padding:0 0 8px;background:' + SURFACE + '}';
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
  // Group added checklist items by their section for clear "added to Pack / Do" feedback.
  var SECT = { pack: '🎒 Pack', grab: '🛒 Grab', do: '📍 Do' };
  function sectionSummary(addedItems) {
    var by = { pack: [], grab: [], do: [] };
    (addedItems || []).forEach(function (i) { (by[i.cat] || by.pack).push(i.label); });
    return ['pack', 'grab', 'do'].filter(function (c) { return by[c].length; })
      .map(function (c) { return SECT[c] + ': ' + by[c].join(', '); }).join('  ·  ');
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
        if (window.PBChecklist) {
          var rc = window.PBChecklist.addItems(inp.items || []);
          window.PBChecklist.open();
          var summ = sectionSummary(rc.addedItems);
          note(summ ? '\u2713 Added to your list \u2014 ' + summ : '\u2713 Those were already on your list');
        } else { note('\u2715 Open the \u201cBuild a Trip\u201d page to add these to your Pack & Go list.'); }
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

  async function send(text, fromVoice) {
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
      // Voice turn → read the reply back, then re-open the mic for a hands-free
      // back-and-forth (until the user taps stop or closes the panel).
      if (fromVoice) speak(reply, function () { if (voiceMode && panelOpen) startListen(); });
    } catch (e) {
      typing(false);
      var errMsg = "I couldn't reach the planner just now. Once the site is deployed with the AI key set, this works live.";
      add('bot', errMsg);
      if (fromVoice) { voiceMode = false; speak(errMsg); }
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
    fab.innerHTML = '<span class="pbask-mark">' + pineSvg(14) + '</span> Ask Park Buddy';
    var panel = document.createElement('div'); panel.className = 'pbask-panel';
    panel.innerHTML =
      '<div class="pbask-head"><span class="lg">' + pineSvg(17) + '</span><div><b>Ask Park Buddy</b><small>AI trip planner \u00b7 real NPS data</small></div><button class="pbask-spk' + (ttsOn ? '' : ' off') + '" title="Read replies aloud">' + (ttsOn ? '\uD83D\uDD0A' : '\uD83D\uDD07') + '</button><button class="pbask-x" title="Close">\u2715</button></div>' +
      '<div class="pbask-body"></div>' +
      '<div class="pbask-note">Grounded in National Park Service data \u00b7 not live weather</div>' +
      '<div class="pbask-foot"><button class="pbask-mic" title="Speak">\uD83C\uDFA4</button><input type="text" placeholder="Describe your trip\u2026" maxlength="240"><button class="pbask-send" title="Send">\u2191</button></div>';
    document.body.appendChild(fab); document.body.appendChild(panel);
    bodyEl = panel.querySelector('.pbask-body'); inputEl = panel.querySelector('input');

    var opened = false;
    function open() { panelOpen = true; panel.classList.add('open'); fab.style.display = 'none'; if (!opened) { opened = true; greet(); } inputEl.focus(); }
    function close() { panelOpen = false; voiceMode = false; stopSpeaking(); try { stopListen(); } catch (e) {} panel.classList.remove('open'); fab.style.display = ''; }
    fab.onclick = open;
    panel.querySelector('.pbask-x').onclick = close;
    panel.querySelector('.pbask-send').onclick = function () { stopSpeaking(); send(); };
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); stopSpeaking(); send(); } });

    // Speaker toggle \u2014 read replies aloud on/off (remembered).
    var spk = panel.querySelector('.pbask-spk');
    spk.onclick = function () {
      ttsOn = !ttsOn; try { localStorage.setItem('pb_ask_tts', ttsOn ? '1' : '0'); } catch (e) {}
      spk.classList.toggle('off', !ttsOn); spk.textContent = ttsOn ? '\ud83d\udd0a' : '\ud83d\udd07';
      if (!ttsOn) stopSpeaking();
    };

    // Voice-in: browser Web Speech API. Shows a LIVE user bubble that fills in with the
    // words as you speak (interim results), auto-stops after a beat of silence, then sends.
    var mic = panel.querySelector('.pbask-mic');
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = null, reclive = false, liveBubble = null, silenceT = null, finalT = '';
    var stopListen = function () { voiceMode = false; if (rec) { try { rec.stop(); } catch (e) {} } };
    if (!SR) { mic.style.display = 'none'; }
    else {
      startListen = function () {
        if (reclive) return;
        stopSpeaking(); // barge-in: if the bot is talking, listening cuts it off
        try { rec = new SR(); } catch (e) { return; }
        rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
        finalT = ''; reclive = true; voiceMode = true; mic.classList.add('rec');
        liveBubble = add('user', ''); liveBubble.classList.add('live'); liveBubble.textContent = '\u2026';
        // Auto-stop after a beat of silence: a longer grace before the first words, a
        // shorter gap once you've started, so it neither cuts you off nor hangs open.
        var armSilence = function (ms) { clearTimeout(silenceT); silenceT = setTimeout(function () { try { rec.stop(); } catch (e) {} }, ms || 1700); };
        rec.onresult = function (e) {
          var interim = '';
          for (var i = e.resultIndex; i < e.results.length; i++) { var res = e.results[i]; if (res.isFinal) finalT += res[0].transcript; else interim += res[0].transcript; }
          var shown = (finalT + ' ' + interim).trim();
          if (liveBubble) liveBubble.textContent = shown || '\u2026';
          bodyEl.scrollTop = bodyEl.scrollHeight;
          armSilence(1700);
        };
        rec.onerror = function (ev) {
          reclive = false; mic.classList.remove('rec'); clearTimeout(silenceT);
          if (liveBubble) { liveBubble.remove(); liveBubble = null; }
          if (ev && ev.error === 'not-allowed') { voiceMode = false; note('\ud83c\udfa4 Allow microphone access in your browser to talk to Park Buddy.'); }
          else if (ev && ev.error !== 'no-speech' && ev.error !== 'aborted') { voiceMode = false; }
        };
        rec.onend = function () {
          reclive = false; mic.classList.remove('rec'); clearTimeout(silenceT);
          if (liveBubble) { liveBubble.remove(); liveBubble = null; }
          var v = finalT.trim();
          if (v) send(v, true); else voiceMode = false;
        };
        try { rec.start(); armSilence(6000); } catch (e) { reclive = false; voiceMode = false; mic.classList.remove('rec'); if (liveBubble) { liveBubble.remove(); liveBubble = null; } }
      };
      mic.onclick = function () { if (reclive) stopListen(); else startListen(); };
    }

    // Public API so ANY mic on the site (e.g. Trip Studio's Pack & Go) hands the voice
    // conversation to THIS chat instead of running its own speech engine — one voice home.
    window.PBAsk = {
      open: function () { open(); },
      openAndListen: function () {
        open();
        if (!SR) { note('🎤 Voice needs a supported browser — you can type here instead.'); return; }
        // let the panel paint, then start listening + drop a "here's what I can do" cue
        setTimeout(function () { note('🎤 Listening… tell me what to add or where to go.'); startListen(); }, 180);
      },
      ask: function (text) { open(); setTimeout(function () { stopSpeaking(); send(text); }, 150); },
    };
    // Also honor an event, in case a caller fires before this script finished mounting.
    window.addEventListener('pb:ask-open-voice', function () { window.PBAsk.openAndListen(); });
  }

  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  pickupCarried();
})();
