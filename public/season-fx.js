/* ParkPulse Season FX — subtle, depth-parallax seasonal particles in the page background.
   Auto-detects the season from today's date (Northern Hemisphere). Sits BEHIND all content
   (z-index:-1), so it only shows in the page background/margins — never over the map or text.
   Override: SeasonFX.set('spring'|'summer'|'fall'|'winter'). Respects prefers-reduced-motion. */
(function(){
if(window.SeasonFX) return;

function detect(){
  var m=new Date().getMonth(); // 0=Jan
  if(m>=2&&m<=4) return 'spring';
  if(m>=5&&m<=7) return 'summer';
  if(m>=8&&m<=10) return 'fall';
  return 'winter';
}

var PAL={
  spring:['#f4c4d4','#f8dbe5','#ffffff','#f0b8cf','#fbe3ec'],
  summer:['#e3a93f','#d6982f','#eab85a','#cf8f28'],
  fall:['#c9762f','#b5622a','#d79a3f','#a8492a','#caa14b','#9c5a25'],
  winter:['#ffffff','#eaf3fb','#dcebf8','#ffffff']
};

var canvas, ctx, W, H, DPR, parts=[], raf=null, season=detect(), reduce=false;
try{ reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

function count(){
  var base=Math.round(window.innerWidth*window.innerHeight/38000);
  base=Math.max(18,Math.min(40,base));            // visible but still calm
  if(reduce) base=Math.round(base*0.4);
  return base;
}
function rnd(a,b){return a+Math.random()*(b-a);}
function pick(a){return a[(Math.random()*a.length)|0];}

function mkPart(initTop){
  var z=Math.random();                             // depth 0(far)..1(near)
  var up = season==='summer';
  var p={
    x:rnd(0,W), z:z,
    size:(season==='winter'?rnd(2.5,4.5):season==='summer'?rnd(2.5,5):rnd(7,13))*(0.55+z*0.8),
    alpha:(season==='summer'?0.6:0.5)*(0.4+z*0.6),
    color:pick(PAL[season]),
    sway:rnd(14,40)*(0.5+z), swPhase:rnd(0,Math.PI*2), swSpeed:rnd(0.4,1.1),
    rot:rnd(0,Math.PI*2), rotSp:rnd(-0.9,0.9),
    vy:(up?-1:1)*rnd(8,26)*(0.45+z), vx:rnd(-10,10)*(0.4+z)
  };
  p.y = initTop ? (up?rnd(0,H):rnd(-H,0)) : (up?H+rnd(0,40):-rnd(0,40));
  return p;
}
function build(){ parts=[]; var n=count(); for(var i=0;i<n;i++) parts.push(mkPart(true)); }

function drawLeaf(p){
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
  ctx.fillStyle=p.color; ctx.globalAlpha=p.alpha;
  ctx.beginPath(); ctx.ellipse(0,0,p.size,p.size*0.6,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=p.alpha*0.6; ctx.strokeStyle='rgba(80,45,20,.6)'; ctx.lineWidth=Math.max(0.6,p.size*0.09);
  ctx.beginPath(); ctx.moveTo(-p.size,0); ctx.lineTo(p.size,0); ctx.stroke();
  ctx.restore();
}
function drawPetal(p){
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
  ctx.fillStyle=p.color; ctx.globalAlpha=p.alpha;
  ctx.beginPath(); ctx.ellipse(0,0,p.size,p.size*0.5,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawDot(p,glow){
  ctx.save(); ctx.globalAlpha=p.alpha;
  if(glow){ var g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*2.6); g.addColorStop(0,p.color); g.addColorStop(1,'rgba(210,150,40,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*2.6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=Math.min(1,p.alpha*1.25); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*0.6,0,Math.PI*2); ctx.fill(); }
  else { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
  ctx.restore();
}
function sunRays(){
  // soft warm beams from top corners
  ctx.save();
  var g1=ctx.createLinearGradient(W,0,W*0.45,H*0.7);
  g1.addColorStop(0,'rgba(255,224,150,0.16)'); g1.addColorStop(1,'rgba(255,224,150,0)');
  ctx.fillStyle=g1; ctx.beginPath(); ctx.moveTo(W,0); ctx.lineTo(W,H*0.5); ctx.lineTo(W*0.4,0); ctx.closePath(); ctx.fill();
  var g2=ctx.createLinearGradient(0,0,W*0.5,H*0.8);
  g2.addColorStop(0,'rgba(255,236,180,0.12)'); g2.addColorStop(1,'rgba(255,236,180,0)');
  ctx.fillStyle=g2; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W*0.55,0); ctx.lineTo(0,H*0.55); ctx.closePath(); ctx.fill();
  ctx.restore();
}

var t0=performance.now();
function frame(now){
  var dt=Math.min(0.05,(now-(frame._l||now))/1000); frame._l=now;
  ctx.clearRect(0,0,W,H);
  if(season==='summer') sunRays();
  for(var i=0;i<parts.length;i++){
    var p=parts[i];
    p.swPhase+=p.swSpeed*dt;
    p.x += (p.vx + Math.sin(p.swPhase)*p.sway)*dt;
    p.y += p.vy*dt;
    p.rot += p.rotSp*dt;
    // recycle
    if(season==='summer'){ if(p.y< -30||p.x< -40||p.x>W+40){ Object.assign(p,mkPart(false)); } }
    else if(p.y>H+30){ Object.assign(p,mkPart(false)); }
    if(season==='fall') drawLeaf(p);
    else if(season==='spring') drawPetal(p);
    else if(season==='winter') drawDot(p,false);
    else drawDot(p,true);
  }
  raf=requestAnimationFrame(frame);
}

function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  W=window.innerWidth; H=window.innerHeight;
  canvas.width=W*DPR; canvas.height=H*DPR; canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  build();
}
function start(){
  canvas=document.createElement('canvas'); canvas.id='seasonfx';
  canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
  (document.body||document.documentElement).appendChild(canvas);
  ctx=canvas.getContext('2d'); resize();
  window.addEventListener('resize',function(){clearTimeout(start._t);start._t=setTimeout(resize,180);});
  if(raf)cancelAnimationFrame(raf); raf=requestAnimationFrame(frame);
}
window.SeasonFX={
  get season(){return season;},
  set:function(s){ if(['spring','summer','fall','winter'].indexOf(s)>-1){season=s; if(canvas)build();} }
};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
