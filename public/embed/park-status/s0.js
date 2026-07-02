/* ParkBuddy — live Park Status (terrain + season living scene). Vanilla build for Next.js embed. */
(function(){
function init(){

    var PB=window.PB, WeatherFX=window.WeatherFX;
    var PARKS=PB.parks, SI=PB.stateInfo;
    // --- Source-aware destinations (foundation for state parks / national forests) ---
    // The built-in 63 are NPS national parks. Additional destinations (state parks &
    // national forests from PAD-US / USFS) can arrive via window.PB.destinations or a
    // sessionStorage handoff from the map — each with a namespaced string id + a `source`.
    var EXTRA=[];
    try{ if(PB.destinations&&PB.destinations.length) EXTRA=EXTRA.concat(PB.destinations); }catch(e){}
    try{ var _hd=JSON.parse(sessionStorage.getItem('pb_dest')||'null'); if(_hd&&_hd.id!=null&&typeof _hd.lat==='number') EXTRA=EXTRA.concat([_hd]); }catch(e){}
    function normDest(p){
      if(!p)return p;
      if(!p.source) p.source=(typeof p.id==='number')?'nps':'other';
      if(!p.type) p.type=(p.source==='nps')?'national_park':(p.source==='usfs')?'national_forest':(p.source==='state')?'state_park':'destination';
      return p;
    }
    PARKS.forEach(normDest); EXTRA.forEach(normDest);
    var ALL=PARKS.concat(EXTRA);
    function findDest(id){ for(var i=0;i<ALL.length;i++){ if(String(ALL[i].id)===String(id)) return ALL[i]; } return null; }
    // Per-source presentation profile — drives labels, links & which AGENCY sections show.
    // Universal sections (weather, verdict, alerts, nearby places/trails) always run.
    function destProfile(p){
      var s=p.source||'nps';
      if(s==='usfs'||p.type==='national_forest') return { kind:'National Forest', agency:'USDA Forest Service', hasNPS:false,
        recQuery:p.name, official:p.url||('https://www.google.com/search?q='+encodeURIComponent(p.name+' fs.usda.gov')), officialLabel:'Official Forest Service page \u2197' };
      if(s==='state'||p.type==='state_park') return { kind:'State Park', agency:((p.state||'State')+' State Parks'), hasNPS:false,
        recQuery:p.name, official:p.url||('https://www.google.com/search?q='+encodeURIComponent(p.name+' '+(p.state||'')+' state park')), officialLabel:'Official state-park page \u2197' };
      return { kind:'National Park', agency:'National Park Service', hasNPS:true,
        recQuery:p.name+' National Park', official:'https://www.google.com/search?q='+encodeURIComponent(p.name+' national park nps.gov'), officialLabel:'Official NPS info \u2197' };
    }
    var el=function(id){return document.getElementById(id);};
    var rafFlag=false;
    var pgState={};
    function toast(msg){
      var t=document.getElementById('pb-toast');
      if(!t){ t=document.createElement('div'); t.id='pb-toast'; t.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);z-index:120;background:linear-gradient(120deg,#1d4a37,#163a2b);color:#fbf6ea;font-size:.84rem;font-weight:700;padding:11px 18px;border-radius:999px;box-shadow:0 16px 40px -16px rgba(0,0,0,.6);opacity:0;transition:opacity .3s,transform .3s;pointer-events:none'; document.body.appendChild(t); }
      t.textContent=msg; t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)';
      clearTimeout(t._h); t._h=setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; },2200);
    }
    function addParkToTrip(){
      var p=findDest(current); if(!p)return;
      var t={}; try{ t=JSON.parse(localStorage.getItem('pp_trip2')||'{}')||{}; }catch(e){ t={}; }
      if(!t.s)t.s=[];
      var exists=t.s.some(function(s){return (s.pid===p.id)||(s.p===p.id);});
      if(!exists){ t.s.push({pid:p.id,ni:2,lo:''}); try{ localStorage.setItem('pp_trip2',JSON.stringify(t)); }catch(e){} }
      toast(exists ? p.name+' is already in your trip' : 'Added '+p.name+' to your trip ✓');
    }
    function paginatedList(boxId,items,pageSize,renderItem,key){
      var box=el(boxId); if(!box)return;
      var pages=Math.ceil(items.length/pageSize), page=pgState[key]||0;
      if(page>=pages)page=pgState[key]=0;
      var start=page*pageSize, html=items.slice(start,start+pageSize).map(renderItem).join('');
      if(pages>1){
        var bp='border:1px solid #e7ddca;background:#fffdf7;color:#1d4a37;font-size:.78rem;font-weight:700;padding:6px 13px;border-radius:9px;cursor:pointer;font-family:inherit';
        html+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid #e7ddca">'
          +'<button data-pg="prev" style="'+bp+'">‹ Prev</button>'
          +'<span style="font-size:.72rem;color:#8c8473;font-weight:700;letter-spacing:.04em">'+(page+1)+' / '+pages+' · '+items.length+' total</span>'
          +'<button data-pg="next" style="'+bp+'">Next ›</button></div>';
      }
      box.innerHTML=html;
      var pv=box.querySelector('[data-pg=prev]'), nx=box.querySelector('[data-pg=next]');
      if(pv)pv.onclick=function(){ pgState[key]=(page-1+pages)%pages; paginatedList(boxId,items,pageSize,renderItem,key); };
      if(nx)nx.onclick=function(){ pgState[key]=(page+1)%pages; paginatedList(boxId,items,pageSize,renderItem,key); };
      Array.prototype.forEach.call(box.querySelectorAll('.js-addtrip'),function(b){ b.onclick=function(){ addParkToTrip(); }; });
    }
    function campItem(c){
      return '<div style="'+S.vi+'"><b style="font-size:.86rem;color:#163a2b;display:block">'+(c.name||'')+'</b>'
        +(c.description?'<p style="font-size:.78rem;color:#6a7160;line-height:1.45;margin-top:3px">'+c.description+'</p>':'')
        +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center">'
        +'<button class="js-addtrip" style="display:inline-flex;align-items:center;gap:5px;background:linear-gradient(120deg,#1d4a37,#163a2b);color:#fff;border:none;font-size:.74rem;font-weight:700;padding:6px 12px;border-radius:9px;cursor:pointer;font-family:inherit">+ Add to trip</button>'
        +(c.reservationUrl?'<a href="'+c.reservationUrl+'" target="_blank" rel="noopener" style="font-size:.74rem;color:#1d4a37;font-weight:700;text-decoration:none">Reserve ↗</a>':'')
        +(c.url?'<a href="'+c.url+'" target="_blank" rel="noopener" style="font-size:.74rem;color:#1d4a37;font-weight:600;text-decoration:none">Details ↗</a>':'')
        +'</div></div>';
    }
    function renderCamps(cg){
      var box=el('camps'); if(!box)return;
      if(!cg.length){ box.innerHTML='<span style="'+S.load+'">No campgrounds listed.</span>'; return; }
      paginatedList('camps',cg,4,campItem,'camps');
    }

    var S={
      td:'display:flex;gap:13px;padding:13px 0;border-top:1px solid #e7ddca',
      tdimg:'width:88px;height:66px;object-fit:cover;border-radius:11px;flex:none',
      h4:'font-size:.96rem;color:#163a2b;margin-bottom:3px;font-family:Spectral,Georgia,serif;font-weight:700',
      p:'font-size:.83rem;line-height:1.5;color:#525a46',
      dur:'font-size:.72rem;color:#8c8473;margin-top:3px',
      achip:'font-size:.76rem;background:rgba(238,243,230,.85);border:1px solid #e7ddca;color:#1d4a37;padding:5px 12px;border-radius:999px;font-weight:600',
      fee:'padding:11px 0;border-top:1px solid #e7ddca',
      ft:'display:flex;justify-content:space-between;gap:10px;align-items:baseline',
      amt:'font-size:1.05rem;font-weight:700;color:#1d4a37;font-family:Spectral,Georgia,serif',
      vi:'padding:9px 0;border-top:1px solid #e7ddca',
      btn:'display:inline-flex;align-items:center;gap:6px;text-decoration:none;background:rgba(238,243,230,.85);color:#1d4a37;border:1px solid #e7ddca;font-size:.82rem;font-weight:600;padding:8px 14px;border-radius:11px',
      btnP:'display:inline-flex;align-items:center;gap:6px;text-decoration:none;background:linear-gradient(120deg,#1d4a37,#163a2b);color:#fff;border:1px solid transparent;font-size:.82rem;font-weight:600;padding:8px 14px;border-radius:11px',
      row:'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px',
      clear:'display:flex;align-items:center;gap:8px;color:#3f7a34;font-weight:600;font-size:.9rem',
      gchip:'flex:1 1 116px;min-width:116px;background:#f7f3e9;border:1px solid #e7ddca;border-radius:14px;padding:11px 13px',
      gk:'font-size:.6rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8c8473',
      gv:'font-family:Spectral,Georgia,serif;font-size:1.4rem;font-weight:700;color:#1d4a37;margin-top:4px;line-height:1',
      gs:'font-size:.68rem;color:#8c8473;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      load:'color:#8c8473;font-size:.86rem'
    };
    var REG={lower48:'Contiguous U.S.',alaska:'Alaska',hawaii:'Hawaii',territory:'U.S. Territory'};

    /* ---------- picker ---------- */
    var pick=el('pick');
    ALL.slice().sort(function(a,b){return a.name.localeCompare(b.name);}).forEach(function(p){
      var o=document.createElement('option'); o.value=p.id; o.textContent=p.name+(p.state?' — '+p.state:''); pick.appendChild(o);
    });
    function paramId(){
      var u=new URLSearchParams(location.search), q=u.get('park')||u.get('dest'); if(!q)return null;
      var byId=findDest(q); if(byId)return byId.id;
      var n=q.toLowerCase().replace(/[^a-z]/g,'');
      var byName=ALL.find(function(p){return p.name.toLowerCase().replace(/[^a-z]/g,'')===n;});
      return byName?byName.id:null;
    }
    function addPickOption(p){
      if(pick.querySelector('option[value="'+String(p.id).replace(/"/g,'\\"')+'"]'))return;
      var o=document.createElement('option'); o.value=p.id; o.textContent=p.name+(p.state?' — '+p.state:''); pick.appendChild(o);
    }
    // Direct navigation to a state park / national forest (e.g. ?dest=usfs:co-white-river-national-forest)
    // won't have been handed off by the map, so it isn't in ALL yet. Pull it from the destinations API
    // by exact id, register it, and re-render — otherwise the page would silently fall back to Yosemite.
    function resolveMissingDest(pending){
      var u=new URLSearchParams(location.search), q=u.get('park')||u.get('dest');
      if(!q || paramId()!=null){ if(pending) render(); return; } // nothing to resolve, or already resolvable locally
      fetch('/api/destinations?id='+encodeURIComponent(q)).then(function(r){return r.json();}).then(function(j){
        var list=(j&&j.destinations)||[], d=null;
        for(var i=0;i<list.length;i++){ if(String(list[i].id)===String(q)){ d=list[i]; break; } }
        if(!d && list.length===1) d=list[0]; // exact-id API deployed: single row is the match
        if(!d){ if(pending) render(); return; } // fall back to the default view
        d=normDest(d); EXTRA.push(d); ALL=PARKS.concat(EXTRA);
        addPickOption(d);
        current=d.id; pick.value=current; render();
      }).catch(function(){ if(pending) render(); });
    }
    var current=paramId()||PARKS.find(function(p){return p.name==='Yosemite';}).id;
    pick.value=current;
    pick.onchange=function(){var v=pick.value; var d=findDest(v); current=(d&&typeof d.id==='number')?+v:v; render();};

    /* ---------- tabs ---------- */
    var BTN='flex:1;min-width:96px;border:none;padding:10px 14px;font-size:.86rem;font-weight:700;font-family:inherit;cursor:pointer;border-radius:11px;white-space:nowrap;';
    function showTab(t){
      document.querySelectorAll('#seg button').forEach(function(b){
        b.style.cssText=BTN+(b.getAttribute('data-tab')===t?'background:linear-gradient(120deg,#1d4a37,#163a2b);color:#fbf6ea;box-shadow:0 6px 16px -8px rgba(15,44,32,.7)':'background:transparent;color:#6a7160');
      });
      ['now','do','visit','story'].forEach(function(x){ var pane=el('pane-'+x); if(pane) pane.style.display=(x===t?(x==='now'||x==='visit'?'grid':(x==='do'||x==='story'?'grid':'block')):'none'); });
    }
    function getScroller(){
      var els=[document.scrollingElement, document.documentElement, document.body];
      for(var i=0;i<els.length;i++){ var e=els[i]; if(e && e.scrollHeight>e.clientHeight+4) return e; }
      return document.scrollingElement||document.documentElement||document.body;
    }
    function scrollToEl(target, off){
      if(!target)return; off=(off==null)?80:off;
      var sc=getScroller(), start=sc.scrollTop||0;
      var y=Math.max(0, target.getBoundingClientRect().top+start-off);
      var dist=y-start, t0=null, dur=460;
      function step(ts){ if(t0===null)t0=ts; var p=Math.min(1,(ts-t0)/dur); sc.scrollTop=start+dist*(1-Math.pow(1-p,3)); if(p<1)requestAnimationFrame(step); }
      if(window.requestAnimationFrame){ requestAnimationFrame(step); setTimeout(function(){ sc.scrollTop=y; },520); }
      else { sc.scrollTop=y; }
    }
    function gotoTab(t){ showTab(t); scrollToEl(document.getElementById('seg'),80); }
    document.querySelectorAll('#seg button').forEach(function(b){ b.onclick=function(){ gotoTab(b.getAttribute('data-tab')); }; });
    var _sbx=el('statusBox'); if(_sbx)_sbx.addEventListener('click',function(){ showTab('now'); scrollToEl((el('glance')&&el('glance').parentElement)||document.getElementById('seg'),80); });
    el('waalert').addEventListener('click',function(e){ e.preventDefault(); openAlertModal(); });
    function openAlertModal(){
      var body=el('alertModalBody'); if(!body)return;
      var nps=el('npsalerts'), wx=el('alerts');
      body.innerHTML='<div style="font-size:.64rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#1d4a37;margin:0 0 9px">Official NPS · closures</div>'+(nps?nps.innerHTML:'')+
        '<div style="font-size:.64rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#1d4a37;margin:18px 0 9px">National Weather Service</div>'+(wx?wx.innerHTML:'');
      el('alertModal').style.display='flex';
    }
    function closeAlertModal(){ var m=el('alertModal'); if(m)m.style.display='none'; }
    var amc=el('alertModalClose'); if(amc)amc.onclick=closeAlertModal;
    var am=el('alertModal'); if(am)am.addEventListener('click',function(e){ if(e.target===am)closeAlertModal(); });
    var cue=el('scrollcue'); if(cue)cue.addEventListener('click',function(){ scrollToEl(document.getElementById('seg'),80); });
    var nav=el('navfloat');
    if(nav){
      var navL=el('navfloatLabel'), navA=el('navfloatArrow');
      var pageY=function(){ return window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||(getScroller()&&getScroller().scrollTop)||0; };
      var setY=function(y){ y=Math.max(0,y); try{window.scrollTo(0,y);}catch(e){} try{document.documentElement.scrollTop=y;}catch(e){} try{document.body.scrollTop=y;}catch(e){} var s=getScroller(); if(s)s.scrollTop=y; };
      var animTo=function(toY){ var start=pageY(), t0=null; toY=Math.max(0,toY); function step(ts){ if(t0===null)t0=ts; var pr=Math.min(1,(ts-t0)/460); setY(start+(toY-start)*(1-Math.pow(1-pr,3))); if(pr<1)requestAnimationFrame(step); } requestAnimationFrame(step); };
      nav.onclick=function(){
        if(nav.getAttribute('data-dir')==='up'){ animTo(0); }
        else { var seg=document.getElementById('seg'); if(seg) animTo(pageY()+seg.getBoundingClientRect().top-70); }
      };
      var updNav=function(){
        var y=pageY(), seg=document.getElementById('seg');
        var segTop=seg?(seg.getBoundingClientRect().top+y):99999;
        var up=(y > segTop-260);
        nav.setAttribute('data-dir', up?'up':'down');
        if(navL)navL.textContent = up?'Back to top':'Live conditions below';
        if(navA)navA.textContent = up?'↑':'↓';
      };
      window.addEventListener('scroll',updNav,{capture:true,passive:true});
      window.addEventListener('resize',updNav,{passive:true}); setTimeout(updNav,80); updNav();
    }
    var topbar=el('topbar');
    if(topbar){
      var py=function(){ return window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||(getScroller()&&getScroller().scrollTop)||0; };
      topbar.style.willChange='transform';
      var lastHY=py();
      var hideBar=function(){ topbar.style.transform='translateY(-180%)'; };
      var showBar=function(){ topbar.style.transform='translateY(0)'; };
      var onHScroll=function(){
        var y=py(), dy=y-lastHY;
        if(y<70){ showBar(); }
        else if(dy>4 && y>120){ hideBar(); }
        else if(dy<-4){ showBar(); }
        lastHY=y;
      };
      window.addEventListener('scroll',onHScroll,{capture:true,passive:true});
      var cb=el('topbarClose'); if(cb)cb.onclick=function(e){ e.preventDefault(); e.stopPropagation(); hideBar(); };
    }

    /* ====================== LIVING SCENE ====================== */
    function hx(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
    function rgb(a){return 'rgb('+a[0]+','+a[1]+','+a[2]+')';}
    function scale(a,f,b){b=b||0;return [Math.max(0,Math.min(255,Math.round(a[0]*f+b))),Math.max(0,Math.min(255,Math.round(a[1]*f+b))),Math.max(0,Math.min(255,Math.round(a[2]*f+b)))];}
    function mix(a,b,t){return [Math.round(a[0]+(b[0]-a[0])*t),Math.round(a[1]+(b[1]-a[1])*t),Math.round(a[2]+(b[2]-a[2])*t)];}

    function silSvg(type,col,w,h){
      if(type==='hiker') return '<svg viewBox="0 0 28 42" width="'+(w||36)+'" height="'+(h||54)+'" fill="none" stroke="'+col+'" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3.4" fill="'+col+'" stroke="none"></circle><path d="M12 9 L12 23"></path><path d="M12 14 L19 19"></path><path d="M12 23 L8 36"></path><path d="M12 23 L16 36"></path><path d="M20 6 L21 38"></path><path d="M9 11 Q4 13 6 20"></path></svg>';
      if(type==='biker') return '<svg viewBox="0 0 42 32" width="'+(w||56)+'" height="'+(h||42)+'" fill="none" stroke="'+col+'" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="23" r="6.5"></circle><circle cx="33" cy="23" r="6.5"></circle><path d="M9 23 L19 23 L26 12 L33 23 M19 23 L23 12"></path><circle cx="25" cy="6.5" r="2.8" fill="'+col+'" stroke="none"></circle><path d="M25 9 L23 14 M23 12 L30 13"></path></svg>';
      return '<svg viewBox="0 0 52 24" width="'+(w||66)+'" height="'+(h||30)+'" fill="none"><path d="M3 14 Q26 24 49 14 Q26 19 3 14 Z" fill="'+col+'"></path><circle cx="26" cy="6" r="3.2" fill="'+col+'"></circle><rect x="24.7" y="8" width="2.6" height="7" rx="1.3" fill="'+col+'"></rect><path d="M15 3 L37 13" stroke="'+col+'" stroke-width="2.2" stroke-linecap="round"></path></svg>';
    }
    function silhouettes(cfg){
      var night=(cfg.tod==='night');
      var col=night?'rgba(228,235,231,.4)':'rgba(16,28,20,.4)';
      var out='';
      cfg.sils.forEach(function(t,i){
        if(t==='birds'){
          var flock='';
          for(var b=0;b<3;b++){ flock+='<span style="display:inline-block;margin:0 7px;animation:pb-bob '+(2.4+b*0.4)+'s ease-in-out '+(b*0.3)+'s infinite"><svg viewBox="0 0 24 12" width="'+(24+b*5)+'" height="'+(12+b*2)+'" fill="none" stroke="'+col+'" stroke-width="1.8" stroke-linecap="round"><path d="M1 8 Q6 1 12 7 Q18 1 23 8"></path></svg></span>'; }
          out+='<div style="position:absolute;top:'+(15+i*7)+'%;left:0;animation:pb-cross '+(50+i*9)+'s linear '+(i*7)+'s infinite">'+flock+'</div>';
        } else if(t==='raft'||t==='kayak'||t==='canoe'||t==='boat'){
          var bp=cfg.water?(100-cfg.water.y-3)+'%':'11%';
          out+='<div style="position:absolute;bottom:'+bp+';left:0;animation:pb-cross 42s linear infinite"><span style="display:inline-block;animation:pb-bobr 3s ease-in-out infinite">'+silSvg('boat',col)+'</span></div>';
        } else {
          out+='<div style="position:absolute;bottom:9%;left:0;animation:pb-cross '+(58+i*7)+'s linear '+(i*5)+'s infinite"><span style="display:inline-block;animation:pb-bob 1.8s ease-in-out infinite">'+silSvg(t,col)+'</span></div>';
        }
      });
      return out;
    }
    function particles(cfg,night){
      var type=cfg.particles;
      if(type==='none') return '';
      if(night && type!=='snow') return '';
      if(type==='mist'){
        var m='';
        for(var i=0;i<4;i++){ m+='<div style="position:absolute;left:-30%;width:160%;top:'+(40+i*12)+'%;height:14px;border-radius:20px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);filter:blur(4px);opacity:.5;animation:pb-mist '+(10+i*3)+'s linear '+(i*1.5)+'s infinite"></div>'; }
        return m;
      }
      var conf={pollen:{c:'#ece0b0',rise:true,a:[2,4]},dust:{c:'#d8c9a0',rise:true,a:[1.5,3]},embers:{c:'#e0894a',rise:true,a:[2,3.6]},snow:{c:'#ffffff',rise:false,a:[2.5,5]},leaves:{c:'#c87a32',rise:false,a:[6,11]}}[type];
      if(!conf) return '';
      var out='';
      for(var i=0;i<22;i++){
        var x=Math.random()*100, sz=conf.a[0]+Math.random()*(conf.a[1]-conf.a[0]), dur=conf.rise?(9+Math.random()*7):(7+Math.random()*8), delay=Math.random()*dur;
        var shape=(type==='leaves')?'border-radius:45% 55% 50% 50%':'border-radius:50%';
        var pos=conf.rise?'bottom:-2%':'top:-4%';
        out+='<span style="position:absolute;left:'+x.toFixed(1)+'%;'+pos+';width:'+sz.toFixed(1)+'px;height:'+sz.toFixed(1)+'px;'+shape+';background:'+conf.c+';opacity:0;animation:'+(conf.rise?'pb-rise':'pb-fall')+' '+dur.toFixed(1)+'s linear '+delay.toFixed(1)+'s infinite"></span>';
      }
      return '<div style="position:absolute;inset:0;pointer-events:none">'+out+'</div>';
    }
    function buildScene(cfg){
      var sc=el('livescene'); if(!sc)return;
      var night=(cfg.tod==='night'), dusk=(cfg.tod==='dusk'), dawn=(cfg.tod==='dawn');
      var sky=cfg.sky.map(hx);
      if(dusk) sky=sky.map(function(c){return scale(mix(c,[255,150,90],.28),.9);});
      else if(dawn) sky=sky.map(function(c){return mix(c,[255,205,160],.16);});
      else if(night) sky=sky.map(function(c){return mix(scale(c,.3),[18,26,54],.55);});
      var html='<div style="position:absolute;inset:0;background:linear-gradient(180deg,'+rgb(sky[0])+' 0%,'+rgb(sky[1])+' 50%,'+rgb(sky[2])+' 100%)"></div>';
      if(night){ var st=''; for(var i=0;i<46;i++){ var sx=Math.random()*100, sy=Math.random()*56, ss=(Math.random()*1.5+0.6).toFixed(1); st+='<span style="position:absolute;left:'+sx.toFixed(1)+'%;top:'+sy.toFixed(1)+'%;width:'+ss+'px;height:'+ss+'px;border-radius:50%;background:#fff;opacity:.5;animation:pb-twinkle '+(2+Math.random()*3).toFixed(1)+'s ease-in-out '+(Math.random()*4).toFixed(1)+'s infinite"></span>'; } html+='<div style="position:absolute;inset:0">'+st+'</div>'; }
      var sunC=night?'#eef3ff':cfg.sun, sunSz=night?72:150;
      var sunX=(cfg.arch==='canyon'||cfg.arch==='desert')?'70%':'24%';
      var sunY=night?'15%':(dusk?'40%':'22%');
      var glow=night?'radial-gradient(circle,'+sunC+',rgba(238,243,255,0) 66%)':'radial-gradient(circle,'+sunC+',rgba(255,255,255,0) 70%)';
      html+='<div style="position:absolute;left:'+sunX+';top:'+sunY+';width:'+sunSz+'px;height:'+sunSz+'px;border-radius:50%;background:'+glow+';filter:blur(2px);animation:pb-sun 7s ease-in-out infinite"></div>';
      var waterH=cfg.water?(100-cfg.water.y):0;
      var ridges=cfg.ridges, n=ridges.length, cols=cfg.colors.map(hx);
      for(var r=0;r<n;r++){
        var col=cols[Math.min(r,cols.length-1)];
        if(night) col=scale(col,.42); else if(dusk) col=scale(mix(col,[120,70,80],.18),.84);
        var op=(n===3?[0.74,0.9,1][r]:[0.86,1][r]);
        var bottom=cfg.water?waterH+'%':'0';
        var hh=ridges[r].h+(cfg.water?-6:0);
        html+='<div data-depth="'+((r+1)*8)+'" style="position:absolute;left:-9%;right:-9%;bottom:'+bottom+';height:'+hh+'%;background:'+rgb(col)+';opacity:'+op+';clip-path:polygon('+ridges[r].clip+');will-change:transform"></div>';
      }
      if(cfg.snow && !night){ var fc=mix(cols[0],[255,255,255],.55); html+='<div style="position:absolute;left:-9%;right:-9%;bottom:'+(cfg.water?waterH+'%':'0')+';height:'+(ridges[0].h-2)+'%;background:'+rgb(fc)+';opacity:.5;clip-path:polygon('+ridges[0].clip+')"></div>'; }
      if(cfg.water){
        var w=cfg.water.colors.map(hx); if(night)w=w.map(function(c){return scale(c,.4);});
        html+='<div style="position:absolute;left:0;right:0;bottom:0;height:'+waterH+'%;background:linear-gradient(180deg,'+rgb(w[0])+','+rgb(w[1])+')"></div>';
        for(var k=0;k<4;k++){ html+='<div style="position:absolute;left:6%;right:6%;bottom:'+(waterH-3-k*6)+'%;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);opacity:.5;animation:pb-shimmer '+(4+k)+'s ease-in-out '+(k*.5)+'s infinite"></div>'; }
      }
      if(cfg.river){
        html+='<div style="position:absolute;left:-12%;right:-12%;bottom:12%;height:48px;transform:rotate(-3deg);background:linear-gradient(90deg,transparent,rgba(198,226,232,.5) 20%,rgba(212,236,240,.62),rgba(198,226,232,.5) 80%,transparent);filter:blur(1px)"></div>';
        html+='<div style="position:absolute;left:6%;right:20%;bottom:14%;height:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);transform:rotate(-3deg);animation:pb-shimmer 4s ease-in-out infinite"></div>';
      }
      html+=silhouettes(cfg);
      html+=particles(cfg,night);
      var layer=document.createElement('div'); layer.setAttribute('data-scenelayer','1');
      layer.style.cssText='position:absolute;inset:0;opacity:0;transition:opacity 1s ease';
      layer.innerHTML=html; sc.appendChild(layer);
      void layer.offsetWidth;
      setTimeout(function(){layer.style.opacity='1';},20);
      var all=sc.querySelectorAll('[data-scenelayer]');
      for(var z=0;z<all.length-1;z++){ (function(o){setTimeout(function(){if(o.parentNode)o.parentNode.removeChild(o);},1100);})(all[z]); }
    }
    document.addEventListener('mousemove',function(e){
      if(rafFlag)return; rafFlag=true;
      requestAnimationFrame(function(){
        var dx=e.clientX/window.innerWidth-.5, dy=e.clientY/window.innerHeight-.5;
        document.querySelectorAll('#livescene [data-depth]').forEach(function(r){ var d=+r.getAttribute('data-depth'); r.style.transform='translate('+(dx*d)+'px,'+(dy*d*.34)+'px)'; });
        rafFlag=false;
      });
    });

    /* ---------- best-activity hero ---------- */
    function actType(t){ t=(t||'').toLowerCase();
      if(/bik/.test(t)) return 'biker';
      if(/raft|kayak|canoe|paddl|snorkel|swim|boat|sail|dive|fish/.test(t)) return 'boat';
      if(/wildlife|bird|whale|seal/.test(t)) return 'birds';
      if(/star|aurora/.test(t)) return 'stars';
      return 'hiker';
    }
    function activityBand(act, big){
      var type=actType(act.t), H=big?80:54, W=240, fig='rgba(248,241,224,.85)', night=(type==='stars'), inner='', i, b;
      var sky=night?'linear-gradient(180deg,#172241 0%,#293760 58%,#3a4a72 100%)':'linear-gradient(180deg,#a9c4da 0%,#e8c79a 56%,#f3ddb8 100%)';
      // sun or stars
      if(!night){
        inner+='<div style="position:absolute;right:'+(big?30:20)+'px;top:'+(big?13:9)+'px;width:'+(big?24:17)+'px;height:'+(big?24:17)+'px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fff6d8,#ffcc74 72%);box-shadow:0 0 20px 6px rgba(255,201,110,.5);animation:pb-sun 6s ease-in-out infinite"></div>';
      } else {
        var ns=big?16:9;
        for(i=0;i<ns;i++){ inner+='<span style="position:absolute;left:'+(6+i*(86/ns)).toFixed(1)+'%;top:'+(8+(i%3)*18)+'%;width:'+(1.5+(i%2))+'px;height:'+(1.5+(i%2))+'px;border-radius:50%;background:#fff;opacity:.85;animation:pb-twinkle '+(2+i%3)+'s ease-in-out '+(i*0.22).toFixed(1)+'s infinite"></span>'; }
      }
      // layered mountain ridges
      var far='M0 '+H+' L0 '+Math.round(H*0.5)+' L'+Math.round(W*0.26)+' '+Math.round(H*0.26)+' L'+Math.round(W*0.44)+' '+Math.round(H*0.46)+' L'+Math.round(W*0.68)+' '+Math.round(H*0.2)+' L'+W+' '+Math.round(H*0.48)+' L'+W+' '+H+' Z';
      var near='M0 '+H+' L0 '+Math.round(H*0.74)+' L'+Math.round(W*0.32)+' '+Math.round(H*0.4)+' L'+Math.round(W*0.58)+' '+Math.round(H*0.72)+' L'+Math.round(W*0.8)+' '+Math.round(H*0.52)+' L'+W+' '+Math.round(H*0.78)+' L'+W+' '+H+' Z';
      var farCol=night?'rgba(220,228,255,.1)':'rgba(86,108,122,.5)', nearCol=night?'rgba(210,220,250,.16)':'rgba(31,49,42,.74)';
      inner+='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="'+far+'" fill="'+farCol+'"></path><path d="'+near+'" fill="'+nearCol+'"></path>'
        +'<path d="M'+Math.round(W*0.32)+' '+Math.round(H*0.4)+' l-7 9 l7 -3 l7 3 Z" fill="rgba(255,255,255,'+(night?'.5':'.7')+')"></path></svg>';
      if(type==='birds'){
        var bx=[22,48,68];
        for(b=0;b<3;b++){ inner+='<div style="position:absolute;top:'+(14+b*11)+'%;left:'+bx[b]+'%;animation:pb-bob '+(2.4+b*0.5)+'s ease-in-out '+(b*0.4).toFixed(1)+'s infinite"><svg viewBox="0 0 24 12" width="'+((big?20:15)+b*3)+'" height="'+((big?10:7)+b)+'" fill="none" stroke="'+fig+'" stroke-width="1.7" stroke-linecap="round"><path d="M1 8 Q6 1 12 7 Q18 1 23 8"></path></svg></div>'; }
      } else if(type==='boat'){
        inner+='<div style="position:absolute;left:0;right:0;bottom:0;height:'+(big?30:20)+'px;background:linear-gradient(180deg,rgba(120,168,190,.55),rgba(58,108,140,.8))"></div>';
        for(i=0;i<3;i++){ inner+='<div style="position:absolute;left:6%;right:6%;bottom:'+(big?(8+i*7):(5+i*5))+'px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.62),transparent);opacity:.55;animation:pb-shimmer '+(3+i)+'s ease-in-out '+(i*0.4)+'s infinite"></div>'; }
        inner+='<div style="position:absolute;left:44%;bottom:'+(big?14:9)+'px;transform:translateX(-50%);animation:pb-bobr 3s ease-in-out infinite">'+silSvg('boat',fig,big?50:34,big?23:16)+'</div>';
      } else {
        var sz=(type==='biker')?(big?[46,34]:[30,22]):(big?[27,41]:[18,27]);
        inner+='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><path d="M'+Math.round(W*0.06)+' '+Math.round(H*0.95)+' Q'+Math.round(W*0.22)+' '+Math.round(H*0.74)+' '+Math.round(W*0.31)+' '+Math.round(H*0.44)+'" fill="none" stroke="rgba(248,241,224,.42)" stroke-width="1.6" stroke-dasharray="2 4" stroke-linecap="round"></path></svg>';
        inner+='<div style="position:absolute;left:31%;bottom:'+Math.round(H*0.42)+'px;transform:translateX(-50%);animation:pb-bob 2.2s ease-in-out infinite">'+silSvg(type,fig,sz[0],sz[1])+'</div>';
      }
      return '<div style="position:relative;height:'+H+'px;margin-top:'+(big?16:10)+'px;overflow:hidden;border-radius:11px;background:'+sky+'">'+inner+'</div>';
    }
    function heroScene(act){
      var type=actType(act.t);
      var scene = type==='biker'?'forest' : type==='boat'?'river' : type==='birds'?'meadow' : type==='stars'?'night' : 'alpine';
      var fig='rgba(248,241,224,.94)', W=240, H=120, inner='', i, b;
      var svgOpen='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">';

      if(scene==='alpine'){
        var sky='linear-gradient(180deg,#8fb6d6 0%,#e7c79a 55%,#f4dab4 100%)';
        inner+='<div style="position:absolute;right:14%;top:13%;width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 40% 38%,#fff6d8,#ffcc74 72%);box-shadow:0 0 44px 14px rgba(255,201,110,.42);animation:pb-sun 6s ease-in-out infinite"></div>';
        var far='M0 '+H+' L0 '+(H*0.56)+' L'+(W*0.28)+' '+(H*0.3)+' L'+(W*0.5)+' '+(H*0.5)+' L'+(W*0.74)+' '+(H*0.24)+' L'+W+' '+(H*0.46)+' L'+W+' '+H+' Z';
        var near='M0 '+H+' L0 '+(H*0.72)+' L'+(W*0.22)+' '+(H*0.54)+' L'+(W*0.44)+' '+(H*0.74)+' L'+(W*0.68)+' '+(H*0.38)+' L'+(W*0.86)+' '+(H*0.58)+' L'+W+' '+(H*0.48)+' L'+W+' '+H+' Z';
        inner+=svgOpen+'<path d="'+far+'" fill="rgba(96,122,144,.45)"></path><path d="'+near+'" fill="rgba(34,54,68,.8)"></path><path d="M'+(W*0.68)+' '+(H*0.38)+' l-9 12 l9 -4 l9 4 Z" fill="rgba(255,255,255,.82)"></path></svg>';
        inner+=svgOpen+'<path d="M'+(W*0.96)+' '+(H*0.95)+' Q'+(W*0.82)+' '+(H*0.72)+' '+(W*0.69)+' '+(H*0.42)+'" fill="none" stroke="rgba(248,241,224,.5)" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"></path></svg>';
        inner+='<div style="position:absolute;left:68%;bottom:56%;transform:translateX(-50%);animation:pb-bob 2.6s ease-in-out infinite">'+silSvg('hiker',fig,36,55)+'</div>';
        return '<div style="position:absolute;inset:0;overflow:hidden;background:'+sky+'">'+inner+'</div>';
      }
      if(scene==='forest'){
        var sky='linear-gradient(180deg,#d6dfcd 0%,#aec39e 45%,#83a079 100%)';
        inner+='<div style="position:absolute;left:22%;top:9%;width:66px;height:66px;border-radius:50%;background:radial-gradient(circle,rgba(255,251,224,.85),rgba(255,251,224,0) 70%);animation:pb-sun 7s ease-in-out infinite"></div>';
        inner+=svgOpen+'<path d="M0 '+H+' L0 '+(H*0.62)+' Q'+(W*0.3)+' '+(H*0.48)+' '+(W*0.6)+' '+(H*0.6)+' T'+W+' '+(H*0.56)+' L'+W+' '+H+' Z" fill="rgba(108,138,106,.5)"></path></svg>';
        var pine=function(x,baseY,w,h,col){ return '<path d="M'+x+' '+baseY+' L'+(x-w)+' '+baseY+' L'+(x-w*0.5)+' '+(baseY-h*0.5)+' L'+(x-w*0.78)+' '+(baseY-h*0.5)+' L'+x+' '+(baseY-h)+' L'+(x+w*0.78)+' '+(baseY-h*0.5)+' L'+(x+w*0.5)+' '+(baseY-h*0.5)+' L'+(x+w)+' '+baseY+' Z" fill="'+col+'"></path>'; };
        var pines='', pdat=[[0.08,0.96,9,40],[0.2,1.0,12,52],[0.84,0.97,10,44],[0.95,1.02,13,56],[0.72,0.94,8,34]];
        for(i=0;i<pdat.length;i++){ pines+=pine(W*pdat[i][0],H*pdat[i][1],pdat[i][2],pdat[i][3],'rgba(26,44,32,.85)'); }
        inner+=svgOpen+'<path d="M0 '+H+' L0 '+(H*0.78)+' Q'+(W*0.42)+' '+(H*0.66)+' '+W+' '+(H*0.76)+' L'+W+' '+H+' Z" fill="rgba(38,58,42,.72)"></path>'+pines+'</svg>';
        for(i=0;i<3;i++){ inner+='<div style="position:absolute;left:-25%;width:150%;top:'+(42+i*16)+'%;height:13px;border-radius:20px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);filter:blur(5px);opacity:.55;animation:pb-mist '+(9+i*3)+'s linear '+(i*1.6)+'s infinite"></div>'; }
        inner+='<div style="position:absolute;left:58%;bottom:50%;transform:translateX(-50%);animation:pb-bob 2.4s ease-in-out infinite">'+silSvg('biker',fig,58,43)+'</div>';
        return '<div style="position:absolute;inset:0;overflow:hidden;background:'+sky+'">'+inner+'</div>';
      }
      if(scene==='river'){
        var sky='linear-gradient(180deg,#c2e2f4 0%,#86b7da 42%,#5f97c3 70%)';
        inner+='<div style="position:absolute;left:50%;top:13%;margin-left:-26px;width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 42% 40%,#fff8de,#ffd884 72%);box-shadow:0 0 40px 12px rgba(255,216,132,.45);animation:pb-sun 6s ease-in-out infinite"></div>';
        inner+=svgOpen+'<path d="M0 '+(H*0.5)+' L'+(W*0.26)+' '+(H*0.32)+' L'+(W*0.46)+' '+(H*0.48)+' L'+(W*0.7)+' '+(H*0.3)+' L'+W+' '+(H*0.46)+' L'+W+' '+(H*0.52)+' L0 '+(H*0.54)+' Z" fill="rgba(74,100,118,.55)"></path></svg>';
        inner+='<div style="position:absolute;left:0;right:0;bottom:0;height:48%;background:linear-gradient(180deg,rgba(124,180,204,.72),rgba(40,92,128,.92))"></div>';
        inner+='<div style="position:absolute;left:50%;bottom:0;width:30px;height:48%;margin-left:-15px;background:linear-gradient(180deg,rgba(255,224,150,.6),rgba(255,224,150,0));filter:blur(3px);opacity:.7;animation:pb-shimmer 4s ease-in-out infinite"></div>';
        for(i=0;i<5;i++){ inner+='<div style="position:absolute;left:6%;right:6%;bottom:'+(5+i*8)+'%;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.62),transparent);opacity:.55;animation:pb-shimmer '+(3+i*0.6)+'s ease-in-out '+(i*0.35)+'s infinite"></div>'; }
        inner+='<div style="position:absolute;left:58%;bottom:46%;transform:translateX(-50%);animation:pb-bobr 3s ease-in-out infinite">'+silSvg('boat',fig,68,32)+'</div>';
        return '<div style="position:absolute;inset:0;overflow:hidden;background:'+sky+'">'+inner+'</div>';
      }
      if(scene==='meadow'){
        var sky='linear-gradient(180deg,#f4b06a 0%,#f6cf86 38%,#ecdca6 100%)';
        inner+='<div style="position:absolute;left:50%;bottom:42%;width:72px;height:72px;margin-left:-36px;border-radius:50%;background:radial-gradient(circle at 45% 45%,#fff0c2,#ffac46 70%);box-shadow:0 0 64px 20px rgba(255,170,70,.4);animation:pb-sun 7s ease-in-out infinite"></div>';
        inner+=svgOpen+'<path d="M0 '+H+' L0 '+(H*0.64)+' Q'+(W*0.3)+' '+(H*0.54)+' '+(W*0.58)+' '+(H*0.62)+' T'+W+' '+(H*0.6)+' L'+W+' '+H+' Z" fill="rgba(176,146,74,.5)"></path><path d="M0 '+H+' L0 '+(H*0.8)+' Q'+(W*0.4)+' '+(H*0.68)+' '+W+' '+(H*0.78)+' L'+W+' '+H+' Z" fill="rgba(96,108,52,.72)"></path></svg>';
        var mbx=[24,44,66];
        for(b=0;b<3;b++){ inner+='<div style="position:absolute;top:'+(13+b*8)+'%;left:'+mbx[b]+'%;animation:pb-bob '+(2.6+b*0.5)+'s ease-in-out '+(b*0.4).toFixed(1)+'s infinite"><svg viewBox="0 0 24 12" width="'+(24+b*5)+'" height="'+(12+b)+'" fill="none" stroke="rgba(74,58,30,.72)" stroke-width="1.7" stroke-linecap="round"><path d="M1 8 Q6 1 12 7 Q18 1 23 8"></path></svg></div>'; }
        for(i=0;i<14;i++){ var px=Math.random()*96+2, py=Math.random()*38+42; inner+='<span style="position:absolute;left:'+px.toFixed(1)+'%;top:'+py.toFixed(1)+'%;width:'+(2+Math.random()*2).toFixed(1)+'px;height:'+(2+Math.random()*2).toFixed(1)+'px;border-radius:50%;background:rgba(255,238,182,.9);box-shadow:0 0 4px rgba(255,224,150,.7);animation:pb-bob '+(2.5+Math.random()*2.2).toFixed(1)+'s ease-in-out '+(Math.random()*2).toFixed(1)+'s infinite"></span>'; }
        return '<div style="position:absolute;inset:0;overflow:hidden;background:'+sky+'">'+inner+'</div>';
      }
      var sky='linear-gradient(180deg,#101a36 0%,#1f2b50 55%,#33406b 100%)';
      for(i=0;i<30;i++){ inner+='<span style="position:absolute;left:'+(Math.random()*94+2).toFixed(1)+'%;top:'+(Math.random()*62+3).toFixed(1)+'%;width:'+(1.4+Math.random()*1.6).toFixed(1)+'px;height:'+(1.4+Math.random()*1.6).toFixed(1)+'px;border-radius:50%;background:#fff;opacity:.85;animation:pb-twinkle '+(2+i%4)+'s ease-in-out '+(i*0.1).toFixed(1)+'s infinite"></span>'; }
      inner+='<div style="position:absolute;right:16%;top:14%;width:44px;height:44px;border-radius:50%;background:radial-gradient(circle at 38% 36%,#fdfbf0,#d6dcf0 76%);box-shadow:0 0 28px 8px rgba(214,220,240,.35)"></div>';
      var nm='M0 '+H+' L0 '+(H*0.7)+' L'+(W*0.3)+' '+(H*0.42)+' L'+(W*0.54)+' '+(H*0.66)+' L'+(W*0.78)+' '+(H*0.44)+' L'+W+' '+(H*0.64)+' L'+W+' '+H+' Z';
      inner+=svgOpen+'<path d="'+nm+'" fill="rgba(10,16,34,.85)"></path></svg>';
      return '<div style="position:absolute;inset:0;overflow:hidden;background:'+sky+'">'+inner+'</div>';
    }
    function renderBest(){
      var A=PB.activities(current), s=A.season;
      var tag=s.charAt(0).toUpperCase()+s.slice(1)+' · best right now';
      var lead=A.list[0];
      el('bestLead').style.cursor='pointer';
      el('bestLead').style.position='relative';
      el('bestLead').style.overflow='hidden';
      el('bestLead').style.minHeight='clamp(176px,22vh,222px)';
      el('bestLead').style.padding='18px 20px';
      el('bestLead').style.border='1.5px solid rgba(228,190,120,.72)';
      el('bestLead').style.boxShadow='0 22px 60px -28px rgba(0,0,0,.7),0 0 0 4px rgba(228,190,120,.16)';
      el('bestLead').style.display='flex';
      el('bestLead').style.alignItems='flex-end';
      el('bestLead').innerHTML=
        heroScene(lead)+
        '<div style="position:absolute;inset:0;background:linear-gradient(102deg,rgba(9,24,16,.9) 0%,rgba(9,24,16,.66) 44%,rgba(9,24,16,.16) 78%,rgba(9,24,16,.04) 100%)"></div>'+
        '<div style="position:absolute;top:12px;right:14px;z-index:3;display:inline-flex;align-items:center;gap:5px;background:linear-gradient(120deg,#e4be78,#c79a4b);color:#15241c;font-size:.58rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;padding:5px 10px;border-radius:999px;box-shadow:0 6px 16px -6px rgba(0,0,0,.5)">★ Top pick</div>'+
        '<div style="position:relative;z-index:2;max-width:50ch">'+
          '<div style="font-size:.64rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#e4be78;margin-bottom:9px">'+tag+'</div>'+
          '<div style="display:flex;align-items:flex-start;gap:13px">'+
            '<div style="font-size:2.1rem;line-height:1;flex:none">'+lead.ic+'</div>'+
            '<div style="flex:1"><h3 style="font-family:Spectral,serif;font-weight:800;color:#fbf6ea;font-size:1.42rem;line-height:1.05;letter-spacing:-.01em">'+lead.t+'</h3>'+
            '<p style="color:rgba(251,246,234,.9);font-size:.88rem;line-height:1.5;margin-top:6px">'+lead.b+'</p></div>'+
          '</div>'+
          '<div style="margin-top:12px;font-size:.76rem;font-weight:800;letter-spacing:.02em;color:#e4be78">See all things to do →</div>'+
        '</div>';
      el('bestRest').innerHTML=A.list.slice(1).map(function(a){
        return '<div style="position:relative;overflow:hidden;cursor:pointer;flex:1 1 200px;min-width:178px;min-height:160px;border:1px solid rgba(255,255,255,.16);border-radius:16px;display:flex;align-items:flex-end;box-shadow:0 16px 40px -24px rgba(0,0,0,.6)">'+
          heroScene(a)+
          '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,24,16,.05) 0%,rgba(9,24,16,.32) 52%,rgba(9,24,16,.86) 100%)"></div>'+
          '<div style="position:relative;z-index:2;padding:13px">'+
            '<div style="font-size:1.3rem;line-height:1">'+a.ic+'</div>'+
            '<div style="font-family:Spectral,serif;font-weight:700;color:#fbf6ea;font-size:1rem;margin-top:6px">'+a.t+'</div>'+
            '<div style="color:rgba(251,246,234,.82);font-size:.74rem;line-height:1.4;margin-top:3px">'+a.b+'</div>'+
          '</div></div>';
      }).join('');
      el('bestLead').onclick=function(){ gotoTab('do'); };
      Array.prototype.forEach.call(el('bestRest').children,function(c){ c.onclick=function(){ gotoTab('do'); }; });
      el('terrLabel').textContent=A.label;
    }

    /* ====================== LIVE DATA ====================== */
    function offline(msg){
      el('alerts').innerHTML='<span style="'+S.load+'">'+msg+'</span>';
      el('glance').innerHTML='<div style="'+S.gchip+';flex:1 1 100%"><div style="'+S.gk+'">Coverage</div><div style="'+S.gv+';font-size:1rem">Outside NWS area</div><div style="'+S.gs+'">No live weather for this territory</div></div>';
    }
    function offlineWeather(){
      var msg='Live weather appears on the published site.';
      el('glance').innerHTML='<div style="'+S.gchip+';flex:1 1 100%"><div style="'+S.gk+'">Live data</div><div style="'+S.gv+';font-size:1rem">On the published site</div><div style="'+S.gs+'">weather.gov can\u2019t load from a local file</div></div>';
    }
    function loadConditions(p){
      var pane=el('pane-now'); if(!pane) return;
      var card=el('liveCond');
      if(!card){ card=document.createElement('div'); card.id='liveCond'; card.style.cssText='grid-column:1/-1;background:#fffdf7;border:1px solid #e7ddca;border-radius:20px;padding:18px;box-shadow:0 18px 44px -22px rgba(28,46,34,.45),0 2px 6px rgba(28,46,34,.05)'; pane.insertBefore(card, pane.firstChild); }
      card.innerHTML='<div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#8c8473;font-weight:800;margin-bottom:9px">Live alerts &amp; conditions</div><span style="'+S.load+'">Checking weather alerts, wildfire &amp; air quality…</span>';
      fetch('/api/conditions?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(!d){ card.style.display='none'; return; }
        var H='<div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#8c8473;font-weight:800;margin-bottom:12px">Live alerts &amp; conditions</div>';
        var any=false;
        var pill=function(bg,bd,col,ic,t,s){return '<div style="display:flex;gap:11px;align-items:flex-start;background:'+bg+';border:1px solid '+bd+';border-radius:13px;padding:12px 13px;margin-bottom:9px"><span style="font-size:1.1rem;line-height:1">'+ic+'</span><div style="min-width:0"><b style="color:'+col+';font-size:.9rem;display:block">'+t+'</b>'+(s?'<span style="font-size:.78rem;color:#5b6258;line-height:1.4;display:block;margin-top:2px">'+s+'</span>':'')+'</div></div>';};
        (d.weatherAlerts||[]).forEach(function(a){ any=true; var sev=/extreme|severe/i.test(a.severity); H+=pill(sev?'rgba(217,83,79,.08)':'rgba(199,154,75,.1)', sev?'rgba(217,83,79,.3)':'rgba(199,154,75,.32)', sev?'#b03b36':'#9a6f28', sev?'⚠️':'⚡', a.event+(a.area?' · '+a.area.split(';')[0]:''), (a.headline||a.instruction||'').slice(0,150)); });
        (d.wildfires||[]).forEach(function(f){ any=true; H+=pill('rgba(217,83,79,.08)','rgba(217,83,79,.3)','#b03b36','🔥', f.name+' wildfire'+(f.distanceMi!=null?' · ~'+f.distanceMi+' mi away':''), [f.acres!=null?f.acres.toLocaleString()+' acres':'', f.percentContained!=null?f.percentContained+'% contained':''].filter(Boolean).join(' · ')); });
        if(d.airQuality){ any=true; var aq=d.airQuality, bad=aq.aqi>100; H+=pill(bad?'rgba(217,83,79,.08)':'rgba(63,122,52,.1)', bad?'rgba(217,83,79,.3)':'rgba(63,122,52,.28)', bad?'#b03b36':'#2f7d4f','🌫️', 'Air quality: '+aq.category+' (AQI '+aq.aqi+')', aq.parameter+(aq.reportingArea?' · '+aq.reportingArea:'')); }
        if(!any){ H+='<div style="display:flex;gap:10px;align-items:center;color:#2f7d4f;font-weight:700;font-size:.88rem;background:rgba(63,122,52,.08);border:1px solid rgba(63,122,52,.25);border-radius:13px;padding:13px"><span>✓</span> No active weather alerts, wildfires, or air-quality concerns nearby.</div>'; }
        var credits=['Alerts: NOAA/NWS weather.gov','Wildfire: NIFC'];
        if(d.airQuality){ credits.push('Air quality: AirNow — EPA &amp; state/local/tribal air agencies'); }
        H+='<div style="font-size:.62rem;color:#a79f8c;margin-top:11px;line-height:1.4">Data &amp; credit: '+credits.join(' · ')+'. Agencies are the owners and authorities for their data.</div>';
        card.innerHTML=H; card.style.display='';
      }).catch(function(){ card.style.display='none'; });
    }
    // Adventure Basecamp: curated towns win (editorial quality); otherwise pull the nearest
    // real towns live from OpenStreetMap so EVERY destination shows gateway towns, not just
    // the marquee ones. gwToken guards against a slow fetch landing after the user switches.
    var gwToken = 0;
    function gatewayCard(){
      var pane = el('pane-now'); if(!pane) return null;
      var gc = el('gateway');
      if(!gc){ gc=document.createElement('div'); gc.id='gateway'; gc.style.cssText='grid-column:1/-1;background:linear-gradient(150deg,#33555f,#1d3941);border:1px solid rgba(228,190,120,.3);border-radius:20px;padding:18px;color:#fbf6ea;box-shadow:0 18px 44px -22px rgba(8,18,12,.5)'; pane.insertBefore(gc, pane.firstChild); }
      return gc;
    }
    function renderGateway(g){
      var gc = gatewayCard(); if(!gc) return;
      var towns = (g.towns && g.towns.length) ? g.towns : (g.town ? [{ name:g.town }] : []);
      if(!towns.length){ gc.style.display='none'; return; }
      var multi = towns.length > 1;
      var head = '<div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#e4be78;font-weight:800;margin-bottom:7px">Adventure basecamp'+(multi?'s':'')+'</div>';
      var chip = 'display:inline-flex;align-items:center;gap:6px;background:linear-gradient(120deg,#e4be78,#c79a4b);color:#15241c;font-size:.82rem;font-weight:800;padding:8px 13px;border-radius:11px;text-decoration:none';
      var lodge = function(t){ return 'https://www.google.com/maps/search/lodging+near+'+encodeURIComponent(t.name); };
      var html;
      if(multi){
        var chips = towns.map(function(t){
          var dist = (t.distanceMi!=null) ? ' <span style="font-weight:600;opacity:.75">· '+t.distanceMi+' mi</span>' : '';
          return '<a href="'+lodge(t)+'" target="_blank" rel="noopener" style="'+chip+'">\uD83C\uDFD5\uFE0F '+t.name+dist+'</a>';
        }).join('');
        html = head + '<p style="font-size:.86rem;color:rgba(251,246,234,.82);line-height:1.5;margin:0 0 12px">'+g.blurb+'</p><div style="display:flex;flex-wrap:wrap;gap:8px">'+chips+'</div>';
      } else {
        var t0 = towns[0];
        html = head + '<div style="font-family:Spectral,serif;font-weight:700;font-size:1.3rem">\uD83C\uDFD5\uFE0F '+t0.name+'</div><p style="font-size:.86rem;color:rgba(251,246,234,.82);line-height:1.5;margin-top:6px">'+g.blurb+'</p><a href="'+lodge(t0)+'" target="_blank" rel="noopener" style="display:inline-block;margin-top:10px;'+chip+'">Find lodging here \u2192</a>';
      }
      gc.innerHTML = html; gc.style.display='';
    }
    function loadGateway(p){
      var curated = (window.PB_GATEWAY && window.PB_GATEWAY(p.name)) || null;
      if(curated){ renderGateway(curated); return; }
      var mine = ++gwToken, gc0 = el('gateway'); if(gc0) gc0.style.display='none';
      fetch('/api/gateway?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)+'&state='+encodeURIComponent(p.state||'')).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(mine!==gwToken) return; // user switched destinations — drop stale result
        if(!d || !d.towns || !d.towns.length){ var g1=el('gateway'); if(g1)g1.style.display='none'; return; }
        renderGateway({ blurb: d.blurb || 'Closest towns for lodging, food and supplies.', towns: d.towns });
      }).catch(function(){ if(mine===gwToken){ var g2=el('gateway'); if(g2)g2.style.display='none'; } });
    }
    // National forests: pull the real rec-area record (description, activities, campgrounds,
    // directions) from Recreation.gov / RIDB and fill the sections that otherwise just link out.
    var fdToken = 0;
    function fmtName(s){ return String(s||'').replace(/_/g,' ').toLowerCase().replace(/\b([a-z])/g,function(m,c){return c.toUpperCase();}); }
    function loadForestDetail(p, prof){
      var mine = ++fdToken;
      fetch('/api/forest?name='+encodeURIComponent(p.name)+'&lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(mine!==fdToken || !d || !d.found) return; // keep the link-out fallback
        var off = d.official || prof.official;
        var offLink = '<a href="'+off+'" target="_blank" rel="noopener" style="color:#2c5562;font-weight:700">'+prof.officialLabel+'</a>';
        var credit = '<div style="font-size:.62rem;color:#a79f8c;margin-top:11px;line-height:1.4">Data &amp; credit: '+(d.credit||'Recreation.gov / RIDB')+'</div>';
        if(d.description){ setBox('nps', npsMapBlock(p)+'<p style="'+S.p+';margin-bottom:10px">'+d.description+'</p><div style="font-size:.78rem;color:#6a7160">'+prof.kind+' · '+prof.agency+'. '+offLink+'</div>'); }
        if(d.activities && d.activities.length){
          var chips='<div style="display:flex;flex-wrap:wrap;gap:8px">'+d.activities.slice(0,18).map(function(a){ return '<span style="'+S.achip+'">'+fmtName(a)+'</span>'; }).join('')+'</div>'+credit;
          var tb=el('todo'); if(tb) tb.innerHTML=chips;
          var ab=el('activities'); if(ab) ab.innerHTML=chips;
        }
        if(d.campgrounds && d.campgrounds.length){
          var cg=d.campgrounds.map(function(c){
            return '<div style="'+S.vi+'"><b style="font-size:.86rem;color:#163a2b;display:block">'+fmtName(c.name)+'</b>'
              +(c.description?'<p style="font-size:.78rem;color:#6a7160;line-height:1.45;margin-top:3px">'+c.description.replace(/^Overview\s*/i,'')+'</p>':'')
              +(c.url?'<div style="display:flex;gap:8px;margin-top:8px"><a href="'+c.url+'" target="_blank" rel="noopener" style="font-size:.74rem;color:#1d4a37;font-weight:700;text-decoration:none">'+(c.reservable?'Reserve ↗':'Details ↗')+'</a></div>':'')
              +'</div>';
          }).join('');
          var cb=el('camps'); if(cb) cb.innerHTML=cg+credit;
        }
        if(d.recAreas && d.recAreas.length){
          var pr=el('places'); if(pr) pr.innerHTML=d.recAreas.map(function(x){ return '<div style="'+S.td+'"><div><h4 style="'+S.h4+'">'+fmtName(x.name)+'</h4>'+(x.description?'<p style="'+S.p+'">'+x.description.replace(/^Overview\s*/i,'')+'</p>':'')+(x.url?'<div style="'+S.dur+'"><a href="'+x.url+'" target="_blank" rel="noopener" style="color:#1d4a37;font-weight:700;text-decoration:none">Details ↗</a></div>':'')+'</div></div>'; }).join('')+credit; }
        var _maps='https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lng;
        var _gd=d.directions && !/^n\/?a\.?$/i.test(String(d.directions).trim());
        var _gp=d.phone && !/^1+$/.test(String(d.phone).replace(/[^0-9]/g,''));
        var db=el('directions');
        if(db) db.innerHTML=(_gd?'<p style="'+S.p+'">'+d.directions+'</p>':'<p style="'+S.p+'">'+p.name+' — '+p.lat.toFixed(3)+', '+p.lng.toFixed(3)+'.</p>')
          +'<div style="'+S.row+'"><a style="'+S.btnP+'" href="'+_maps+'" target="_blank" rel="noopener">◎ Get driving directions</a>'
          +(_gp?'<a style="'+S.btn+'" href="tel:'+d.phone.replace(/[^0-9+]/g,'')+'">☎ '+d.phone+'</a>':'')
          +'<a style="'+S.btn+'" href="'+off+'" target="_blank" rel="noopener">'+prof.officialLabel+'</a></div>';
      }).catch(function(){});
    }
    // A representative photo (+ extract) for non-NPS destinations, from Wikipedia/Wikimedia.
    var photoToken = 0;
    function loadPhoto(p, prof){
      var mine = ++photoToken;
      fetch('/api/photo?name='+encodeURIComponent(p.name)+'&state='+encodeURIComponent(p.state||'')).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(mine!==photoToken || !d || !d.found) return;
        if(d.image){ var hp=el('heroPhoto'), ph=el('heroPhotoPh');
          if(hp){ hp.onload=function(){ hp.style.display='block'; if(ph)ph.style.display='none'; }; hp.src=d.image; hp.alt=p.name; }
          var g=el('gallery'); if(g){ g.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px"><a href="'+(d.pageUrl||d.image)+'" target="_blank" rel="noopener"><img src="'+d.thumb+'" alt="'+p.name+'" style="width:100%;height:120px;object-fit:cover;border-radius:12px"></a></div><div style="font-size:.62rem;color:#a79f8c;margin-top:8px;line-height:1.4">'+d.credit+'</div>'; } }
        if(d.extract){ var al=el('aboutlive'); if(al && (!al.textContent || al.textContent.length<40)) al.textContent=d.extract; }
        // Wikipedia extract as the overview when RIDB doesn't supply one.
        if(d.extract && prof){
          setBox('nps', npsMapBlock(p)+'<p style="'+S.p+';margin-bottom:10px">'+d.extract+(d.pageUrl?' <a href="'+d.pageUrl+'" target="_blank" rel="noopener" style="color:#2c5562;font-weight:700">Wikipedia ↗</a>':'')+'</p><div style="font-size:.78rem;color:#6a7160">'+prof.kind+' · '+prof.agency+'. <a href="'+prof.official+'" target="_blank" rel="noopener" style="color:#2c5562;font-weight:700">'+prof.officialLabel+'</a></div>');
        }
      }).catch(function(){});
    }
    // Fill the universally-available sections for ANY non-NPS destination (state parks included):
    // directions from coordinates, plus campgrounds & points of interest from Recreation.gov / OSM.
    var ddToken = 0;
    function loadDestDetail(p, prof){
      var maps='https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lng;
      var db=el('directions');
      if(db) db.innerHTML='<p style="'+S.p+'">'+p.name+' is at '+p.lat.toFixed(3)+', '+p.lng.toFixed(3)+'.</p><div style="'+S.row+'"><a style="'+S.btnP+'" href="'+maps+'" target="_blank" rel="noopener">◎ Get driving directions</a><a style="'+S.btn+'" href="'+prof.official+'" target="_blank" rel="noopener">'+prof.officialLabel+'</a></div>';
      var mine=++ddToken;
      fetch('/api/places?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(mine!==ddToken || !d) return;
        var credit='<div style="font-size:.62rem;color:#a79f8c;margin-top:11px;line-height:1.4">Data &amp; credit: '+(d.credit||'Recreation.gov / RIDB + OpenStreetMap')+'</div>';
        var isCamp=function(f){return /camp/i.test((f.type||'')+' '+(f.name||''));};
        var camps=(d.facilities||[]).filter(isCamp);
        if(camps.length){ var cb=el('camps'); if(cb) cb.innerHTML=camps.slice(0,10).map(function(c){
          return '<div style="'+S.vi+'"><b style="font-size:.86rem;color:#163a2b;display:block">'+c.name+'</b>'
            +(c.description?'<p style="font-size:.78rem;color:#6a7160;line-height:1.45;margin-top:3px">'+c.description+'</p>':'')
            +(c.url?'<div style="display:flex;gap:8px;margin-top:8px"><a href="'+c.url+'" target="_blank" rel="noopener" style="font-size:.74rem;color:#1d4a37;font-weight:700;text-decoration:none">'+(c.reservable?'Reserve ↗':'Details ↗')+'</a></div>':'')
            +'</div>'; }).join('')+credit; }
        var poi=(d.recAreas||[]).concat((d.facilities||[]).filter(function(f){return !isCamp(f);}));
        if(poi.length){ var pb=el('places'); if(pb) pb.innerHTML=poi.slice(0,10).map(function(x){
          return '<div style="'+S.td+'"><div><h4 style="'+S.h4+'">'+x.name+'</h4>'
            +((x.description||x.type)?'<p style="'+S.p+'">'+(x.description||x.type)+'</p>':'')
            +(x.url?'<div style="'+S.dur+'"><a href="'+x.url+'" target="_blank" rel="noopener" style="color:#1d4a37;font-weight:700;text-decoration:none">Details ↗</a></div>':'')
            +'</div></div>'; }).join('')+credit; }
      }).catch(function(){});
    }
    function loadPlaces(p){
      loadGateway(p);
      var pane2=el('pane-now'); if(!pane2) return;
      var card=el('nearbyRec');
      if(!card){ card=document.createElement('div'); card.id='nearbyRec'; card.style.cssText='grid-column:1/-1;background:#fffdf7;border:1px solid #e7ddca;border-radius:20px;padding:18px;box-shadow:0 18px 44px -22px rgba(28,46,34,.45),0 2px 6px rgba(28,46,34,.05)'; pane2.appendChild(card); }
      card.innerHTML='<div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#8c8473;font-weight:800;margin-bottom:9px">Nearby to explore</div><span style="'+S.load+'">Finding campgrounds, forests &amp; trails nearby…</span>';
      fetch('/api/places?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(!d||(!d.facilities||!d.facilities.length)&&(!d.recAreas||!d.recAreas.length)){ card.style.display='none'; return; }
        var item=function(x,ic){return '<a href="'+(x.url||'#')+'" target="_blank" rel="noopener" style="display:flex;gap:11px;align-items:flex-start;text-decoration:none;padding:11px 0;border-top:1px solid #f1ead9"><span style="font-size:1.1rem">'+ic+'</span><div style="min-width:0"><b style="color:#1d4a37;font-size:.9rem;display:block">'+x.name+'</b>'+(x.type||x.description?'<span style="font-size:.76rem;color:#5b6258;line-height:1.4;display:block;margin-top:1px">'+(x.type||x.description)+'</span>':'')+'</div></a>';};
        var H='<div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#8c8473;font-weight:800;margin-bottom:4px">Nearby to explore</div>';
        (d.recAreas||[]).slice(0,4).forEach(function(r){ H+=item(r,'🏞️'); });
        (d.facilities||[]).slice(0,6).forEach(function(f){ H+=item(f,/camp/i.test(f.type)?'⛺':/trail/i.test(f.type)?'🥾':'📍'); });
        H+='<div style="font-size:.62rem;color:#a79f8c;margin-top:11px;line-height:1.4">Data &amp; credit: '+(d.credit||'Recreation.gov / RIDB')+'</div>';
        card.innerHTML=H; card.style.display='';
      }).catch(function(){ card.style.display='none'; });
    }
    function loadTrails(p){
      var pane=el('pane-now'); if(!pane) return;
      var card=el('nearbyTrails');
      if(!card){ card=document.createElement('div'); card.id='nearbyTrails'; card.style.cssText='grid-column:1/-1;background:#fffdf7;border:1px solid #e7ddca;border-radius:20px;padding:18px;box-shadow:0 18px 44px -22px rgba(28,46,34,.45),0 2px 6px rgba(28,46,34,.05)'; pane.appendChild(card); }
      card.innerHTML='<div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#8c8473;font-weight:800;margin-bottom:9px">Trails &amp; routes nearby</div><span style="'+S.load+'">Finding hikes, off-road &amp; ski routes…</span>';
      fetch('/api/trails?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)+'&radius='+((p.source==='nps')?25:45)).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(!d||(!d.hiking||!d.hiking.length)&&(!d.offroad||!d.offroad.length)&&(!d.ski||!d.ski.length)){ card.style.display='none'; return; }
        var grp=function(title,ic,arr){ if(!arr||!arr.length) return ''; return '<div style="margin-top:10px"><div style="font-size:.74rem;font-weight:800;color:#1d4a37;margin-bottom:5px">'+ic+' '+title+'</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+arr.slice(0,8).map(function(x){return '<span style="font-size:.76rem;color:#3a463c;background:#fbf6ea;border:1px solid #e7ddca;border-radius:999px;padding:5px 10px">'+x.name+'</span>';}).join('')+'</div></div>'; };
        var H='<div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#8c8473;font-weight:800;margin-bottom:2px">Trails &amp; routes nearby</div>';
        H+=grp('Hiking trails','🥾',d.hiking)+grp('Off-road / 4x4','🚙',d.offroad)+grp('Ski routes','⛷️',d.ski);
        H+='<div style="font-size:.62rem;color:#a79f8c;margin-top:11px;line-height:1.4">Data &amp; credit: '+(d.credit||'© OpenStreetMap contributors')+'</div>';
        card.innerHTML=H; card.style.display='';
      }).catch(function(){ card.style.display='none'; });
    }
    function loadForecast(p){
      fetch('https://api.weather.gov/points/'+p.lat.toFixed(4)+','+p.lng.toFixed(4),{headers:{Accept:'application/geo+json'}})
        .then(function(r){if(!r.ok)throw 0;return r.json();})
        .then(function(d){return fetch(d.properties.forecast,{headers:{Accept:'application/geo+json'}});})
        .then(function(r){if(!r.ok)throw 0;return r.json();})
        .then(function(d){
          var per=d.properties.periods, c=per[0];
          try{paintHero(c);paintHeroWeather(c.shortForecast);enhanceLive(p,per);}catch(e){}
        }).catch(function(){offlineWeather();});
    }
    function loadAlerts(p){
      fetch('https://api.weather.gov/alerts/active?point='+p.lat.toFixed(4)+','+p.lng.toFixed(4),{headers:{Accept:'application/geo+json'}})
        .then(function(r){if(!r.ok)throw 0;return r.json();})
        .then(function(d){
          var fs=d.features||[]; _nws=fs.length; updateHeroAlerts();
          if(!fs.length){ el('alerts').innerHTML='<div style="'+S.clear+'">✓ No active alerts — all clear right now.</div>'; return; }
          el('alerts').innerHTML=fs.slice(0,5).map(function(f){var a=f.properties;return alertBlock(a.severity||'Moderate',a.event,a.headline||'','Until '+(a.expires?new Date(a.expires).toLocaleString():'further notice'));}).join('');
        }).catch(function(){ el('alerts').innerHTML='<span style="'+S.load+'">Alerts appear on the published site.</span>'; });
    }
    function alertBlock(sev,ev,hl,tm){
      var sevHi=(sev==='Severe'||sev==='Extreme'), bd=sevHi?'#bb4636':(sev==='Minor'?'#3f7a34':'#b9823f'), bg=sevHi?'rgba(251,236,235,.85)':(sev==='Minor'?'rgba(238,246,234,.85)':'rgba(253,246,230,.82)');
      return '<div style="border-left:4px solid '+bd+';background:'+bg+';border-radius:0 12px 12px 0;padding:10px 13px;margin-bottom:9px"><div style="font-weight:700;font-size:.88rem;color:#1a2b21">'+ev+'</div>'+(hl?'<div style="font-size:.78rem;color:#555;margin-top:3px">'+hl+'</div>':'')+(tm?'<div style="font-size:.7rem;color:#8c8473;margin-top:4px">'+tm+'</div>':'')+'</div>';
    }
    var _npsCache={};
    function fetchNPS(name){
      if(_npsCache[name]) return _npsCache[name];
      var pr=fetch('/api/nps?name='+encodeURIComponent(name),{headers:{Accept:'application/json'}})
        .then(function(r){if(!r.ok)throw 0;return r.json();})
        .then(function(d){if(d&&d.error)throw 0;return d;})
        .catch(function(e){delete _npsCache[name];throw e;});
      _npsCache[name]=pr; return pr;
    }
    function setBox(id,html){var e=el(id); if(e)e.innerHTML=html;}
    function npsMapBlock(p){
      var u=(window.PB_NPS_MAP&&window.PB_NPS_MAP(p.name))||'';
      var lat=p.lat,lng=p.lng,h='';
      if(typeof lat==='number'&&typeof lng==='number'){
        var bb=(lng-0.55).toFixed(4)+','+(lat-0.38).toFixed(4)+','+(lng+0.55).toFixed(4)+','+(lat+0.38).toFixed(4);
        h+='<iframe title="'+(p.name||'Park')+' map" loading="lazy" style="width:100%;height:240px;border:1px solid #e7ddca;border-radius:13px;display:block;margin-bottom:11px" src="https://www.openstreetmap.org/export/embed.html?bbox='+bb+'&layer=mapnik&marker='+lat+','+lng+'"></iframe>';
      }
      h+='<div style="'+S.row+'">'+(u?'<a style="'+S.btn+'" href="'+u+'" target="_blank" rel="noopener">\uD83D\uDDFA Official NPS park map \u2197</a>':'')+(typeof lat==='number'?'<a style="'+S.btn+'" href="https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lng+'#map=10/'+lat+'/'+lng+'" target="_blank" rel="noopener">Open full map \u2197</a>':'')+'</div>';
      return h;
    }
    function loadNPS(p){
      setBox('nps', npsMapBlock(p)+'<span style="'+S.load+'">Loading official NPS details\u2026</span>');
      fetchNPS(p.name).then(function(d){
        var park=d.park||{};
        var _imgs=park.images||[];
        var _hp=el('heroPhoto'), _ph=el('heroPhotoPh');
        if(_hp && _imgs.length){ _hp.onload=function(){ _hp.style.display='block'; if(_ph)_ph.style.display='none'; }; _hp.src=_imgs[0].url; _hp.alt=_imgs[0].alt||p.name; }
        if(park.description){ var al=el('aboutlive'); if(al)al.textContent=park.description; }
        if(park.url){ var nl=el('npslink'); if(nl)nl.href=park.url; }
        _nps=(d.alerts&&d.alerts.length)||0; updateHeroAlerts();
        var ab=el('npsalerts');
        if(ab){ if(d.alerts&&d.alerts.length){ ab.innerHTML=d.alerts.slice(0,8).map(function(a){var sev=(a.category==='Park Closure'||a.category==='Danger')?'Severe':(a.category==='Caution'?'Moderate':'Minor');return alertBlock(sev,(a.category||'Notice')+': '+(a.title||''),a.description||'','');}).join(''); } else { ab.innerHTML='<div style="'+S.clear+'">✓ No official NPS alerts or closures posted.</div>'; } }
        var box=el('nps');
        if(box){ var html='', fees=park.entranceFees||[], hours=(park.operatingHours&&park.operatingHours[0]&&park.operatingHours[0].description)||'';
          html+='<div style="font-size:.88rem;line-height:1.65;color:#3f4636">';
          if(fees.length) html+='<div><b style="color:#1d4a37">Entrance:</b> '+fees.map(function(f){return ((f.cost&&f.cost!=='0.00')?('$'+f.cost):'Free')+(f.title?(' — '+f.title):'');}).join(' · ')+'</div>';
          else html+='<div>Entrance fee information isn\u2019t posted for this park.</div>';
          if(hours) html+='<div style="margin-top:5px"><b style="color:#1d4a37">Hours:</b> '+hours+'</div>';
          if(park.url) html+='<div style="'+S.row+'"><a style="'+S.btn+'" href="'+park.url+'" target="_blank" rel="noopener">Official park page ↗</a></div>';
          html+='</div>'; box.innerHTML=npsMapBlock(p)+html;
        }
        var td=d.thingsToDo||[];
        setBox('todo', td.length?td.map(function(t){return '<div style="'+S.td+'">'+(t.image?'<img style="'+S.tdimg+'" src="'+t.image+'" alt="">':'')+'<div><h4 style="'+S.h4+'">'+(t.title||'')+'</h4><p style="'+S.p+'">'+(t.shortDescription||'')+'</p>'+(t.duration?'<div style="'+S.dur+'">⏱ '+t.duration+'</div>':'')+(t.url?' <a href="'+t.url+'" target="_blank" rel="noopener" style="font-size:.78rem;color:#1d4a37;font-weight:600">Details ↗</a>':'')+'</div></div>';}).join(''):'<span style="'+S.load+'">No things-to-do listed for this park.</span>');
        var acts=park.activities||[];
        setBox('activities', acts.length?'<div style="display:flex;flex-wrap:wrap;gap:7px">'+acts.map(function(a){return '<span style="'+S.achip+'">'+a+'</span>';}).join('')+'</div>':'<span style="'+S.load+'">No activities listed.</span>');
        var imgs=park.images||[];
        setBox('gallery', imgs.length?'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">'+imgs.map(function(i){return '<a href="'+i.url+'" target="_blank" rel="noopener"><img src="'+i.url+'" alt="'+(i.alt||'').replace(/"/g,'')+'" style="width:100%;height:150px;object-fit:cover;border-radius:13px;border:1px solid #e7ddca"></a>';}).join('')+'</div>':'<span style="'+S.load+'">No photos available.</span>');
        var fees2=park.entranceFees||[], passes=park.entrancePasses||[], fh='';
        if(fees2.length) fh+=fees2.map(function(f){return '<div style="'+S.fee+'"><div style="'+S.ft+'"><b style="font-size:.9rem;color:#163a2b">'+(f.title||'Entrance')+'</b><span style="'+S.amt+'">'+((f.cost&&f.cost!=='0.00')?('$'+f.cost):'Free')+'</span></div>'+(f.description?'<p style="font-size:.78rem;color:#6a7160;line-height:1.45;margin-top:3px">'+f.description.slice(0,180)+'</p>':'')+'</div>';}).join('');
        if(passes.length) fh+=passes.map(function(f){return '<div style="'+S.fee+'"><div style="'+S.ft+'"><b style="font-size:.9rem;color:#163a2b">'+(f.title||'Pass')+'</b><span style="'+S.amt+'">'+((f.cost&&f.cost!=='0.00')?('$'+f.cost):'Free')+'</span></div></div>';}).join('');
        setBox('fees', fh||'<span style="'+S.load+'">No fee information posted (many parks are free to enter).</span>');
        var oh=park.operatingHours&&park.operatingHours[0];
        setBox('hours', oh?'<p style="font-size:.86rem;line-height:1.5;color:#4c5443">'+(oh.description||'')+'</p>':'<span style="'+S.load+'">Hours not listed.</span>');
        var cg=d.campgrounds||[];
        renderCamps(cg);
        var vc=d.visitorCenters||[];
        setBox('vcenters', vc.length?vc.map(function(v){return '<div style="'+S.vi+'"><b style="font-size:.86rem;color:#163a2b;display:block">'+(v.name||'')+'</b>'+(v.description?'<p style="font-size:.78rem;color:#6a7160;line-height:1.45;margin-top:2px">'+v.description+'</p>':'')+'</div>';}).join(''):'<span style="'+S.load+'">No visitor centers listed.</span>');
        setBox('directions', park.directionsInfo?'<p style="font-size:.84rem;line-height:1.5;color:#4c5443">'+park.directionsInfo+'</p>'+(park.url?'<div style="'+S.row+'"><a style="'+S.btn+'" href="'+park.url+'" target="_blank" rel="noopener">Full directions ↗</a></div>':''):'<span style="'+S.load+'">No directions posted.</span>');
        var ev=d.events||[];
        setBox('events', ev.length?ev.map(function(e){return '<div style="'+S.td+'"><div><h4 style="'+S.h4+'">'+(e.title||'')+'</h4><div style="'+S.dur+'">'+[e.date,e.times].filter(Boolean).join(' · ')+(e.location?(' · '+e.location):'')+'</div>'+(e.description?'<p style="'+S.p+'">'+e.description+'</p>':'')+(e.url?' <a href="'+e.url+'" target="_blank" rel="noopener" style="font-size:.78rem;color:#1d4a37;font-weight:600">Event info ↗</a>':'')+'</div></div>';}).join(''):'<span style="'+S.load+'">No upcoming events listed.</span>');
        var nw=d.news||[];
        setBox('news', nw.length?nw.map(function(n){return '<div style="'+S.td+'"><div><h4 style="'+S.h4+'">'+(n.title||'')+'</h4>'+(n.date?'<div style="'+S.dur+'">'+n.date+'</div>':'')+(n.abstract?'<p style="'+S.p+'">'+n.abstract+'</p>':'')+(n.url?' <a href="'+n.url+'" target="_blank" rel="noopener" style="font-size:.78rem;color:#1d4a37;font-weight:600">Read more ↗</a>':'')+'</div></div>';}).join(''):'<span style="'+S.load+'">No recent news releases.</span>');
        var pl=d.places||[];
        setBox('places', pl.length?pl.map(function(x){return '<div style="'+S.td+'">'+(x.image?'<img style="'+S.tdimg+'" src="'+x.image+'" alt="">':'')+'<div><h4 style="'+S.h4+'">'+(x.title||'')+'</h4>'+(x.description?'<p style="'+S.p+'">'+x.description+'</p>':'')+(x.url?' <a href="'+x.url+'" target="_blank" rel="noopener" style="font-size:.78rem;color:#1d4a37;font-weight:600">Details ↗</a>':'')+'</div></div>';}).join(''):'<span style="'+S.load+'">No points of interest listed.</span>');
      }).catch(function(){
        var msg='<span style="'+S.load+'">Official NPS details appear once the site is published with an NPS key configured.</span>';
        ['npsalerts','todo','activities','gallery','fees','hours','camps','vcenters','directions','events','news','places'].forEach(function(id){setBox(id,msg);});
        setBox('nps', npsMapBlock(p)+msg);
      });
    }

    /* ---------- hero status + alerts ---------- */
    var _nws=0,_nps=0,_wxPer=null,_wxP=null;
    function resetHero(){ el('heroTemp').textContent='—'; el('stState').textContent='Open'; el('stSub').textContent='Live status'; var bc=el('beacon'); bc.style.background='#46d97f'; bc.style.boxShadow='0 0 10px 1px rgba(70,217,127,.7)'; _wxPer=null; var vd=el('verdict'); if(vd){ vd.style.display='none'; vd.innerHTML=''; } }
    function paintHero(c){ el('heroTemp').textContent=c.temperature; el('stSub').textContent=c.shortForecast; }
    function paintHeroWeather(text){
      var box=el('heroWxBox'); if(!box||!window.WeatherFX)return;
      try{
        box.innerHTML=WeatherFX.scene(text,{size:'lg'}).replace('<div class="wfx ','<div style="position:absolute;inset:0;width:100%;height:100%;min-height:0;border-radius:0;box-shadow:none" class="wfx ');
      }catch(e){ box.innerHTML=''; }
    }
    function updateHeroAlerts(checking){
      var ic=el('abIc'), t=el('abTitle'), bar=el('waalert');
      if(checking){ ic.textContent='…'; t.textContent='Checking alerts…'; ic.style.background='rgba(63,122,52,.3)'; ic.style.color='#9fe3a6'; bar.style.borderColor='rgba(255,255,255,.16)'; return; }
      var total=_nws+_nps;
      if(total>0){ ic.textContent='⚠'; t.textContent=total+' active alert'+(total>1?'s':'')+(_nps>0?' · closures':''); ic.style.background=_nps>0?'rgba(204,74,62,.4)':'rgba(214,124,72,.36)'; ic.style.color=_nps>0?'#ffc9bf':'#ffd6b0'; bar.style.borderColor='rgba(228,165,95,.5)'; }
      else { ic.textContent='✓'; t.textContent='All clear'; ic.style.background='rgba(63,122,52,.3)'; ic.style.color='#9fe3a6'; bar.style.borderColor='rgba(255,255,255,.16)'; }
      try{renderVerdict();}catch(e){}
    }

    /* ---------- go / no-go verdict (the hero call) ---------- */
    function _vnum(s){ if(typeof s==='number')return s; var m=String(s||'').match(/-?\d+/g); return m?Math.max.apply(null,m.map(Number)):null; }
    function renderVerdict(){
      var box=el('verdict'); if(!box) return;
      var per=_wxPer; if(!per||!per.length){ box.style.display='none'; return; }
      var T=(window.PBVerdict&&PBVerdict.evaluate(per,_nws,_nps));
      if(!T){ box.style.display='none'; return; }
      var chips=T.chips;
      var chipHtml=chips.map(function(c,ci){
        return '<span style="display:inline-flex;align-items:center;gap:6px;font-size:.74rem;font-weight:700;padding:6px 12px;border-radius:999px;animation:pb-vchip .45s ease both;animation-delay:'+(0.25+ci*0.08).toFixed(2)+'s;'
          +(c.pos?'background:rgba(47,125,79,.12);color:#2f7d4f;border:1px solid rgba(47,125,79,.22)':'background:rgba(176,90,45,.12);color:#b0552d;border:1px solid rgba(176,90,45,.22)')+'">'
          +'<span style="width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7"></span>'+c.t+'</span>';
      }).join('');
      box.style.display='block';
      var C=(2*Math.PI*38), Coff=(C*(1-(T.score||0)/100));
      box.innerHTML=
        '<div style="position:relative;overflow:hidden;border-radius:24px;background:#fffdf7;border:1px solid #ece2cd;box-shadow:0 26px 64px -30px rgba(0,0,0,.72),0 0 0 4px '+T.ring+';animation:pb-vpop .5s cubic-bezier(.2,.8,.3,1) both">'
        +'<div style="position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;background:linear-gradient(115deg,transparent 34%,rgba(255,255,255,.4) 48%,transparent 62%);transform:translateX(-130%);animation:pb-vsweep 5s ease-in-out 0.7s infinite"></div>'
        +'<div style="height:6px;background:'+T.grad+'"></div>'
        +'<div style="position:relative;display:flex;gap:20px;align-items:center;padding:22px 24px 18px;flex-wrap:wrap">'
          +'<div style="position:relative;flex:none;width:90px;height:90px">'
            +'<div style="position:absolute;top:11px;left:11px;right:11px;bottom:11px;border-radius:50%;background:'+T.ring+';filter:blur(7px);animation:pb-vglow 2.6s ease-in-out infinite"></div>'
            +'<div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;border-radius:50%;background:'+T.orb+';box-shadow:inset 0 2px 6px rgba(255,255,255,.6)"></div>'
            +'<svg width="90" height="90" viewBox="0 0 90 90" style="position:absolute;top:0;left:0;transform:rotate(-90deg)">'
              +'<circle cx="45" cy="45" r="38" fill="none" stroke="rgba(20,40,30,.08)" stroke-width="7"></circle>'
              +'<circle class="pb-vring" cx="45" cy="45" r="38" fill="none" stroke="'+T.c+'" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+C.toFixed(1)+'" style="transition:stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1)"></circle>'
            +'</svg>'
            +'<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:2.2rem;line-height:1;color:'+T.c+';font-weight:800;animation:pb-vicon .6s cubic-bezier(.2,1.5,.4,1) .15s both">'+T.ic+'</div>'
          +'</div>'
          +'<div style="flex:1;min-width:230px">'
            +'<div style="display:flex;align-items:center;gap:8px;font-size:.64rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#b07d3a;margin-bottom:6px">'
              +'<span style="width:7px;height:7px;border-radius:50%;background:#46d97f;box-shadow:0 0 0 3px rgba(70,217,127,.22);animation:pb-pulse 2s infinite"></span>'
              +'Today\u2019s call \u00b7 should you go?'
            +'</div>'
            +'<div style="font-family:Spectral,Georgia,serif;font-weight:800;font-size:clamp(1.8rem,4.2vw,2.5rem);line-height:1.02;letter-spacing:-.01em;color:'+T.c+';animation:pb-vrise .55s cubic-bezier(.2,.8,.3,1) .08s both">'+T.word+'</div>'
            +'<div style="font-size:.94rem;line-height:1.5;color:#5b5848;margin-top:7px;max-width:54ch">'+T.sub+'</div>'
          +'</div>'
        +'</div>'
        +(chipHtml?'<div style="position:relative;display:flex;flex-wrap:wrap;gap:8px;padding:0 24px 22px">'+chipHtml+'</div>':'')
        +'</div>';
      var _ring=box.querySelector('.pb-vring');
      if(_ring){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ _ring.style.strokeDashoffset=Coff.toFixed(1); }); }); }
    }

    /* ---------- golden hour + crowd ---------- */
    function fmtTime(d){ if(!d||isNaN(d))return '—'; return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}); }
    function sunTimes(lat,lng,date){
      try{
        var rad=Math.PI/180, deg=180/Math.PI, start=new Date(date.getFullYear(),0,0), doy=Math.floor((date-start)/86400000), zen=90.833;
        function calc(isRise){
          var lngHour=lng/15, t=isRise?doy+((6-lngHour)/24):doy+((18-lngHour)/24), M=(0.9856*t)-3.289;
          var L=M+(1.916*Math.sin(M*rad))+(0.020*Math.sin(2*M*rad))+282.634; L=(L+360)%360;
          var RA=deg*Math.atan(0.91764*Math.tan(L*rad)); RA=(RA+360)%360;
          RA=RA+((Math.floor(L/90)*90)-(Math.floor(RA/90)*90)); RA=RA/15;
          var sinDec=0.39782*Math.sin(L*rad), cosDec=Math.cos(Math.asin(sinDec));
          var cosH=(Math.cos(zen*rad)-(sinDec*Math.sin(lat*rad)))/(cosDec*Math.cos(lat*rad));
          if(cosH>1||cosH<-1)return null;
          var H=isRise?360-deg*Math.acos(cosH):deg*Math.acos(cosH); H=H/15;
          var T=H+RA-(0.06571*t)-6.622, UT=(T-lngHour)%24; return (UT+24)%24;
        }
        var rUT=calc(true), sUT=calc(false); if(rUT==null||sUT==null)return null;
        function toLocal(ut){var d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0)); d.setUTCMinutes(Math.round(ut*60)); return d;}
        return {sunrise:toLocal(rUT), sunset:toLocal(sUT)};
      }catch(e){return null;}
    }
    function sunArcHTML(p){
      var sun=sunTimes(p.lat,p.lng,new Date()), w=240,h=98,cx=w/2,baseY=h-12,r=Math.min(cx-18,baseY-6);
      var path='M '+(cx-r)+' '+baseY+' A '+r+' '+r+' 0 0 1 '+(cx+r)+' '+baseY;
      var frac=0.5,riseS='—',setS='—',note='Daylight';
      if(sun){ riseS=fmtTime(sun.sunrise); setS=fmtTime(sun.sunset);
        var now=Date.now(), span=sun.sunset.getTime()-sun.sunrise.getTime(); frac=(now-sun.sunrise.getTime())/span;
        if(frac<0){frac=0;note='Before sunrise';} else if(frac>1){frac=1;note='After sunset · night';}
        else{var gh=span*0.09; note=(now<=sun.sunrise.getTime()+gh||now>=sun.sunset.getTime()-gh)?'✨ Golden hour right now':'Daylight';}
      } else { note='Polar day/night'; }
      var theta=Math.PI*(1-frac), sx=cx+r*Math.cos(theta), sy=baseY-r*Math.sin(theta), arcLen=Math.PI*r;
      return '<div style="padding-top:4px"><svg viewBox="0 0 '+w+' '+h+'" width="100%" style="display:block"><defs><linearGradient id="ghg" x1="0" x2="1"><stop offset="0" stop-color="#e4be78"></stop><stop offset="1" stop-color="#c79a4b"></stop></linearGradient></defs>'+
        '<line x1="'+(cx-r-6)+'" y1="'+baseY+'" x2="'+(cx+r+6)+'" y2="'+baseY+'" stroke="#e3d9c5" stroke-width="1.5"></line>'+
        '<path d="'+path+'" fill="none" stroke="#e3d9c5" stroke-width="3" stroke-linecap="round"></path>'+
        '<path d="'+path+'" fill="none" stroke="url(#ghg)" stroke-width="3" stroke-linecap="round" stroke-dasharray="'+arcLen.toFixed(1)+'" stroke-dashoffset="'+(arcLen*(1-frac)).toFixed(1)+'"></path>'+
        '<circle cx="'+sx.toFixed(1)+'" cy="'+sy.toFixed(1)+'" r="7" fill="#f6b21e" stroke="#fffdf7" stroke-width="2.5"></circle></svg>'+
        '<div style="display:flex;justify-content:space-between;font-size:.82rem;font-weight:700;color:#1d4a37;margin-top:8px"><span><small style="display:block;font-size:.58rem;color:#8c8473;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:1px">Sunrise</small>'+riseS+'</span><span style="text-align:right"><small style="display:block;font-size:.58rem;color:#8c8473;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:1px">Sunset</small>'+setS+'</span></div>'+
        '<div style="font-size:.74rem;color:#6a7160;margin-top:9px;text-align:center;font-weight:600">'+note+'</div></div>';
    }
    var ICONIC=new Set([9,21,61,41,25,54,28,30,15,60,37,50,46,5,44]);
    function crowdGauge(p){
      var now=new Date(), m=now.getMonth(), dow=now.getDay(), base=ICONIC.has(p.id)?60:36;
      var seasonAdj=(m>=5&&m<=7)?24:(m===8||m===4)?12:(m>=10||m<=1)?-16:2, weekendAdj=(dow===0||dow===6)?14:(dow===5)?6:0;
      var score=Math.max(8,Math.min(97,base+seasonAdj+weekendAdj)), level=score>72?'Busy':score>46?'Moderate':'Quiet';
      var bestSeason=ICONIC.has(p.id)?'late Sept–Oct or May':'spring &amp; fall';
      el('crowd').innerHTML='<div style="display:flex;flex-direction:column;gap:9px"><div style="font-family:Spectral,serif;font-size:1.5rem;font-weight:700;color:#1d4a37;line-height:1">'+level+' <span style="font-size:.6rem;font-weight:700;color:#8c8473;letter-spacing:.06em;text-transform:uppercase">· est. today</span></div>'+
        '<div style="position:relative;width:100%;height:9px;border-radius:999px;background:linear-gradient(90deg,#5fae6e,#e4c061 52%,#cf6f54);margin-top:2px"><div style="position:absolute;top:-5px;width:4px;height:19px;border-radius:3px;background:#15241c;box-shadow:0 0 0 3px rgba(255,253,247,.92);transform:translateX(-50%);left:'+score+'%"></div></div>'+
        '<div style="display:flex;justify-content:space-between;font-size:.58rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#8c8473"><span>Quiet</span><span>Packed</span></div>'+
        '<div style="font-size:.8rem;color:#4c5443;line-height:1.5;margin-top:2px">Go on <b style="color:#1d4a37">weekday mornings</b> — and visit in <b style="color:#1d4a37">'+bestSeason+'</b> for the thinnest crowds.</div></div>';
    }
    function bigScene(text){
      return WeatherFX.scene(text,{size:'lg'}).replace('<div class="wfx ','<div style="position:absolute;inset:0;width:100%;height:100%;border-radius:0;box-shadow:none" class="wfx ');
    }
    function miniScene(text){
      return WeatherFX.scene(text,{size:'sm'}).replace('<div class="wfx ','<div style="position:relative;height:34px;min-height:0;border-radius:8px;box-shadow:none" class="wfx ');
    }
    function shortDay(x){ try{ return new Date(x.startTime).toLocaleDateString([],{weekday:'short'}); }catch(e){ return (x.name||'').slice(0,3); } }
    function enhanceLive(p,per){
      _wxPer=per; _wxP=p;
      var day=per.find(function(x){return x.isDaytime;})||per[0], nt=per.find(function(x){return !x.isDaytime;})||per[1]||per[0], sun=sunTimes(p.lat,p.lng,new Date()), now0=per[0];
      var ci=0;
      function accent(type){
        if(type==='wind'){
          return '<span style="position:absolute;top:10px;right:11px;width:24px;height:15px;overflow:hidden;opacity:.9">'
            +'<i style="position:absolute;top:1px;left:-8px;width:100%;height:2px;border-radius:2px;background:rgba(255,255,255,.85);animation:wfx-gust 2.6s ease-in-out infinite"></i>'
            +'<i style="position:absolute;top:6px;left:-8px;width:78%;height:2px;border-radius:2px;background:rgba(255,255,255,.7);animation:wfx-gust 3.1s ease-in-out infinite;animation-delay:-1s"></i>'
            +'<i style="position:absolute;top:11px;left:-8px;width:62%;height:2px;border-radius:2px;background:rgba(255,255,255,.6);animation:wfx-gust 3.7s ease-in-out infinite;animation-delay:-.5s"></i></span>';
        }
        if(type==='low'){
          return '<span style="position:absolute;top:10px;right:11px;width:16px;height:16px;border-radius:50%;box-shadow:inset -5px -3px 0 0 #bcd6ff;animation:pb-sun 4.5s ease-in-out infinite"></span>';
        }
        var col={high:'#ffce78',sunrise:'#ffd24a',sunset:'#ff9a5a',golden:'#ffe0a0'}[type]||'#ffce78';
        return '<span style="position:absolute;top:10px;right:11px;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff,'+col+');box-shadow:0 0 12px 2px '+col+';animation:pb-sun 3.6s ease-in-out infinite"></span>';
      }
      function chip(label,val,sub,type){
        var d=(4.2+ci*0.5).toFixed(1), dl=(ci*0.4).toFixed(1); ci++;
        return '<div style="position:relative;min-width:0;background:rgba(255,255,255,.13);-webkit-backdrop-filter:blur(13px) saturate(1.3);backdrop-filter:blur(13px) saturate(1.3);border:1px solid rgba(255,255,255,.28);border-radius:14px;padding:9px 12px;color:#fff;box-shadow:0 16px 32px -18px rgba(0,0,0,.7);text-shadow:0 1px 4px rgba(0,0,0,.5);animation:pb-bob '+d+'s ease-in-out '+dl+'s infinite">'
          + accent(type)
          +'<div style="font-size:.55rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:22px">'+label+'</div>'
          +'<div style="font-family:Spectral,Georgia,serif;font-weight:700;font-size:1.1rem;line-height:1;margin-top:5px">'+val+'</div>'
          +'<div style="font-size:.6rem;opacity:.82;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:.74em">'+(sub||'')+'</div>'
          +'</div>';
      }
      var gStart='—', gSub='At dawn &amp; dusk';
      if(sun){
        var span=Math.abs(sun.sunset-sun.sunrise), gh=Math.min(span*0.12,90*60000), nowMs=Date.now();
        var setMs=sun.sunset.getTime(), es=setMs-gh;
        var gActive=(nowMs>=sun.sunrise.getTime()&&nowMs<=sun.sunrise.getTime()+gh)||(nowMs>=setMs-gh&&nowMs<=setMs);
        gStart=fmtTime(new Date(Math.min(es,setMs)));
        gSub=gActive?'✨ Right now':'till '+fmtTime(sun.sunset);
      }
      var chips=chip('High'+(day?' · '+day.name:''), day?day.temperature+'°':'—', day?(day.shortForecast||''):'','high')
        +chip('Low'+(nt?' · '+nt.name:''), nt?nt.temperature+'°':'—', nt?(nt.shortForecast||''):'','low')
        +chip('Wind', now0.windSpeed||'—', now0.windDirection||'','wind')
        +chip('Sunrise', sun?fmtTime(sun.sunrise):'—', 'Local','sunrise')
        +chip('Sunset', sun?fmtTime(sun.sunset):'—', 'Local','sunset')
        +chip('Golden hour', gStart, gSub,'golden');
      var fdays=per.filter(function(x){return x.isDaytime;}).slice(0,7);
      if(fdays.length<5) fdays=per.slice(0,7);
      var fcells=fdays.map(function(x,i){
        return '<div style="min-width:0;background:rgba(255,255,255,.13);-webkit-backdrop-filter:blur(13px) saturate(1.3);backdrop-filter:blur(13px) saturate(1.3);border:1px solid rgba(255,255,255,.26);border-radius:13px;padding:9px 6px 10px;text-align:center;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.5);box-shadow:0 14px 28px -18px rgba(0,0,0,.6)">'
          +'<div style="font-size:.56rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(i===0?'Today':shortDay(x))+'</div>'
          +'<div style="margin:5px 0 5px">'+miniScene(x.shortForecast)+'</div>'
          +'<div style="font-family:Spectral,Georgia,serif;font-weight:700;font-size:1rem;line-height:1">'+x.temperature+'°</div>'
          +'</div>';
      }).join('');
      var html=bigScene(now0.shortForecast)
        +'<div style="position:absolute;inset:0;z-index:3;background:linear-gradient(180deg,rgba(8,18,12,.26) 0%,rgba(8,18,12,.05) 30%,rgba(8,18,12,.2) 60%,rgba(8,18,12,.6) 100%)"></div>'
        +'<div style="position:relative;z-index:4;display:flex;flex-direction:column;min-height:inherit;padding:14px 18px 16px">'
          +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">'
            +'<div style="font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.95);font-weight:800;text-shadow:0 1px 5px rgba(0,0,0,.5)">◷ Today at a glance</div>'
            +'<div style="font-size:.62rem;color:rgba(255,255,255,.85);font-weight:700;text-shadow:0 1px 5px rgba(0,0,0,.5)">'+p.name+'</div>'
          +'</div>'
          +'<div style="margin-top:11px;display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.55)">'
            +'<div style="display:flex;align-items:flex-start;gap:4px;line-height:.82">'
              +'<span style="font-family:Spectral,Georgia,serif;font-weight:700;font-size:clamp(2.5rem,6vw,3.7rem)">'+now0.temperature+'</span>'
              +'<span style="font-size:1.3rem;margin-top:.16em;opacity:.85">°</span>'
            +'</div>'
            +'<div style="padding-bottom:4px">'
              +'<div style="font-family:Spectral,Georgia,serif;font-size:clamp(1rem,2.2vw,1.2rem);font-weight:600">'+now0.shortForecast+'</div>'
              +'<div style="font-size:.74rem;font-weight:600;opacity:.9;margin-top:2px">'+now0.name+' · Wind '+now0.windSpeed+' '+now0.windDirection+'</div>'
            +'</div>'
          +'</div>'
          +'<div style="margin-top:13px;display:grid;gap:9px;grid-template-columns:repeat(auto-fit,minmax(116px,1fr))">'+chips+'</div>'
          +'<div style="margin-top:13px">'
            +'<div style="font-size:.56rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.82);margin-bottom:8px;text-shadow:0 1px 4px rgba(0,0,0,.5)">Next 7 days</div>'
            +'<div style="display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(90px,1fr))">'+fcells+'</div>'
          +'</div>'
        +'</div>';
      el('glance').innerHTML=html;
      try{renderVerdict();}catch(e){}
    }

    /* ---------- reviews ---------- */
    var SB_URL='https://fsgmwersernbtjugkuhk.supabase.co', SB_KEY='sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn';
    var SB_HEAD={apikey:SB_KEY,Authorization:'Bearer '+SB_KEY,'Content-Type':'application/json'};
    var BAD=['fuck','shit','bitch','asshole','cunt','nigger','faggot','retard','whore','dick','pussy','bastard'], rvRating=0;
    function escHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function profane(t){var low=(' '+t.toLowerCase()+' ').replace(/[^a-z ]/g,' ');return BAD.some(function(w){return low.indexOf(' '+w+' ')>-1;});}
    function starStr(n){n=Math.round(n);return '★★★★★'.slice(0,n)+'☆☆☆☆☆'.slice(0,5-n);}
    function timeAgo(iso){var d=new Date(iso),s=(Date.now()-d)/1000; if(s<3600)return Math.max(1,Math.floor(s/60))+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; if(s<2592000)return Math.floor(s/86400)+'d ago'; return d.toLocaleDateString();}
    function loadReviews(p){
      var sum=el('revsummary'), list=el('revlist'); if(sum)sum.textContent='Loading reviews…'; if(list)list.innerHTML='';
      fetch(SB_URL+'/rest/v1/reviews?park_id=eq.'+p.id+'&order=created_at.desc&select=*',{headers:SB_HEAD})
        .then(function(r){if(!r.ok)throw 0;return r.json();})
        .then(function(rows){
          var sum=el('revsummary'), list=el('revlist'); if(!sum||!list)return;
          if(!rows.length){ sum.innerHTML='<span style="color:#8c8473;font-size:.9rem">No reviews yet — be the first to share your experience!</span>'; list.innerHTML=''; return; }
          var avg=rows.reduce(function(a,r){return a+r.rating;},0)/rows.length;
          sum.innerHTML='<div style="display:flex;align-items:center;gap:10px"><span style="font-family:Spectral,serif;font-size:1.9rem;color:#1d4a37;line-height:1">'+avg.toFixed(1)+'</span><div><div style="color:#c79a4b;font-size:1.05rem;letter-spacing:1px">'+starStr(avg)+'</div><div style="font-size:.78rem;color:#8c8473">'+rows.length+' review'+(rows.length>1?'s':'')+'</div></div></div>';
          list.innerHTML=rows.map(function(r){return '<div style="padding:13px 0;border-top:1px solid #e7ddca"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:4px"><b style="font-size:.9rem;color:#163a2b">'+escHtml(r.author)+'</b><span style="font-size:.72rem;color:#8c8473">'+timeAgo(r.created_at)+'</span></div><div style="color:#c79a4b;font-size:.9rem;letter-spacing:1px">'+starStr(r.rating)+'</div><p style="font-size:.86rem;line-height:1.55;color:#4c5443;margin-top:4px">'+escHtml(r.body)+'</p></div>';}).join('');
        }).catch(function(){ var sum=el('revsummary'); if(sum)sum.innerHTML='<span style="color:#8c8473;font-size:.9rem">Reviews couldn\u2019t load right now. Please try again shortly.</span>'; });
    }
    (function setupReviewForm(){
      var stars=el('rv-stars');
      if(stars) stars.addEventListener('click',function(e){var rect=stars.getBoundingClientRect(), rel=(e.clientX-rect.left)/rect.width; rvRating=Math.max(1,Math.min(5,Math.ceil(rel*5))); stars.textContent='★★★★★'.slice(0,rvRating)+'☆☆☆☆☆'.slice(0,5-rvRating);});
      var btn=el('rv-submit'); if(btn) btn.onclick=submitReview;
    })();
    function submitReview(){
      var p=findDest(current); if(!p)return;
      var name=(el('rv-name').value||'').trim(), body=(el('rv-body').value||'').trim(), msg=el('rv-msg');
      var show=function(t,ok){ if(msg){msg.textContent=t;msg.style.color=ok?'#3d7a2a':'#b54a3a';} };
      if(!name){show('Please add your name.',false);return;}
      if(rvRating<1){show('Please pick a star rating.',false);return;}
      if(body.length<3){show('Please write a little more.',false);return;}
      if(profane(name)||profane(body)){show('Please keep it family-friendly.',false);return;}
      show('Posting…',true);
      fetch(SB_URL+'/rest/v1/reviews',{method:'POST',headers:Object.assign({},SB_HEAD,{Prefer:'return=minimal'}),body:JSON.stringify({park_id:p.id,park_name:p.name,author:name,rating:rvRating,body:body})})
        .then(function(r){if(!r.ok)throw 0; show('Thanks — your review is posted!',true); el('rv-name').value=''; el('rv-body').value=''; rvRating=0; el('rv-stars').textContent='☆☆☆☆☆'; loadReviews(p);})
        .catch(function(){show('Couldn\u2019t post right now — please try again.',false);});
    }

    /* ---------- master render ---------- */
    function render(){
      var p=findDest(current); if(!p){ p=PARKS[0]; current=p.id; }
      var prof=destProfile(p);
      pick.value=current;
      el('pname').textContent=p.name;
      el('psub').textContent='· '+(p.state||'')+' · '+(p.source==='nps'?(REG[p.region]||''):prof.kind);
      el('pest').textContent=p.year?('Established '+p.year):prof.kind;
      el('desc').textContent=p.desc||(p.name+' — '+prof.kind.toLowerCase()+'.');
      el('aboutlive').textContent=p.desc||'';
      el('about').textContent=(p.state&&SI[p.state])?SI[p.state]:'';
      var maps='https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lng;
      var official=prof.official;
      el('loc').innerHTML='<div><b style="color:#1d4a37">Coordinates:</b> '+p.lat.toFixed(3)+', '+p.lng.toFixed(3)+'</div><div style="'+S.row+'"><a style="'+S.btn+'" href="'+maps+'" target="_blank" rel="noopener">◎ Get directions</a><a style="'+S.btn+'" href="'+official+'" target="_blank" rel="noopener">'+prof.officialLabel+'</a></div>';
      var rec='https://www.recreation.gov/search?q='+encodeURIComponent(prof.recQuery);
      el('reserve').innerHTML='<p style="font-size:.86rem;line-height:1.55;color:#525a46;margin-bottom:12px">Some destinations require timed-entry or campground reservations, booked on the official government sites — we link you straight there.</p><div style="'+S.row+';margin-top:0"><a style="'+S.btnP+'" href="'+rec+'" target="_blank" rel="noopener">Check reservations on Recreation.gov ↗</a><a style="'+S.btn+'" id="npslink" href="'+official+'" target="_blank" rel="noopener">'+prof.officialLabel+'</a></div><p style="font-size:.72rem;color:#8f8b7c;margin-top:10px">Reservations and payment are handled by the official site (managed by the '+prof.agency+').</p>';

      var _hp0=el('heroPhoto'); if(_hp0){ _hp0.style.display='none'; _hp0.removeAttribute('src'); }
      var _ph0=el('heroPhotoPh'); if(_ph0)_ph0.style.display='flex';
      var _wx0=el('heroWxBox'); if(_wx0)_wx0.innerHTML='';
      var _phl=el('heroPhotoPhLabel'); if(_phl)_phl.textContent='Iconic photo · '+p.name;
      var _cfg=null; try{ if(p.source==='nps') _cfg=PB.config(current); }catch(e){}
      buildScene(_cfg||PB.config(PARKS[0].id));
      renderBest();
      resetHero();
      try{ crowdGauge(p); }catch(e){}
      _nws=0;_nps=0; updateHeroAlerts(true);
      pgState={};
      // reset live boxes
      el('alerts').innerHTML='<span style="'+S.load+'">Checking for alerts…</span>';
      el('glance').innerHTML='<span style="'+S.load+'">Loading…</span>';
      if(prof.hasNPS){ loadNPS(p); }
      else { setBox('nps', npsMapBlock(p)+'<span style="'+S.load+'">'+prof.kind+' · managed by '+prof.agency+'. <a href="'+prof.official+'" target="_blank" rel="noopener" style="color:#2c5562;font-weight:700">'+prof.officialLabel+'</a></span>');
        ['npsalerts','todo','activities','gallery','fees','hours','camps','vcenters','directions','events','news','places'].forEach(function(id){ var b=el(id); if(b)b.innerHTML='<span style="'+S.load+'">Provided by '+prof.agency+' — see the official page above.</span>'; });
        var _isF=(p.source==='usfs'||p.type==='national_forest');
        if(_isF){ loadForestDetail(p, prof); } else { loadDestDetail(p, prof); }
        loadPhoto(p, prof); }
      loadConditions(p);
      loadPlaces(p);
      loadTrails(p);
      loadReviews(p);
      if(p.region==='territory'){ offline('This U.S. territory is outside the National Weather Service coverage area.'); return; }
      loadForecast(p); loadAlerts(p);
    }

    // If a state-park/forest dest must be fetched, skip the first paint so the user
    // never sees the Yosemite fallback flash — resolveMissingDest renders once resolved.
    var _u=new URLSearchParams(location.search), _q=_u.get('park')||_u.get('dest');
    var pending=!!_q && paramId()==null;
    if(!pending) render();
    resolveMissingDest(pending);
}
var tries=0;
(function wait(){ if(window.PB && window.WeatherFX){ init(); } else if(tries++ < 250){ setTimeout(wait,30); } else { init(); } })();
})();
