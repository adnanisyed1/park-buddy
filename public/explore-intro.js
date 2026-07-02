/* ParkBuddy — Bento launcher home. The home IS this cover, sitting over the live
   verdict map. Tiles either REVEAL the map in-place (lift the cover) or EXPAND into
   their own page via the smooth transition. A home button brings the bento back.
   Self-contained; loaded on the Explore (index) page only. */
(function () {
  if (window.__ppExploreIntro) return;
  window.__ppExploreIntro = true;

  var SERIF = "'Spectral',Georgia,serif";
  var SANS = "'Hanken Grotesk',system-ui,sans-serif";

  var navigating = false;
  function go(href) {
    if (navigating) return; // bug 3: block double-navigation / double transition
    navigating = true;
    if (window.__ppTrans && window.__ppTrans.go) window.__ppTrans.go(href);
    else location.href = href;
  }

  function openSignin() {
    if (window.__ppAuth && window.__ppAuth.openAccount) { window.__ppAuth.openAccount(); }
    else if (window.__ppAuth && window.__ppAuth.showWelcome) { window.__ppAuth.showWelcome(); }
    else if (typeof toast === 'function') { toast('Sign-in is available on the published site.'); }
  }

  // tiles: act 'map' = reveal map in-place · 'near' = reveal + locate ·
  // 'passport' = passport overlay · otherwise navigate to href.
  var TILES = [
    { k: 'explore', big: 1, ic: '🗺️', h: 'Explore the map', p: "All 63 parks, each pin coloured by today's go / no-go call.", act: 'map' },
    { k: 'status', ic: '🌤️', h: 'Live park status', p: 'Weather, alerts & the verdict for any park.', act: 'map' },
    { k: 'near', ic: '📍', h: 'Parks near me', p: 'Find the best parks around you, right now.', act: 'near' },
    { k: 'build', ic: '🧭', h: 'Build a trip', p: 'Real-road routes, dates & costs.', href: '/build-trip' },
    { k: 'plan', ic: '📋', h: 'Plan a trip', p: "Not sure where? Answer a few questions.", href: '/plan' },
    { k: 'passport', ic: '🛂', h: 'Trip passport', p: 'Collect a stamp for every park you visit.', act: 'passport' },
    { k: 'about', ic: '📖', h: 'About', p: 'Everything ParkBuddy does, in one place.', act: 'about', href: '/about' }
  ];

  function styles() {
    if (document.getElementById('ex-bento-kf')) return;
    var s = document.createElement('style');
    s.id = 'ex-bento-kf';
    s.textContent =
      "@keyframes exb-sun{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.06);opacity:1}}" +
      "@keyframes exb-drift{from{transform:translateX(-20vw)}to{transform:translateX(120vw)}}" +
      "@keyframes exb-rise{from{transform:translateY(20px)}to{transform:translateY(0)}}" +
      "@keyframes exb-pulse{0%{box-shadow:0 0 0 0 rgba(70,217,127,.5)}70%{box-shadow:0 0 0 8px rgba(70,217,127,0)}100%{box-shadow:0 0 0 0 rgba(70,217,127,0)}}" +
      "@keyframes exb-shim{0%,55%{transform:translateX(-130%)}80%,100%{transform:translateX(130%)}}" +
      "#ex-bento .exb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;max-width:920px;width:100%;margin:30px auto 0}" +
      "#ex-bento .exb-tile{grid-column:span 1}" +
      "#ex-bento .exb-tile.big{grid-column:span 2;grid-row:span 2}" +
      "#ex-bento .exb-tile{position:relative;overflow:hidden;text-align:left;cursor:pointer;border:1px solid rgba(255,255,255,.5);" +
        "background:rgba(251,246,234,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-radius:20px;padding:17px 18px;" +
        "display:flex;flex-direction:column;justify-content:space-between;min-height:104px;color:#15241c;font-family:" + SANS + ";" +
        "box-shadow:0 16px 40px rgba(8,16,12,.32);transition:transform .3s cubic-bezier(.2,.8,.3,1),box-shadow .3s;animation:exb-rise .6s ease both}" +
      "#ex-bento .exb-tile:hover{transform:translateY(-6px);box-shadow:0 28px 60px rgba(8,16,12,.46)}" +
      "#ex-bento .exb-tile .exb-ic{font-size:1.5rem;line-height:1}" +
      "#ex-bento .exb-tile.big .exb-ic{font-size:2rem}" +
      "#ex-bento .exb-tile h3{font-family:" + SERIF + ";font-weight:700;font-size:1.12rem;color:#163a2b;letter-spacing:-.01em;margin-top:10px}" +
      "#ex-bento .exb-tile.big h3{font-size:1.7rem}" +
      "#ex-bento .exb-tile p{font-size:.78rem;color:#5e6557;line-height:1.4;margin-top:3px;font-weight:500}" +
      "#ex-bento .exb-tile.big p{font-size:.92rem;max-width:32ch}" +
      "#ex-bento .exb-tile .exb-go{position:absolute;top:15px;right:16px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(22,58,43,.08);color:#163a2b;font-size:14px;transition:transform .3s,background .3s}" +
      "#ex-bento .exb-tile:hover .exb-go{transform:translate(2px,-2px);background:#1d4a37;color:#fff}" +
      "#ex-bento .exb-tile.big{background:linear-gradient(150deg,#1d4a37,#0f2c20 70%);border:1px solid rgba(228,190,120,.32);color:#fbf6ea}" +
      "#ex-bento .exb-tile.big h3{color:#fbf6ea}#ex-bento .exb-tile.big p{color:rgba(251,246,234,.8)}" +
      "#ex-bento .exb-tile.big .exb-go{background:rgba(228,190,120,.2);color:#e4be78}" +
      "#ex-bento .exb-tile.big:hover .exb-go{background:#e4be78;color:#15241c}" +
      "#ex-bento .exb-shim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 32%,rgba(228,190,120,.16) 48%,transparent 64%);transform:translateX(-130%);animation:exb-shim 6s ease-in-out infinite}" +
      "#ex-home{position:fixed;left:16px;bottom:64px;top:auto;transform:none;z-index:8500;display:none;align-items:center;gap:8px;background:rgba(16,32,23,.5);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(228,190,120,.5);color:#fbf6ea;border-radius:999px;padding:8px 16px 8px 10px;font-family:" + SANS + ";font-weight:800;font-size:.82rem;cursor:pointer;box-shadow:0 12px 30px -12px rgba(0,0,0,.6)}" +
      "#ex-home .hm{width:26px;height:26px;border-radius:8px;background:linear-gradient(145deg,#e4be78,#c79a4b);display:flex;align-items:center;justify-content:center}" +
      "#ex-bento .exb-flip{perspective:1000px;background:none!important;border:none!important;box-shadow:none!important;padding:0!important;overflow:visible}" +
      "#ex-bento .exb-flip:hover{transform:none}" +
      "#ex-bento .exb-flip-inner{position:relative;width:100%;min-height:104px;height:100%;transition:transform .6s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}" +
      "#ex-bento .exb-flip.flipped .exb-flip-inner{transform:rotateY(180deg)}" +
      "#ex-bento .exb-face{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;border:1px solid rgba(255,255,255,.5);background:rgba(251,246,234,.92);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-radius:20px;padding:16px 17px;display:flex;flex-direction:column;justify-content:space-between;color:#15241c;box-shadow:0 16px 40px rgba(8,16,12,.32)}" +
      "#ex-bento .exb-front .exb-ic{font-size:1.5rem}#ex-bento .exb-front h3{font-family:" + SERIF + ";font-weight:700;font-size:1.12rem;color:#163a2b;margin-top:10px}#ex-bento .exb-front p{font-size:.78rem;color:#5e6557;line-height:1.4;margin-top:3px;font-weight:500}#ex-bento .exb-front .exb-go{position:absolute;top:15px;right:16px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(22,58,43,.08);color:#163a2b;font-size:14px}" +
      "#ex-bento .exb-back{transform:rotateY(180deg);background:linear-gradient(150deg,#1d4a37,#0f2c20);border-color:rgba(228,190,120,.32);color:#fbf6ea;justify-content:center;gap:8px}" +
      "#ex-bento .exb-back .bl{font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#e4be78}" +
      "#ex-bento .exb-opt{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:rgba(251,246,234,.1);border:1px solid rgba(255,255,255,.22);color:#fbf6ea;border-radius:11px;padding:9px 11px;font-family:" + SANS + ";font-weight:700;font-size:.84rem;cursor:pointer;transition:background .15s}" +
      "#ex-bento .exb-opt:hover{background:rgba(251,246,234,.2)}" +
      "#ex-bento .exb-unflip{position:absolute;top:9px;right:12px;background:none;border:none;color:rgba(251,246,234,.7);font-size:1rem;cursor:pointer;line-height:1}" +
      "#ex-parklist{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,18,12,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}" +
      "#ex-parklist .pl-card{background:#fbf6ea;border-radius:22px;width:100%;max-width:460px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 40px 90px -30px rgba(0,0,0,.7)}" +
      "#ex-parklist .pl-head{background:linear-gradient(135deg,#33555f,#1d3941);color:#fbf6ea;padding:15px 18px}" +
      "#ex-parklist .pl-head h3{font-family:" + SERIF + ";font-weight:700;font-size:1.18rem}" +
      "#ex-parklist .pl-x{background:rgba(255,255,255,.16);border:none;color:#fbf6ea;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:.95rem;flex:none}" +
      "#ex-parklist .pl-search{margin:13px 16px 6px;padding:11px 13px;border:1.5px solid #e7ddca;border-radius:12px;font-family:" + SANS + ";font-size:.9rem;outline:none;color:#1a2b21}" +
      "#ex-parklist .pl-search:focus{border-color:#c79a4b;box-shadow:0 0 0 3px rgba(199,154,75,.18)}" +
      "#ex-parklist .pl-list{overflow-y:auto;padding:4px 8px 12px}" +
      "#ex-parklist .pl-row{display:flex;justify-content:space-between;align-items:center;padding:11px 12px;border-radius:12px;cursor:pointer}" +
      "#ex-parklist .pl-row:hover{background:#f1ead9}" +
      "#ex-about{position:fixed;inset:0;z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,18,12,.55);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}" +
      "#ex-about .ab-card{background:#fbf6ea;border-radius:24px;width:100%;max-width:640px;max-height:88vh;overflow-y:auto;box-shadow:0 40px 90px -30px rgba(0,0,0,.7);animation:exb-rise .5s ease both}" +
      "#ex-about .ab-head{background:linear-gradient(150deg,#1d4a37,#0f2c20);color:#fbf6ea;padding:24px 24px 22px;position:relative}" +
      "#ex-about .ab-x{position:absolute;top:15px;right:15px;background:rgba(255,255,255,.16);border:none;color:#fbf6ea;width:32px;height:32px;border-radius:9px;cursor:pointer;font-size:1rem}" +
      "#ex-about .ab-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:20px 22px}" +
      "#ex-about .ab-item{background:#fffdf7;border:1px solid #e7ddca;border-radius:15px;padding:14px 15px}" +
      "#ex-about .ab-item .ai{font-size:1.4rem;line-height:1}" +
      "#ex-about .ab-item h4{font-family:" + SERIF + ";font-weight:700;font-size:1rem;color:#163a2b;margin-top:8px}" +
      "#ex-about .ab-item p{font-size:.8rem;color:#5e6557;line-height:1.45;margin-top:3px}" +
      "#ex-about .ab-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:2px 24px 22px}" +
      "#ex-bento #ex-signin{position:absolute;top:16px;right:16px;z-index:5;display:inline-flex;align-items:center;gap:7px;background:rgba(251,246,234,.12);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.28);color:#fbf6ea;border-radius:999px;padding:8px 15px;font-family:" + SANS + ";font-weight:800;font-size:.8rem;cursor:pointer;transition:background .15s}" +
      "#ex-bento #ex-signin:hover{background:rgba(251,246,234,.22)}" +
      "#ex-bento #ex-signin .si-av{width:20px;height:20px;border-radius:50%;background:linear-gradient(145deg,#e4be78,#c79a4b);display:flex;align-items:center;justify-content:center;color:#15241c;font-size:.7rem;font-weight:900}" +
      "@media(max-width:560px){#ex-about .ab-grid{grid-template-columns:1fr}}" +
      "@media(max-width:760px){#ex-bento{padding:0}#ex-bento .exb-grid{grid-template-columns:repeat(2,1fr)}#ex-bento .exb-tile.big{grid-column:span 2;grid-row:span 1;min-height:120px}#ex-bento .exb-tile{min-height:96px;padding:14px 15px}#ex-bento .exb-tile h3{font-size:1rem}#ex-bento .exb-tile.big h3{font-size:1.3rem}#ex-bento .exb-tile p{font-size:.74rem}}" +
      "@media(max-width:430px){#ex-bento .exb-grid{grid-template-columns:1fr}#ex-bento .exb-tile.big{grid-column:span 1}#ex-bento .exb-flip-inner{min-height:96px}}" +
      "@media(max-width:760px){#ex-bento .exb-grid{grid-template-columns:repeat(2,1fr)}#ex-bento .exb-tile.big{grid-column:span 2;grid-row:span 1}}" +
      "@media(prefers-reduced-motion:reduce){#ex-bento *{animation:none!important}}" +
      "#ex-bento .exb-scroll{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);z-index:3;display:inline-flex;align-items:center;gap:9px;background:rgba(16,32,23,.5);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(228,190,120,.4);color:#fbf6ea;border-radius:999px;padding:9px 16px;font-family:" + SANS + ";font-weight:700;font-size:.76rem;cursor:pointer}" +
      "#ex-bento .exb-scroll .ar{animation:exb-bounce 1.8s ease-in-out infinite;font-size:.9rem}" +
      "@keyframes exb-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}" +
      "#ex-bento .exb-band{padding:clamp(60px,10vh,120px) clamp(20px,5vw,56px);position:relative;text-align:left}" +
      "#ex-bento .exb-band.cream{background:#fbf6ea;color:#15241c}" +
      "#ex-bento .exb-band.greenb{background:linear-gradient(160deg,#33555f,#1d3941);color:#fbf6ea}" +
      "#ex-bento .exb-w{max-width:1080px;margin:0 auto}" +
      "#ex-bento .exb-kick{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#c79a4b;margin-bottom:14px}" +
      "#ex-bento .exb-lead{font-family:" + SERIF + ";font-weight:700;font-size:clamp(1.8rem,3.6vw,3rem);line-height:1.12;letter-spacing:-.015em;max-width:20ch;margin:0}" +
      "#ex-bento .exb-lead em{font-style:italic}" +
      "#ex-bento .exb-band.cream .exb-lead{color:#15241c}#ex-bento .exb-band.cream .exb-lead em{color:#2c5562}" +
      "#ex-bento .exb-band.greenb .exb-lead em{color:#e4be78}" +
      "#ex-bento .exb-blg{font-size:clamp(1.02rem,1.5vw,1.18rem);line-height:1.65;max-width:60ch;margin-top:18px}" +
      "#ex-bento .exb-band.cream .exb-blg{color:#4a5346}#ex-bento .exb-band.greenb .exb-blg{color:rgba(251,246,234,.82)}" +
      "#ex-bento .exb-statement{font-family:" + SERIF + ";font-weight:700;font-size:clamp(1.9rem,4.2vw,3.4rem);line-height:1.16;letter-spacing:-.02em;max-width:24ch;margin:0;color:#15241c}" +
      "#ex-bento .exb-statement .hl{color:#c79a4b}" +
      "#ex-bento .exb-trio{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:46px}" +
      "#ex-bento .exb-feat{border-radius:20px;padding:28px 24px;position:relative;overflow:hidden;background:rgba(251,246,234,.06);border:1px solid rgba(228,190,120,.22)}" +
      "#ex-bento .exb-feat .ic{width:54px;height:54px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:1.7rem;background:linear-gradient(145deg,#e4be78,#c79a4b);box-shadow:0 8px 20px rgba(199,154,75,.3);margin-bottom:16px}" +
      "#ex-bento .exb-feat h3{font-family:" + SERIF + ";font-weight:700;font-size:1.4rem;margin:0 0 8px;color:#fbf6ea}" +
      "#ex-bento .exb-feat p{font-size:.94rem;line-height:1.55;margin:0;color:rgba(251,246,234,.78)}" +
      "#ex-bento .exb-feat .num{position:absolute;top:16px;right:20px;font-family:" + SERIF + ";font-weight:800;font-size:2.6rem;opacity:.12;color:#e4be78}" +
      "#ex-bento .exb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:46px}" +
      "#ex-bento .exb-stat{text-align:center}" +
      "#ex-bento .exb-stat b{font-family:" + SERIF + ";font-weight:800;font-size:clamp(2.2rem,4.5vw,3.2rem);line-height:1;color:#e4be78;display:block}" +
      "#ex-bento .exb-stat span{font-size:.82rem;font-weight:600;color:rgba(251,246,234,.7);margin-top:8px;display:block}" +
      "#ex-bento .exb-showcase{display:grid;grid-template-columns:1.05fr .95fr;gap:46px;align-items:center}" +
      "#ex-bento .exb-pass{aspect-ratio:1.6/1;border-radius:22px;background:linear-gradient(150deg,#33555f,#16303a);border:1px solid rgba(228,190,120,.32);box-shadow:0 30px 70px rgba(8,16,12,.4);padding:28px;color:#fbf6ea;position:relative;overflow:hidden}" +
      "#ex-bento .exb-pass .foil{font-size:.64rem;letter-spacing:.3em;text-transform:uppercase;color:#e4be78;font-weight:700}" +
      "#ex-bento .exb-pass .bn{font-family:" + SERIF + ";font-weight:800;font-size:2rem;background:linear-gradient(120deg,#f3dca6,#c79a4b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-top:6px}" +
      "#ex-bento .exb-pass .stamps{position:absolute;bottom:24px;left:28px;right:28px;display:flex;gap:10px}" +
      "#ex-bento .exb-pass .stamp{width:44px;height:44px;border-radius:50%;border:2px dashed rgba(228,190,120,.6);display:flex;align-items:center;justify-content:center;font-size:1.05rem;transform:rotate(var(--r,-4deg))}" +
      "#ex-bento .exb-pass .shim{position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(228,190,120,.16) 50%,transparent 65%);transform:translateX(-120%);animation:exb-shim 4.5s ease-in-out infinite}" +
      "#ex-bento .exb-cta{text-align:center}" +
      "#ex-bento .exb-cta h2{font-family:" + SERIF + ";font-weight:800;font-size:clamp(2rem,5vw,3.6rem);line-height:1.04;letter-spacing:-.02em;max-width:18ch;margin:0 auto;color:#fbf6ea}" +
      "#ex-bento .exb-cta h2 em{font-style:italic;color:#e4be78}" +
      "#ex-bento .exb-ctarow{display:flex;gap:14px;justify-content:center;margin-top:30px;flex-wrap:wrap}" +
      "#ex-bento .exb-btn{display:inline-flex;align-items:center;gap:9px;padding:15px 28px;border-radius:13px;font-weight:700;font-size:.95rem;text-decoration:none;cursor:pointer;border:none;font-family:" + SANS + "}" +
      "#ex-bento .exb-btn.gold{background:linear-gradient(120deg,#e4be78,#c79a4b);color:#15241c}" +
      "#ex-bento .exb-btn.ghost{background:transparent;border:1px solid rgba(251,246,234,.35);color:#fbf6ea}" +
      "#ex-bento .exb-foot{padding:30px;text-align:center;color:rgba(251,246,234,.6);font-size:.8rem;background:#16303a}" +
      "#ex-bento .exb-rv{opacity:0;transform:translateY(28px);transition:opacity .8s cubic-bezier(.2,.8,.25,1),transform .8s cubic-bezier(.2,.8,.25,1)}" +
      "#ex-bento .exb-rv.in{opacity:1;transform:none}" +
      "@media(max-width:760px){#ex-bento .exb-trio{grid-template-columns:1fr}#ex-bento .exb-stats{grid-template-columns:repeat(2,1fr);gap:26px}#ex-bento .exb-showcase{grid-template-columns:1fr;gap:30px}#ex-bento .exb-band{padding:58px 18px}}" +
      "#ex-bento .exb-quick{font-family:" + SANS + ";font-size:.82rem;color:rgba(251,246,234,.6);display:flex;flex-wrap:wrap;align-items:center;gap:9px}" +
      "#ex-bento .exb-quick .lbl{opacity:.8}" +
      "#ex-bento .exb-quick a{color:rgba(251,246,234,.92);text-decoration:none;font-weight:600;border-bottom:1px solid rgba(228,190,120,.45);padding-bottom:1px;cursor:pointer;transition:.15s}" +
      "#ex-bento .exb-quick a:hover{color:#fff;border-bottom-color:#e4be78}" +
      "#ex-bento .exb-quick .sep{opacity:.35}" +
      "@keyframes exb-birds{0%{transform:translate(0,0)}50%{transform:translate(26px,-12px)}100%{transform:translate(54px,4px)}}" +
      "#ex-bento .exb-scene{position:absolute;inset:0;z-index:0;overflow:hidden}" +
      "#ex-bento .exb-sky{position:absolute;inset:0;background:linear-gradient(180deg,#3a5f6e 0%,#6f8f86 55%,#cfd9c2 100%)}" +
      "#ex-bento .exb-sun{position:absolute;top:-9%;right:7%;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle at 50% 50%,rgba(255,238,190,.95),rgba(228,190,120,.5) 38%,transparent 70%);filter:blur(4px);animation:exb-sun 6s ease-in-out infinite}" +
      "#ex-bento .exb-cloud{position:absolute;border-radius:50%;background:radial-gradient(circle at 40% 40%,rgba(255,253,247,.5),rgba(255,253,247,.12) 60%,transparent 75%);filter:blur(8px);opacity:.7}" +
      "#ex-bento .exb-cloud.c1{top:13%;left:0;width:240px;height:70px;animation:exb-drift 46s linear infinite}" +
      "#ex-bento .exb-cloud.c2{top:23%;left:0;width:170px;height:54px;opacity:.5;animation:exb-drift 64s linear infinite;animation-delay:-20s}" +
      "#ex-bento .exb-cloud.c3{top:7%;left:0;width:300px;height:84px;opacity:.4;animation:exb-drift 82s linear infinite;animation-delay:-50s}" +
      "#ex-bento .exb-ridge{position:absolute;left:-6%;right:-6%;bottom:0;will-change:transform;transition:transform .25s ease-out}" +
      "#ex-bento .exb-ridge.r3{height:54vh;background:linear-gradient(180deg,#86a59c,#789a90);opacity:.42;clip-path:polygon(0 64%,18% 40%,34% 56%,52% 30%,68% 52%,84% 34%,100% 50%,100% 100%,0 100%)}" +
      "#ex-bento .exb-ridge.r2{height:44vh;background:linear-gradient(180deg,#557d73,#456b61);opacity:.7;clip-path:polygon(0 72%,14% 54%,30% 68%,46% 44%,62% 64%,80% 46%,100% 62%,100% 100%,0 100%)}" +
      "#ex-bento .exb-ridge.r1{height:36vh;background:linear-gradient(180deg,#2f574c,#1d3a31);clip-path:polygon(0 78%,12% 62%,28% 76%,44% 56%,60% 74%,78% 58%,100% 72%,100% 100%,0 100%)}" +
      "#ex-bento .exb-birds{position:absolute;top:14%;left:60%;color:rgba(251,246,234,.5);font-size:.95rem;letter-spacing:4px;animation:exb-birds 9s ease-in-out infinite}" +
      "#ex-bento .exb-veil{position:absolute;inset:0;background:radial-gradient(130% 92% at 50% 6%,transparent 44%,rgba(8,18,12,.42) 100%),linear-gradient(100deg,rgba(7,18,12,.5) 0%,rgba(8,20,14,.2) 48%,transparent 74%)}" +
      "#ex-bento .exb-grain{position:absolute;inset:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")}" +
      "#ex-bento .exb-story{position:relative;z-index:2;background:#fbf6ea;border-radius:34px 34px 0 0;margin-top:-32px;box-shadow:0 -26px 70px -34px rgba(8,18,12,.7)}" +
      "#ex-bento .exb-story .exb-band:first-child{border-radius:34px 34px 0 0}" +
      "#ex-bento .exb-btn{transition:transform .12s ease,box-shadow .12s ease,background .14s}" +
      "#ex-bento .exb-btn.gold{box-shadow:0 4px 0 #9c7330,0 12px 22px -8px rgba(120,90,40,.5)}" +
      "#ex-bento .exb-btn.gold:hover{transform:translateY(-1px);box-shadow:0 5px 0 #9c7330,0 16px 28px -8px rgba(120,90,40,.55)}" +
      "#ex-bento .exb-btn.gold:active{transform:translateY(3px);box-shadow:0 1px 0 #9c7330}" +
      "#ex-bento .exb-btn.ghost{background:rgba(251,246,234,.08);border:1px solid rgba(251,246,234,.42);color:#fbf6ea;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
      "#ex-bento .exb-btn.ghost:hover{background:rgba(251,246,234,.18);border-color:#e4be78;transform:translateY(-1px)}" +
      "#ex-bento .exb-feat{transition:transform .3s cubic-bezier(.2,.8,.3,1),box-shadow .3s}" +
      "#ex-bento .exb-feat::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 32%,rgba(228,190,120,.14) 48%,transparent 64%);transform:translateX(-130%);animation:exb-shim 6s ease-in-out infinite;pointer-events:none}" +
      "#ex-bento .exb-feat:hover{transform:translateY(-7px);box-shadow:0 28px 60px rgba(8,16,12,.4)}" +
      "#ex-bento .exb-pass{transition:transform .4s cubic-bezier(.2,.8,.3,1),box-shadow .4s}" +
      "#ex-bento .exb-pass:hover{transform:translateY(-6px) rotate(-.6deg);box-shadow:0 40px 90px rgba(8,16,12,.5)}" +
      "#ex-bento .exb-flhint{font-family:" + SANS + ";font-size:.8rem;font-weight:700;color:#c79a4b;margin-top:18px;letter-spacing:.02em}" +
      "#ex-bento .exb-flipcard{perspective:1300px;width:100%;max-width:430px;margin-left:auto}" +
      "#ex-bento .exb-flipcard-inner{position:relative;width:100%;min-height:300px;transition:transform .65s cubic-bezier(.4,.2,.2,1);transform-style:preserve-3d}" +
      "#ex-bento .exb-flipcard.flipped .exb-flipcard-inner{transform:rotateY(180deg)}" +
      "#ex-bento .exb-flipface{position:absolute;inset:0;-webkit-backface-visibility:hidden;backface-visibility:hidden;border-radius:24px;overflow:hidden;box-shadow:0 30px 70px -22px rgba(8,16,12,.55)}" +
      "#ex-bento .exb-flipfront{display:flex;flex-direction:column;background:linear-gradient(150deg,#33555f,#16303a);border:1px solid rgba(228,190,120,.34);color:#fbf6ea;padding:24px 24px 22px;text-align:left;cursor:pointer;font-family:" + SANS + ";width:100%}" +
      "#ex-bento .exb-flipfront .shim{position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(228,190,120,.18) 50%,transparent 65%);transform:translateX(-120%);animation:exb-shim 4.5s ease-in-out infinite;pointer-events:none}" +
      "#ex-bento .exb-flipfront .ff-top{display:inline-flex;align-items:center;gap:8px;font-size:.64rem;font-weight:800;letter-spacing:.1em;color:#e4be78}" +
      "#ex-bento .exb-flipfront .ff-dot{width:8px;height:8px;border-radius:50%;background:#46d97f;box-shadow:0 0 0 4px rgba(70,217,127,.22);animation:exb-pulse 2s infinite}" +
      "#ex-bento .exb-flipfront .ff-name{font-family:" + SERIF + ";font-weight:800;font-size:2.1rem;line-height:1;margin-top:14px}" +
      "#ex-bento .exb-flipfront .ff-sub{font-size:.8rem;color:rgba(251,246,234,.66);margin-top:4px}" +
      "#ex-bento .exb-flipfront .ff-verdict{display:flex;align-items:center;gap:12px;margin-top:auto}" +
      "#ex-bento .exb-flipfront .ff-badge{background:#3fae6a;color:#08200f;font-weight:800;font-size:.78rem;letter-spacing:.04em;padding:7px 13px;border-radius:999px}" +
      "#ex-bento .exb-flipfront .ff-temp{font-family:" + SERIF + ";font-weight:700;font-size:1.9rem}" +
      "#ex-bento .exb-flipfront .ff-go{margin-top:16px;display:inline-flex;align-self:flex-start;align-items:center;gap:7px;background:linear-gradient(120deg,#e4be78,#c79a4b);color:#15241c;font-weight:800;font-size:.82rem;padding:10px 16px;border-radius:11px}" +
      "#ex-bento .exb-flipback{transform:rotateY(180deg);display:flex;flex-direction:column;justify-content:center;gap:11px;background:#fffdf7;border:1px solid #e7ddca;padding:24px;text-align:left}" +
      "#ex-bento .exb-flipback .fb-label{font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8c8473;margin-bottom:2px}" +
      "#ex-bento .exb-unflip2{position:absolute;top:12px;right:14px;background:none;border:none;color:#8c8473;font-size:1.1rem;cursor:pointer;line-height:1}" +
      "#ex-bento .exb-statopt{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:#fbf6ea;border:1px solid #e7ddca;border-radius:14px;padding:14px 15px;cursor:pointer;font-family:" + SANS + ";transition:transform .15s,border-color .15s,box-shadow .15s,background .15s}" +
      "#ex-bento .exb-statopt:hover{border-color:#c79a4b;background:#fff;transform:translateX(3px);box-shadow:0 10px 26px -16px rgba(28,46,34,.5)}" +
      "#ex-bento .exb-statopt .oi{font-size:1.5rem;flex:none}" +
      "#ex-bento .exb-statopt .ot b{display:block;font-family:" + SERIF + ";font-weight:700;font-size:1.02rem;color:#234851}" +
      "#ex-bento .exb-statopt .ot small{display:block;font-size:.74rem;color:#8c8473;margin-top:1px}" +
      "#ex-bento .exb-flipfront .ff-flip{position:absolute;top:13px;right:13px;z-index:2;font-family:" + SANS + ";font-size:.6rem;font-weight:800;letter-spacing:.06em;color:#e4be78;background:rgba(228,190,120,.16);border:1px solid rgba(228,190,120,.45);padding:5px 9px;border-radius:999px;display:inline-flex;align-items:center;gap:5px}" +
      "@media(max-width:760px){#ex-bento .exb-flipcard{max-width:none;margin:0}}" +
      "@keyframes wf-radar{0%{transform:scale(.3);opacity:.8}100%{transform:scale(2.6);opacity:0}}" +
      "@keyframes wf-draw{to{stroke-dashoffset:0}}@keyframes wf-flow{to{stroke-dashoffset:-28}}@keyframes wf-conn{from{left:-8px}to{left:100%}}" +
      "@keyframes wf-stamp{0%{opacity:0;transform:scale(1.5) rotate(-8deg)}60%{opacity:1;transform:scale(.96) rotate(-3deg)}100%{transform:scale(1) rotate(-3deg)}}" +
      "@keyframes wf-rise2{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
      "#ex-bento .exb-wf .wf2{position:relative;margin-top:46px}" +
      "#ex-bento .wf2-spine{position:absolute;left:50%;top:10px;bottom:10px;width:3px;transform:translateX(-50%);background:repeating-linear-gradient(180deg,#d8c9a6 0 7px,transparent 7px 16px);border-radius:3px;z-index:1}" +
      "#ex-bento .wf2-fill{position:absolute;left:0;top:0;width:100%;height:0;background:linear-gradient(180deg,#e4be78,#c79a4b);border-radius:3px;box-shadow:0 0 12px rgba(228,190,120,.7)}" +
      "#ex-bento .wf2-marker{position:absolute;left:50%;top:0;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:linear-gradient(150deg,#33555f,#1d3941);border:2px solid #e4be78;display:flex;align-items:center;justify-content:center;font-size:1.15rem;z-index:5;box-shadow:0 8px 20px -6px rgba(0,0,0,.5),0 0 0 7px rgba(228,190,120,.14)}" +
      "#ex-bento .wf2-stations{position:relative;z-index:2;display:flex;flex-direction:column;gap:clamp(42px,9vh,104px)}" +
      "#ex-bento .wf2-st{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:clamp(22px,5vw,64px);align-items:center;opacity:.42;filter:saturate(.7);transition:opacity .55s ease,filter .55s ease}" +
      "#ex-bento .wf2-st.live{opacity:1;filter:none}" +
      "#ex-bento .wf2-st:nth-child(even) .wf2-visual{order:2}" +
      "#ex-bento .wf2-node{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #d8c9a6;z-index:3;transition:.4s}" +
      "#ex-bento .wf2-st.live .wf2-node{border-color:#c79a4b;background:#e4be78;box-shadow:0 0 0 6px rgba(228,190,120,.22)}" +
      "#ex-bento .wf2-visual{position:relative;aspect-ratio:5/3.5;border-radius:20px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:linear-gradient(165deg,#3a5f6e 0%,#456b61 55%,#2f574c 100%);border:1px solid rgba(228,190,120,.32);box-shadow:0 30px 66px -38px rgba(8,18,12,.7),inset 0 1px 0 rgba(255,255,255,.07)}" +
      "#ex-bento .wf2-tag{position:absolute;top:12px;left:14px;z-index:6;font-family:" + SANS + ";font-size:.58rem;font-weight:800;letter-spacing:.16em;color:#e4be78;display:flex;align-items:center;gap:6px}#ex-bento .wf2-tag .wd{width:7px;height:7px;border-radius:50%;background:#46d97f;box-shadow:0 0 8px 1px #46d97f;animation:exb-pulse 1.6s infinite}" +
      "#ex-bento .wf2-copy{padding:4px 0}" +
      "#ex-bento .wf2-badge{display:inline-flex;align-items:center;gap:12px}#ex-bento .wf2-badge .bn{width:46px;height:46px;flex:none;border-radius:13px;background:linear-gradient(150deg,#33555f,#1d3941);color:#e4be78;display:flex;align-items:center;justify-content:center;font-family:" + SERIF + ";font-weight:800;font-size:1.4rem;border:1px solid rgba(228,190,120,.4)}#ex-bento .wf2-badge .bl{font-family:" + SANS + ";font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a98a4e}" +
      "#ex-bento .wf2-copy h3{font-family:" + SERIF + ";font-weight:800;font-size:clamp(1.5rem,2.9vw,2.45rem);line-height:1.05;letter-spacing:-.02em;margin-top:15px;color:#1d3941}#ex-bento .wf2-copy h3 em{font-style:italic;color:#2c5562}#ex-bento .wf2-copy p{color:#5b6258;font-size:clamp(.98rem,1.35vw,1.12rem);line-height:1.55;max-width:44ch;margin-top:12px}" +
      "#ex-bento .wf-map{position:absolute;inset:0;background:linear-gradient(135deg,rgba(86,165,156,.16),rgba(15,40,34,.55)),repeating-linear-gradient(0deg,rgba(150,200,190,.07) 0 1px,transparent 1px 36px),repeating-linear-gradient(90deg,rgba(150,200,190,.07) 0 1px,transparent 1px 36px)}" +
      "#ex-bento .wf-pin{position:absolute;width:17px;height:17px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f3cd83,#c79a4b);border:2px solid #fffdf7;box-shadow:0 0 0 2px rgba(28,74,55,.4),0 4px 8px rgba(0,0,0,.5)}" +
      "#ex-bento .wf-pin.dim{width:10px;height:10px;background:radial-gradient(circle at 35% 30%,#9fc0b8,#5d7e76);box-shadow:0 2px 5px rgba(0,0,0,.4);opacity:.7}" +
      "#ex-bento .wf-pin .wf-rad{position:absolute;inset:-3px;border-radius:50%;border:2px solid rgba(228,190,120,.6)}" +
      "#ex-bento .wf2-st.live .wf-pin .wf-rad{animation:wf-radar 2.4s ease-out infinite}#ex-bento .wf-pin .wf-rad.b{animation-delay:1.2s}" +
      "#ex-bento .wf-card{width:78%;max-width:330px;background:rgba(8,22,18,.5);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:18px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}" +
      "#ex-bento .wf-sun{width:48px;height:48px;border-radius:50%;background:radial-gradient(circle at 38% 35%,#fff3c4,#ffd24a 60%,#f6b21e);box-shadow:0 0 24px 5px rgba(255,206,80,.5)}#ex-bento .wf2-st.live .wf-sun{animation:exb-sun 3s ease-in-out infinite}" +
      "#ex-bento .wf-temp{font-family:" + SERIF + ";font-weight:800;font-size:2.3rem;color:#fff;margin-top:12px;line-height:1}" +
      "#ex-bento .wf-verdict{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(120deg,#3fae6a,#2f7d4f);color:#06210f;font-weight:800;font-size:.84rem;padding:8px 14px;border-radius:999px;margin-top:12px;transform-origin:left center}#ex-bento .wf2-st.live .wf-verdict{animation:wf-stamp .7s cubic-bezier(.3,1.4,.4,1) .25s both}" +
      "#ex-bento .wf-chips{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}#ex-bento .wf-chips span{font-size:.66rem;font-weight:700;color:#dfeae6;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);padding:5px 9px;border-radius:999px;opacity:0}#ex-bento .wf2-st.live .wf-chips span{animation:wf-rise2 .5s ease forwards}#ex-bento .wf2-st.live .wf-chips span:nth-child(1){animation-delay:.5s}#ex-bento .wf2-st.live .wf-chips span:nth-child(2){animation-delay:.62s}#ex-bento .wf2-st.live .wf-chips span:nth-child(3){animation-delay:.74s}" +
      "#ex-bento .wf-route{position:absolute;inset:0;background:linear-gradient(135deg,rgba(86,165,156,.14),rgba(15,40,34,.5)),repeating-linear-gradient(0deg,rgba(150,200,190,.06) 0 1px,transparent 1px 38px),repeating-linear-gradient(90deg,rgba(150,200,190,.06) 0 1px,transparent 1px 38px)}#ex-bento .wf-route svg{position:absolute;inset:0;width:100%;height:100%}#ex-bento .wf2-st.live .wf-path{animation:wf-draw 2.2s ease .3s forwards,wf-flow 1s linear 2.5s infinite}" +
      "#ex-bento .wf-rstop{position:absolute;transform:translate(-50%,-50%);opacity:0}#ex-bento .wf2-st.live .wf-rstop{animation:wf-rise2 .5s ease forwards}#ex-bento .wf2-st.live .wf-rstop:nth-child(2){animation-delay:.2s}#ex-bento .wf2-st.live .wf-rstop:nth-child(3){animation-delay:1s}#ex-bento .wf2-st.live .wf-rstop:nth-child(4){animation-delay:1.7s}" +
      "#ex-bento .wf-dot{width:24px;height:24px;border-radius:50% 50% 50% 2px;transform:rotate(45deg);background:linear-gradient(135deg,#33555f,#16303a);border:2px solid #e4be78;box-shadow:0 4px 9px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center}#ex-bento .wf-dot b{transform:rotate(-45deg);font-size:.7rem;font-weight:800;color:#fff}" +
      "#ex-bento .wf-rstats{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:16px;opacity:0}#ex-bento .wf2-st.live .wf-rstats{animation:wf-rise2 .5s ease 2.2s forwards}#ex-bento .wf-rstats div{text-align:center}#ex-bento .wf-rstats b{display:block;font-family:" + SERIF + ";font-size:1.2rem;color:#e4be78}#ex-bento .wf-rstats span{font-size:.54rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(234,241,239,.6)}" +
      "#ex-bento .wf-pack{display:flex;flex-direction:column;align-items:center;gap:11px;width:82%}#ex-bento .wf-gchip{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:11px;padding:9px 13px;font-size:.8rem;font-weight:700;color:#eaf1ef;opacity:0}#ex-bento .wf2-st.live .wf-gchip{animation:wf-rise2 .5s ease forwards}#ex-bento .wf2-st.live .wf-gchip:nth-child(1){animation-delay:.15s}#ex-bento .wf2-st.live .wf-gchip:nth-child(2){animation-delay:.3s}#ex-bento .wf2-st.live .wf-gchip:nth-child(3){animation-delay:.45s}" +
      "#ex-bento .wf-ready{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(120deg,#3fae6a,#2f7d4f);color:#06210f;font-weight:800;font-size:.9rem;padding:10px 18px;border-radius:999px;margin-top:4px;opacity:0}#ex-bento .wf2-st.live .wf-ready{animation:wf-stamp .7s cubic-bezier(.3,1.4,.4,1) .7s both}" +
      "@media(max-width:760px){#ex-bento .wf2-spine{left:20px}#ex-bento .wf2-marker{left:20px}#ex-bento .wf2-st{grid-template-columns:1fr;gap:15px;padding-left:48px}#ex-bento .wf2-st:nth-child(even) .wf2-visual{order:0}#ex-bento .wf2-node{left:20px;top:30px;transform:translate(-50%,-50%)}#ex-bento .wf2-visual{aspect-ratio:5/3.2}}" +
      "@media(prefers-reduced-motion:reduce){#ex-bento .exb-rv{opacity:1!important;transform:none!important}}";
    document.head.appendChild(s);
  }

  function homeBtn() {
    var b = document.getElementById('ex-home');
    if (b) return b;
    b = document.createElement('button');
    b.id = 'ex-home';
    b.innerHTML = '<span class="hm"><svg width="15" height="15" viewBox="0 0 24 24" fill="#15241c"><path d="M12 2l5 9h-3l5 9H5l5-9H7z"></path><rect x="11" y="18" width="2" height="4"></rect></svg></span>Home';
    b.addEventListener('click', showCover);
    (document.body || document.documentElement).appendChild(b);
    return b;
  }

  // bug 1: map-page chrome (planner FAB/panel sit above the cover at z-9998) must
  // not float over the bento landing — hide it while the cover is up.
  function setMapChrome(show) {
    ['ppb-fab', 'ppb-panel'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.style.visibility = show ? '' : 'hidden';
    });
  }

  // When a park's bottom sheet (Live / Trip) is open on mobile, the floating map
  // controls (Home, Parks-near-me, planner) sit on top of the sheet and cover the
  // weather card. Toggle a body class so CSS can hide them while a sheet is open.
  function watchSheets() {
    var info = document.getElementById('info'), dash = document.getElementById('dash');
    if (!info && !dash) return;
    function sync() {
      var open = (info && info.classList.contains('open')) || (dash && dash.classList.contains('open'));
      document.body.classList.toggle('pp-sheet-open', !!open);
    }
    var mo = new MutationObserver(sync);
    [info, dash].forEach(function (el) { if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] }); });
    sync();
  }

  var ov = null;
  function showCover() {
    if (!ov) return;
    ov.style.transform = 'translateY(0)';
    try { ov.scrollTop = 0; } catch (e) {}
    ov.style.opacity = '1';
    ov.style.pointerEvents = 'auto';
    ov.querySelectorAll('.exb-flip.flipped').forEach(function (f) { f.classList.remove('flipped'); });
    var hb = document.getElementById('ex-home'); if (hb) hb.style.display = 'none';
    setMapChrome(false);
  }
  function hideCover() {
    if (!ov) return;
    ov.style.transform = 'translateY(-104%)';
    ov.style.opacity = '0';
    ov.style.pointerEvents = 'none';
    var hb = homeBtn(); hb.style.display = 'flex';
    setMapChrome(true);
  }

  function act(t) {
    if (t.act === 'map') { hideCover(); }
    else if (t.act === 'near') { hideCover(); if (typeof window.flyToMe === 'function') setTimeout(window.flyToMe, 350); }
    else if (t.act === 'passport') { if (window.__ppPassport && window.__ppPassport.open) window.__ppPassport.open(); else if (typeof toast === 'function') toast('Passport loads in a moment…'); }
    else if (t.act === 'about') { openAbout(); }
    else if (t.href) { go(t.href); }
  }

  function openAbout() {
    if (document.getElementById('ex-about')) return;
    var ITEMS = [
      { ic: '🌤️', h: 'Live conditions', p: 'Real-time weather, alerts & closures for every park.' },
      { ic: '✓', h: 'Go / no-go call', p: 'One honest verdict so you know if it\u2019s a good day.' },
      { ic: '🗺️', h: 'Explore the map', p: 'All 63 parks, each pin coloured by today\u2019s call.' },
      { ic: '📋', h: 'Plan a trip', p: 'Answer a few questions, get a personalised route.' },
      { ic: '🧭', h: 'Build a trip', p: 'Real-road routes with dates & a cost estimate.' },
      { ic: '🛂', h: 'Trip passport', p: 'Collect a stamp for every park you explore.' }
    ];
    var m = document.createElement('div');
    m.id = 'ex-about';
    m.innerHTML = '<div class="ab-card">' +
      '<div class="ab-head"><button class="ab-x" aria-label="Close">\u2715</button>' +
        '<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(20,36,28,.4);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 13px;font-family:' + SANS + ';font-size:.64rem;font-weight:800;letter-spacing:.1em;color:#e4be78;margin-bottom:13px">WHY PARKBUDDY</div>' +
        '<h2 style="font-family:' + SERIF + ';font-weight:800;font-size:clamp(1.5rem,4vw,2.1rem);line-height:1.05;letter-spacing:-.01em;margin:0">One place to decide,<br>plan &amp; go.</h2>' +
        '<p style="font-family:' + SANS + ';font-size:.92rem;line-height:1.55;color:rgba(251,246,234,.85);margin-top:11px;max-width:52ch">ParkBuddy reads live conditions at every U.S. national park and gives you one honest go / no-go call \u2014 then helps you plan the whole trip around it.</p>' +
      '</div>' +
      '<div class="ab-grid">' + ITEMS.map(function (it) { return '<div class="ab-item"><div class="ai">' + it.ic + '</div><h4>' + it.h + '</h4><p>' + it.p + '</p></div>'; }).join('') + '</div>' +
      '<div class="ab-foot"><span style="display:inline-flex;align-items:center;gap:8px;font-family:' + SANS + ';font-weight:800;color:#1d4a37;font-size:.9rem"><span style="width:9px;height:9px;border-radius:50%;background:#46c46a"></span>Free for travelers, always.</span>' +
        '<a class="ab-full" href="/about" style="font-family:' + SANS + ';font-weight:800;color:#b07d3a;text-decoration:none;font-size:.86rem">Read the full story \u2192</a></div>' +
    '</div>';
    (document.body || document.documentElement).appendChild(m);
    function close() { if (m.parentNode) m.parentNode.removeChild(m); }
    m.querySelector('.ab-x').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    var full = m.querySelector('.ab-full');
    if (full) full.addEventListener('click', function (e) { e.preventDefault(); go('/about'); });
  }

  function allParks() {
    try { if (typeof PARKS !== 'undefined' && PARKS && PARKS.length) return PARKS; } catch (e) {}
    return window.PARKS || window.TRIP_PARKS || [];
  }
  function openParkList() {
    if (document.getElementById('ex-parklist')) return;
    var parks = allParks().slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    function rowsHtml(q) {
      q = (q || '').toLowerCase();
      var html = parks.filter(function (p) { return !q || (p.name + ' ' + p.state).toLowerCase().indexOf(q) > -1; }).map(function (p) {
        var V = window._verdictById && window._verdictById[p.id];
        var col = V ? V.c : '#cdbf9f';
        var dot = '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.08);flex:none"></span>';
        return '<div class="pl-row" data-id="' + p.id + '"><b style="font-family:' + SERIF + ';font-weight:700;font-size:.98rem;color:#234851">' + p.name + '</b><div style="display:flex;align-items:center;gap:9px"><span style="font-size:.74rem;color:#8c8473;font-weight:600">' + p.state + '</span>' + dot + '</div></div>';
      }).join('');
      return html || '<div style="padding:22px;text-align:center;color:#8c8473;font-size:.86rem">No parks match that search.</div>';
    }
    var modal = document.createElement('div');
    modal.id = 'ex-parklist';
    modal.innerHTML = '<div class="pl-card">' +
      '<div class="pl-head"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h3>Pick a park</h3><button class="pl-x" aria-label="Close">\u2715</button></div>' +
        '<p style="font-size:.78rem;color:rgba(251,246,234,.75);margin-top:3px">See its live conditions &amp; go / no-go call</p></div>' +
      '<input class="pl-search" placeholder="Search parks or states\u2026" autocomplete="off">' +
      '<div class="pl-list">' + rowsHtml('') + '</div>' +
    '</div>';
    (document.body || document.documentElement).appendChild(modal);
    var listEl = modal.querySelector('.pl-list');
    var search = modal.querySelector('.pl-search');
    function bind() { listEl.querySelectorAll('.pl-row').forEach(function (r) { r.addEventListener('click', function () { var id = +r.getAttribute('data-id'); close(); hideCover(); var p = parks.filter(function (x) { return x.id === id; })[0]; if (p && typeof window.selectPark === 'function') { setTimeout(function () { try { window.selectPark(p); } catch (e) {} }, 480); } else { go('/park-status?park=' + id); } }); }); }
    bind();
    search.addEventListener('input', function () { listEl.innerHTML = rowsHtml(search.value); bind(); });
    function close() { if (modal.parentNode) modal.parentNode.removeChild(modal); }
    modal.querySelector('.pl-x').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    setTimeout(function () { try { search.focus(); } catch (e) {} }, 60);
  }

  function inject() {
    if (document.getElementById('ex-bento')) return;
    styles();

    ov = document.createElement('div');
    ov.id = 'ex-bento';
    ov.style.cssText = "position:fixed;inset:0;z-index:9000;overflow-y:auto;overscroll-behavior:contain;color:#fbf6ea;background:#3a5f6e;" +
      "display:block;text-align:left;" +
      "transition:transform 1s cubic-bezier(.76,0,.24,1),opacity .55s ease .3s;will-change:transform";

    var tilesHtml = TILES.map(function (t) {
      if (t.k === 'status') {
        return '<div class="exb-tile exb-flip" data-k="status">' +
          '<div class="exb-flip-inner">' +
            '<div class="exb-face exb-back">' +
              '<button class="exb-unflip" title="Back">\u21A9</button>' +
              '<div class="bl">Find a park by\u2026</div>' +
              '<button class="exb-opt" data-sub="map">\uD83D\uDDFA\uFE0F On the map</button>' +
              '<button class="exb-opt" data-sub="list">\uD83D\uDCCB Pick from a list</button>' +
            '</div>' +
            '<div class="exb-face exb-front">' +
              '<div class="exb-ic">' + t.ic + '</div>' +
              '<div><h3>' + t.h + '</h3><p>' + t.p + '</p></div>' +
              '<span class="exb-go">\u2192</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
      return '<button class="exb-tile ' + (t.big ? 'big' : '') + '" data-k="' + t.k + '">' +
        (t.big ? '<div class="exb-shim"></div>' : '') +
        '<div class="exb-ic">' + t.ic + '</div>' +
        '<div><h3>' + t.h + '</h3><p>' + t.p + '</p></div>' +
        '<span class="exb-go">\u2192</span>' +
      '</button>';
    }).join('');

    var aboutHtml =
      '<section class="exb-band cream"><div class="exb-w exb-showcase">' +
        '<div class="exb-rv">' +
          '<div class="exb-kick">Live conditions</div>' +
          '<p class="exb-lead">Is today a <em>good day</em> to go?</p>' +
          '<p class="exb-blg">Every U.S. national park gets one honest go / no-go call &mdash; today&rsquo;s weather, active alerts and official closures. Pick a park to see its live status.</p>' +
          '<div class="exb-flhint">&rarr;&nbsp; Tap the card to choose how</div>' +
        '</div>' +
        '<div class="exb-rv"><div class="exb-flipcard" id="exb-statuscard"><div class="exb-flipcard-inner">' +
          '<button class="exb-flipface exb-flipfront" type="button">' +
            '<div class="shim"></div>' +
            '<span class="ff-flip">&#8635; Flip me</span>' +
            '<div class="ff-top"><span class="ff-dot"></span>LIVE &middot; sample park</div>' +
            '<div class="ff-name">Zion</div>' +
            '<div class="ff-sub">Utah &middot; today</div>' +
            '<div class="ff-verdict"><span class="ff-badge">&#10003; GOOD DAY</span><span class="ff-temp">72&deg;</span></div>' +
            '<span class="ff-go">Check a park &rarr;</span>' +
          '</button>' +
          '<div class="exb-flipface exb-flipback">' +
            '<button class="exb-unflip2" type="button" title="Back">&#8617;</button>' +
            '<div class="fb-label">Find a park by&hellip;</div>' +
            '<button class="exb-statopt" data-statopt="map" type="button"><span class="oi">&#128506;&#65039;</span><span class="ot"><b>On the live map</b><small>Tap any pin for its status</small></span></button>' +
            '<button class="exb-statopt" data-statopt="list" type="button"><span class="oi">&#128203;</span><span class="ot"><b>Pick from a list</b><small>Search all 63 parks</small></span></button>' +
          '</div>' +
        '</div></div></div>' +
      '</div></section>' +
      '<section class="exb-band cream"><div class="exb-w">' +
        '<div class="exb-kick exb-rv">Why we built it</div>' +
        '<p class="exb-statement exb-rv">Planning the outdoors is <span class="hl">scattered</span> across a dozen apps. We bring it into <span class="hl">one trail.</span></p>' +
        '<p class="exb-blg exb-rv">Maps in one tab, weather in another, trail reviews somewhere else, a spreadsheet for the budget. ParkBuddy unites live park conditions, real-road trip planning, and a collectible Trip Passport &mdash; so the only thing you have to focus on is the journey.</p>' +
      '</div></section>' +
      '<section class="exb-band cream exb-wf"><div class="exb-w">' +
        '<div class="exb-kick exb-rv">How it works</div>' +
        '<p class="exb-lead exb-rv">The trail from &ldquo;should we go?&rdquo; to <em>packed &amp; gone.</em></p>' +
        '<div class="wf2">' +
          '<div class="wf2-spine"><div class="wf2-fill" id="wf2-fill"></div><div class="wf2-marker" id="wf2-marker">\uD83E\uDDED</div></div>' +
          '<div class="wf2-stations">' +
            '<div class="wf2-st" data-wf="0"><div class="wf2-node"></div>' +
              '<div class="wf2-visual"><div class="wf2-tag"><span class="wd"></span>LIVE MAP</div><div class="wf-map"><span class="wf-pin dim" style="left:24%;top:34%"></span><span class="wf-pin dim" style="left:70%;top:26%"></span><span class="wf-pin dim" style="left:78%;top:64%"></span><span class="wf-pin" style="left:50%;top:48%"><span class="wf-rad"></span><span class="wf-rad b"></span></span></div></div>' +
              '<div class="wf2-copy"><div class="wf2-badge"><span class="bn">01</span><span class="bl">Discover</span></div><h3>Find a park <em>worth the drive.</em></h3><p>Every U.S. national park on one live map &mdash; pins coloured by today&rsquo;s go / no-go call, so the good days jump out.</p></div>' +
            '</div>' +
            '<div class="wf2-st" data-wf="1"><div class="wf2-node"></div>' +
              '<div class="wf2-visual"><div class="wf2-tag"><span class="wd"></span>CONDITIONS</div><div class="wf-card"><div class="wf-sun"></div><div class="wf-temp">74&deg;</div><div class="wf-verdict">&#10003; Good day to go</div><div class="wf-chips"><span>&#9728;&#65039; Clear</span><span>&#9788;&#65039; UV high</span><span>&#128167; Muddy</span></div></div></div>' +
              '<div class="wf2-copy"><div class="wf2-badge"><span class="bn">02</span><span class="bl">Read the conditions</span></div><h3>One honest <em>go / no-go</em> call.</h3><p>Real weather, alerts and official closures &mdash; distilled into a plain-language verdict and the conditions behind it.</p></div>' +
            '</div>' +
            '<div class="wf2-st" data-wf="2"><div class="wf2-node"></div>' +
              '<div class="wf2-visual"><div class="wf2-tag"><span class="wd"></span>ROUTE</div><div class="wf-route"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path class="wf-path" d="M22,32 C40,20 54,52 70,28 C82,40 60,66 78,72" fill="none" stroke="#e4be78" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="3 3" pathLength="100" stroke-dashoffset="100"></path></svg><div class="wf-rstop" style="left:22%;top:32%"><span class="wf-dot"><b>1</b></span></div><div class="wf-rstop" style="left:70%;top:28%"><span class="wf-dot"><b>2</b></span></div><div class="wf-rstop" style="left:78%;top:72%"><span class="wf-dot"><b>3</b></span></div><div class="wf-rstats"><div><b>612</b><span>mi</span></div><div><b>9</b><span>days</span></div><div><b>$1.8k</b><span>est</span></div></div></div></div>' +
              '<div class="wf2-copy"><div class="wf2-badge"><span class="bn">03</span><span class="bl">Build the trip</span></div><h3>A route on <em>real roads.</em></h3><p>Chain parks into a road trip with drive times, dates and a transparent cost &mdash; each stop carrying its own live conditions.</p></div>' +
            '</div>' +
            '<div class="wf2-st" data-wf="3"><div class="wf2-node"></div>' +
              '<div class="wf2-visual"><div class="wf2-tag"><span class="wd"></span>PACK &amp; GO</div><div class="wf-pack"><span class="wf-gchip">&#129509; Down jacket</span><span class="wf-gchip">&#129406; WP boots</span><span class="wf-gchip">&#127966;&#65039; Zion Lodge</span><span class="wf-ready">&#10003; Packed &amp; booked</span></div></div>' +
              '<div class="wf2-copy"><div class="wf2-badge"><span class="bn">04</span><span class="bl">Pack &amp; go</span></div><h3>Exactly <em>what to bring</em> &mdash; and where to stay.</h3><p>Gear and stays tuned to the forecast at every stop. Then our checklist packs you &mdash; voice it, generate it, and walk your trip in Start Mode.</p></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div></section>' +
      '<section class="exb-band cream"><div class="exb-w exb-showcase">' +
        '<div class="exb-rv"><div class="exb-kick">The Trip Passport</div><p class="exb-lead">Your adventures, <em>beautifully kept.</em></p><p class="exb-blg">Real national-park visitors collect cancellation stamps in a passport book. We made it digital. Each trip you plan becomes a collectible card with your route, dates, and parks &mdash; ready to carry in your pocket and share with friends.</p></div>' +
        '<div class="exb-pass exb-rv"><div class="shim"></div><div class="foil">National Parks &middot; Trip Passport</div><div class="bn">ParkBuddy</div><div class="stamps"><span class="stamp" style="--r:-6deg">&#127964;&#65039;</span><span class="stamp" style="--r:4deg">&#127794;</span><span class="stamp" style="--r:-3deg">&#9968;&#65039;</span><span class="stamp" style="--r:6deg">&#129413;</span></div></div>' +
      '</div></section>' +
      '<section class="exb-band greenb"><div class="exb-w">' +
        '<div class="exb-kick exb-rv">The mission</div>' +
        '<p class="exb-lead exb-rv">Get more people <em>outside</em> &mdash; more often.</p>' +
        '<div class="exb-stats">' +
          '<div class="exb-stat exb-rv"><b data-count="63">0</b><span>National parks</span></div>' +
          '<div class="exb-stat exb-rv"><b data-count="400" data-suffix="+">0</b><span>Protected places</span></div>' +
          '<div class="exb-stat exb-rv"><b data-count="100" data-suffix="%">0</b><span>Live official data</span></div>' +
          '<div class="exb-stat exb-rv"><b data-count="1" data-suffix=" app">0</b><span>For every adventure</span></div>' +
        '</div>' +
      '</div></section>' +
      '<section class="exb-band greenb exb-cta"><div class="exb-w">' +
        '<h2 class="exb-rv">Your next <em>wild</em> is waiting.</h2>' +
        '<div class="exb-ctarow exb-rv"><button class="exb-btn gold" data-act="map">Explore the map</button><button class="exb-btn ghost" data-go="/build-trip">Build a trip</button></div>' +
      '</div></section>' +
      '<footer class="exb-foot">ParkBuddy &middot; Discover &middot; Plan &middot; Collect</footer>';

    ov.innerHTML =
      '<button id="ex-signin"><span class="si-av">\u25CF</span>Sign in</button>' +
      '<section class="exb-hero" style="position:relative;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px 78px;overflow:hidden">' +
      // living scene
      '<div class="exb-scene">' +
        '<div class="exb-sky"></div>' +
        '<div class="exb-sun"></div>' +
        '<div class="exb-cloud c1"></div>' +
        '<div class="exb-cloud c2"></div>' +
        '<div class="exb-cloud c3"></div>' +
        '<div class="exb-ridge r3" data-depth="9"></div>' +
        '<div class="exb-ridge r2" data-depth="18"></div>' +
        '<div class="exb-ridge r1" data-depth="30"></div>' +
        '<div class="exb-birds">\u2303\u00a0\u00a0\u2303</div>' +
        '<div class="exb-veil"></div>' +
        '<div class="exb-grain"></div>' +
      '</div>' +
      // content
      '<div style="position:relative;z-index:2;width:100%;max-width:1040px;margin:0 auto;text-align:left">' +
        '<div style="display:inline-flex;align-items:center;gap:9px;background:rgba(20,36,28,.42);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 15px;font-family:' + SANS + ';font-size:.72rem;font-weight:800;letter-spacing:.08em;margin-bottom:22px;animation:exb-rise .6s ease both">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#46d97f;box-shadow:0 0 0 4px rgba(70,217,127,.22);animation:exb-pulse 2s infinite"></span><span id="exb-hint">Live national-park conditions</span></div>' +
        '<h1 style="font-family:' + SERIF + ';font-weight:800;font-size:clamp(2.9rem,8vw,5.6rem);line-height:.96;letter-spacing:-.025em;margin:0;max-width:15ch;text-shadow:0 4px 30px rgba(0,0,0,.4);animation:exb-rise .7s ease .05s both">Your national parks, <em style="font-style:italic;color:#e4be78">live.</em></h1>' +
        '<p style="font-family:' + SANS + ';font-size:clamp(1.02rem,1.7vw,1.28rem);margin:22px 0 0;max-width:54ch;color:rgba(251,246,234,.88);line-height:1.55;text-shadow:0 2px 14px rgba(0,0,0,.4);animation:exb-rise .8s ease .1s both">One honest go / no-go call for every U.S. national park \u2014 live weather, alerts and conditions, plus the tools to plan the whole trip around them.</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;animation:exb-rise .9s ease .15s both">' +
          '<button class="exb-btn gold" data-hero="map">Explore the live map \u2192</button>' +
          '<button class="exb-btn ghost" data-hero="/plan">Plan a trip</button>' +
        '</div>' +
        '<div class="exb-quick" style="margin-top:22px;animation:exb-rise 1s ease .2s both"><span class="lbl">Or jump to</span>' +
          '<a data-hero="status">Park status</a><span class="sep">\u00b7</span>' +
          '<a data-hero="near">Parks near me</a><span class="sep">\u00b7</span>' +
          '<a data-hero="/build-trip">Build a trip</a><span class="sep">\u00b7</span>' +
          '<a data-hero="passport">Trip passport</a><span class="sep">\u00b7</span>' +
          '<a data-hero="/shop.html">Shop gear &amp; stays</a></div>' +
      '</div>' +
      '<button class="exb-scroll" data-scroll="1"><span>New here? Discover ParkBuddy</span><span class="ar">&darr;</span></button>' +
      '</section>' +
      '<div class="exb-story">' + aboutHtml + '</div>';

    (document.body || document.documentElement).appendChild(ov);
    homeBtn();
    var pre = document.getElementById('ex-preload'); if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
    setMapChrome(false); // cover is up on first paint — keep map chrome hidden (bug 1)
    watchSheets();

    // bug 4: /explore is the live map itself (reached from the Build page's "Map" tab),
    // so open straight onto the map instead of the bento landing.
    var path = (location.pathname || '').replace(/\/+$/, '');
    var directMap = /\bview=map\b/.test(location.search || '') || /\/explore$/.test(path);
    if (directMap) { ov.style.transition = 'none'; hideCover(); requestAnimationFrame(function () { ov.style.transition = ''; }); }

    var si = ov.querySelector('#ex-signin');
    if (si) si.addEventListener('click', function (e) { e.stopPropagation(); openSignin(); });

    // hero buttons + quick-access links
    ov.querySelectorAll('[data-hero]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var v = el.getAttribute('data-hero');
        if (v === 'map') { hideCover(); }
        else if (v === 'near') { hideCover(); if (typeof window.flyToMe === 'function') setTimeout(window.flyToMe, 350); }
        else if (v === 'status') { openParkList(); }
        else if (v === 'passport') { if (window.__ppPassport && window.__ppPassport.open) window.__ppPassport.open(); else if (typeof toast === 'function') toast('Passport loads in a moment\u2026'); }
        else if (v && v.charAt(0) === '/') { go(v); }
      });
    });

    // live-status selector card (flip to choose: map or list)
    var statusCard = ov.querySelector('#exb-statuscard');
    if (statusCard) {
      var sFront = statusCard.querySelector('.exb-flipfront');
      if (sFront) sFront.addEventListener('click', function (e) { e.stopPropagation(); statusCard.classList.add('flipped'); });
      var sUnflip = statusCard.querySelector('.exb-unflip2');
      if (sUnflip) sUnflip.addEventListener('click', function (e) { e.stopPropagation(); statusCard.classList.remove('flipped'); });
      [].slice.call(statusCard.querySelectorAll('.exb-statopt')).forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var o = b.getAttribute('data-statopt');
          statusCard.classList.remove('flipped');
          if (o === 'map') { hideCover(); }
          else { openParkList(); }
        });
      });
    }

    ov.querySelectorAll('.exb-tile').forEach(function (el, idx) {
      el.style.animationDelay = (0.25 + idx * 0.06) + 's';
      if (el.classList.contains('exb-flip')) {
        var front = el.querySelector('.exb-front');
        if (front) front.addEventListener('click', function (e) { e.stopPropagation(); el.classList.add('flipped'); });
        var unflip = el.querySelector('.exb-unflip');
        if (unflip) unflip.addEventListener('click', function (e) { e.stopPropagation(); el.classList.remove('flipped'); });
        el.querySelectorAll('.exb-opt').forEach(function (b) {
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            if (b.getAttribute('data-sub') === 'map') { el.classList.remove('flipped'); hideCover(); }
            else { openParkList(); }
          });
        });
        return;
      }
      el.addEventListener('click', function () {
        var t = TILES.find(function (x) { return x.k === el.getAttribute('data-k'); });
        if (t) act(t);
      });
    });

    // scroll cue → scroll into the story
    var scrollBtn = ov.querySelector('.exb-scroll');
    if (scrollBtn) scrollBtn.addEventListener('click', function () {
      var band = ov.querySelector('.exb-band');
      if (band) ov.scrollTo({ top: band.offsetTop - 8, behavior: 'smooth' });
    });

    // story CTA buttons
    ov.querySelectorAll('.exb-btn[data-act], .exb-btn[data-go]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (b.getAttribute('data-act') === 'map') hideCover();
        else if (b.getAttribute('data-go')) go(b.getAttribute('data-go'));
      });
    });

    // count-up animation for stats
    function animateCount(b) {
      if (b.__ran) return; b.__ran = true;
      var target = +b.getAttribute('data-count'), suf = b.getAttribute('data-suffix') || '', t0 = null, dur = 1100;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(target * e) + suf;
        if (p < 1) requestAnimationFrame(step); else b.textContent = target + suf;
      }
      requestAnimationFrame(step);
    }

    // reveal story sections as they scroll into view (scroll-based; robust without IO)
    (function () {
      var els = [].slice.call(ov.querySelectorAll('.exb-rv'));
      if (!els.length) return;
      function check() {
        var vh = ov.clientHeight, ovTop = ov.getBoundingClientRect().top;
        els = els.filter(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < ovTop + vh * 0.88 && r.bottom > ovTop + 40) {
            el.classList.add('in');
            [].slice.call(el.querySelectorAll('[data-count]')).forEach(animateCount);
            return false;
          }
          return true;
        });
      }
      ov.addEventListener('scroll', check, { passive: true });
      check();
    })();

    // scroll-driven "trail" workflow — a compass marker hikes the path (cover's own scroll)
    (function () {
      var wf = ov.querySelector('.wf2'); if (!wf) return;
      var sts = [].slice.call(wf.querySelectorAll('.wf2-st'));
      var fill = ov.querySelector('#wf2-fill'), marker = ov.querySelector('#wf2-marker');
      var cur = -1;
      function drive() {
        var wr = wf.getBoundingClientRect();
        var mid = ov.getBoundingClientRect().top + ov.clientHeight * 0.5;
        var prog = (mid - wr.top) / Math.max(wr.height, 1);
        prog = Math.max(0, Math.min(1, prog));
        if (fill) fill.style.height = (prog * 100) + '%';
        if (marker) marker.style.top = (prog * 100) + '%';
        var best = 0, bd = 1e9;
        sts.forEach(function (s, n) { var r = s.getBoundingClientRect(), c = r.top + r.height / 2, d = Math.abs(c - mid); if (d < bd) { bd = d; best = n; } });
        if (best !== cur) { cur = best; sts.forEach(function (s, n) { s.classList.toggle('live', n <= best); }); }
      }
      ov.addEventListener('scroll', drive, { passive: true });
      drive();
    })();

    // gentle parallax on the hero mountains (desktop pointer only)
    (function () {
      var scene = ov.querySelector('.exb-scene'), heroEl = ov.querySelector('.exb-hero');
      if (!scene || !heroEl || window.matchMedia('(max-width:760px)').matches) return;
      var ridges = [].slice.call(scene.querySelectorAll('.exb-ridge[data-depth]')), raf = null;
      heroEl.addEventListener('mousemove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          var dx = (e.clientX / window.innerWidth - .5), dy = (e.clientY / window.innerHeight - .5);
          ridges.forEach(function (l) { var d = +l.getAttribute('data-depth'); l.style.transform = 'translate(' + (dx * d).toFixed(1) + 'px,' + (dy * d * .35).toFixed(1) + 'px)'; });
          raf = null;
        });
      });
    })();

    // live conditions counter
    var hint = ov.querySelector('#exb-hint');
    var iv = setInterval(function () {
      if (!document.getElementById('ex-bento')) { clearInterval(iv); return; }
      var n = window._verdictById ? Object.keys(window._verdictById).length : 0;
      if (hint && n > 0) hint.textContent = "Today\u2019s conditions in for " + n + " parks";
    }, 400);
  }

  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);
})();
