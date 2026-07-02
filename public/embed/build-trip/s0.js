
var PARKS=window.TRIP_PARKS||[], PREBUILT=window.TRIP_PREBUILT||[];
var byId={}; PARKS.forEach(function(p){byId[p.id]=p;});
var NIGHTS={1:3,4:2,5:2,7:2,8:3,9:2,13:2,14:2,16:2,19:2,20:2,21:3,24:2,25:2,28:2,30:2,33:2,37:3,41:2,48:2,54:2,56:2,57:2,58:2,60:2,61:3};
var CARS={none:{label:"My own car",mpg:26,rate:0},economy:{label:"Economy car",mpg:32,rate:45},midsize:{label:"Midsize car",mpg:28,rate:55},suv:{label:"SUV",mpg:22,rate:85},minivan:{label:"Minivan / Van",mpg:20,rate:95}};
var trip={name:"",startDate:"",travelers:2,car:"midsize",gas:3.5,hotel:130,food:40,stops:[],ovr:{}};
// stop: {pid|name,lat,lng,custom,kind, nights, lodge, hidden}

function stopLL(s){ if(s.pid){var p=byId[s.pid];return p?[p.lat,p.lng]:null;} return [s.lat,s.lng]; }
function stopName(s){ return s.pid?(byId[s.pid]?byId[s.pid].name:'Park'):s.name; }
function stopSub(s){ if(s.pid){var p=byId[s.pid];return p?(p.state+' · National Park'):'';} return (s.kind?s.kind+' · ':'')+(typeof s.lat==='number'?s.lat.toFixed(3)+', '+s.lng.toFixed(3):''); }
function visibleStops(){ return trip.stops.filter(function(s){return !s.hidden;}); }
function miles(a,b){var R=3958.8,t=Math.PI/180,dLat=(b[0]-a[0])*t,dLng=(b[1]-a[1])*t,la1=a[0]*t,la2=b[0]*t;var h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function driveH(mi){return mi/55*1.3;}
function fmtH(h){var hh=Math.floor(h),mm=Math.round((h-hh)*60);if(mm===60){hh++;mm=0;}return (hh?hh+'h ':'')+(mm?mm+'m':(hh?'':'0m'));}
function defNights(s){return s.pid?(NIGHTS[s.pid]||1):0;}
function toast(t){var el=document.getElementById('toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove('show');},2300);}

/* route info (real roads via OSRM, with estimate fallback) */
var routeInfo=null, routeKey='';
function legsData(){ if(routeInfo&&routeInfo.ok&&routeInfo.legs&&routeInfo.legs.length){return routeInfo.legs;} var vs=visibleStops(),a=[];for(var i=1;i<vs.length;i++){var d=miles(stopLL(vs[i-1]),stopLL(vs[i]));a.push({mi:d,hours:driveH(d)});}return a; }
function totalMiles(){ if(routeInfo&&routeInfo.ok)return routeInfo.totalMi; var vs=visibleStops(),t=0;for(var i=1;i<vs.length;i++)t+=miles(stopLL(vs[i-1]),stopLL(vs[i]));return t; }
function isRealRoute(){ return !!(routeInfo&&routeInfo.ok&&routeInfo.real); }
function travelDays(){var n=0;legsData().forEach(function(l){if(l.hours>5)n++;});return n;}
function totalNights(){return visibleStops().reduce(function(a,s){return a+(s.nights!=null?s.nights:defNights(s));},0);}
function tripDays(){var d=totalNights()+travelDays();if(d<1&&visibleStops().length)d=1;return d;}
function computeRoute(cb){
  var vs=visibleStops();
  if(vs.length<2){routeInfo={ok:true,real:false,line:vs.map(gll),legs:[],totalMi:0};routeKey='lt2';cb&&cb();return;}
  var key=vs.map(function(s){var l=stopLL(s);return l[0].toFixed(4)+','+l[1].toFixed(4);}).join(';');
  if(key===routeKey&&routeInfo){cb&&cb();return;}
  function fallback(){var legs=[],tot=0;for(var i=1;i<vs.length;i++){var dd=miles(stopLL(vs[i-1]),stopLL(vs[i]));legs.push({mi:dd,hours:driveH(dd)});tot+=dd;}routeInfo={ok:true,real:false,line:vs.map(gll),legs:legs,totalMi:tot};routeKey=key;cb&&cb();}
  var coords=vs.map(function(s){var l=stopLL(s);return l[1]+','+l[0];}).join(';');
  fetch('https://router.project-osrm.org/route/v1/driving/'+coords+'?overview=full&geometries=geojson')
   .then(function(r){if(!r.ok)throw 0;return r.json();})
   .then(function(d){
     var rt=d.routes&&d.routes[0]; if(!rt||!rt.geometry)throw 0;
     var line=rt.geometry.coordinates.map(function(c){return {lat:c[1],lng:c[0]};});
     var legs=(rt.legs||[]).map(function(l){return {mi:l.distance/1609.34,hours:l.duration/3600};});
     routeInfo={ok:true,real:true,line:line,legs:legs,totalMi:rt.distance/1609.34};routeKey=key;cb&&cb();
   })
   .catch(fallback);
}

/* prebuilt */
function renderPrebuilt(){
  var w=document.getElementById('prebuilt');
  w.innerHTML=PREBUILT.map(function(it){return '<div class="ic" data-id="'+it.id+'"><div class="rg">'+it.region+'</div><h3>'+it.name+'</h3><p>'+it.tag+'</p><div class="meta"><span class="pill">'+it.parks.length+' parks</span><span class="pill">~'+it.days+' days</span></div></div>';}).join('');
  w.querySelectorAll('.ic').forEach(function(c){c.onclick=function(){loadPrebuilt(c.getAttribute('data-id'));};});
}
function loadPrebuilt(id){
  var it=PREBUILT.find(function(x){return x.id===id;});if(!it)return;
  trip.name=it.name;trip.stops=it.parks.map(function(pid){return {pid:pid,nights:NIGHTS[pid]||1,lodge:''};});
  document.getElementById('tripname').value=trip.name;
  render(true);toast('Loaded “'+it.name+'”');
}

/* render orchestration */
function render(fit){ layout(fit); save(); computeRoute(function(){ layout(false); }); }
function layout(fit){ renderStops(); renderStats(); renderCost(); drawMap(fit); syncLinks(); refreshParkSelect(); }

function renderStops(){
  var el=document.getElementById('stoplist');
  if(!trip.stops.length){el.innerHTML='<div class="empty"><span class="big">🧭</span>Your trip is empty. Tap a ready-made itinerary above, or add stops below.</div>';document.getElementById('daterange').textContent='';return;}
  var L=legsData(),html='',day=1,visN=0;
  trip.stops.forEach(function(s,i){
    if(s.hidden){
      html+='<div class="stop hidden" data-i="'+i+'"><span class="num">–</span><div class="si"><b>'+stopName(s)+'</b><div class="sub">Hidden from map</div></div><button class="eye" data-i="'+i+'" title="Show on map">🙈</button><button class="rm" data-i="'+i+'" title="Remove">×</button></div>';
      return;
    }
    if(visN>0){var lg=L[visN-1]||{mi:0,hours:0};html+='<div class="leg"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12l7 7 7-7"/></svg> ~'+Math.round(lg.mi)+' mi · ~'+fmtH(lg.hours)+' drive'+(isRealRoute()?'':' (est.)')+'</div>';}
    var nights=s.nights!=null?s.nights:defNights(s);
    var dayLabel=nights>=1?('Day '+day+(nights>1?'–'+(day+nights-1):'')):('Day '+day+' · stop');
    day+=Math.max(nights,1);
    visN++;
    var condHtml = s.pid ? '<div class="cond" id="cond-'+i+'" data-pid="'+s.pid+'" style="margin-top:9px;padding-top:9px;border-top:1px dashed #e7ddca"><span style="font-size:.74rem;color:#8c8473;font-weight:600">⛅ Checking live conditions…</span></div>' : '';
    html+='<div class="stop" draggable="true" data-i="'+i+'"><span class="grip">⠿</span><span class="num">'+visN+'</span><div class="si"><div class="day">'+dayLabel+'</div><b>'+stopName(s)+'</b><div class="sub">'+stopSub(s)+'</div>'+
      '<div class="srow"><label>🌙 <input class="mini nightsin" data-i="'+i+'" type="number" min="0" max="14" value="'+nights+'"> nights</label>'+
      '<input class="lodge lodgein" data-i="'+i+'" placeholder="🏨 Where you\'re staying" value="'+(s.lodge||'').replace(/"/g,'&quot;')+'"></div>'+
      condHtml+
      '</div><button class="eye" data-i="'+i+'" title="Hide from map">👁</button><button class="rm" data-i="'+i+'" title="Remove">×</button></div>';
  });
  el.innerHTML=html;
  // date-aware conditions: a near trip shows the forecast for THAT day; a far-future
  // trip shows seasonal guidance (no misleading "today" verdict); no date = live now.
  (function renderConds(){
    var startD = trip.startDate ? new Date(trip.startDate+'T00:00') : null;
    var today = new Date(); today.setHours(0,0,0,0);
    var acc=0;
    function seasonOf(m){ return (m<=1||m===11)?'winter':(m<=4)?'spring':(m<=7)?'summer':'fall'; }
    function sameDay(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
    function linkFor(pid){ return '<a href="/park-status?park='+pid+'" onclick="event.stopPropagation()" style="margin-left:auto;font-size:.76rem;font-weight:800;color:#1d4a37;text-decoration:none;white-space:nowrap">Live status →</a>'; }
    function wrap(inner){ return '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'+inner+'</div>'; }
    function pill(R){ return '<span style="display:inline-flex;align-items:center;gap:7px;background:'+R.ring+';color:'+R.c+';font-size:.76rem;font-weight:800;padding:5px 11px;border-radius:999px"><span style="width:8px;height:8px;border-radius:50%;background:'+R.c+'"></span>'+R.word+'</span>'; }
    trip.stops.forEach(function(s,i){
      if(s.hidden) return;
      var nights=s.nights!=null?s.nights:defNights(s);
      var arrival = startD ? new Date(startD.getTime()+acc*86400000) : null;
      acc += Math.max(nights,1);
      if(!s.pid||!window.PBVerdict) return;
      var p=byId[s.pid]; if(!p||typeof p.lat!=='number') return;
      var box=document.getElementById('cond-'+i); if(!box||box.getAttribute('data-pid')!==String(s.pid)) return;
      var daysOut = arrival ? Math.round((arrival-today)/86400000) : null;
      // beyond the forecast window — honest seasonal guidance, no fake verdict
      if(daysOut!==null && daysOut>7){
        var mo=arrival.toLocaleDateString(undefined,{month:'long'});
        box.innerHTML=wrap('<span style="display:inline-flex;align-items:center;gap:7px;background:rgba(176,125,58,.13);color:#9a6f2e;font-size:.76rem;font-weight:800;padding:5px 11px;border-radius:999px">📅 '+mo+' · typical '+seasonOf(arrival.getMonth())+'</span><span style="font-size:.74rem;color:#8c8473;font-weight:600">Go / no-go unlocks ~7 days before you go</span>'+linkFor(s.pid));
        return;
      }
      PBVerdict.fetchPeriods(p.lat,p.lng,function(periods){
        var box=document.getElementById('cond-'+i); if(!box||box.getAttribute('data-pid')!==String(s.pid)) return;
        if(!periods){ box.innerHTML=wrap('<span style="font-size:.74rem;color:#8c8473;font-weight:600">Live conditions unavailable</span>'+linkFor(s.pid)); return; }
        var per0=null, label;
        if(arrival && daysOut>=0){ per0=periods.find(function(x){return x.isDaytime && sameDay(new Date(x.startTime),arrival);}); }
        if(per0){ label=(daysOut===0?'Today':arrival.toLocaleDateString(undefined,{weekday:'short'}))+' forecast'; }
        else { per0=periods[0]; label=arrival?'Forecast':'Live now'; }
        var R=PBVerdict.evaluate([per0],0,0);
        if(!R){ box.innerHTML=wrap('<span style="font-size:.74rem;color:#8c8473;font-weight:600">Live conditions unavailable</span>'+linkFor(s.pid)); return; }
        box.innerHTML=wrap(pill(R)+'<span style="font-size:.76rem;color:#6a7160;font-weight:600">'+label+' · '+R.temp+'\u00b0'+(R.sky?' · '+R.sky:'')+'</span>'+linkFor(s.pid));
      });
    });
  })();
  el.querySelectorAll('.rm').forEach(function(b){b.onclick=function(e){e.stopPropagation();trip.stops.splice(+b.getAttribute('data-i'),1);render(true);};});
  el.querySelectorAll('.eye').forEach(function(b){b.onclick=function(e){e.stopPropagation();var s=trip.stops[+b.getAttribute('data-i')];s.hidden=!s.hidden;render(true);};});
  el.querySelectorAll('.nightsin').forEach(function(inp){inp.onclick=function(e){e.stopPropagation();};inp.onchange=function(){trip.stops[+inp.getAttribute('data-i')].nights=Math.max(0,parseInt(inp.value)||0);renderStops();renderStats();renderCost();save();};});
  el.querySelectorAll('.lodgein').forEach(function(inp){inp.onclick=function(e){e.stopPropagation();};inp.oninput=function(){trip.stops[+inp.getAttribute('data-i')].lodge=inp.value;save();};});
  el.querySelectorAll('.stop:not(.hidden)').forEach(function(row){
    row.addEventListener('click',function(){var ll=stopLL(trip.stops[+row.getAttribute('data-i')]);if(!ll)return;if(window.matchMedia('(max-width:980px)').matches)setMobileView('map');if(mapOK&&map){map.panTo({lat:ll[0],lng:ll[1]});map.setZoom(Math.max(map.getZoom(),7));}});
    row.addEventListener('dragstart',function(e){dragI=+row.getAttribute('data-i');row.classList.add('drag');e.dataTransfer.effectAllowed='move';});
    row.addEventListener('dragend',function(){row.classList.remove('drag');el.querySelectorAll('.stop').forEach(function(r){r.classList.remove('over');});});
    row.addEventListener('dragover',function(e){e.preventDefault();row.classList.add('over');});
    row.addEventListener('dragleave',function(){row.classList.remove('over');});
    row.addEventListener('drop',function(e){e.preventDefault();var to=+row.getAttribute('data-i');if(dragI===null||dragI===to)return;var m=trip.stops.splice(dragI,1)[0];trip.stops.splice(to,0,m);dragI=null;render(true);});
  });
  var dr=document.getElementById('daterange');
  if(trip.startDate){var sd=new Date(trip.startDate+'T00:00');var ed=new Date(sd);ed.setDate(ed.getDate()+Math.max(tripDays()-1,0));var o={month:'short',day:'numeric'};dr.textContent=sd.toLocaleDateString(undefined,o)+' – '+ed.toLocaleDateString(undefined,o);document.getElementById('enddate').value=ed.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
  else{dr.textContent='';document.getElementById('enddate').value='';}
}
var dragI=null;
function renderStats(){
  document.getElementById('st-stops').textContent=visibleStops().length;
  document.getElementById('st-days').textContent=tripDays();
  document.getElementById('st-miles').textContent=Math.round(totalMiles()).toLocaleString();
  var ct=costTotal();document.getElementById('st-cost').textContent=ct>=1000?'$'+(ct/1000).toFixed(1)+'k':'$'+Math.round(ct);
}
function refreshParkSelect(){
  var sel=document.getElementById('parksel');var used={};trip.stops.forEach(function(s){if(s.pid)used[s.pid]=1;});
  sel.innerHTML='<option value="">Choose a park…</option>'+PARKS.slice().sort(function(a,b){return a.name.localeCompare(b.name);}).filter(function(p){return !used[p.id];}).map(function(p){return '<option value="'+p.id+'">'+p.name+' — '+p.state+'</option>';}).join('');
}

/* cost */
function costParts(){
  var mi=totalMiles(),days=tripDays(),nights=totalNights(),car=CARS[trip.car]||CARS.midsize;
  var trav=Math.max(1,trip.travelers||1);
  var fuel=car.mpg?mi/car.mpg*(trip.gas||3.5):0;
  var rentalEst=car.rate*days;
  var lodgingEst=nights*(trip.hotel||0);
  var parks=visibleStops().filter(function(s){return s.pid;}).length;
  var passNote=parks>2;
  var ticketsEst=passNote?80:parks*35;
  var foodc=days*trav*(trip.food||0);
  // manual overrides — when a user enters their real price it wins over the estimate
  var ovr=trip.ovr||{};
  var rental=(ovr.rental!=null)?ovr.rental:rentalEst;
  var lodging=(ovr.lodging!=null)?ovr.lodging:lodgingEst;
  var tickets=(ovr.tickets!=null)?ovr.tickets:ticketsEst;
  return {fuel:fuel,rental:rental,rentalEst:rentalEst,lodging:lodging,lodgingEst:lodgingEst,parkFees:tickets,ticketsEst:ticketsEst,food:foodc,parks:parks,passNote:passNote,nights:nights,days:days,car:car,trav:trav,mi:mi,ovr:ovr};
}
function costTotal(){var c=costParts();return c.fuel+c.rental+c.lodging+c.parkFees+c.food;}
function money(n){return '$'+Math.round(n).toLocaleString();}
function setOvr(k,v){trip.ovr=trip.ovr||{};if(v==null||v===''||isNaN(v)){delete trip.ovr[k];}else{trip.ovr[k]=Math.max(0,v);}renderCost();renderStats();save();}
function renderCost(){
  var c=costParts(),el=document.getElementById('costlines');
  // [icon, sublabel, value, overrideKey|null, estimate]
  var rows=[
    ['⛽ Fuel', c.car.mpg?Math.round(c.mi)+' mi · '+c.car.mpg+' mpg':'—', c.fuel, null, c.fuel],
    ['🚗 '+c.car.label, c.car.rate?('est. $'+c.car.rate+'/day × '+c.days+' days'):'using your own car', c.rental, 'rental', c.rentalEst],
    ['🏨 Lodging', 'est. '+c.nights+' nights × $'+(trip.hotel||0), c.lodging, 'lodging', c.lodgingEst],
    ['🎟️ Park entry / tickets', c.passNote?'est. America the Beautiful annual pass':('est. '+c.parks+' park'+(c.parks!==1?'s':'')+' × $35'), c.parkFees, 'tickets', c.ticketsEst],
    ['🍽️ Food', c.days+' days × '+c.trav+' ppl × $'+(trip.food||0), c.food, null, c.food]
  ];
  el.innerHTML=rows.map(function(r){
    var key=r[3], overridden=key&&c.ovr[key]!=null;
    var amt;
    if(key){
      amt='<span class="amtwrap'+(overridden?' set':'')+'">$<input class="ovrin" data-k="'+key+'" inputmode="decimal" value="'+Math.round(r[2])+'" title="Type your own price">'+
        (overridden?'<button class="ovrreset" data-k="'+key+'" title="Back to estimate">↺</button>':'')+'</span>';
    } else {
      amt='<span class="amt">'+money(r[2])+'</span>';
    }
    var tag=overridden?' <em class="yourprice">your price</em>':'';
    return '<div class="line"><div class="lt">'+r[0]+'<small>'+r[1]+tag+'</small></div>'+amt+'</div>';
  }).join('');
  document.getElementById('costtotal').textContent=money(costTotal());
  document.getElementById('costper').textContent=c.trav>1?(money(costTotal()/c.trav)+' per person'):'';
  el.querySelectorAll('.ovrin').forEach(function(inp){
    inp.onchange=function(){setOvr(inp.getAttribute('data-k'),parseFloat(inp.value));};
    inp.onkeydown=function(e){if(e.key==='Enter'){inp.blur();}};
  });
  el.querySelectorAll('.ovrreset').forEach(function(b){
    b.onclick=function(){setOvr(b.getAttribute('data-k'),null);};
  });
}

/* map */
var map=null,gmarkers=[],routePoly=[],routeVisible=true,dirSvc=null,mapOK=false;
function gll(s){var l=stopLL(s);return l?{lat:l[0],lng:l[1]}:null;}
function initMap(){
  if(typeof google==='undefined'||!google.maps)return;
  map=new google.maps.Map(document.getElementById('lmap'),{center:{lat:39.5,lng:-98.35},zoom:4,mapTypeId:'roadmap',mapTypeControl:true,mapTypeControlOptions:{mapTypeIds:['roadmap','terrain','satellite','hybrid']},streetViewControl:true,fullscreenControl:false,zoomControl:true,gestureHandling:'greedy',styles:window.PARKBUDDY_MAP_STYLE||[]});
  dirSvc=new google.maps.DirectionsService();
  mapOK=true;
}
function drawMap(fit){
  if(!mapOK||!map)return;
  gmarkers.forEach(function(m){m.setMap(null);});gmarkers=[];
  routePoly.forEach(function(p){p.setMap(null);});routePoly=[];
  var vs=visibleStops();
  var lls=vs.map(gll).filter(Boolean);
  var line=(routeInfo&&routeInfo.line&&routeInfo.line.length>1)?routeInfo.line:lls;
  if(line.length>1){
    if(isRealRoute()){
      routePoly.push(new google.maps.Polyline({path:line,strokeColor:'#ffffff',strokeOpacity:.9,strokeWeight:8,map:routeVisible?map:null,zIndex:1}));
      routePoly.push(new google.maps.Polyline({path:line,strokeColor:'#1a73e8',strokeOpacity:.95,strokeWeight:5,map:routeVisible?map:null,zIndex:2}));
    } else {
      routePoly.push(new google.maps.Polyline({path:line,strokeColor:'#1a73e8',strokeOpacity:0,strokeWeight:4,map:routeVisible?map:null,icons:[{icon:{path:'M 0,-1 0,1',strokeColor:'#1a73e8',strokeOpacity:.85,scale:3},offset:'0',repeat:'13px'}]}));
    }
  }
  vs.forEach(function(s,i){var p=gll(s);if(!p)return;
    var mk=new google.maps.Marker({position:p,map:routeVisible?map:null,title:(i+1)+'. '+stopName(s),
      label:{text:String(i+1),color:'#ffffff',fontSize:'12px',fontWeight:'700'},
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:13,fillColor:'#1d4a37',fillOpacity:1,strokeColor:'#c79a4b',strokeWeight:2}});
    gmarkers.push(mk);});
  if(fit){
    var fb=line.length>1?line:lls;
    if(fb.length>1){var b=new google.maps.LatLngBounds();fb.forEach(function(pt){b.extend(pt);});map.fitBounds(b,60);}
    else if(lls.length===1){map.setCenter(lls[0]);map.setZoom(8);}
    else {map.setCenter({lat:39.5,lng:-98.35});map.setZoom(4);}
  }
}

/* place search (Photon / OpenStreetMap, keyless) */
var searchT=null;
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function placesNew(){return (typeof google!=='undefined'&&google.maps&&google.maps.places&&google.maps.places.AutocompleteSuggestion)?google.maps.places:null;}
var acToken=null;
function doSearch(q){
  var box=document.getElementById('results');
  if(!q||q.length<3){box.classList.remove('show');box.innerHTML='';return;}
  if(placesNew()){googleSearch(q,box);return;}
  if(typeof google!=='undefined'&&google.maps&&google.maps.Geocoder){geocoderSearch(q,box);return;}
  photonSearch(q,box);
}
function addFoundStop(name,lat,lng,kind,address){
  trip.stops.push({name:name,lat:lat,lng:lng,custom:true,kind:kind||'',address:address||'',nights:0,lodge:''});
  document.getElementById('placeq').value='';
  var box=document.getElementById('results');box.classList.remove('show');box.innerHTML='';acToken=null;
  render(true);toast('Added '+name);
}
// Classic Google Geocoder — resolves a full typed address (street + apt/unit + ZIP)
// to coordinates. Needs only the Geocoding API enabled on your key.
function geocoderSearch(q,box){
  new google.maps.Geocoder().geocode({address:q,region:'us'},function(res,status){
    if(status!=='OK'||!res||!res.length){
      box.innerHTML='<div class="r"><span>No address match — try adding the city, state or ZIP.</span></div>';
      box.classList.add('show');return;
    }
    box.innerHTML='';
    res.slice(0,5).forEach(function(r){
      var loc=r.geometry&&r.geometry.location;if(!loc)return;
      var full=r.formatted_address||q, parts=full.split(',');
      var main=parts[0], sec=parts.slice(1).join(',').trim();
      var row=document.createElement('div');row.className='r';
      row.innerHTML='<b>'+esc(main)+'</b>'+(sec?'<span>'+esc(sec)+'</span>':'');
      row.onmousedown=function(e){e.preventDefault();};
      row.onclick=function(){addFoundStop(main,loc.lat(),loc.lng(),'address',full);};
      box.appendChild(row);
    });
    box.classList.add('show');
  });
}
function googleSearch(q,box){
  var P=placesNew();
  try{if(!acToken)acToken=new P.AutocompleteSessionToken();}catch(e){}
  P.AutocompleteSuggestion.fetchAutocompleteSuggestions({input:q,sessionToken:acToken}).then(function(res){
    var sg=(res&&res.suggestions)||[];
    if(!sg.length){box.innerHTML='<div class="r"><span>No matches — try a different address.</span></div>';box.classList.add('show');return;}
    box.innerHTML='';
    sg.forEach(function(s){
      var pred=s.placePrediction;if(!pred)return;
      var main=(pred.mainText&&pred.mainText.text)||(pred.text&&pred.text.text)||'Place';
      var sec=(pred.secondaryText&&pred.secondaryText.text)||'';
      var r=document.createElement('div');r.className='r';
      r.innerHTML='<b>'+esc(main)+'</b>'+(sec?'<span>'+esc(sec)+'</span>':'');
      r.onmousedown=function(e){e.preventDefault();};
      r.onclick=function(){
        var place=pred.toPlace();
        place.fetchFields({fields:['displayName','location','formattedAddress','types']}).then(function(){
          var loc=place.location;if(!loc)return;
          var kind=((place.types&&place.types[0])||'').replace(/_/g,' ');
          trip.stops.push({name:place.displayName||main,lat:loc.lat(),lng:loc.lng(),custom:true,kind:kind,address:place.formattedAddress||'',nights:0,lodge:''});
          document.getElementById('placeq').value='';box.classList.remove('show');box.innerHTML='';acToken=null;render(true);toast('Added '+(place.displayName||main));
        }).catch(function(){toast('Could not add that place');});
      };
      box.appendChild(r);
    });
    box.classList.add('show');
  }).catch(function(){photonSearch(q,box);});
}
function photonSearch(q,box){
  fetch('https://photon.komoot.io/api/?q='+encodeURIComponent(q)+'&limit=6&lang=en&lat=39.5&lon=-98.35')
   .then(function(r){if(!r.ok)throw 0;return r.json();})
   .then(function(d){
     var fs=(d.features||[]);
     if(!fs.length){box.innerHTML='<div class="r"><span>No matches — try a different name.</span></div>';box.classList.add('show');return;}
     box.innerHTML=fs.map(function(f){var p=f.properties||{},g=f.geometry.coordinates;var nm=p.name||((p.housenumber?p.housenumber+' ':'')+(p.street||''))||p.street||'Place';var ctx=[p.city,p.state,p.postcode,p.country].filter(Boolean).join(', ');var kind=(p.osm_value||p.type||'').replace(/_/g,' ');
       return '<div class="r" data-lat="'+g[1]+'" data-lng="'+g[0]+'" data-nm="'+nm.replace(/"/g,'&quot;')+'" data-k="'+kind+'">'+(kind?'<span class="k">'+kind+'</span>':'')+'<b>'+nm+'</b><span>'+ctx+'</span></div>';}).join('');
     box.classList.add('show');
     box.querySelectorAll('.r').forEach(function(r){var lat=r.getAttribute('data-lat');if(!lat)return;r.onclick=function(){trip.stops.push({name:r.getAttribute('data-nm'),lat:+lat,lng:+r.getAttribute('data-lng'),custom:true,kind:r.getAttribute('data-k')||'',nights:0,lodge:''});document.getElementById('placeq').value='';box.classList.remove('show');render(true);};});
   })
   .catch(function(){box.innerHTML='<div class="r"><span>Search needs to be online — it works on the published site.</span></div>';box.classList.add('show');});
}

/* nav + share */
function shareData(){
  var compact={n:trip.name,d:trip.startDate,t:trip.travelers,c:trip.car,s:trip.stops.map(function(s){return s.pid?{p:s.pid,ni:s.nights,lo:s.lodge}:{c:[s.name,+s.lat.toFixed(4),+s.lng.toFixed(4)],k:s.kind,ni:s.nights,lo:s.lodge};})};
  var url=location.origin+location.pathname+'?trip='+encodeURIComponent(JSON.stringify(compact));
  var lines=visibleStops().map(function(s,i){var n=(s.nights!=null?s.nights:defNights(s));return (i+1)+'. '+stopName(s)+(n>=1?(' ('+n+'n)'):'');});
  var txt=(trip.name||'My national-parks trip')+' 🏞️\n'+tripDays()+' days · '+Math.round(totalMiles()).toLocaleString()+' mi · ~'+money(costTotal())+'\n\n'+lines.join('\n')+'\n\nOpen, edit & navigate: '+url;
  return {url:url,text:txt};
}
function syncLinks(){
  var lls=visibleStops().map(stopLL).filter(Boolean),has=visibleStops().length>0,has2=lls.length>1;
  var g=document.getElementById('gmaps'),a=document.getElementById('amaps');
  if(has2){var o=lls[0].join(','),d=lls[lls.length-1].join(','),mids=lls.slice(1,-1).map(function(x){return x.join(',');}).join('|');
    g.href='https://www.google.com/maps/dir/?api=1&travelmode=driving&origin='+o+'&destination='+d+(mids?'&waypoints='+encodeURIComponent(mids):'');
    a.href='http://maps.apple.com/?saddr='+o+'&daddr='+lls.slice(1).map(function(x){return x.join(',');}).join('+to:');
    g.style.pointerEvents=a.style.pointerEvents='';g.style.opacity=a.style.opacity='';
  }else{g.removeAttribute('href');a.removeAttribute('href');g.style.pointerEvents=a.style.pointerEvents='none';g.style.opacity=a.style.opacity='.45';}
  var sd=shareData();
  var wa=document.getElementById('sh-wa'),sms=document.getElementById('sh-sms');
  wa.href='https://wa.me/?text='+encodeURIComponent(sd.text);sms.href='sms:?&body='+encodeURIComponent(sd.text);
  [wa,sms].forEach(function(b){b.style.pointerEvents=has?'':'none';b.style.opacity=has?'':'.45';});
}

/* persistence */
function save(){try{localStorage.setItem('pp_trip2',JSON.stringify(shareCompact()));}catch(e){}}
function shareCompact(){return {n:trip.name,d:trip.startDate,t:trip.travelers,c:trip.car,gas:trip.gas,ho:trip.hotel,fo:trip.food,ov:trip.ovr,s:trip.stops};}
function loadCompact(c){
  trip.name=c.n||'';trip.startDate=c.d||'';trip.travelers=c.t||2;trip.car=c.c||'midsize';
  if(c.gas!=null)trip.gas=c.gas;if(c.ho!=null)trip.hotel=c.ho;if(c.fo!=null)trip.food=c.fo;
  trip.ovr=(c.ov&&typeof c.ov==='object')?c.ov:{};
  trip.stops=(c.s||[]).map(function(x){
    if(x.pid!=null||x.p!=null){return {pid:(x.pid!=null?x.pid:x.p),nights:(x.ni!=null?x.ni:x.nights),lodge:x.lo||x.lodge||'',hidden:!!x.hidden};}
    if(x.c){return {name:x.c[0],lat:x.c[1],lng:x.c[2],custom:true,kind:x.k||'',nights:(x.ni!=null?x.ni:0),lodge:x.lo||'',hidden:!!x.hidden};}
    return x;
  }).filter(function(s){return s.pid?byId[s.pid]:(typeof s.lat==='number');});
}
function fillBasics(){
  document.getElementById('tripname').value=trip.name;
  document.getElementById('startdate').value=trip.startDate;
  document.getElementById('travelers').value=trip.travelers;
  document.getElementById('car').value=trip.car;
  document.getElementById('gas').value=trip.gas;document.getElementById('hotel').value=trip.hotel;document.getElementById('food').value=trip.food;
}

function boot(){
  document.getElementById('car').innerHTML=Object.keys(CARS).map(function(k){return '<option value="'+k+'">'+CARS[k].label+'</option>';}).join('');
  renderPrebuilt(); initMap();
  var q=new URLSearchParams(location.search).get('trip');
  if(q){try{loadCompact(JSON.parse(q));}catch(e){}}
  else{try{var ls=localStorage.getItem('pp_trip2');if(ls)loadCompact(JSON.parse(ls));}catch(e){}}
  fillBasics(); render(true);
  if(window.matchMedia('(max-width:980px)').matches)setMobileView('map',true);

  document.getElementById('tripname').addEventListener('input',function(e){trip.name=e.target.value;syncLinks();save();});
  document.getElementById('startdate').addEventListener('change',function(e){trip.startDate=e.target.value;renderStops();save();});
  document.getElementById('travelers').addEventListener('change',function(e){trip.travelers=Math.max(1,parseInt(e.target.value)||1);renderCost();renderStats();save();});
  document.getElementById('car').addEventListener('change',function(e){trip.car=e.target.value;renderCost();renderStats();save();});
  document.getElementById('gas').addEventListener('input',function(e){trip.gas=parseFloat(e.target.value)||0;renderCost();renderStats();save();});
  document.getElementById('hotel').addEventListener('input',function(e){trip.hotel=parseFloat(e.target.value)||0;renderCost();renderStats();save();});
  document.getElementById('food').addEventListener('input',function(e){trip.food=parseFloat(e.target.value)||0;renderCost();renderStats();save();});
  document.getElementById('showmap').addEventListener('change',function(e){routeVisible=e.target.checked;drawMap(false);});
  var ppb=document.getElementById('passportbtn');
  if(ppb)ppb.onclick=function(){
    save();
    if(window.__ppPassport){
      var parkIds=trip.stops.filter(function(s){return s.pid;}).map(function(s){return s.pid;});
      window.__ppPassport.saveTrip({
        name:trip.name||'My national-parks trip',
        startDate:trip.startDate||'',
        days:tripDays(),
        miles:totalMiles(),
        cost:costTotal(),
        parkIds:parkIds
      });
    }
    if(window.__ppItinerary){ window.__ppItinerary.download(); }
    else { toast('Passport loads in a moment…'); }
  };
  document.getElementById('addpark').onclick=function(){var v=document.getElementById('parksel').value;if(!v)return;trip.stops.push({pid:+v,nights:NIGHTS[+v]||1,lodge:''});document.getElementById('parksel').value='';render(true);};
  document.getElementById('addcustom').onclick=function(){
    var nm=(document.getElementById('cname').value||'').trim(),co=(document.getElementById('ccoord').value||'').trim();
    var m=co.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);if(!m){toast('Enter coordinates as: lat, lng');return;}
    var lat=+m[1],lng=+m[2];if(lat<-90||lat>90||lng<-180||lng>180){toast('Those coordinates look off');return;}
    trip.stops.push({name:nm||('Stop '+(trip.stops.length+1)),lat:lat,lng:lng,custom:true,kind:'',nights:0,lodge:''});
    document.getElementById('cname').value='';document.getElementById('ccoord').value='';render(true);
  };
  var pq=document.getElementById('placeq');
  pq.addEventListener('input',function(e){clearTimeout(searchT);var v=e.target.value;searchT=setTimeout(function(){doSearch(v);},320);});
  pq.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();clearTimeout(searchT);doSearch(e.target.value);}});
  pq.addEventListener('blur',function(){setTimeout(function(){document.getElementById('results').classList.remove('show');},180);});
  document.getElementById('sh-copy').onclick=function(){var u=shareData().url;if(navigator.clipboard){navigator.clipboard.writeText(u).then(function(){toast('Trip link copied!');},function(){prompt('Copy this link:',u);});}else prompt('Copy this link:',u);};
  document.getElementById('sh-native').onclick=function(){var sd=shareData();if(navigator.share)navigator.share({title:trip.name||'ParkPulse trip',text:sd.text,url:sd.url}).catch(function(){});else{if(navigator.clipboard)navigator.clipboard.writeText(sd.url);toast('Link copied — paste it anywhere');}};
  document.getElementById('clearbtn').onclick=function(){if(trip.stops.length&&!confirm('Clear this trip?'))return;trip.stops=[];trip.name='';document.getElementById('tripname').value='';render(true);};
}
function loadGoogle(cb){
  if(typeof google!=='undefined'&&google.maps){cb();return;}
  var key=window.GMAPS_KEY||'';
  var lm=document.getElementById('lmap');
  if(!key){lm.innerHTML='<div style="padding:30px;text-align:center;color:#8c8473">Add your Google Maps API key in <b>config.js</b> to enable the map.</div>';cb();return;}
  window.__gmReady=function(){cb();};
  window.gm_authFailure=function(){lm.innerHTML='<div style="padding:30px;text-align:center;color:#8c8473">Google Maps could not authorize this key for this site. Check this key&rsquo;s allowed websites &amp; enabled APIs in Google Cloud.</div>';};
  var s=document.createElement('script');s.async=true;s.defer=true;
  s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&libraries=geometry,places&callback=__gmReady';
  s.onerror=function(){lm.innerHTML='<div style="padding:30px;text-align:center;color:#8c8473">Google Maps failed to load (check your connection or key).</div>';cb();};
  document.head.appendChild(s);
}
window.addEventListener('load',function(){ loadGoogle(function(){ boot(); }); });
function setMobileView(t,skipScroll){
  var mj=document.getElementById('mjump');
  if(mj)mj.querySelectorAll('button').forEach(function(x){x.classList.toggle('on', x.getAttribute('data-t')===t);});
  if(skipScroll)return;
  var target=(t==='map')?document.querySelector('.mapcard'):document.querySelector('.col');
  if(target){var y=target.getBoundingClientRect().top+window.pageYOffset-66;window.scrollTo({top:Math.max(0,y),behavior:'smooth'});}
}
(function(){var mj=document.getElementById('mjump');if(!mj)return;mj.querySelectorAll('button').forEach(function(b){b.onclick=function(){setMobileView(b.getAttribute('data-t'));};});})();

/* ---- Agent control surface: lets "Ask Park Buddy" build the trip live on this page ---- */
window.PBTrip = (function(){
  function norm(s){return String(s||'').toLowerCase().replace(/national park.*$|national preserve.*$/,'').replace(/&/g,'and').replace(/[^a-z]/g,'');}
  function find(name){
    var n=norm(name); if(!n) return null;
    var ex=PARKS.filter(function(p){return norm(p.name)===n;}); if(ex.length) return ex[0];
    var part=PARKS.filter(function(p){var pn=norm(p.name);return pn.indexOf(n)>-1||n.indexOf(pn)>-1;});
    return part[0]||null;
  }
  function addPark(name,nights){
    var p=find(name); if(!p) return {ok:false,error:'No matching national park: '+name};
    if(trip.stops.some(function(s){return s.pid===p.id;})) return {ok:true,name:p.name,note:'already in trip'};
    trip.stops.push({pid:p.id,nights:nights||NIGHTS[p.id]||2,lodge:''});
    render(true); return {ok:true,name:p.name};
  }
  function setBasics(o){
    o=o||{};
    if(o.name!=null) trip.name=o.name;
    if(o.startDate) trip.startDate=o.startDate;
    if(o.travelers) trip.travelers=Math.max(1,parseInt(o.travelers,10)||1);
    fillBasics(); render(false); return {ok:true};
  }
  function buildTrip(names,opts){
    opts=opts||{};
    trip.stops=[]; var added=[],missed=[];
    (names||[]).forEach(function(nm){var p=find(nm); if(p){ if(!trip.stops.some(function(s){return s.pid===p.id;})){ trip.stops.push({pid:p.id,nights:NIGHTS[p.id]||2,lodge:''}); added.push(p.name);} } else missed.push(nm);});
    if(opts.name!=null) trip.name=opts.name;
    if(opts.startDate) trip.startDate=opts.startDate;
    if(opts.travelers) trip.travelers=Math.max(1,parseInt(opts.travelers,10)||1);
    fillBasics(); render(true); return {ok:true,added:added,missed:missed};
  }
  function clearTrip(){ trip.stops=[]; render(true); return {ok:true}; }
  function generateChecklist(){
    try{ var ck=document.querySelector('.pbck'); if(!ck) return {ok:false,error:'checklist not ready'};
      var g=ck.querySelector('[data-gen="trip"]'); if(g){ g.click(); setTimeout(function(){ var a=ck.querySelector('.pbck-addall'); if(a)a.click(); },450); }
      var y=ck.getBoundingClientRect().top+(window.pageYOffset||0)-70; window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
      return {ok:true};
    }catch(e){ return {ok:false}; }
  }
  function startMode(){ try{ var b=document.querySelector('.pbck-start'); if(b){ b.click(); return {ok:true}; } return {ok:false}; }catch(e){ return {ok:false}; } }
  function downloadPassport(){ var b=document.getElementById('passportbtn'); if(b){ b.click(); return {ok:true}; } return {ok:false}; }
  function state(){
    var names=trip.stops.filter(function(s){return !s.hidden;}).map(function(s){return s.pid&&byId[s.pid]?byId[s.pid].name:(s.name||'stop');});
    return {name:trip.name||'',startDate:trip.startDate||'',travelers:trip.travelers,stops:names,
      days:(typeof tripDays==='function'?tripDays():null),
      miles:(typeof totalMiles==='function'?Math.round(totalMiles()):null)};
  }
  return {addPark:addPark,setBasics:setBasics,buildTrip:buildTrip,clearTrip:clearTrip,generateChecklist:generateChecklist,startMode:startMode,downloadPassport:downloadPassport,find:find,state:state};
})();
