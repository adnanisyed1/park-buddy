/* ParkBuddy — Commerce engines (Gear + Lodging).
   Self-contained: injects the conditions-driven "What to bring" gear rail into the
   Park Status "Now" tab and "Where to stay" lodging into the "Plan a visit" tab.
   Both fire one shared track() event. Matches the teal theme. Loaded on park-status. */
(function () {
  if (window.__pbCommerce) return;
  window.__pbCommerce = true;

  var GEAR = [
    { ph: 'insulated jacket', br: 'REI Co-op', nm: '650-Down Hooded Jacket', why: '\u2744 For the cold dawn start', price: '$189', partner: 'REI', sku: 'down-jacket', via: 'via REI' },
    { ph: 'trail boots', br: 'Merrell', nm: 'Moab 3 Waterproof Boot', why: '\uD83D\uDCA6 Trails muddy after rain', price: '$145', partner: 'REI', sku: 'wp-boots', via: 'via REI' },
    { ph: 'sun hoodie', br: 'Outdoor Research', nm: 'Echo Sun Hoodie \u00b7 UPF 50', why: '\u2600 High UV midday in the open', price: '$65', partner: 'Amazon', sku: 'sun-hoodie', via: 'via Amazon' },
    { ph: 'water reservoir', br: 'CamelBak', nm: 'Crux 3L Reservoir', why: '\uD83C\uDFDC Dry air \u2014 carry extra water', price: '$38', partner: 'REI', sku: 'reservoir', via: 'via REI' }
  ];
  var STAYS = [
    { ph: 'lodge \u00b7 canyon view', tag: 'In-park \u00b7 0.0 mi', inpark: 1, nm: 'Park Lodge', meta: 'Historic in-park lodge \u00b7 shuttle stop', why: '\uD83D\uDCCD Wake up inside the park', price: '$239', partner: 'Booking.com', sku: 'park-lodge', via: 'via Booking.com', cta: 'Book' },
    { ph: 'hotel \u00b7 riverside', tag: '1.1 mi', nm: 'Riverside Inn', meta: 'Walk to the entrance \u00b7 pool', why: '\uD83D\uDEB6 Skip the parking scramble', price: '$312', partner: 'Stay22', sku: 'riverside', via: 'via Stay22', cta: 'Book' },
    { ph: 'campground', tag: 'In-park \u00b7 0.5 mi', inpark: 1, nm: 'Watchman Campground', meta: 'Reservable \u00b7 electric & tent sites', why: '\u2744 Pack warm \u2014 cold overnight lows', price: '$35', partner: 'Recreation.gov', sku: 'campground', via: 'via Recreation.gov', cta: 'Reserve' }
  ];

  function css() {
    if (document.getElementById('pbc-css')) return;
    var s = document.createElement('style'); s.id = 'pbc-css';
    s.textContent =
      ".pbc-mod{grid-column:1/-1;position:relative;background:#fffdf7;border:1px solid #e7ddca;border-radius:20px;padding:18px;box-shadow:0 18px 44px -22px rgba(28,46,34,.45),0 2px 6px rgba(28,46,34,.06);font-family:'Hanken Grotesk',system-ui,sans-serif}" +
      ".pbc-h{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}" +
      ".pbc-h .ey{font-size:.66rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#c79a4b;margin-bottom:5px}" +
      ".pbc-h .ttl{font-family:'Spectral',serif;font-weight:700;font-size:1.28rem;color:#1d3941;line-height:1.1}.pbc-h .ttl em{font-style:italic;color:#2c5562}" +
      ".pbc-h .sub{font-size:.82rem;color:#5b6258;margin-top:4px;line-height:1.45;max-width:58ch}" +
      ".pbc-aff{font-size:.64rem;font-weight:700;color:#a98a4e;background:rgba(199,154,75,.12);border:1px solid rgba(199,154,75,.32);padding:6px 11px;border-radius:999px;white-space:nowrap;align-self:flex-start}" +
      ".pbc-rail{display:flex;gap:13px;overflow-x:auto;padding:2px 2px 12px}" +
      ".pbc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(216px,1fr));gap:13px}" +
      ".pbc-card{flex:none;width:210px;background:#fff;border:1px solid #e7ddca;border-radius:15px;overflow:hidden;box-shadow:0 14px 34px -24px rgba(28,46,34,.45);display:flex;flex-direction:column;transition:transform .25s,box-shadow .25s}" +
      ".pbc-grid .pbc-card{width:auto}" +
      ".pbc-card:hover{transform:translateY(-6px);box-shadow:0 24px 50px -26px rgba(28,46,34,.55)}" +
      ".pbc-ph{position:relative;height:120px;background:repeating-linear-gradient(135deg,#e7eceb 0 11px,#dfe6e4 11px 22px);display:flex;align-items:flex-end}" +
      ".pbc-ph .l{position:relative;z-index:1;font-family:ui-monospace,Menlo,monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:#7c8a86;background:rgba(255,255,255,.72);padding:3px 7px;border-radius:6px;margin:8px}" +
      ".pbc-ph .bg{position:absolute;z-index:2;top:8px;left:8px;font-size:.58rem;font-weight:800;background:rgba(16,32,23,.6);color:#fbf6ea;padding:5px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.18)}" +
      ".pbc-ph .bg.in{background:linear-gradient(120deg,#2f7d4f,#1d4a37)}" +
      ".pbc-b{padding:11px 12px 13px;display:flex;flex-direction:column;flex:1}" +
      ".pbc-b .br{font-size:.58rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8c8473}" +
      ".pbc-b .tr{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}" +
      ".pbc-b h4{font-family:'Spectral',serif;font-weight:700;font-size:1rem;color:#1d3941;line-height:1.16;margin:3px 0 4px}" +
      ".pbc-rate{flex:none;font-size:.72rem;font-weight:800;color:#9a6f28}" +
      ".pbc-meta{font-size:.72rem;color:#8c8473;font-weight:600;margin-bottom:9px}" +
      ".pbc-why{display:inline-flex;align-items:flex-start;gap:6px;background:rgba(199,154,75,.13);border:1px solid rgba(199,154,75,.3);color:#9a6f28;font-size:.68rem;font-weight:700;line-height:1.3;padding:6px 9px;border-radius:9px;margin-bottom:10px}" +
      ".pbc-ft{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".pbc-pr{font-family:'Spectral',serif;font-weight:700;font-size:1.08rem;color:#2c5562}.pbc-pr small{font-size:.66rem;color:#8c8473;font-weight:600;font-family:inherit}" +
      ".pbc-buy{display:inline-flex;align-items:center;gap:5px;border:none;font-family:inherit;font-size:.75rem;font-weight:700;padding:8px 13px;border-radius:9px;cursor:pointer;text-decoration:none;background:#2c5562;color:#fff;box-shadow:0 3px 0 #16303a;transition:transform .12s,box-shadow .12s}" +
      ".pbc-buy:active{transform:translateY(2px);box-shadow:0 1px 0 #16303a}" +
      ".pbc-buy.gold{background:linear-gradient(120deg,#e4be78,#c79a4b);color:#15241c;box-shadow:0 3px 0 #9c7330}.pbc-buy.gold:active{box-shadow:0 1px 0 #9c7330}" +
      ".pbc-via{font-size:.58rem;color:#8c8473;font-weight:600;text-align:right;margin-top:6px}" +
      ".pbc-trust{grid-column:1/-1;text-align:center;font-size:.78rem;color:#7c8473;padding:6px 0 2px}.pbc-trust b{color:#1d4a37}" +
      ".pbc-signup{margin-top:14px;background:linear-gradient(150deg,#33555f,#1d3941);border:1px solid rgba(228,190,120,.3);border-radius:16px;padding:18px 20px;color:#fbf6ea}" +
      ".pbc-su-h{font-family:'Spectral',serif;font-weight:700;font-size:1.12rem}.pbc-su-h b{color:#e4be78}.pbc-su-sub{font-size:.84rem;color:rgba(251,246,234,.78);margin-top:3px}" +
      ".pbc-form{display:flex;flex-wrap:wrap;gap:9px;margin-top:13px}.pbc-in{flex:1;min-width:130px;padding:11px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fbf6ea;font-family:inherit;font-size:.88rem;outline:none}.pbc-in::placeholder{color:rgba(251,246,234,.55)}.pbc-in:focus{border-color:#e4be78;background:rgba(255,255,255,.16)}" +
      ".pbc-su-btn{flex:none;border:none}.pbc-msg{font-size:.82rem;color:#9fe3a6;font-weight:700;margin-top:9px}";
    document.head.appendChild(s);
  }

  function gearCard(g) {
    return '<article class="pbc-card" data-eng="gear" data-partner="' + g.partner + '" data-sku="' + g.sku + '" data-url="' + (g.url || '') + '">' +
      '<div class="pbc-ph"><span class="l">' + g.ph + '</span></div>' +
      '<div class="pbc-b"><div class="br">' + g.br + '</div><h4>' + g.nm + '</h4>' +
      '<div class="pbc-why">' + g.why + '</div>' +
      '<div class="pbc-ft"><span class="pbc-pr">' + g.price + '</span><a class="pbc-buy" href="#">Buy \u2192</a></div>' +
      '<div class="pbc-via">' + g.via + '</div></div></article>';
  }
  function stayCard(s) {
    return '<article class="pbc-card" data-eng="lodging" data-partner="' + s.partner + '" data-sku="' + s.sku + '" data-url="' + (s.url || '') + '">' +
      '<div class="pbc-ph"><span class="bg' + (s.inpark ? ' in' : '') + '">' + s.tag + '</span><span class="l">' + s.ph + '</span></div>' +
      '<div class="pbc-b"><div class="tr"><h4>' + s.nm + '</h4></div><div class="pbc-meta">' + s.meta + '</div>' +
      '<div class="pbc-why">' + s.why + '</div>' +
      '<div class="pbc-ft"><span class="pbc-pr">' + s.price + '<small>/nt</small></span><a class="pbc-buy gold" href="#">' + s.cta + ' \u2192</a></div>' +
      '<div class="pbc-via">' + s.via + '</div></div></article>';
  }

  function gearModule(parkName) {
    return '<div class="pbc-mod" data-pbc="gear">' +
      '<div class="pbc-h"><div><div class="ey">What to bring \u00b7 gear</div>' +
      '<div class="ttl">Gear for <em>' + (parkName ? parkName + '\u2019s' : 'today\u2019s') + ' conditions</em></div>' +
      '<div class="sub">Tuned to the live forecast above \u2014 not a generic catalog.</div></div>' +
      '<span class="pbc-aff">Affiliate \u00b7 earn on a sale</span></div>' +
      '<div class="pbc-rail">' + GEAR.map(gearCard).join('') + '</div></div>';
  }
  function signupBlock() {
    return '<div class="pbc-signup"><div class="pbc-su-l"><div class="pbc-su-h">Run a lodge, cabin or campground? <b>List it with us.</b></div>' +
      '<div class="pbc-su-sub">Free to list \u2014 you only pay on a booking we send your way.</div></div>' +
      '<form class="pbc-form"><input class="pbc-in" placeholder="Property name" data-f="name"><input class="pbc-in" placeholder="Park or town" data-f="loc"><input class="pbc-in" type="email" placeholder="Email" data-f="email"><button type="submit" class="pbc-buy gold pbc-su-btn">List your stay \u2192</button></form>' +
      '<div class="pbc-msg"></div></div>';
  }
  function stayModule(parkName, kind) {
    return '<div class="pbc-mod" data-pbc="' + (kind || 'lodging') + '">' +
      '<div class="pbc-h"><div><div class="ey">Where to stay \u00b7 lodging</div>' +
      '<div class="ttl">Stays near <em>' + (parkName || 'the park') + '</em></div>' +
      '<div class="sub">Closest first \u2014 book direct, we earn only on a confirmed stay.</div></div>' +
      '<span class="pbc-aff">Commission on booking</span></div>' +
      '<div class="pbc-grid">' + STAYS.map(stayCard).join('') +
      '<div class="pbc-trust"><b>Free for travelers, always.</b> Every pick serves the trip first.</div></div>' +
      signupBlock() + '</div>';
  }

  function track(eng, partner, sku) {
    var ctx = {};
    try {
      ctx = { park: (document.getElementById('pname') || {}).textContent, verdict: (document.getElementById('stState') || {}).textContent, temp: (document.getElementById('heroTemp') || {}).textContent };
    } catch (e) {}
    try { console.log('[pb-commerce] outbound', { ts: Date.now(), engine: eng, partner: partner, sku: sku, context: ctx }); } catch (e) {}
    var t = document.getElementById('toast');
    if (t) { t.textContent = 'Tracked: ' + eng + ' \u00b7 ' + partner; t.classList.add('show'); clearTimeout(t._pbt); t._pbt = setTimeout(function () { t.classList.remove('show'); }, 2200); }
  }
  function wire(root) {
    [].slice.call(root.querySelectorAll('.pbc-card')).forEach(function (c) {
      var eng = c.getAttribute('data-eng'), p = c.getAttribute('data-partner'), s = c.getAttribute('data-sku'), url = c.getAttribute('data-url');
      [].slice.call(c.querySelectorAll('.pbc-buy')).forEach(function (b) {
        if (url) { b.setAttribute('href', url); b.setAttribute('target', '_blank'); b.setAttribute('rel', 'noopener sponsored'); }
        b.addEventListener('click', function (e) { track(eng, p, s); if (!url) { e.preventDefault(); } });
      });
    });
  }

  function wireSignup(root) {
    [].slice.call(root.querySelectorAll('.pbc-form')).forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (f.querySelector('[data-f="name"]') || {}).value, email = (f.querySelector('[data-f="email"]') || {}).value;
        var msg = f.parentNode.querySelector('.pbc-msg');
        if (!name || !email) { if (msg) { msg.style.color = '#f3c9a0'; msg.textContent = 'Add your property name and email.'; } return; }
        try { console.log('[pb-commerce] lodge-signup', { ts: Date.now(), name: name, loc: (f.querySelector('[data-f="loc"]') || {}).value, email: email }); } catch (err) {}
        if (msg) { msg.style.color = '#9fe3a6'; msg.textContent = '\u2713 Thanks \u2014 we\u2019ll be in touch to get ' + name + ' listed.'; }
        f.reset();
      });
    });
  }

  function inject() {
    var now = document.getElementById('pane-now');
    var visit = document.getElementById('pane-visit');
    if (!now && !visit) return false;
    if (document.querySelector('[data-pbc]')) return true;
    css();
    var parkName = (document.getElementById('pname') || {}).textContent || '';
    parkName = (parkName === '\u2014') ? '' : parkName;
    if (now) now.insertAdjacentHTML('beforeend', gearModule(parkName));
    if (visit) visit.insertAdjacentHTML('afterbegin', stayModule(parkName));
    wire(document); wireSignup(document);
    return true;
  }

  // Build-a-Trip: a "Where to stay on your trip" module + lodge signup, under the builder.
  function injectBuildTrip() {
    var builder = document.querySelector('.builder');
    if (!builder) return false;
    if (document.querySelector('[data-pbc="lodging-trip"]')) return true;
    css();
    var wrap = document.createElement('section');
    wrap.style.cssText = 'max-width:1320px;margin:0 auto;padding:4px clamp(16px,3vw,28px) 46px';
    wrap.innerHTML = stayModule('your stops', 'lodging-trip');
    builder.parentNode.insertBefore(wrap, builder.nextSibling);
    wire(wrap); wireSignup(wrap);
    return true;
  }

  function boot() { return inject() || injectBuildTrip(); }
  (function start() {
    var done = false; function go() { if (done) return; done = true; boot(); }
    function apply(d) { if (d) { if (d.gear && d.gear.length) GEAR = d.gear; if (d.stays && d.stays.length) STAYS = d.stays; } go(); }
    try { fetch('/products.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(apply, function () { go(); }); } catch (e) { go(); }
    setTimeout(go, 2000);
  })();
})();
