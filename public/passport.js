/* ParkBuddy — shared Trip Passport.
   Self-contained: injects its own styles + overlay, exposes window.__ppPassport.
   Model:
     pp_passports → [{id,name,startDate,days,miles,cost,parkIds[],created}]  (one card per finished trip)
     pp_stamped   → [{id,year}]  parks marked visited (global; synced)
   Each finished Build-a-Trip becomes a digital itinerary card; tapping a park
   stamps it as visited. Requires parks-data.js (window.PARK_BY_ID). */
(function () {
  if (window.__ppPassport) return;

  var GREEN="#1d4a37",GREEN2="#11301f",GOLD="#c79a4b",GOLD2="#e4be78",CREAM="#fbf6ea",INK="#15241c",MUTED="#8c8473";
  var SANS="'Hanken Grotesk',system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  var SERIF="'Spectral',Georgia,serif";
  var TOTAL=63;
  var ICONS=["🏔️","🌲","🏜️","⛰️","🏞️","🌄","🦅","🌋","🏕️","🌊","🍂","🪨"];

  function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function lsGet(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}}
  function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

  function prefs(){return lsGet("pp_prefs",{})||{};}
  function holderName(){return prefs().name||"Guest Explorer";}
  function cards(){var a=lsGet("pp_passports",[]);return Array.isArray(a)?a:[];}
  function stamped(){var a=lsGet("pp_stamped",[]);return Array.isArray(a)?a:[];}
  function isStamped(id){return stamped().some(function(s){return s.id===id;});}
  function stampYear(id){var s=stamped().find(function(x){return x.id===id;});return s&&s.year?s.year:null;}

  function iconFor(id){
    var p=window.PARK_BY_ID&&window.PARK_BY_ID[id];
    if(p&&window.REGION_ICON&&window.REGION_ICON[p.region]&&p.region!=="lower48")return window.REGION_ICON[p.region];
    return ICONS[id%ICONS.length];
  }
  function rank(n){
    if(n>=TOTAL)return "★ Grand Slam";
    if(n>=40)return "★ Park Legend";
    if(n>=20)return "★ Trailblazer";
    if(n>=10)return "★ Park Ranger";
    if(n>=5)return "★ Summit Seeker";
    if(n>=1)return "★ Trail Wanderer";
    return "★ Trailhead Rookie";
  }
  function money(n){return "$"+Math.round(n||0).toLocaleString();}
  function fmtDate(s){ if(!s)return ""; var d=new Date(s+"T00:00:00"); if(isNaN(d))return ""; return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }

  function stats(){
    var s=stamped().length;
    return {stamped:s,total:TOTAL,pct:Math.round(s/TOTAL*100),trips:cards().length};
  }

  // ----- persistence: save a finished trip as a card -----
  function saveTrip(card){
    if(!card)return;
    var list=cards();
    var id=card.id||("t"+Date.now());
    card.id=id; card.created=card.created||Date.now();
    var i=list.findIndex(function(c){return c.id===id || (card.name && c.name===card.name);});
    if(i>=0)list[i]=Object.assign({},list[i],card); else list.unshift(card);
    lsSet("pp_passports",list); // setItem patched by auth.js → cloud sync
    activeId=card.id;
    open();
  }

  // ----- styles -----
  function ensureStyle(){
    if(document.getElementById("pp2-style"))return;
    var st=document.createElement("style");st.id="pp2-style";
    st.textContent=
      "@keyframes pp2in{from{transform:scale(.93) translateY(16px);opacity:0}to{transform:none;opacity:1}}"+
      "@keyframes pp2press{0%{transform:rotate(var(--r,-4deg)) scale(2.3);opacity:0}55%{opacity:1}100%{transform:rotate(var(--r,-4deg)) scale(1)}}"+
      "@keyframes pp2draw{to{stroke-dashoffset:0}}"+
      "#pp2-ov{position:fixed;inset:0;z-index:100002;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(8,16,12,.62);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-family:"+SANS+"}"+
      "#pp2-ov.show{display:flex}"+
      ".pp2-book{width:min(920px,96vw);height:min(600px,90vh);position:relative;border-radius:18px;overflow:hidden;display:flex;background:linear-gradient(145deg,"+GREEN+","+GREEN2+");box-shadow:0 40px 100px rgba(0,0,0,.6);border:1px solid rgba(228,190,120,.3);animation:pp2in .5s cubic-bezier(.2,.8,.3,1)}"+
      ".pp2-close{position:absolute;top:14px;right:16px;z-index:6;width:34px;height:34px;border-radius:50%;border:none;background:rgba(20,36,28,.5);color:#fff;font-size:18px;cursor:pointer}"+
      ".pp2-cover{width:39%;min-width:220px;padding:34px 30px;display:flex;flex-direction:column;color:"+CREAM+";background:linear-gradient(160deg,"+GREEN+",#0e2a1d);border-right:2px dashed rgba(228,190,120,.3)}"+
      ".pp2-foil{font-size:.66rem;letter-spacing:.3em;text-transform:uppercase;color:"+GOLD2+";font-weight:700}"+
      ".pp2-brand{font-family:"+SERIF+";font-weight:800;font-size:2rem;line-height:1.02;margin:8px 0 0;background:linear-gradient(120deg,#f3dca6,"+GOLD+");-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}"+
      ".pp2-emblem{width:80px;height:80px;border-radius:50%;border:2px solid rgba(228,190,120,.5);display:flex;align-items:center;justify-content:center;margin:20px 0;background:radial-gradient(circle,rgba(228,190,120,.16),transparent);font-size:2.1rem}"+
      ".pp2-bar{height:8px;border-radius:999px;background:rgba(255,255,255,.14);overflow:hidden}"+
      ".pp2-bar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,"+GOLD2+","+GOLD+");transition:width .6s cubic-bezier(.2,.8,.3,1)}"+
      ".pp2-pl{display:flex;justify-content:space-between;font-size:.72rem;color:rgba(251,246,234,.72);font-weight:600;margin-top:7px}"+
      ".pp2-holder{margin-top:auto}"+
      ".pp2-lab{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:rgba(251,246,234,.55)}"+
      ".pp2-nm{font-family:"+SERIF+";font-size:1.15rem;font-weight:600;border-bottom:1px solid rgba(228,190,120,.4);padding-bottom:6px;margin-top:3px}"+
      ".pp2-rank{margin-top:12px;display:inline-flex;align-items:center;gap:7px;font-size:.72rem;font-weight:700;color:"+INK+";background:linear-gradient(120deg,"+GOLD2+","+GOLD+");padding:6px 12px;border-radius:999px;align-self:flex-start}"+
      ".pp2-pages{flex:1;background:"+CREAM+";padding:26px 28px;overflow-y:auto}"+
      ".pp2-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}"+
      ".pp2-chip{font-family:"+SANS+";font-size:.74rem;font-weight:700;padding:6px 12px;border-radius:999px;border:1px solid #ddd2bb;background:#fff;color:"+INK+";cursor:pointer;white-space:nowrap}"+
      ".pp2-chip.on{background:"+GREEN+";color:#fff;border-color:"+GREEN+"}"+
      ".pp2-card{border-radius:16px;overflow:hidden;border:1px solid #e6dcc4;box-shadow:0 8px 22px rgba(20,36,28,.1);margin-bottom:18px}"+
      ".pp2-cardhead{background:linear-gradient(135deg,"+GREEN+",#235742);color:"+CREAM+";padding:18px 20px;position:relative}"+
      ".pp2-cardhead .nm{font-family:"+SERIF+";font-weight:700;font-size:1.4rem;line-height:1.05}"+
      ".pp2-cardhead .dt{font-size:.76rem;color:rgba(251,246,234,.78);font-weight:600;margin-top:3px}"+
      ".pp2-cardstats{display:flex;gap:18px;margin-top:14px}"+
      ".pp2-cardstats .s b{font-family:"+SERIF+";font-weight:700;font-size:1.25rem;display:block}"+
      ".pp2-cardstats .s span{font-size:.66rem;text-transform:uppercase;letter-spacing:.05em;color:rgba(251,246,234,.7);font-weight:700}"+
      ".pp2-route{display:flex;align-items:center;gap:0;flex-wrap:wrap;padding:14px 18px;background:#fff}"+
      ".pp2-node{display:flex;align-items:center}"+
      ".pp2-node .dot{width:26px;height:26px;border-radius:50%;background:"+GREEN+";color:#fff;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}"+
      ".pp2-node .dot.done{background:linear-gradient(120deg,"+GOLD2+","+GOLD+");color:"+INK+"}"+
      ".pp2-node .nm{font-size:.74rem;font-weight:600;color:"+INK+";margin:0 4px 0 6px;white-space:nowrap}"+
      ".pp2-node .leg{width:18px;height:2px;background:#d8cdb2;margin:0 2px}"+
      ".pp2-sec{font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:"+GOLD+";margin:4px 0 12px}"+
      ".pp2-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}"+
      ".pp2-stamp{aspect-ratio:1;border-radius:50%;border:2.5px dashed "+GREEN+";display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6px;color:"+GREEN+";cursor:pointer;transform:rotate(var(--r,-4deg));background:rgba(29,74,55,.05);transition:background .2s}"+
      ".pp2-stamp:hover{background:rgba(29,74,55,.12)}"+
      ".pp2-stamp.empty{border-style:dotted;border-color:#cbbfa3;color:#b3a98f;background:transparent}"+
      ".pp2-stamp .ic{font-size:1.1rem}"+
      ".pp2-stamp .pk{font-family:"+SERIF+";font-weight:700;font-size:.72rem;line-height:1.04;margin-top:2px}"+
      ".pp2-stamp .yr{font-size:.54rem;letter-spacing:.08em;margin-top:3px;font-weight:700}"+
      ".pp2-stamp.pressed{animation:pp2press .5s cubic-bezier(.3,1.4,.4,1)}"+
      ".pp2-empty{margin-top:24px;text-align:center;color:"+MUTED+";font-size:.9rem;line-height:1.55}"+
      ".pp2-empty .big{font-size:2.3rem;display:block;margin-bottom:10px}"+
      ".pp2-empty a{display:inline-block;margin-top:14px;background:linear-gradient(120deg,"+GOLD2+","+GOLD+");color:"+INK+";text-decoration:none;font-weight:700;font-size:.82rem;padding:10px 18px;border-radius:10px}"+
      ".pp2-hint{margin-top:14px;font-size:.72rem;color:"+MUTED+";text-align:center}"+
      ".pp2-actions{display:flex;gap:10px;margin-top:18px}"+
      ".pp2-btn{flex:1;padding:11px;border-radius:10px;border:none;font-family:"+SANS+";font-weight:700;font-size:.82rem;cursor:pointer;text-align:center;text-decoration:none}"+
      ".pp2-btn.gold{background:linear-gradient(120deg,"+GOLD2+","+GOLD+");color:"+INK+"}"+
      ".pp2-btn.ghost{background:#fff;border:1px solid #e3d8c2;color:"+GREEN+"}"+
      ".pp2-wallet{display:flex;gap:10px;margin-top:14px}"+
      ".pp2-wbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px;border-radius:11px;border:none;cursor:pointer;background:#15241c;color:#fff;font-family:"+SANS+";font-weight:600;font-size:.8rem}"+
      ".pp2-wbtn:hover{background:#000}"+
      ".pp2-wlabel{font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:"+MUTED+";text-align:center;margin-top:16px}"+
      "@media(max-width:660px){.pp2-book{flex-direction:column;height:min(640px,92vh)}.pp2-cover{width:auto;border-right:none;border-bottom:2px dashed rgba(228,190,120,.3);padding:22px}.pp2-emblem{display:none}.pp2-grid{grid-template-columns:repeat(2,1fr)}}";
    document.head.appendChild(st);
  }

  var ov=null, activeId=null;
  function build(){
    ensureStyle();
    if(ov)return ov;
    ov=document.createElement("div");ov.id="pp2-ov";
    ov.innerHTML=
      '<div class="pp2-book">'+
        '<button class="pp2-close" aria-label="Close">&times;</button>'+
        '<div class="pp2-cover">'+
          '<div class="pp2-foil">National Parks · Trip Passport</div>'+
          '<div class="pp2-brand">ParkBuddy</div>'+
          '<div class="pp2-emblem">🏔️</div>'+
          '<div><div class="pp2-bar"><i id="pp2-fill"></i></div>'+
            '<div class="pp2-pl"><span id="pp2-count">0 of 63 parks</span><span id="pp2-pct">0%</span></div></div>'+
          '<div class="pp2-holder"><div class="pp2-lab">Passport holder</div>'+
            '<div class="pp2-nm" id="pp2-nm">Guest Explorer</div>'+
            '<span class="pp2-rank" id="pp2-rank">★ Trailhead Rookie</span></div>'+
        '</div>'+
        '<div class="pp2-pages" id="pp2-pages"></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector(".pp2-close").onclick=close;
    ov.onclick=function(e){if(e.target===ov)close();};
    return ov;
  }

  function routeHtml(ids){
    return '<div class="pp2-route">'+ids.map(function(id,i){
      var p=window.PARK_BY_ID[id]; if(!p)return "";
      var done=isStamped(id);
      return '<div class="pp2-node">'+(i?'<span class="leg"></span>':'')+
        '<span class="dot'+(done?' done':'')+'">'+(i+1)+'</span>'+
        '<span class="nm">'+esc(p.name.replace(" National Park",""))+'</span></div>';
    }).join("")+'</div>';
  }
  function stampsHtml(ids){
    return '<div class="pp2-grid">'+ids.map(function(id){
      var p=window.PARK_BY_ID[id]; if(!p)return "";
      var on=isStamped(id), r=(-6+(id*4)%11), yr=on?(stampYear(id)||""):"— — —";
      return '<div class="pp2-stamp'+(on?"":" empty")+'" data-id="'+id+'" style="--r:'+r+'deg" title="'+(on?"Visited — tap to remove":"Tap to stamp as visited")+'">'+
        '<div class="ic">'+iconFor(id)+'</div><div class="pk">'+esc(p.name)+'</div><div class="yr">'+yr+'</div></div>';
    }).join("")+'</div>';
  }

  function updateCover(){
    var s=stats();
    document.getElementById("pp2-nm").textContent=holderName();
    document.getElementById("pp2-rank").textContent=rank(s.stamped);
    document.getElementById("pp2-count").textContent=s.stamped+" of "+TOTAL+" parks";
    document.getElementById("pp2-pct").textContent=s.pct+"%";
    document.getElementById("pp2-fill").style.width=Math.max(2,s.pct)+"%";
  }

  function render(){
    build(); updateCover();
    var list=cards();
    var pages=document.getElementById("pp2-pages");
    if(!list.length){
      pages.innerHTML='<div class="pp2-empty"><span class="big">🛂</span>No trip cards yet.<br>Build a trip, then tap <b>Create Trip Passport</b> — your itinerary becomes a collectible card here.<br><a href="/build-trip">Build a trip →</a></div>';
      return;
    }
    if(!activeId||!list.some(function(c){return c.id===activeId;}))activeId=list[0].id;
    var card=list.find(function(c){return c.id===activeId;});
    var ids=(card.parkIds||[]).filter(function(id){return window.PARK_BY_ID&&window.PARK_BY_ID[id];});
    var visited=ids.filter(isStamped).length;

    var chips=list.length>1?('<div class="pp2-chips">'+list.map(function(c){
      return '<button class="pp2-chip'+(c.id===activeId?' on':'')+'" data-card="'+c.id+'">'+esc(c.name||"Trip")+'</button>';
    }).join("")+'</div>'):'';

    var dateStr=card.startDate?(fmtDate(card.startDate)+(card.days?" · "+card.days+" days":"")):(card.days?card.days+" days":"");

    pages.innerHTML=chips+
      '<div class="pp2-card">'+
        '<div class="pp2-cardhead"><div class="nm">'+esc(card.name||"My Trip")+'</div>'+
          '<div class="dt">'+esc(dateStr)+'</div>'+
          '<div class="pp2-cardstats">'+
            '<div class="s"><b>'+ids.length+'</b><span>Parks</span></div>'+
            (card.miles?'<div class="s"><b>'+Math.round(card.miles).toLocaleString()+'</b><span>Miles</span></div>':'')+
            (card.cost?'<div class="s"><b>'+money(card.cost)+'</b><span>Est. cost</span></div>':'')+
            '<div class="s"><b>'+visited+'/'+ids.length+'</b><span>Stamped</span></div>'+
          '</div>'+
        '</div>'+
        (ids.length?routeHtml(ids):'')+
      '</div>'+
      (ids.length?('<div class="pp2-sec">Stamps — tap a park you\u2019ve visited</div>'+stampsHtml(ids)):'<div class="pp2-empty">This trip has no national parks to stamp yet.</div>')+
      '<div class="pp2-wlabel">Save this pass</div>'+
      '<div class="pp2-wallet">'+
        '<button class="pp2-wbtn" id="pp2-apple"></button>'+
        '<button class="pp2-wbtn" id="pp2-google"></button>'+
      '</div>'+
      '<div class="pp2-actions"><a class="pp2-btn gold" href="/build-trip">Plan another trip</a>'+
      '<button class="pp2-btn ghost" id="pp2-share">Share this card</button></div>';

    pages.querySelectorAll(".pp2-chip").forEach(function(b){b.onclick=function(){activeId=b.getAttribute("data-card");render();};});
    pages.querySelectorAll(".pp2-stamp").forEach(function(el){el.onclick=function(){toggleStamp(+el.getAttribute("data-id"),el);};});
    var ap=pages.querySelector("#pp2-apple"), go=pages.querySelector("#pp2-google");
    if(ap){ap.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.8c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-1.1 2.7-2.2.5-.7.9-1.6 1.2-2.5-2.6-1-2.7-3.2-2.7-3.3zM14.2 6.1c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.7-.9 2.8 1 .1 2-.5 2.6-1.3z"/></svg>Apple Wallet';
      ap.onclick=function(){flash("Apple Wallet passes — coming soon!");};}
    if(go){go.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="#fff" stroke-width="1.6"/><path d="M3 10h18" stroke="#fff" stroke-width="1.6"/></svg>Google Wallet';
      go.onclick=function(){flash("Google Wallet passes — coming soon!");};}
    var sh=pages.querySelector("#pp2-share");
    if(sh)sh.onclick=function(){
      var msg=(card.name||"My ParkBuddy trip")+" — "+ids.length+" national parks"+(card.miles?", "+Math.round(card.miles).toLocaleString()+" miles":"")+". My passport: "+stats().stamped+"/"+TOTAL+"!";
      if(navigator.share)navigator.share({title:"ParkBuddy",text:msg,url:location.origin}).catch(function(){});
      else if(navigator.clipboard)navigator.clipboard.writeText(msg+" "+location.origin).then(function(){flash("Copied!");});
      else flash(msg);
    };
  }

  function toggleStamp(id,el){
    var arr=stamped(),i=arr.findIndex(function(x){return x.id===id;}),pressing=i<0;
    if(pressing)arr.push({id:id,year:String(new Date().getFullYear())});else arr.splice(i,1);
    lsSet("pp_stamped",arr);
    updateCover();
    // update the card's stamped counter live
    var card=cards().find(function(c){return c.id===activeId;});
    if(card){var ids=(card.parkIds||[]).filter(function(x){return window.PARK_BY_ID&&window.PARK_BY_ID[x];});var v=ids.filter(isStamped).length;
      var sEl=document.querySelector(".pp2-cardstats .s:last-child b");if(sEl)sEl.textContent=v+"/"+ids.length;}
    if(el){
      var p=window.PARK_BY_ID[id],yr=pressing?String(new Date().getFullYear()):"— — —";
      el.className="pp2-stamp"+(pressing?"":" empty");
      el.querySelector(".yr").textContent=yr;
      el.title=pressing?"Visited — tap to remove":"Tap to stamp as visited";
      if(pressing){void el.offsetWidth;el.classList.add("pressed");}
    }
    // recolor route node
    var node=document.querySelector('.pp2-route .pp2-node .dot[data-rid="'+id+'"]');
    if(typeof window.__ppOnPassportChange==="function"){try{window.__ppOnPassportChange(stats());}catch(e){}}
  }

  function flash(msg){
    var t=document.getElementById("pp2-toast");
    if(!t){t=document.createElement("div");t.id="pp2-toast";t.style.cssText="position:fixed;bottom:64px;left:50%;transform:translateX(-50%);z-index:100003;background:rgba(20,36,28,.94);color:#fbf6ea;font-family:"+SANS+";font-weight:600;font-size:.84rem;padding:11px 18px;border-radius:999px;box-shadow:0 8px 26px rgba(0,0,0,.35);opacity:0;transition:opacity .25s";document.body.appendChild(t);}
    t.textContent=msg;t.style.opacity="1";clearTimeout(t._t);t._t=setTimeout(function(){t.style.opacity="0";},2200);
  }

  function open(opts){ if(opts&&opts.cardId)activeId=opts.cardId; render(); build().classList.add("show"); }
  function close(){ if(ov)ov.classList.remove("show"); }

  window.__ppPassport={open:open,close:close,saveTrip:saveTrip,stats:stats,rank:rank};
})();
