/* ParkBuddy — Explore map: colour every park marker by today's go/no-go verdict.
   Reuses the shared PBVerdict engine (same call the Status page & planner use),
   loads conditions for every park in a throttled background sweep, and recolours
   each marker the moment its verdict lands. Selection / in-trip state is shown by
   the ring (stroke) so the FILL colour can always communicate today's conditions. */
(function(){
  window._verdictById = window._verdictById || {};
  function PV(){ return window.PBVerdict; }

  // --- override marker styling: fill = verdict colour, ring = selection/trip ---
  styleMarker = function(p){
    var m = (typeof gmarkersById!=='undefined' ? gmarkersById : {})[p.id];
    if(!m || typeof google==='undefined' || !google.maps) return;
    var on = !!(typeof selected!=='undefined' && selected && selected.id===p.id);
    var inTrip = !!(typeof myTrip!=='undefined' && myTrip && myTrip.some(function(x){return x.id===p.id;}));
    var V = window._verdictById[p.id];
    var fill = V ? V.c : '#b3ab97';                       // grey until its verdict lands
    var stroke = on ? '#15241c' : inTrip ? '#c79a4b' : '#fffdf7';
    var sw = on ? 3.5 : inTrip ? 3 : 2;
    var scale = on ? 11 : inTrip ? 8 : 6.8;
    m.setIcon({path:google.maps.SymbolPath.CIRCLE,scale:scale,fillColor:fill,fillOpacity:1,strokeColor:stroke,strokeWeight:sw});
    m.setZIndex(on?999:inTrip?500:1);
  };

  // --- throttled background sweep of all park verdicts ---
  var started=false;
  function loadAll(){
    if(started || !PV() || typeof PARKS==='undefined') return; started=true;
    if(typeof paintMarkers==='function') paintMarkers();  // flip everything to grey first
    var queue = PARKS.filter(function(p){return p.region!=='territory' && typeof p.lat==='number';});
    var i=0, active=0, N=4;
    function pump(){
      while(active<N && i<queue.length){
        var p=queue[i++]; active++;
        (function(p){
          PV().fetchVerdict(p.lat, p.lng, function(R){
            active--;
            if(R){
              window._verdictById[p.id]=R;
              if(typeof styleMarker==='function') styleMarker(p);
              if(typeof selected!=='undefined' && selected && selected.id===p.id && typeof renderLive==='function') renderLive();
            }
            pump();
          });
        })(p);
      }
    }
    pump();
  }

  // --- verdict pill at the top of the live info panel ---
  var _origRenderLive = (typeof renderLive==='function') ? renderLive : null;
  renderLive = function(){
    if(_origRenderLive) _origRenderLive.apply(this, arguments);
    try{
      var el=document.getElementById('ip-live');
      if(!el || typeof selected==='undefined' || !selected) return;
      var V=window._verdictById[selected.id]; if(!V) return;
      if(el.querySelector('.vpill')) return;
      var pill=document.createElement('div');
      pill.className='vpill';
      pill.style.cssText='display:flex;align-items:center;gap:11px;background:'+V.ring+';border:1px solid '+hexA(V.c,.28)+';border-radius:15px;padding:12px 14px;margin-bottom:11px;animation:pb-vpop .45s cubic-bezier(.2,.8,.3,1) both';
      pill.innerHTML='<span style="position:relative;width:34px;height:34px;flex:none;border-radius:50%;background:'+V.orb+';display:flex;align-items:center;justify-content:center;color:'+V.c+';font-weight:800;font-size:1.15rem;box-shadow:inset 0 1px 3px rgba(255,255,255,.6)">'+V.ic+'</span>'
        +'<span style="min-width:0"><b style="display:block;font-family:Spectral,Georgia,serif;font-size:1.08rem;font-weight:700;color:'+V.c+';line-height:1.1">'+V.word+'</b><span style="font-size:.76rem;color:#6a7160;font-weight:600">Today \u00b7 '+V.temp+'\u00b0 \u00b7 '+V.sky+'</span></span>';
      el.insertBefore(pill, el.firstChild);
    }catch(e){}
  };
  function hexA(hex,a){
    var h=String(hex||'').replace('#',''); if(h.length!==6) return 'rgba(0,0,0,'+a+')';
    return 'rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+','+a+')';
  }

  // --- start once the map is ready (or after a fallback delay) ---
  var t=setInterval(function(){ if(typeof mapReady!=='undefined' && mapReady){ clearInterval(t); loadAll(); } }, 300);
  setTimeout(function(){ if(!started) loadAll(); }, 5000);
})();
