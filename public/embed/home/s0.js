
class DCLogic { constructor(){ this.props = {}; this.state = {}; } setState(){} forceUpdate(){} }
class Component extends DCLogic {
  renderVals(){ return {}; }

  componentDidMount(){
    this.buildStatic();
    this.buildFilter();
    this.buildStats();
    this.buildPersonas();
    this.buildBooking();
    this.buildChecklist();
    this.buildAlerts();
    this.buildAuth();
    this.buildLearn();
    this.buildShop();
    this.buildHow();
    this.buildTrust();
    this.buildFooter();
    this.initCanvas();
    this.initTicker();
    this.initReveals();
    this.initMagnetic();
    this.initScrolly();
    this.buildMapModal();
    this.hydrateAll(document);
  }
  componentWillUnmount(){ if(this._raf)cancelAnimationFrame(this._raf); if(this._io)this._io.disconnect(); if(this._tick)cancelAnimationFrame(this._tick); if(this._pTimer)clearInterval(this._pTimer); window.removeEventListener('scroll',this._onScroll); window.removeEventListener('mousemove',this._onMouse); }

  buildStatic(){
    var nav=document.getElementById('navLinks');
    if(nav){
      var links=[['Explore','/explore'],['Book','/book'],['Shop','/shop'],['Pro','#pro'],['Learn','#learn']];
      nav.innerHTML=links.map(function(l){ return '<a href="'+l[1]+'" style="text-decoration:none;color:inherit;position:relative;transition:color .4s" onmouseover="this.style.color=\'#e8cf9a\'" onmouseout="this.style.color=\'\'">'+l[0]+'</a>'; }).join('');
    }
    var done=function(form,label){ if(!form)return; form.onsubmit=function(e){ e.preventDefault(); var b=form.querySelector('button'); if(b){ b.textContent=label; b.style.background='linear-gradient(120deg,#7fce9a,#4f9e6a)'; b.style.color='#0b1710'; } }; };
    done(document.getElementById('intakeForm'),'Application received ✓');
    done(document.getElementById('notifyShop'),'On the list ✓');
    done(document.getElementById('footNews'),'✓');
    var cols={agentWrap:'minmax(0,1fr) minmax(0,1.02fr)',alertsGrid:'minmax(0,1fr) minmax(0,1.1fr)',listGrid:'minmax(0,1fr) minmax(0,1.1fr)'};
    var fit=function(){ var one=window.innerWidth<820; Object.keys(cols).forEach(function(id){ var el=document.getElementById(id); if(el) el.style.gridTemplateColumns=one?'1fr':cols[id]; }); };
    fit(); window.addEventListener('resize',fit);
  }
  buildChecklist(){
    var box=document.getElementById('checklist'); if(!box) return;
    var self=this;
    var items=['Altitude layers — tops out near 12,000 ft','Rain shell — afternoon storms likely','2L+ water per person','Microspikes — snow lingers up high','Bear canister — backcountry nights','Offline map downloaded'];
    box.innerHTML=items.map(function(t,i){
      return '<div class="pb-check" data-i="'+i+'" style="display:flex;align-items:center;gap:11px;opacity:.5;transition:opacity .5s"><span class="pb-box" style="width:20px;height:20px;flex:none;border-radius:6px;border:1.5px solid rgba(217,183,121,.4);display:flex;align-items:center;justify-content:center;transition:all .4s"><span class="pb-tick" style="color:#0b1710;font-size:.7rem;opacity:0;transition:opacity .3s">✓</span></span><span style="font-size:.88rem;color:#d3d8d1">'+t+'</span></div>';
    }).join('');
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ self.runChecklist(); io.disconnect(); } }); },{threshold:.3});
      io.observe(box);
    } else this.runChecklist();
  }
  runChecklist(){
    var rows=document.querySelectorAll('#checklist .pb-check'); if(!rows.length) return;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches){ rows.forEach(function(r){ r.style.opacity='1'; var b=r.querySelector('.pb-box'),t=r.querySelector('.pb-tick'); b.style.background='linear-gradient(120deg,#e8cf9a,#c9a35f)'; b.style.borderColor='transparent'; t.style.opacity='1'; }); return; }
    var i=0;
    var tick=function(){
      if(i>=rows.length){ setTimeout(function(){ rows.forEach(function(r){ var b=r.querySelector('.pb-box'),t=r.querySelector('.pb-tick'); r.style.opacity='.5'; b.style.background='transparent'; b.style.borderColor='rgba(217,183,121,.4)'; t.style.opacity='0'; }); i=0; setTimeout(tick,700); },2000); return; }
      var r=rows[i], b=r.querySelector('.pb-box'), t=r.querySelector('.pb-tick');
      r.style.opacity='1'; b.style.background='linear-gradient(120deg,#e8cf9a,#c9a35f)'; b.style.borderColor='transparent'; t.style.opacity='1';
      i++; setTimeout(tick,520);
    };
    tick();
  }
  buildAlerts(){
    var box=document.getElementById('alertChips'); if(!box) return;
    var self=this;
    this._alerts=['Road & pass opens','Permit & reservation drops','First snow','Wildfire & smoke','Wildflower & foliage'];
    this._alertOn={0:true,2:true};
    var render=function(){
      box.innerHTML=self._alerts.map(function(a,i){ var on=self._alertOn[i];
        return '<button data-i="'+i+'" style="cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:500;border-radius:999px;padding:8px 14px;border:1px solid '+(on?'transparent':'rgba(217,183,121,.22)')+';background:'+(on?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'rgba(255,255,255,.03)')+';color:'+(on?'#0b1710':'#c3c8d0')+';transition:all .3s">'+(on?'✓ ':'')+a+'</button>';
      }).join('');
      box.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ var i=+b.getAttribute('data-i'); self._alertOn[i]=!self._alertOn[i]; render(); }; });
    };
    render();
    var form=document.getElementById('alertForm'); if(form) form.onsubmit=function(e){ e.preventDefault(); var b=form.querySelector('button'); b.textContent='Subscribed ✓'; b.style.background='linear-gradient(120deg,#7fce9a,#4f9e6a)'; };
  }

  /* ---------------- HERO CANVAS: gold topographic filigree ---------------- */
  initCanvas(){
    var cv=document.getElementById('heroCanvas'); if(!cv) return;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches){ this.staticCanvas(cv); return; }
    var ctx=cv.getContext('2d'), self=this;
    var dpr=Math.min(window.devicePixelRatio||1,2), W=0,H=0;
    var mx=0,my=0,tmx=0,tmy=0;
    function resize(){ W=cv.clientWidth; H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize();
    this._onResize=resize; window.addEventListener('resize',resize);
    // gilt dust particles
    var dust=[]; for(var i=0;i<70;i++){ dust.push({x:Math.random(),y:Math.random(),r:Math.random()*1.4+.3,s:Math.random()*.4+.1,p:Math.random()*Math.PI*2}); }
    this._onMouse=function(e){ tmx=(e.clientX/window.innerWidth-.5); tmy=(e.clientY/window.innerHeight-.5); };
    window.addEventListener('mousemove',this._onMouse);
    var t=0;
    function frame(){
      t+=0.0032; mx+=(tmx-mx)*.05; my+=(tmy-my)*.05;
      ctx.clearRect(0,0,W,H);
      // contour lines
      var rows=13;
      for(var r=0;r<rows;r++){
        var baseY=(r/(rows-1))*H;
        var depth=(r/(rows-1)-.5);
        var alpha=0.05+0.11*(1-Math.abs(depth)*1.3);
        if(alpha<0.02) continue;
        ctx.beginPath();
        for(var x=-20;x<=W+20;x+=8){
          var nx=x/W;
          var y=baseY
            +Math.sin(nx*3.1+t+r*.5)*22*(1+depth)
            +Math.sin(nx*7.4-t*1.3+r)*9
            +Math.cos(nx*1.7+t*.6)*16
            +mx*40*(depth);
          if(x===-20)ctx.moveTo(x,y+my*30*depth); else ctx.lineTo(x,y+my*30*depth);
        }
        var g=ctx.createLinearGradient(0,0,W,0);
        g.addColorStop(0,'rgba(201,163,95,0)');
        g.addColorStop(.5,'rgba(232,207,154,'+alpha+')');
        g.addColorStop(1,'rgba(201,163,95,0)');
        ctx.strokeStyle=g; ctx.lineWidth=1; ctx.stroke();
      }
      // gilt dust
      for(var d=0;d<dust.length;d++){
        var pt=dust[d];
        var px=pt.x*W+Math.sin(t+pt.p)*10+mx*60*pt.s;
        var py=(pt.y+ (t*pt.s*0.02))%1*H+my*40*pt.s;
        var tw=0.4+0.6*Math.abs(Math.sin(t*2+pt.p));
        ctx.beginPath(); ctx.arc(px,py%H,pt.r,0,Math.PI*2);
        ctx.fillStyle='rgba(232,207,154,'+(tw*.5)+')'; ctx.fill();
      }
      self._raf=requestAnimationFrame(frame);
    }
    frame();
  }
  staticCanvas(cv){
    var ctx=cv.getContext('2d'); var W=cv.clientWidth,H=cv.clientHeight; cv.width=W;cv.height=H;
    for(var r=0;r<12;r++){ var y=(r/11)*H; ctx.beginPath(); for(var x=0;x<=W;x+=8){ var yy=y+Math.sin(x/W*3+r)*18; if(x===0)ctx.moveTo(x,yy); else ctx.lineTo(x,yy);} ctx.strokeStyle='rgba(232,207,154,0.06)'; ctx.stroke(); }
  }

  /* ---------------- TICKER ---------------- */
  initTicker(){
    var el=document.getElementById('ticker'); if(!el) return;
    var items=[
      ['Zion','GO · 74°F clear'],['Glacier','Going-to-the-Sun open'],['Rocky Mountain','Timed entry 9–2'],
      ['Yosemite','PREPARE · firefall window'],['Arches','GO · 81°F'],['Great Smoky','Cades Cove open'],
      ['Yellowstone','Bison on the road, N loop'],['Acadia','HOLD · fog on Cadillac'],['Grand Canyon','GO · South Rim clear'],
      ['Olympic','Hoh road open'],['Sequoia','Chains advised, Generals Hwy']
    ];
    el.innerHTML=items.concat(items).map(function(it){
      return '<span style="margin-right:40px"><b style="color:#e8cf9a">'+it[0]+'</b> <span style="color:#6f757f">—</span> '+it[1]+'</span>';
    }).join('');
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    var self=this, x=0, w=el.scrollWidth/2;
    function step(){ x-=0.5; if(-x>=w)x=0; el.style.transform='translateX('+x+'px)'; self._tick=requestAnimationFrame(step); }
    step();
  }

  /* ---------------- FILTER BUILDER ---------------- */
  FILTERS = [
    {key:'activity',label:'Activity',multi:true,opts:[
      {id:'hike',t:'Hiking',w:900},{id:'drive',t:'Scenic drives',w:141},{id:'lakes',t:'Lakes',w:1200},
      {id:'camp',t:'Camping',w:1200},{id:'ohv',t:'Off-road / OHV',w:260,soon:true},{id:'mtb',t:'Mountain biking',w:340,soon:true},{id:'ski',t:'Skiing',w:120,soon:true}
    ]},
    {key:'vibe',label:'Vibe',multi:true,opts:[
      {id:'open',t:'Open now',m:.82},{id:'quiet',t:'Less crowded',m:.55},{id:'dog',t:'Dog-friendly',m:.4},{id:'family',t:'Family',m:.7},{id:'epic',t:'Epic views',m:.6}
    ]},
    {key:'region',label:'Region',multi:true,opts:[
      {id:'west',t:'West',m:.34},{id:'sw',t:'Southwest',m:.26},{id:'rockies',t:'Rockies',m:.22},{id:'east',t:'East',m:.3},{id:'ak',t:'Alaska',m:.08}
    ]}
  ];
  sel = {activity:{},vibe:{},region:{}};

  buildFilter(){
    var wrap=document.getElementById('filterGroups'); if(!wrap) return;
    var self=this;
    wrap.innerHTML=this.FILTERS.map(function(g){
      var chips=g.opts.map(function(o){
        return '<button class="pb-chip" data-g="'+g.key+'" data-o="'+o.id+'" style="position:relative;font-family:inherit;font-size:.82rem;font-weight:500;color:#c3c8d0;background:rgba(255,255,255,.03);border:1px solid rgba(217,183,121,.18);border-radius:999px;padding:9px 15px">'
          +o.t
          +(o.soon?'<span style="margin-left:7px;font-family:\'Space Mono\',monospace;font-size:.54rem;letter-spacing:.1em;text-transform:uppercase;color:#d9b779;border:1px solid rgba(217,183,121,.3);border-radius:999px;padding:1px 6px">Soon</span>':'')
          +'</button>';
      }).join('');
      return '<div><div style="font-family:\'Space Mono\',monospace;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#9aa0ab;margin-bottom:11px">'+g.label+'</div>'
        +'<div style="display:flex;gap:9px;flex-wrap:wrap">'+chips+'</div></div>';
    }).join('');
    wrap.querySelectorAll('.pb-chip').forEach(function(btn){
      btn.onclick=function(){
        var g=btn.getAttribute('data-g'), o=btn.getAttribute('data-o');
        if(self.sel[g][o]) delete self.sel[g][o]; else self.sel[g][o]=true;
        self.recount();
      };
    });
    this.recount(true);
  }
  chipOn(b){ b.style.color='#0b1710'; b.style.background='linear-gradient(120deg,#e8cf9a,#c9a35f)'; b.style.borderColor='transparent'; b.style.boxShadow='0 6px 20px -8px rgba(217,183,121,.7)'; b.style.transform='translateY(-1px)'; }
  chipOff(b){ b.style.color='#c3c8d0'; b.style.background='rgba(255,255,255,.03)'; b.style.borderColor='rgba(217,183,121,.18)'; b.style.boxShadow='none'; b.style.transform='none'; }
  recount(instant){
    var self=this;
    this.syncChips();
    var act=Object.keys(this.sel.activity), vibe=Object.keys(this.sel.vibe), reg=Object.keys(this.sel.region);
    var base=0;
    if(act.length){ this.FILTERS[0].opts.forEach(function(o){ if(self.sel.activity[o.id]) base+=o.w; }); }
    else base=4260; // everything
    var m=1;
    vibe.forEach(function(id){ var o=self.FILTERS[1].opts.find(function(x){return x.id===id;}); if(o)m*=o.m; });
    if(reg.length){ var rm=0; reg.forEach(function(id){ var o=self.FILTERS[2].opts.find(function(x){return x.id===id;}); if(o)rm+=o.m; }); m*=rm; }
    var target=Math.max(3,Math.round(base*m));
    this._lastTarget=target;
    this.animateNum(document.getElementById('matchCount'),target,instant?0:700);
    this.updateThumbs();
  }
  syncChips(){
    var self=this;
    document.querySelectorAll('.pb-chip').forEach(function(b){
      var g=b.getAttribute('data-g'), o=b.getAttribute('data-o');
      if(self.sel[g]&&self.sel[g][o]) self.chipOn(b); else self.chipOff(b);
    });
  }

  /* ---------------- MAP PRE-FLIGHT MODAL ---------------- */
  buildMapModal(){
    var self=this;
    this.MAP_TYPES=[
      {id:'np',t:'National Parks',c:'#4f9e6a',g:'●',n:63},
      {id:'sp',t:'State Parks',c:'#d9a441',g:'◆',n:48},
      {id:'nf',t:'National Forests',c:'#6f9e5a',g:'▲',n:42}
    ];
    this.MAP_LAYERS=[
      {id:'camp',t:'Campgrounds & areas',c:'#d08a4b',g:'▲'},
      {id:'lakes',t:'Lakes',c:'#4f96c9',g:'●'},
      {id:'hike',t:'Hiking trails',c:'#4f9e6a',g:'▬'},
      {id:'ohv',t:'Off-road / 4x4',c:'#c2562d',g:'▬'},
      {id:'ski',t:'Ski routes',c:'#5a86c9',g:'▬'}
    ];
    this.DEST=[
      {n:'Rocky Mountain',ty:'np',rg:'Colorado',s:'GO',tmp:68,ex:'42 trails · 18 lakes'},
      {n:'Zion',ty:'np',rg:'Utah',s:'GO',tmp:86,ex:'The Narrows flowing'},
      {n:'Glacier',ty:'np',rg:'Montana',s:'PREPARE',tmp:61,ex:'Going-to-the-Sun open'},
      {n:'Yosemite',ty:'np',rg:'California',s:'PREPARE',tmp:79,ex:'Timed entry today'},
      {n:'Great Smoky Mountains',ty:'np',rg:'Tennessee',s:'GO',tmp:75,ex:'Cades Cove open'},
      {n:'Acadia',ty:'np',rg:'Maine',s:'HOLD',tmp:57,ex:'Fog on Cadillac'},
      {n:'Eldorado Canyon',ty:'sp',rg:'Colorado',s:'GO',tmp:71,ex:'Climbing prime'},
      {n:'Custer',ty:'sp',rg:'South Dakota',s:'GO',tmp:73,ex:'Bison herd active'},
      {n:'Valley of Fire',ty:'sp',rg:'Nevada',s:'GO',tmp:91,ex:'Hot — go early'},
      {n:'Arapaho',ty:'nf',rg:'Colorado',s:'GO',tmp:63,ex:'Dispersed sites open'},
      {n:'Pisgah',ty:'nf',rg:'North Carolina',s:'PREPARE',tmp:70,ex:'Afternoon storms'},
      {n:'White River',ty:'nf',rg:'Colorado',s:'GO',tmp:59,ex:'Maroon Bells shuttle'}
    ];
    if(!this.mapSel) this.mapSel={np:true,sp:true,nf:true,camp:false,lakes:false,hike:false,ohv:false,ski:false};
    if(!this.radius) this.radius=150;
    if(this.nearMe===undefined){ this.nearMe=false; this.userLoc=null; }
    this.renderMapFilters();
    this._pinPts=[];
    for(var i=0;i<48;i++){ this._pinPts.push({x:Math.random(),y:Math.random(),k:Math.floor(Math.random()*4)}); }
    var open=function(e){ if(e)e.preventDefault(); self.openMapModal(); };
    var hero=document.getElementById('ctaPrimary'); if(hero) hero.addEventListener('click',open);
    var launch=document.getElementById('launchBtn'); if(launch) launch.addEventListener('click',open);
    var close=document.getElementById('mapModalClose'); if(close) close.onclick=function(){ self.closeMapModal(); };
    var bd=document.getElementById('mapModalBackdrop'); if(bd) bd.onclick=function(){ self.closeMapModal(); };
    var enter=document.getElementById('enterMapBtn'); if(enter) enter.addEventListener('click',function(){ try{ localStorage.setItem('pb_map_filters',JSON.stringify({types:self.mapSel,near:self.nearMe?self.userLoc:null,radius:self.nearMe?self.radius:null,ts:Date.now()})); }catch(e){} });
    document.addEventListener('keydown',function(e){ if(e.key==='Escape') self.closeMapModal(); });
    window.addEventListener('resize',function(){ self.renderResults(); });
  }
  openMapModal(){
    var m=document.getElementById('mapModal'); if(!m)return;
    var card=document.getElementById('mapModalCard'), self=this;
    if(window.innerWidth<720){ card.style.gridTemplateColumns='1fr'; card.style.height='auto'; card.style.maxHeight='92vh'; card.style.overflow='auto'; }
    else { card.style.gridTemplateColumns='minmax(0,1fr) minmax(0,1.12fr)'; card.style.height='min(92vh,640px)'; card.style.maxHeight='none'; card.style.overflow='hidden'; }
    m.style.display='flex';
    this.syncChips();
    requestAnimationFrame(function(){
      document.getElementById('mapModalBackdrop').style.opacity='1';
      card.style.opacity='1'; card.style.transform='none';
      setTimeout(function(){ self.renderResults(); },70);
    });
    this.recountMap();
  }
  renderMapFilters(){
    var mf=document.getElementById('modalFilters'); if(!mf) return;
    var self=this;
    var sw=function(on){ return '<span style="position:relative;width:42px;height:23px;border-radius:999px;flex:none;background:'+(on?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'rgba(255,255,255,.09)')+';border:1px solid '+(on?'transparent':'rgba(217,183,121,.22)')+';transition:all .3s"><span style="position:absolute;top:2px;left:2px;width:17px;height:17px;border-radius:50%;background:#fff;transform:translateX('+(on?'19px':'0')+');transition:transform .3s;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span></span>'; };
    var row=function(it){ var on=!!self.mapSel[it.id]; return '<div class="pb-tog" data-id="'+it.id+'" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;cursor:pointer;border-top:1px solid rgba(217,183,121,.08)"><span style="display:flex;align-items:center;gap:11px"><span style="color:'+it.c+';font-size:.85rem;width:15px;text-align:center">'+it.g+'</span><span style="font-size:.9rem;font-weight:500;color:#e7e3d8">'+it.t+'</span></span>'+sw(on)+'</div>'; };
    var head=function(t){ return '<div style="font-family:\'Space Mono\',monospace;font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;color:#9aa7a0;margin:4px 0 2px">'+t+'</div>'; };
    var X=self.MAP_TYPES.filter(function(x){return self.mapSel[x.id];}).reduce(function(a,b){return a+b.n;},0);
    var Y=self.MAP_TYPES.reduce(function(a,b){return a+b.n;},0);
    mf.innerHTML=
      head('Search radius')
      +'<div style="background:rgba(255,255,255,.03);border:1px solid rgba(217,183,121,.16);border-radius:14px;padding:12px 14px;margin-bottom:6px">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">'
          +'<span style="font-size:.92rem;font-weight:600;color:'+(self.nearMe?'#f4f1ea':'#7f8a82')+'">'+(self.nearMe?('Within <span id="radVal">'+self.radius+'</span> mi of you'):'Search everywhere')+'</span>'
          +'<button id="nearMeBtn" style="cursor:pointer;font-family:\'Space Mono\',monospace;font-size:.6rem;font-weight:700;color:'+(self.nearMe?'#0b1710':'#d9b779')+';background:'+(self.nearMe?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'transparent')+';border:1px solid rgba(217,183,121,.3);border-radius:999px;padding:5px 11px;white-space:nowrap">'+(self.nearMe?'✓ Located':'◎ Near me')+'</button>'
        +'</div>'
        // The distance slider only means something once we know WHERE "you" are.
        // Until "Near me" is tapped it stays disabled with a clear message, so the
        // radius can't be set to a meaningless value with no location behind it.
        +'<input id="radSlider" type="range" min="25" max="500" step="25" value="'+self.radius+'"'+(self.nearMe?'':' disabled')+' style="width:100%;margin-top:11px;accent-color:#c9a35f;'+(self.nearMe?'':'opacity:.3;cursor:not-allowed;pointer-events:none')+'">'
        +(self.nearMe?'':'<div id="nearMeMsg" style="font-size:.72rem;color:#7f8a82;line-height:1.45;margin-top:9px">Tap <b style="color:#d9b779">Near me</b> to search by distance from your location — otherwise we\'ll show every destination that matches.</div>')
      +'</div>'
      +head('Destination types')
      +self.MAP_TYPES.map(row).join('')
      +'<div style="height:6px"></div>'+head('On the map')
      +self.MAP_LAYERS.map(row).join('')
      +'<div style="font-size:.72rem;color:#7f8a82;line-height:1.5;margin-top:10px">Trail, campground &amp; lake layers draw around the park you select.</div>'
      +'<div style="display:flex;gap:8px;margin-top:12px"><button id="mfAll" style="flex:1;cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:600;color:#e7e3d8;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.22);border-radius:10px;padding:9px">All</button><button id="mfNone" style="flex:1;cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:600;color:#e7e3d8;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.22);border-radius:10px;padding:9px">None</button></div>'
      +'<div id="mfMatch" style="font-family:\'Space Mono\',monospace;font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:#9aa7a0;margin-top:12px">'+X+' of '+Y+' destinations match your filters</div>';
    mf.querySelectorAll('.pb-tog').forEach(function(rw){ rw.onclick=function(){ var id=rw.getAttribute('data-id'); self.mapSel[id]=!self.mapSel[id]; self.renderMapFilters(); self.recountMap(); }; });
    var nm=document.getElementById('nearMeBtn'); if(nm) nm.onclick=function(){ self.requestNearMe(); };
    var rs=document.getElementById('radSlider'); if(rs && self.nearMe) rs.oninput=function(){ self.radius=+rs.value; var rv=document.getElementById('radVal'); if(rv)rv.textContent=self.radius; };
    var all=document.getElementById('mfAll'); if(all) all.onclick=function(){ self.MAP_TYPES.concat(self.MAP_LAYERS).forEach(function(x){ self.mapSel[x.id]=true; }); self.renderMapFilters(); self.recountMap(); };
    var none=document.getElementById('mfNone'); if(none) none.onclick=function(){ Object.keys(self.mapSel).forEach(function(k){ self.mapSel[k]=false; }); self.renderMapFilters(); self.recountMap(); };
  }
  requestNearMe(){
    var self=this;
    var nm=document.getElementById('nearMeBtn'); if(nm){ nm.textContent='Locating…'; nm.disabled=true; }
    if(!navigator.geolocation){ this.nearMeError('Location isn’t available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(function(pos){
      self.userLoc={lat:pos.coords.latitude,lng:pos.coords.longitude};
      self.nearMe=true;
      self.renderMapFilters(); self.recountMap();
    }, function(err){
      self.nearMeError(err&&err.code===1?'Location permission denied — allow it to search by distance.':'Couldn’t get your location. Try again.');
    }, {enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  }
  nearMeError(msg){
    var box=document.getElementById('nearMeMsg'); if(box) box.innerHTML='<span style="color:#e0906a">'+msg+'</span>';
    var nm=document.getElementById('nearMeBtn'); if(nm){ nm.textContent='◎ Near me'; nm.disabled=false; }
  }
  recountMap(){
    var self=this;
    var X=self.MAP_TYPES.filter(function(x){return self.mapSel[x.id];}).reduce(function(a,b){return a+b.n;},0);
    this._mapTarget=X;
    this.animateNum(document.getElementById('modalCount'),X,300);
    this.renderResults();
  }
  closeMapModal(){
    var m=document.getElementById('mapModal'); if(!m)return;
    var card=document.getElementById('mapModalCard');
    document.getElementById('mapModalBackdrop').style.opacity='0';
    card.style.opacity='0'; card.style.transform='translateY(22px) scale(.98)';
    setTimeout(function(){ m.style.display='none'; },450);
  }
  renderResults(){
    var box=document.getElementById('previewList'); if(!box) return;
    var self=this;
    var tmap={np:this.MAP_TYPES[0],sp:this.MAP_TYPES[1],nf:this.MAP_TYPES[2]};
    var scol={GO:'#4fd98a',PREPARE:'#e8cf9a',HOLD:'#e0906a'};
    var layersOn=this.MAP_LAYERS.filter(function(l){return self.mapSel[l.id];});
    var list=this.DEST.filter(function(d){ return self.mapSel[d.ty]; });
    if(!list.length){ box.innerHTML='<div style="padding:34px 14px;text-align:center;color:#7f8a82;font-size:.86rem;line-height:1.5">No destination types selected.<br>Toggle National Parks, State Parks or National Forests to see live conditions.</div>'; return; }
    box.innerHTML=list.map(function(d,i){
      var ty=tmap[d.ty], c=scol[d.s]||'#4fd98a';
      var layerLine=layersOn.length?'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">'+layersOn.map(function(l){return '<span style="font-family:\'Space Mono\',monospace;font-size:.55rem;letter-spacing:.04em;color:'+l.c+'">'+l.g+' '+l.t.split(' ')[0]+'</span>';}).join('')+'</div>':'';
      return '<div style="animation:pb-chip .5s '+(Math.min(i,8)*0.04)+'s both;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:11px 11px;border-radius:13px;transition:background .3s" onmouseover="this.style.background=\'rgba(255,255,255,.035)\'" onmouseout="this.style.background=\'transparent\'">'
        +'<div style="display:flex;gap:11px;min-width:0;flex:1"><span style="width:42px;height:42px;flex:none;border-radius:11px;background:linear-gradient(150deg,'+ty.c+'2e,'+ty.c+'12);border:1px solid '+ty.c+'44;display:flex;align-items:center;justify-content:center;color:'+ty.c+';font-size:1.05rem">'+ty.g+'</span><div style="min-width:0"><div style="display:flex;align-items:center;gap:9px"><b style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:1.16rem;color:#f4f1ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+d.n+'</b></div>'
        +'<div style="font-family:\'Space Mono\',monospace;font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;color:#8a938b;margin-top:3px">'+ty.t+' · '+d.rg+'</div>'
        +'<div style="font-size:.76rem;color:#aeb6ad;font-weight:300;margin-top:4px">'+d.ex+'</div>'+layerLine+'</div></div>'
        +'<div style="text-align:right;flex:none"><span style="display:inline-flex;align-items:center;gap:6px;font-family:\'Space Mono\',monospace;font-size:.58rem;font-weight:700;letter-spacing:.1em;color:'+c+';border:1px solid '+c+'55;border-radius:999px;padding:3px 9px"><span style="width:6px;height:6px;border-radius:50%;background:'+c+';box-shadow:0 0 6px '+c+'"></span>'+d.s+'</span><div style="font-family:\'Cormorant Garamond\',serif;font-size:1.15rem;color:#e7e3d8;margin-top:5px">'+d.tmp+'°</div></div>'
      +'</div>';
    }).join('');
  }
  buildPersonas(){
    var list=document.getElementById('personaList'); if(!list) return;
    var self=this;
    this.PERSONAS=[
      {id:'hike',name:'The Hiker',tag:'Days measured in miles.',img:['Angels Landing','Half Dome'],caps:['Live trail status','Elevation & difficulty','Trip reports & photos'],live:'900+ trails · 612 rated GO today',accent:'#4f9e6a'},
      {id:'bike',name:'The Mountain Biker',tag:'Singletrack, berms, big descents.',img:['Slickrock Trail','Mountain biking'],caps:['Trail conditions','Bike-legal routes','Shuttle & flow beta'],live:'Flow trails drying out · 3 new reports',accent:'#c2562d',soon:true},
      {id:'road',name:'The Road Tripper',tag:'The drive is the destination.',img:['Going-to-the-Sun Road','Blue Ridge Parkway'],caps:['Scenic byways','Overlooks & photo stops','Fuel & gateway towns'],live:'141 scenic drives · Going-to-the-Sun open',accent:'#d9a441'},
      {id:'camp',name:'The Camper',tag:'Asleep under the Milky Way.',img:['Campsite','Camping'],caps:['Campground status','Reservations','Amenities & hookups'],live:'1,200+ sites · 340 open tonight',accent:'#6f9e5a'},
      {id:'ski',name:'The Skier',tag:'Chase the storm, earn the turns.',img:['Backcountry skiing','Rocky Mountain National Park'],caps:['Snow report','Avalanche awareness','Access road status'],live:'Season prep · first-snow watch on',accent:'#5a86c9',soon:true},
      {id:'overland',name:'The Overlander',tag:'Air down. Past the pavement.',img:['Alpine Loop (Colorado)','Off-roading'],caps:['OHV & 4x4 routes','Difficulty ratings','Dispersed camping'],live:'Backcountry routes · Alpine Loop open',accent:'#b98a5f',soon:true}
    ];
    list.innerHTML=this.PERSONAS.map(function(p,i){
      return '<div class="pb-persona" data-i="'+i+'" style="cursor:pointer;position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-radius:16px;border:1px solid rgba(217,183,121,.14);background:transparent;transition:all .45s cubic-bezier(.16,.8,.24,1)">'
        +'<div style="min-width:0"><div style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:1.28rem;color:#f4f1ea">'+p.name+(p.soon?' <span style="font-family:\'Space Mono\',monospace;font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:#d9b779;border:1px solid rgba(217,183,121,.3);border-radius:999px;padding:1px 6px;vertical-align:middle">Soon</span>':'')+'</div><div style="color:#9aa7a0;font-size:.8rem;font-weight:300;margin-top:2px">'+p.tag+'</div></div>'
        +'<span class="pb-parrow" style="color:'+p.accent+';font-size:1.1rem;flex:none;opacity:0;transform:translateX(-6px);transition:all .45s">→</span>'
      +'</div>';
    }).join('');
    list.querySelectorAll('.pb-persona').forEach(function(el){ el.onclick=function(){ self.setPersona(+el.getAttribute('data-i'),true); }; });
    var wrap=document.getElementById('personaWrap');
    if(wrap){
      wrap.addEventListener('mouseenter',function(){ self._pPause=true; });
      wrap.addEventListener('mouseleave',function(){ self._pPause=false; });
      var fit=function(){ wrap.style.gridTemplateColumns=window.innerWidth<760?'1fr':'minmax(0,.82fr) minmax(0,1.4fr)'; };
      fit(); window.addEventListener('resize',fit);
    }
    this.setPersona(0,false);
    if(!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches)){
      this._pTimer=setInterval(function(){ if(self._pPause)return; self.setPersona(((self._pI||0)+1)%self.PERSONAS.length,false); },5200);
    }
  }
  setPersona(i,user){
    this._pI=i; var p=this.PERSONAS[i], self=this;
    if(user && this._pTimer){ clearInterval(this._pTimer); this._pTimer=setInterval(function(){ if(self._pPause)return; self.setPersona(((self._pI||0)+1)%self.PERSONAS.length,false); },5200); }
    document.querySelectorAll('.pb-persona').forEach(function(el){
      var on=+el.getAttribute('data-i')===i;
      el.style.background=on?'linear-gradient(120deg,rgba(217,183,121,.16),rgba(14,32,21,.35))':'transparent';
      el.style.borderColor=on?'rgba(217,183,121,.32)':'rgba(217,183,121,.14)';
      var ar=el.querySelector('.pb-parrow'); if(ar){ ar.style.opacity=on?1:0; ar.style.transform=on?'none':'translateX(-6px)'; }
    });
    var stage=document.getElementById('personaStage'); if(!stage) return;
    var caps=p.caps.map(function(c,j){ return '<span style="animation:pb-chip .55s '+(0.18+j*0.13)+'s both;display:inline-flex;align-items:center;gap:8px;background:rgba(10,23,18,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(217,183,121,.25);border-radius:999px;padding:8px 14px;font-size:.82rem;font-weight:500;color:#f4f1ea"><span style="width:6px;height:6px;border-radius:50%;background:'+p.accent+'"></span>'+c+'</span>'; }).join('');
    stage.innerHTML='<img data-wiki="'+p.img.join('|')+'" alt="'+p.name+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.1s ease;animation:pb-kenburns 15s ease-out both">'
      +'<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,19,13,.2) 25%,rgba(8,19,13,.88) 100%)"></div>'
      +'<div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(20px,3vw,36px)">'
      +'<h3 style="animation:pb-chip .6s .05s both;font-family:\'Cormorant Garamond\',serif;font-weight:500;font-size:clamp(2rem,4vw,3.3rem);line-height:1;color:#f7f4ec;text-shadow:0 3px 22px rgba(0,0,0,.55)">'+p.name+'</h3>'
      +'<p style="animation:pb-chip .6s .1s both;color:#d3d8d1;font-size:1.02rem;font-weight:300;margin-top:9px">'+p.tag+'</p>'
      +'<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:17px">'+caps+'</div>'
      +'<div style="animation:pb-chip .6s .5s both;display:inline-flex;align-items:center;gap:9px;margin-top:19px;align-self:flex-start;background:rgba(10,23,18,.58);border:1px solid rgba(217,183,121,.22);border-radius:999px;padding:8px 15px"><span style="width:8px;height:8px;border-radius:50%;background:#4fd98a;box-shadow:0 0 8px #4fd98a;animation:pb-breathe 2.4s infinite"></span><span style="font-family:\'Space Mono\',monospace;font-size:.66rem;letter-spacing:.05em;color:#dfe4dd">'+p.live+'</span></div>'
      +'</div>';
    this.hydrateAll(stage);
  }
  THUMBS={hike:['Hiking trail'],drive:['Scenic route'],lakes:['Alpine lake'],camp:['Campground'],ohv:['Backcountry road'],mtb:['Singletrack'],ski:['Backcountry ski'],open:['Open park'],quiet:['Empty trail'],dog:['Trailhead'],family:['Boardwalk'],epic:['Overlook']};
  PHOTO_Q={hike:['Angels Landing'],drive:['Going-to-the-Sun Road'],lakes:['Jenny Lake'],camp:['Campsite'],ohv:['Alpine Loop (Colorado)'],mtb:['Slickrock Trail'],ski:['Backcountry skiing'],open:['Zion National Park'],quiet:['Great Basin National Park'],dog:['Acadia National Park'],family:['Yosemite Valley'],epic:['Grand Canyon']};
  updateThumbs(){
    var box=document.getElementById('previewThumbs'); if(!box) return;
    var self=this;
    var picks=Object.keys(this.sel.activity).concat(Object.keys(this.sel.vibe)).slice(0,4);
    if(!picks.length){ box.innerHTML='<span style="font-family:\'Space Mono\',monospace;font-size:.66rem;color:#7c828c;letter-spacing:.06em">Pick a few to preview your map</span>'; return; }
    box.innerHTML=picks.map(function(k,i){
      var q=(self.PHOTO_Q[k]||['National park']).join('|');
      return '<span style="position:relative;width:46px;height:46px;border-radius:11px;overflow:hidden;border:1px solid rgba(217,183,121,.35);background:#12241a;margin-left:'+(i?'-10px':'0')+';box-shadow:0 4px 14px -6px rgba(0,0,0,.8)">'
        +'<img data-wiki="'+q+'" alt="" style="width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .5s"></span>';
    }).join('')+'<span style="font-family:\'Space Mono\',monospace;font-size:.64rem;color:#9aa0ab;margin-left:12px;letter-spacing:.04em">live preview</span>';
    this.hydrateAll(box);
  }
  animateNum(el,target,dur){
    if(!el) return;
    var start=parseInt((el.textContent||'0').replace(/[^\d]/g,''))||0;
    if(dur<=0){ el.textContent=target.toLocaleString(); return; }
    var t0=performance.now();
    function step(now){
      var p=Math.min(1,(now-t0)/dur); var e=1-Math.pow(1-p,3);
      el.textContent=Math.round(start+(target-start)*e).toLocaleString();
      if(p<1)requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------------- STATS ---------------- */
  STATS=[
    {n:63,s:'National Parks',suf:'',href:'/explore'},{n:900,s:'Trails',suf:'+',href:'/explore'},{n:141,s:'Scenic Drives',suf:'',href:'/scenic-drives'},
    {n:1200,s:'Campgrounds',suf:'+',href:'/explore'},{n:100,s:'National Forests',suf:'+',href:'/explore'},{n:6800,s:'Lakes charted',suf:'+',href:'/explore'},
    {n:52000,s:'Miles charted',suf:'+'},{n:1,s:'Live conditions, always',suf:'',word:'Now',href:'/explore'}
  ];
  buildStats(){
    var g=document.getElementById('statGrid'); if(!g) return;
    g.innerHTML=this.STATS.map(function(s){
      var inner='<div class="pb-stat" data-n="'+s.n+'" data-suf="'+s.suf+'"'+(s.word?' data-word="'+s.word+'"':'')+' style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:clamp(2rem,4vw,3rem);line-height:1;background:linear-gradient(110deg,#f0dcae,#c9a35f);-webkit-background-clip:text;background-clip:text;color:transparent">0</div>'
        +'<div style="font-family:\'Space Mono\',monospace;font-size:.58rem;letter-spacing:.14em;text-transform:uppercase;color:#9aa0ab;margin-top:9px">'+s.s+(s.href?' <span style="color:#d9b779">→</span>':'')+'</div>';
      if(s.href) return '<a href="'+s.href+'" style="text-decoration:none;background:#0b1710;padding:26px 20px;text-align:center;display:block;transition:background .3s" onmouseover="this.style.background=\'#10241a\'" onmouseout="this.style.background=\'#0b1710\'">'+inner+'</a>';
      return '<div style="background:#0b1710;padding:26px 20px;text-align:center">'+inner+'</div>';
    }).join('');
  }
  runStat(el){
    if(el._done) return; el._done=true;
    var word=el.getAttribute('data-word');
    if(word){ el.textContent=word; return; }
    var n=+el.getAttribute('data-n'), suf=el.getAttribute('data-suf')||'';
    var t0=performance.now(), dur=1600;
    function step(now){ var p=Math.min(1,(now-t0)/dur); var e=1-Math.pow(1-p,3); el.textContent=Math.round(n*e).toLocaleString()+(p===1?suf:''); if(p<1)requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  /* ---------------- BENTO ---------------- */
  BENTO=[
    {t:'Open now',k:'map',cue:'Filters the map',span:'grid-column:span 2;grid-row:span 2',q:['Zion National Park'],stat:'1,140 open today',href:'/explore',sub:'Live GO verdicts across all 63'},
    {t:'Trails',k:'link',span:'',q:['Angels Landing'],stat:'900+ tracked',href:'/explore',sub:'Status, closures, reports'},
    {t:'Scenic drives',k:'link',span:'',q:['Going-to-the-Sun Road'],stat:'141 byways',href:'/scenic-drives',sub:'All-American Roads'},
    {t:'Lakes',k:'map',cue:'Filters the map',span:'',q:['Jenny Lake'],stat:'6,800+ charted',href:'/explore',sub:'Water temp, ramps, swim'},
    {t:'Best for hiking',k:'map',cue:'Filters the map',span:'',q:['Half Dome'],stat:'900+ trails',href:'/explore',sub:'Ranked by conditions'},
    {t:'Campgrounds',k:'link',span:'grid-column:span 2',q:['Campsite'],stat:'1,200+ sites',href:'/explore',sub:'Availability & status'},
    {t:'Scenic drives',k:'map',cue:'Filters the map',span:'',q:['Blue Ridge Parkway'],stat:'On the map',href:'/explore',sub:'Routes with photo markers'},
    {t:'Off-road',k:'map',cue:'Filters the map',span:'',q:['Alpine Loop (Colorado)'],stat:'Soon',soon:true,href:'/explore',sub:'OHV & backcountry routes'},
    {t:'Less crowded',k:'map',cue:'Filters the map',span:'',q:['Great Basin National Park'],stat:'Quiet picks',href:'/explore',sub:'Escape the peak hours'},
    {t:'Plan a trip',k:'link',span:'',q:['Grand Teton National Park'],stat:'Build a route',href:'/build-trip',sub:'Multi-park itineraries'},
    {t:'All parks',k:'link',span:'grid-column:span 2',q:['Grand Canyon'],stat:'63 parks',href:'/explore',sub:'The whole living map'}
  ];
  buildBento(){
    var g=document.getElementById('bento'); if(!g) return;
    var self=this;
    g.innerHTML=this.BENTO.map(function(b,i){
      var isMap=(b.k==='map');
      var cueColor=isMap?'#d9b779':'#7fdca0';
      return '<div class="pb-flip pb-rise" data-flip style="'+b.span+';transition-delay:'+(i%4*0.05)+'s">'
        +'<div class="pb-flip-inner">'
          +'<div class="pb-face" style="border:1px solid rgba(217,183,121,.18)">'
            +'<img data-wiki="'+b.q.join('|')+'" alt="'+b.t+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s,transform 8s ease">'
            +'<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,#12241a 0 14px,#0e1d14 14px 28px)"></div>'
            +'<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,10,16,.1) 30%,rgba(7,10,16,.86) 100%)"></div>'
            +'<div style="position:absolute;left:13px;top:13px;display:inline-flex;align-items:center;gap:6px;font-family:\'Space Mono\',monospace;font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:'+cueColor+';background:rgba(7,10,16,.55);border:1px solid rgba(217,183,121,.2);border-radius:999px;padding:4px 9px"><span style="width:5px;height:5px;border-radius:50%;background:'+cueColor+'"></span>'+(isMap?'Filters the map':'Opens page')+(b.soon?' · Soon':'')+'</div>'
            +'<div style="position:absolute;left:14px;right:14px;bottom:13px"><b style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:1.5rem;color:#f7f4ec;text-shadow:0 2px 14px rgba(0,0,0,.6)">'+b.t+'</b></div>'
          +'</div>'
          +'<div class="pb-face pb-back" style="border:1px solid rgba(217,183,121,.35);background:linear-gradient(160deg,#132819,#0b1710);display:flex;flex-direction:column;justify-content:space-between;padding:18px">'
            +'<div><div style="font-family:\'Space Mono\',monospace;font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:#d9b779">'+(isMap?'Map filter':'Dedicated view')+'</div>'
            +'<b style="display:block;font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:1.6rem;margin-top:6px">'+b.t+'</b>'
            +'<div style="color:#9aa0ab;font-size:.82rem;line-height:1.5;margin-top:6px">'+b.sub+'</div></div>'
            +'<div><div style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:1.2rem;color:#e8cf9a">'+b.stat+'</div>'
            +'<a href="'+b.href+'" style="display:inline-flex;align-items:center;gap:7px;margin-top:8px;text-decoration:none;font-size:.82rem;font-weight:600;color:#f4f1ea">'+(b.soon?'Notify me':(isMap?'Open filtered map':'Open'))+' <span style="color:#d9b779">→</span></a></div>'
          +'</div>'
        +'</div>'
      +'</div>';
    }).join('');
    g.querySelectorAll('[data-flip]').forEach(function(card){
      card.addEventListener('mouseenter',function(){ card.classList.add('pb-flipped'); });
      card.addEventListener('mouseleave',function(){ card.classList.remove('pb-flipped'); });
      card.addEventListener('click',function(e){ if(e.target.tagName==='A')return; card.classList.toggle('pb-flipped'); });
    });
    this.hydrateAll(g);
    this.responsiveBento();
    window.addEventListener('resize',this.responsiveBento.bind(this));
  }
  responsiveBento(){
    var g=document.getElementById('bento'); if(!g) return;
    var w=window.innerWidth;
    g.style.gridTemplateColumns='repeat('+(w<640?2:4)+',1fr)';
  }

  /* ---------------- BOOKING ---------------- */
  buildBooking(){
    var stays=document.getElementById('bookStays'), cars=document.getElementById('bookCars'), self=this;
    // Affiliate hand-off: the Search buttons open the PARTNER's real search in a
    // new tab (we never take payment — same pattern as the Recreation.gov popup).
    // Commission tracking turns on once these ids are filled in; get them from the
    // partner programs (Booking.com / Travelpayouts for stays, Discover Cars for
    // cars). Empty = a plain, still-working partner link with no commission yet.
    var AID_STAYS = '';
    var AID_CARS  = '';
    var field=function(label,val,ph,id){ return '<div style="flex:1;min-width:150px"><div style="font-family:\'Space Mono\',monospace;font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:#9aa0ab;margin-bottom:7px">'+label+'</div><input'+(id?' id="'+id+'"':'')+' value="'+(val||'')+'" placeholder="'+(ph||'')+'" style="width:100%;font-family:inherit;font-size:.9rem;color:#f4f1ea;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.2);border-radius:12px;padding:12px 14px;outline:none"></div>'; };
    var cta=function(label,id){ return '<button id="'+id+'" class="pb-mag" style="cursor:pointer;font-family:inherit;align-self:flex-end;font-size:.88rem;font-weight:600;color:#0b1710;background:linear-gradient(120deg,#e8cf9a,#c9a35f);border:none;padding:13px 24px;border-radius:12px;white-space:nowrap">'+label+'</button>'; };
    if(stays) stays.innerHTML='<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">'
      +field('Destination','Springdale, UT — Zion gateway','','bkStayDest')+field('Check in','','Add dates')+field('Check out','','Add dates')+field('Guests','2 guests','')
      +cta('Search stays →','bkStaySearch')+'</div>';
    if(cars) cars.innerHTML='<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">'
      +field('Pick-up','Las Vegas Airport (LAS) — near Zion','','bkCarLoc')+field('Pick-up date','','Add date')+field('Return date','','Add date')+field('Driver age','25+','')
      +cta('Search cars →','bkCarSearch')+'</div>';
    var openPartner=function(url){ try{ window.open(url,'_blank','noopener,noreferrer'); }catch(e){ location.href=url; } };
    var ss2=document.getElementById('bkStaySearch'); if(ss2) ss2.onclick=function(){ var d=((document.getElementById('bkStayDest')||{}).value||'').trim(); openPartner('https://www.booking.com/searchresults.html?ss='+encodeURIComponent(d)+(AID_STAYS?'&aid='+encodeURIComponent(AID_STAYS):'')); };
    var cs2=document.getElementById('bkCarSearch'); if(cs2) cs2.onclick=function(){ openPartner('https://www.discovercars.com/'+(AID_CARS?'?a_aid='+encodeURIComponent(AID_CARS):'')); };
    var ts=document.getElementById('tabStays'), tc=document.getElementById('tabCars'), tg=document.getElementById('tabGear');
    var gear=document.getElementById('bookGear');
    function setTab(which){
      var on='linear-gradient(120deg,#e8cf9a,#c9a35f)';
      [[ts,'s'],[tc,'c'],[tg,'g']].forEach(function(p){ if(p[0]){ p[0].style.background=which===p[1]?on:'transparent'; p[0].style.color=which===p[1]?'#0b1710':'#c3c8d0'; } });
      if(stays)stays.style.display=which==='s'?'block':'none';
      if(cars)cars.style.display=which==='c'?'block':'none';
      if(gear)gear.style.display=which==='g'?'block':'none';
    }
    if(ts)ts.onclick=function(){setTab('s');}; if(tc)tc.onclick=function(){setTab('c');}; if(tg)tg.onclick=function(){setTab('g');};
  }
  buildAuth(){
    var self=this, panel=document.getElementById('authPanel'); if(!panel) return;
    var drawer=document.getElementById('authDrawer'), bd=document.getElementById('authBackdrop');
    var open=function(){ panel.style.display='block'; requestAnimationFrame(function(){ bd.style.opacity='1'; drawer.style.transform='none'; }); };
    var close=function(){ bd.style.opacity='0'; drawer.style.transform='translateX(100%)'; setTimeout(function(){ panel.style.display='none'; },500); };
    var sb=document.getElementById('signInBtn'); if(sb) sb.onclick=open;
    var ac=document.getElementById('authClose'); if(ac) ac.onclick=close;
    if(bd) bd.onclick=close;
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&panel.style.display==='block') close(); });
    this._authMode='in';
    var tgl=document.getElementById('authToggle'), name=document.getElementById('authName');
    var applyMode=function(){
      var up=self._authMode==='up';
      document.getElementById('authEyebrow').textContent=up?'Join Park Buddy':'Welcome back';
      document.getElementById('authTitle').textContent=up?'Create account':'Sign in';
      document.getElementById('authSubmit').textContent=(up?'Create account':'Sign in')+' →';
      if(name) name.style.display=up?'block':'none';
      tgl.innerHTML=up?'Already have an account? <b style="color:#e8cf9a">Sign in</b>':'New to Park Buddy? <b style="color:#e8cf9a">Create account</b>';
    };
    applyMode();
    if(tgl) tgl.onclick=function(){ self._authMode=self._authMode==='up'?'in':'up'; applyMode(); };
    var form=document.getElementById('authForm');
    if(form) form.onsubmit=function(e){ e.preventDefault(); var b=document.getElementById('authSubmit'); b.textContent='Welcome ✓'; b.style.background='linear-gradient(120deg,#7fce9a,#4f9e6a)'; setTimeout(close,900); };
  }

  /* ---------------- LEARN SCROLLYTELLING ---------------- */
  LEARN=[
    {k:'The living verdict',t:'Every park carries a GO, PREPARE or HOLD verdict — a plain read on whether today is the day. It fuses NWS weather, NPS closures, air quality and crowd patterns into one honest call, and it refreshes all day long.',v:'verdict'},
    {k:'63 and counting',t:'From 6,000-acre Gateway Arch to 8-million-acre Wrangell–St. Elias, there are 63 designated national parks. Park Buddy charts every one — plus 900+ trails, 141 scenic byways, 100+ national forests and thousands of lakes between them.',v:'count'},
    {k:'An agent that plans',t:'Ask in plain words and the AI companion reads live conditions across the whole system, then hands back a real itinerary — routed, timed, checklisted, and ready to book through partners.',v:'ai'},
    {k:'Offline by design',t:'Trail navigation keeps working past the last bar of signal. Routes, waypoints and your live position are cached before you lose the road, so the map never goes dark at the trailhead.',v:'offline'},
    {k:'Roads with a rank',t:'Scenic byways carry federal designations for scenery, nature, history, culture and recreation. The rarest — All-American Roads — are destinations in their own right, and Park Buddy tracks whether each is open.',v:'byway'}
  ];
  buildLearn(){
    var box=document.getElementById('learnSteps'), prog=document.getElementById('learnProgress'); if(!box) return;
    box.innerHTML=this.LEARN.map(function(s,i){
      return '<div class="pb-learnstep" data-i="'+i+'" style="position:absolute;inset:0;opacity:'+(i===0?1:0)+';transform:translateY('+(i===0?0:24)+'px);transition:opacity .7s cubic-bezier(.16,.8,.24,1),transform .7s cubic-bezier(.16,.8,.24,1)">'
        +'<h3 style="font-family:\'Cormorant Garamond\',serif;font-weight:500;font-size:clamp(1.8rem,3.6vw,2.7rem);line-height:1.05;color:#f4f1ea">'+s.k+'</h3>'
        +'<p style="color:#aab0ba;font-size:1.02rem;line-height:1.7;font-weight:300;margin-top:14px;max-width:440px">'+s.t+'</p></div>';
    }).join('');
    prog.innerHTML=this.LEARN.map(function(s,i){ return '<span class="pb-learndot" data-i="'+i+'" style="height:3px;flex:1;border-radius:2px;background:'+(i===0?'#d9b779':'rgba(217,183,121,.2)')+';transition:background .5s"></span>'; }).join('');
    this.setLearnVisual(0);
  }
  setLearnStep(i){
    if(this._learnI===i) return; this._learnI=i;
    document.querySelectorAll('.pb-learnstep').forEach(function(el){ var on=+el.getAttribute('data-i')===i; el.style.opacity=on?1:0; el.style.transform='translateY('+(on?0:24)+'px)'; });
    document.querySelectorAll('.pb-learndot').forEach(function(el){ el.style.background=+el.getAttribute('data-i')===i?'#d9b779':'rgba(217,183,121,.2)'; });
    this.setLearnVisual(i);
  }
  setLearnVisual(i){
    var box=document.getElementById('learnVisual'); if(!box) return;
    var v=this.LEARN[i].v, html='';
    if(v==='verdict'){
      html='<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px">'
        +['GO','PREPARE','HOLD'].map(function(x,j){ var c=['#4fd98a','#e8cf9a','#e08a6a'][j]; var active=j===0;
          return '<div style="display:flex;align-items:center;gap:14px;opacity:'+(active?1:.4)+'"><span style="width:'+(active?18:12)+'px;height:'+(active?18:12)+'px;border-radius:50%;background:'+c+';box-shadow:0 0 '+(active?18:0)+'px '+c+'"></span><span style="font-family:\'Cormorant Garamond\',serif;font-size:'+(active?2.4:1.5)+'rem;font-weight:600;color:'+c+'">'+x+'</span></div>'; }).join('')
        +'</div>';
    } else if(v==='count'){
      html='<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:6rem;line-height:1;background:linear-gradient(110deg,#f0dcae,#c9a35f);-webkit-background-clip:text;background-clip:text;color:transparent">63</div><div style="font-family:\'Space Mono\',monospace;font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;color:#9aa0ab;margin-top:10px">national parks</div></div>';
    } else if(v==='offline'){
      html='<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><svg width="60%" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="50" stroke="rgba(217,183,121,.25)" stroke-width="1"></circle><circle cx="60" cy="60" r="34" stroke="rgba(217,183,121,.35)" stroke-width="1"></circle><path d="M40 78 L58 44 L70 64 L82 40" stroke="#e8cf9a" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="82" cy="40" r="4" fill="#e8cf9a"></circle></svg></div>';
    } else if(v==='ai'){
      html='<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:clamp(24px,4vw,40px)">'
        +'<div style="align-self:flex-end;background:linear-gradient(120deg,rgba(232,207,154,.22),rgba(201,163,95,.16));border:1px solid rgba(217,183,121,.3);border-radius:14px 14px 4px 14px;padding:9px 13px;font-size:.82rem;color:#f4f1ea;max-width:82%">Easy 3-day loop, dog-friendly?</div>'
        +'<div style="align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(217,183,121,.18);border-radius:14px 14px 14px 4px;padding:9px 13px;font-size:.82rem;color:#e7e3d8;max-width:86%">Golden Gate Canyon → Mount Falcon → Staunton. All <b style="color:#4fd98a">GO</b> today.</div>'
        +'<div style="align-self:flex-start;display:flex;gap:6px;margin-top:4px"><span style="font-size:.68rem;color:#0b1710;background:linear-gradient(120deg,#e8cf9a,#c9a35f);border-radius:999px;padding:5px 11px">Add to trip</span><span style="font-size:.68rem;color:#e7e3d8;border:1px solid rgba(217,183,121,.3);border-radius:999px;padding:5px 11px">Checklist</span></div>'
        +'</div>';
    } else {
      html='<div style="position:absolute;inset:0;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:10px;padding:30px">'
        +['Scenic','Natural','Historic','Cultural','Recreational'].map(function(q){ return '<span style="font-family:\'Space Mono\',monospace;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:#d9b779;border:1px solid rgba(217,183,121,.3);border-radius:999px;padding:7px 13px">'+q+'</span>'; }).join('')
        +'<div style="width:100%;text-align:center;margin-top:14px;font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:1.4rem;color:#e7e3d8">All-American Road</div></div>';
    }
    box.innerHTML='<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(217,183,121,.08),transparent 70%)"></div>'+html;
  }

  /* ---------------- SHOP ---------------- */
  buildShop(){
    var g=document.getElementById('shopRow'); if(!g) return;
    var items=[{t:'Park maps & posters',q:['Topographic map']},{t:'Souvenirs',q:['National Park Service']},{t:'Branded gear',q:['Hiking']},{t:'Curated camping gear',q:['Camping']}];
    g.innerHTML=items.map(function(it){
      return '<div class="pb-rise" style="position:relative;aspect-ratio:4/5;border-radius:18px;overflow:hidden;border:1px solid rgba(217,183,121,.18)">'
        +'<img data-wiki="'+it.q.join('|')+'" alt="'+it.t+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s;filter:grayscale(.3) brightness(.7)">'
        +'<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,#12241a 0 14px,#0e1d14 14px 28px)"></div>'
        +'<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,10,16,.2),rgba(7,10,16,.85))"></div>'
        +'<span style="position:absolute;left:12px;top:12px;font-family:\'Space Mono\',monospace;font-size:.54rem;letter-spacing:.12em;text-transform:uppercase;color:#d9b779;background:rgba(7,10,16,.6);border:1px solid rgba(217,183,121,.25);border-radius:999px;padding:4px 9px">Coming soon</span>'
        +'<b style="position:absolute;left:14px;right:14px;bottom:13px;font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:1.25rem;color:#f4f1ea;line-height:1.1">'+it.t+'</b>'
      +'</div>';
    }).join('');
    this.hydrateAll(g);
  }

  /* ---------------- HOW IT WORKS ---------------- */
  buildHow(){
    var g=document.getElementById('howGrid'); if(!g) return;
    var steps=[
      {n:'01',t:'Discover',d:'Design your journey, then watch the country tune itself to your intent.'},
      {n:'02',t:'Decide',d:'Live GO / PREPARE / HOLD verdicts from weather, closures and crowds.'},
      {n:'03',t:'Do',d:'Trails, scenic drives, lakes and off-road — with real conditions on each.'},
      {n:'04',t:'Plan & book',d:'Build the route, then hand off to stays and rental-car partners.'}
    ];
    g.innerHTML=steps.map(function(s){
      return '<div class="pb-rise" style="position:relative;border:1px solid rgba(217,183,121,.16);border-radius:20px;padding:24px;background:linear-gradient(160deg,rgba(14,32,21,.6),rgba(9,22,15,.4))">'
        +'<div style="position:absolute;top:0;left:24px;right:24px;height:1px;background:linear-gradient(90deg,rgba(217,183,121,.6),transparent)"></div>'
        +'<div style="font-family:\'Space Mono\',monospace;font-size:.8rem;color:#d9b779;letter-spacing:.1em">'+s.n+'</div>'
        +'<h3 style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:1.6rem;margin-top:14px">'+s.t+'</h3>'
        +'<p style="color:#9aa0ab;font-size:.88rem;line-height:1.6;font-weight:300;margin-top:8px">'+s.d+'</p></div>';
    }).join('');
  }

  /* ---------------- TRUST ---------------- */
  buildTrust(){
    var g=document.getElementById('sourceRow'); if(!g) return;
    var src=['NPS','USGS','NWS','FHWA · America’s Byways','Recreation.gov'];
    g.innerHTML=src.map(function(s){ return '<span style="font-family:\'Cormorant Garamond\',serif;font-weight:500;font-size:1.3rem;color:#c3c8d0;letter-spacing:.02em">'+s+'</span>'; }).join('<span style="color:rgba(217,183,121,.4)">✦</span>');
  }

  /* ---------------- FOOTER ---------------- */
  buildFooter(){
    var c1=document.getElementById('footCol1'), c2=document.getElementById('footCol2'), soc=document.getElementById('socials');
    var col=function(title,items){ return '<div style="font-family:\'Space Mono\',monospace;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:#9aa0ab">'+title+'</div><div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">'
      +items.map(function(it){ return '<a href="'+it[1]+'" style="text-decoration:none;color:#c3c8d0;font-size:.86rem;transition:color .3s" onmouseover="this.style.color=\'#e8cf9a\'" onmouseout="this.style.color=\'#c3c8d0\'">'+it[0]+'</a>'; }).join('')
      +'</div>'; };
    if(c1)c1.innerHTML=col('Explore',[['Live map','/explore'],['Trails','/explore'],['Scenic drives','/scenic-drives'],['Lakes','/explore']]);
    if(c2)c2.innerHTML=col('Company',[['Plan a trip','/build-trip'],['Shop','#shop'],['List with us','#'],['About','/about']]);
    if(soc)soc.innerHTML=['✦','◈','◆','●'].map(function(g){ return '<a href="#" style="width:34px;height:34px;border-radius:50%;border:1px solid rgba(217,183,121,.25);display:flex;align-items:center;justify-content:center;color:#d9b779;text-decoration:none;transition:all .3s" onmouseover="this.style.background=\'rgba(217,183,121,.12)\'" onmouseout="this.style.background=\'transparent\'">'+g+'</a>'; }).join('');
  }

  /* ---------------- REVEALS ---------------- */
  initReveals(){
    var self=this;
    if(!('IntersectionObserver' in window)){ document.querySelectorAll('.pb-rise').forEach(function(el){el.classList.add('pb-in');}); document.querySelectorAll('.pb-stat').forEach(function(el){self.runStat(el);}); return; }
    this._io=new IntersectionObserver(function(ents){
      ents.forEach(function(e){
        if(!e.isIntersecting) return;
        if(e.target.classList.contains('pb-rise')) e.target.classList.add('pb-in');
        if(e.target.classList.contains('pb-stat')) self.runStat(e.target);
      });
    },{threshold:.16});
    document.querySelectorAll('.pb-rise,.pb-stat').forEach(function(el){ self._io.observe(el); });
  }

  /* ---------------- MAGNETIC BUTTONS ---------------- */
  initMagnetic(){
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    document.querySelectorAll('.pb-mag').forEach(function(el){
      el.addEventListener('mousemove',function(e){ var r=el.getBoundingClientRect(); var x=(e.clientX-r.left-r.width/2)/r.width; var y=(e.clientY-r.top-r.height/2)/r.height; el.style.transform='translate('+(x*8)+'px,'+(y*8)+'px)'; });
      el.addEventListener('mouseleave',function(){ el.style.transform='none'; });
    });
  }

  /* ---------------- SCROLLYTELLING DRIVER ---------------- */
  initScrolly(){
    var sec=document.getElementById('learn'); if(!sec) return;
    var self=this;
    this._onScroll=function(){
      var r=sec.getBoundingClientRect(); var vh=window.innerHeight;
      var total=sec.offsetHeight-vh;
      var p=Math.min(1,Math.max(0,(-r.top)/total));
      var i=Math.min(self.LEARN.length-1,Math.floor(p*self.LEARN.length));
      self.setLearnStep(i);
    };
    window.addEventListener('scroll',this._onScroll,{passive:true});
    this._onScroll();
  }

  /* ---------------- WIKIPEDIA PHOTOS ---------------- */
  sum(title){ var self=this; if(!this._sumc)this._sumc={}; if(!this._sumc[title]){ this._sumc[title]=fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title)).then(function(r){return r.ok?r.json():null;}).catch(function(){delete self._sumc[title];return null;}); } return this._sumc[title]; }
  badFile(u){ var f=(u||'').split('/').pop(); return /\.(gif|svg)(\?|$)/i.test(u||'')||/map|locator|logo|diagram|seal|flag/i.test(f); }
  pickTile(dd){ if(!dd||!dd.thumbnail||!dd.thumbnail.source)return null; var t=dd.thumbnail.source; if(this.badFile(t))return null; var ow=(dd.originalimage&&dd.originalimage.width)||0; return {src:(ow>900)?t.replace(/\/\d+px-/,'/800px-'):t,raw:t}; }
  chainFetch(titles,cb,attempt){ var self=this,i=0; var next=function(){ if(i>=titles.length){ if(!attempt)setTimeout(function(){self.chainFetch(titles,cb,1);},1200); return;} var t=titles[i++]; self.sum(t).then(function(dd){ var p=self.pickTile(dd); if(p)cb(p); else next(); }); }; next(); }
  applyImg(img,p){ var set=function(u){ img.onerror=function(){ if(p.raw&&img.src!==p.raw)img.src=p.raw; else img.style.opacity='0'; }; img.onload=function(){img.style.opacity= (img.style.filter?'1':'1');}; img.src=u; }; if(p.src!==p.raw){ fetch(p.src,{method:'HEAD'}).then(function(r){set(r.ok?p.src:p.raw);}).catch(function(){set(p.raw);}); } else set(p.src); }
  // Photos come from OUR /api/photo (server-side candidate chain + the hardened
  // badFile filter that rejects maps/shields/aerial-tiles/ISS-orbital shots) —
  // not a raw client-side Wikipedia call. data-wiki is already the pipe-joined
  // candidate list /api/photo expects. Staggered so a photo-heavy view doesn't
  // stampede the upstream (same rate-limit lesson as the scenic-drives tiles).
  hydrateAll(scope){
    scope.querySelectorAll('img[data-wiki]').forEach(function(img,idx){
      var want=img.getAttribute('data-wiki'); if(!want||img.getAttribute('data-applied')===want) return;
      img.setAttribute('data-applied',want);
      setTimeout(function(){
        fetch('/api/photo?q='+encodeURIComponent(want)+'&v=4')
          .then(function(r){ return r.ok?r.json():null; })
          .then(function(d){ if(d&&d.found){ img.onload=function(){ img.style.opacity='1'; }; img.src=d.thumb||d.image; } })
          .catch(function(){});
      }, idx*120);
    });
  }
}
// Robust boot: the embed pipeline injects this script AFTER the markup is in
// place and the document is already loaded, so a `DOMContentLoaded` listener may
// never fire. Run immediately when the DOM is ready, else wait for the event.
(function(){
  function boot(){ try { var c = new Component(); c.componentDidMount(); } catch(e){ console.error('[home] boot failed', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

