/* ParkBuddy — shared go / no-go verdict engine.
   One source of truth for the live-conditions call, used by the Park Status
   hero card and by each stop in the Trip planner so the two always agree. */
(function(){
  function vnum(s){ if(typeof s==='number')return s; var m=String(s||'').match(/-?\d+/g); return m?Math.max.apply(null,m.map(Number)):null; }
  // per = weather.gov forecast periods (per[0] = now). nws = # weather alerts, nps = # closures.
  function evaluate(per,nws,nps){
    nws=nws||0; nps=nps||0;
    if(!per||!per.length) return null;
    var now0=per[0];
    var temp=vnum(now0.temperature), wind=vnum(now0.windSpeed)||0, sky=(now0.shortForecast||'').toLowerCase();
    var score=100, neg=[], pos=[];
    var tWord=null,tNeg=0;
    if(temp==null){tWord=null;}
    else if(temp<20){tNeg=46;tWord='Bitter cold '+temp+'\u00b0';}
    else if(temp<33){tNeg=30;tWord='Freezing '+temp+'\u00b0';}
    else if(temp<45){tNeg=13;tWord='Cold '+temp+'\u00b0';}
    else if(temp<50){tNeg=4;tWord='Cool '+temp+'\u00b0';}
    else if(temp<=78){tNeg=0;tWord='Mild '+temp+'\u00b0';}
    else if(temp<=86){tNeg=9;tWord='Warm '+temp+'\u00b0';}
    else if(temp<=94){tNeg=24;tWord='Hot '+temp+'\u00b0';}
    else {tNeg=42;tWord='Extreme heat '+temp+'\u00b0';}
    score-=tNeg; if(tWord){ (tNeg>=13?neg:pos).push(tWord); }
    var wWord=null,wNeg=0;
    if(wind>=35){wNeg=30;wWord='High wind '+wind+' mph';}
    else if(wind>=25){wNeg=16;wWord='Windy '+wind+' mph';}
    else if(wind>=15){wNeg=6;wWord='Breezy '+wind+' mph';}
    score-=wNeg; if(wWord) neg.push(wWord);
    var sWord=null,sNeg=0;
    if(/thunder|storm|tornado/.test(sky)){sNeg=35;sWord='Thunderstorms';}
    else if(/blizzard|ice|sleet|freezing rain/.test(sky)){sNeg=28;sWord='Ice & sleet';}
    else if(/snow/.test(sky)){sNeg=22;sWord='Snow';}
    else if(/heavy rain/.test(sky)){sNeg=20;sWord='Heavy rain';}
    else if(/rain/.test(sky)){sNeg=15;sWord='Rain';}
    else if(/shower|drizzle/.test(sky)){sNeg=10;sWord='Showers';}
    else if(/fog|haze|smoke/.test(sky)){sNeg=9;sWord=/smoke/.test(sky)?'Smoke':'Fog';}
    else if(/sunny|clear/.test(sky)){sNeg=0;score+=4;pos.push(/mostly/.test(sky)?'Mostly sunny':'Clear skies');}
    else if(/cloud/.test(sky)){sNeg=2;pos.push('Cloudy');}
    score-=sNeg; if(sWord) neg.push(sWord);
    if(nps>0){ score-=42; neg.unshift(nps+' closure'+(nps>1?'s':'')); }
    else if(nws>0){ score-=Math.min(nws,2)*12; neg.unshift(nws+' weather alert'+(nws>1?'s':'')); }
    else { pos.push('No alerts'); }
    // trust caps — never over-promise into a closed or dangerous park
    if(temp!=null && (temp>=104||temp<=12)) score=Math.min(score,38);
    if(nws>0) score=Math.min(score,72);
    if(nps>0) score=Math.min(score,36);
    if(score>100)score=100; if(score<0)score=0;
    var T;
    if(score>=82) T={word:'Great day to go',sub:'Conditions are about as good as it gets \u2014 pack up and enjoy.',c:'#2f7d4f',ic:'\u2713',ring:'rgba(47,125,79,.18)',grad:'linear-gradient(90deg,#3f9a5c,#5fae6e)',orb:'linear-gradient(150deg,#e3f4e6,#c4e8cd)'};
    else if(score>=62) T={word:'Good to go',sub:'Solid conditions for a visit \u2014 a little prep and you\u2019re set.',c:'#3f8a3a',ic:'\u2713',ring:'rgba(63,138,58,.16)',grad:'linear-gradient(90deg,#4f9a3a,#7bb24a)',orb:'linear-gradient(150deg,#eef5e0,#d6e8bf)'};
    else if(score>=42) T={word:'Go prepared',sub:'You can go, but the conditions need respect \u2014 gear up before you head out.',c:'#b9802a',ic:'\u25ce',ring:'rgba(199,154,75,.2)',grad:'linear-gradient(90deg,#d4a23f,#e4be78)',orb:'linear-gradient(150deg,#fbf0d8,#f1ddb2)'};
    else if(score>=24) T={word:'Maybe hold off',sub:'Conditions are rough today \u2014 go only if you\u2019re experienced and equipped.',c:'#c4703a',ic:'\u26a0',ring:'rgba(196,112,58,.2)',grad:'linear-gradient(90deg,#cf7338,#e0995a)',orb:'linear-gradient(150deg,#fbe8d8,#f3d2b4)'};
    else T={word:'Better another day',sub:'Today\u2019s not the day \u2014 closures or harsh weather make for a poor trip.',c:'#bf463a',ic:'\u2715',ring:'rgba(191,70,58,.2)',grad:'linear-gradient(90deg,#c0473a,#d76e54)',orb:'linear-gradient(150deg,#fbe0db,#f3c2b8)'};
    var chips=[];
    neg.slice(0,3).forEach(function(t){chips.push({t:t,pos:false});});
    pos.slice(0,Math.max(1,3-chips.length)).forEach(function(t){chips.push({t:t,pos:true});});
    return {score:score, word:T.word, sub:T.sub, c:T.c, ic:T.ic, ring:T.ring, grad:T.grad, orb:T.orb, chips:chips, temp:temp, sky:now0.shortForecast||'', wind:wind};
  }
  // Fetch live conditions for a lat/lng and evaluate. cb(result|null).
  // Weather only (no NPS closures) — the planner strip is a quick read; the full
  // status page layers in closures. Cached per-rounded-coord for the session.
  var _pcache={};
  function fetchPeriods(lat,lng,cb){
    var key=lat.toFixed(3)+','+lng.toFixed(3);
    if(_pcache[key]){ cb(_pcache[key]); return; }
    fetch('https://api.weather.gov/points/'+lat.toFixed(4)+','+lng.toFixed(4),{headers:{Accept:'application/geo+json'}})
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(d){return fetch(d.properties.forecast,{headers:{Accept:'application/geo+json'}});})
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(d){ _pcache[key]=d.properties.periods; cb(_pcache[key]); })
      .catch(function(){ cb(null); });
  }
  // today's verdict (used by the map + status page)
  function fetchVerdict(lat,lng,cb){ fetchPeriods(lat,lng,function(per){ cb(per?evaluate(per,0,0):null); }); }
  window.PBVerdict={evaluate:evaluate, fetchVerdict:fetchVerdict, fetchPeriods:fetchPeriods, vnum:vnum};
})();
