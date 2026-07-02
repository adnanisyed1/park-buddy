/* ParkBuddy landing — living scene, bento mosaic, Trip Passport.
   Runs inside the Next.js embed pipeline (markup in body.html, styles in style.css). */
(function(){
  /* ---------- state heritage scenes ---------- */
  var STATES=[
    {name:"Utah", known:"red-rock canyons & arches",
     sky:["#f7b267","#e76f51","#7d4a3a"], sun:"#fff3d6",
     ridges:[["#b5562f",.92,"0 78%,18% 64%,34% 74%,52% 58%,70% 70%,86% 60%,100% 72%,100% 100%,0 100%"],
             ["#8a3d24",.85,"0 88%,22% 80%,44% 88%,64% 78%,82% 86%,100% 80%,100% 100%,0 100%"],
             ["#5e2c1c",1,"0 95%,30% 90%,60% 95%,100% 90%,100% 100%,0 100%"]]},
    {name:"California", known:"redwoods & Pacific fog",
     sky:["#9fc3b8","#5b8c7e","#244a44"], sun:"#eafff6",
     ridges:[["#3f6f5f",.9,"0 70%,20% 60%,40% 68%,60% 56%,80% 66%,100% 58%,100% 100%,0 100%"],
             ["#2c5246",.92,"0 84%,25% 76%,50% 84%,75% 74%,100% 82%,100% 100%,0 100%"],
             ["#163029",1,"0 94%,50% 88%,100% 94%,100% 100%,0 100%"]]},
    {name:"Montana", known:"glacier peaks & big sky",
     sky:["#bcd6e8","#7fa8c9","#3d5e7e"], sun:"#ffffff",
     ridges:[["#6b8aa6",.85,"0 64%,16% 48%,30% 60%,46% 42%,62% 56%,78% 44%,100% 58%,100% 100%,0 100%"],
             ["#48637e",.9,"0 80%,24% 68%,48% 80%,72% 66%,100% 78%,100% 100%,0 100%"],
             ["#2b3e52",1,"0 92%,40% 86%,100% 92%,100% 100%,0 100%"]]},
    {name:"Arizona", known:"the Grand Canyon",
     sky:["#ffd9a0","#f08a5d","#b83b5e"], sun:"#fff0d0",
     ridges:[["#c96f4a",.9,"0 72%,100% 66%,100% 100%,0 100%"],
             ["#9c4a30",.92,"0 82%,100% 78%,100% 100%,0 100%"],
             ["#6e3120",1,"0 92%,100% 89%,100% 100%,0 100%"]]},
    {name:"Wyoming", known:"Yellowstone & the Tetons",
     sky:["#cfe0d6","#8fb2a4","#3f6b5c"], sun:"#fffbe8",
     ridges:[["#6f93a0",.88,"0 60%,14% 40%,26% 56%,40% 36%,54% 54%,70% 38%,86% 54%,100% 44%,100% 100%,0 100%"],
             ["#41657a",.92,"0 80%,30% 70%,60% 80%,100% 72%,100% 100%,0 100%"],
             ["#243f4e",1,"0 92%,50% 87%,100% 92%,100% 100%,0 100%"]]}
  ];
  function buildScene(){
    var sc=document.getElementById('scene'); if(!sc)return;
    STATES.forEach(function(s,i){
      var ls=document.createElement('div'); ls.className='layerset'+(i===0?' on':'');
      var sky=document.createElement('div'); sky.className='sky';
      sky.style.background='linear-gradient(180deg,'+s.sky[0]+' 0%,'+s.sky[1]+' 52%,'+s.sky[2]+' 100%)';
      ls.appendChild(sky);
      var sun=document.createElement('div'); sun.className='sun';
      var sz=120+(i%2?40:0);
      sun.style.cssText='width:'+sz+'px;height:'+sz+'px;left:22%;top:24%;background:radial-gradient(circle,'+s.sun+',rgba(255,255,255,0) 70%)';
      ls.appendChild(sun);
      s.ridges.forEach(function(r,j){
        var rd=document.createElement('div'); rd.className='ridge';
        rd.style.cssText='height:'+(46+j*14)+'%;background:'+r[0]+';opacity:'+r[1]+';clip-path:polygon('+r[2]+')';
        rd.setAttribute('data-depth',(j+1)*7);
        ls.appendChild(rd);
      });
      sc.appendChild(ls);
    });
  }

  var cur=0;
  function rotate(){
    var sets=document.querySelectorAll('.layerset');
    cur=(cur+1)%STATES.length;
    sets.forEach(function(s,i){s.classList.toggle('on',i===cur);});
    var s=STATES[cur];
    var n=document.getElementById('st-name'),k=document.getElementById('st-known');
    if(n)n.textContent=s.name; if(k)k.textContent='· '+s.known;
  }

  var raf=null;
  function onMove(e){
    if(raf)return;
    raf=requestAnimationFrame(function(){
      var dx=(e.clientX/innerWidth-.5), dy=(e.clientY/innerHeight-.5);
      document.querySelectorAll('.layerset.on .ridge').forEach(function(r){
        var d=+r.getAttribute('data-depth');
        r.style.transform='translate('+(dx*d)+'px,'+(dy*d*.4)+'px)';
      });
      document.querySelectorAll('.layerset.on .sun').forEach(function(s){
        s.style.transform='translate('+(dx*-18)+'px,'+(dy*-12)+'px)';
      });
      raf=null;
    });
  }

  /* ---------- hero words ---------- */
  function buildHero(){
    var words="Find your next wild.".split(" ");
    var h=document.getElementById('hero'); if(!h)return;
    h.innerHTML=words.map(function(w,i){
      return '<span class="word" style="animation-delay:'+(i*.12)+'s">'+(i===2?'<em>'+w+'</em>':w)+'</span>';
    }).join(' ');
  }

  /* ---------- bento tiles ---------- */
  var TILES=[
    {cls:'passport', ti:'🛂', h:'Create your Trip Passport', p:'Every itinerary becomes a collectible passport. Earn a stamp for every park you explore.', action:'passport'},
    {cls:'explore', ti:'🗺️', h:'Explore the map', p:'All 63 parks on a live terrain map — find what\u2019s near you.', href:'/explore'},
    {cls:'status', ti:'🌤️', h:'Live Park Status', p:'Real-time weather, alerts & closures.', live:true, href:'/explore'},
    {ti:'📍', h:'Parks near me', p:'Best parks & lakes nearby.', radar:true, href:'/explore'},
    {ti:'🧭', h:'Build a trip', p:'Real-road routes & costs.', href:'/build-trip'},
    {ti:'🏅', h:'My passports', p:'Your collection & ranks.', action:'passport'},
    {ti:'👥', h:'Community', p:'Trips & tips.', action:'soon'},
    {ti:'🛍️', h:'Shop', p:'Maps & patches.', action:'soon'},
    {ti:'📖', h:'About', p:'Why ParkBuddy.', href:'/about'}
  ];
  function buildTiles(){
    var b=document.getElementById('bento'); if(!b)return;
    b.innerHTML=TILES.map(function(t,i){
      var inner='';
      if(t.cls==='passport'){
        inner='<div class="shimmer"></div><div class="ti">'+t.ti+'</div>'+
          '<div><h3>'+t.h+'</h3><p>'+t.p+'</p></div>'+
          '<div class="crest"><div class="ring"><svg width="60" height="60"><circle cx="30" cy="30" r="25" stroke="rgba(228,190,120,.2)" stroke-width="5" fill="none"></circle><circle id="pp-ring" cx="30" cy="30" r="25" stroke="#e4be78" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="157" stroke-dashoffset="157"></circle></svg><span class="pct" id="pp-pct">0%</span></div>'+
          '<div class="meta"><b id="pp-count">0 of 63 parks</b><br><span id="pp-sub">Start your first passport</span></div></div>'+
          '<div class="go">→</div>';
      } else if(t.cls==='explore'){
        inner='<div class="exmap" id="exmap"></div><div class="ti">'+t.ti+'</div>'+
          '<div><h3>'+t.h+'</h3><p>'+t.p+'</p></div>'+
          '<div class="go">→</div>';
      } else {
        inner='<div class="ti">'+t.ti+'</div>'+(t.radar?'<div class="radar"></div>':'')+
          '<div>'+(t.live?'<div class="live"><span class="livedot"></span><span style="font-size:.74rem;font-weight:700;color:#36864e">Yosemite · OPEN</span></div>':'')+
          '<h3>'+t.h+'</h3>'+(t.live?'<div class="temp">72°</div>':'<p>'+t.p+'</p>')+'</div>'+
          '<div class="go">→</div>';
      }
      return '<div class="tile '+(t.cls||'')+'" data-i="'+i+'" style="animation-delay:'+(.5+i*.08)+'s">'+inner+'</div>';
    }).join('');
    b.querySelectorAll('.tile').forEach(function(el){
      el.onclick=function(){ handle(TILES[+el.getAttribute('data-i')]); };
    });
    buildExploreMap();
  }
  /* animated mini-map inside the Explore tile: stylized US blob, pulsing park dots, drawn route */
  function buildExploreMap(){
    var m=document.getElementById('exmap'); if(!m)return;
    var dots=[[20,42],[31,30],[44,55],[57,38],[68,60],[78,44],[40,72],[62,24],[86,66]];
    var route=[[20,42],[31,30],[44,55],[57,38],[68,60],[78,44]];
    var pts=route.map(function(p){return (p[0]/100*340)+','+(p[1]/100*220);}).join(' ');
    m.innerHTML='<div class="sweep"></div>'+
      '<svg viewBox="0 0 340 220" preserveAspectRatio="none">'+
      '<path class="blob" d="M30 80 Q60 30 130 38 Q210 28 300 60 Q330 110 280 160 Q200 205 110 180 Q40 165 30 80 Z"></path>'+
      '<polyline class="route" points="'+pts+'"></polyline></svg>'+
      dots.map(function(d,i){return '<span class="dot'+(i%2?' p':'')+'" style="left:'+d[0]+'%;top:'+d[1]+'%;animation-delay:'+(i*.3)+'s"></span>';}).join('');
  }
  function handle(t){
    if(t.action==='passport'){openPassport();return;}
    if(t.action==='signin'){doSignin();return;}
    if(t.action==='soon'){toast(t.h+' is coming soon!');return;}
    if(t.href){ if(window.__ppTrans){window.__ppTrans.go(t.href);} else {location.href=t.href;} }
  }
  function openPassport(){ if(window.__ppPassport){window.__ppPassport.open();} else {toast('Passport loads in a moment…');} }

  /* nav actions */
  function wireNav(){
    document.querySelectorAll('[data-action]').forEach(function(el){
      var a=el.getAttribute('data-action');
      el.style.cursor='pointer';
      el.onclick=function(e){
        e.preventDefault();
        if(a==='passport')openPassport();
        else if(a==='signin')doSignin();
        else if(a==='soon')toast('Coming soon!');
      };
    });
  }
  function doSignin(){
    if(window.__ppAuth){ window.__ppAuth.openAccount ? window.__ppAuth.openAccount() : window.__ppAuth.showWelcome(); }
    else { toast('Sign-in loads in a moment…'); }
  }

  /* ---------- toast ---------- */
  function toast(msg){
    var t=document.getElementById('pp-toast');
    if(!t){t=document.createElement('div');t.id='pp-toast';t.style.cssText='position:fixed;bottom:64px;left:50%;transform:translateX(-50%);z-index:80;background:rgba(20,36,28,.92);color:#fbf6ea;font-family:var(--sans);font-weight:600;font-size:.84rem;padding:11px 18px;border-radius:999px;box-shadow:0 8px 26px rgba(0,0,0,.35);opacity:0;transition:opacity .25s';document.body.appendChild(t);}
    t.textContent=msg; t.style.opacity='1'; clearTimeout(t._t);
    t._t=setTimeout(function(){t.style.opacity='0';},2200);
  }

  /* ---------- passport crest (reads shared passport stats) ---------- */
  function updateCrest(){
    var s=(window.__ppPassport&&window.__ppPassport.stats)?window.__ppPassport.stats():{stamped:0,total:63,pct:0,planned:0};
    var ring=document.getElementById('pp-ring');
    if(ring)ring.setAttribute('stroke-dashoffset', String(157*(1-s.stamped/s.total)));
    var pctEl=document.getElementById('pp-pct'); if(pctEl)pctEl.textContent=s.pct+'%';
    var cnt=document.getElementById('pp-count'); if(cnt)cnt.textContent=s.stamped+' of '+s.total+' parks';
    var sub=document.getElementById('pp-sub'); if(sub)sub.textContent=s.planned?(s.planned+' parks in your trips'):'Start your first passport';
  }
  // refresh the tile crest whenever a stamp changes inside the passport
  window.__ppOnPassportChange=function(){updateCrest();};

  function boot(){
    buildScene(); buildHero(); buildTiles(); wireNav(); updateCrest();
    setInterval(rotate,5500);
    document.addEventListener('mousemove',onMove);
    // safety net: guarantee content visible even if entrance animations never run
    setTimeout(function(){document.body.classList.add('revealed');},2600);
    // crest may need a beat for passport.js to finish loading
    setTimeout(updateCrest,400);
  }

  if(document.getElementById('scene')){boot();}
  else{document.addEventListener('DOMContentLoaded',boot);}
})();
