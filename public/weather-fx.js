/* ParkPulse Weather FX — animated, condition-aware 3D weather scenes.
   Usage:  el.innerHTML = WeatherFX.card({text, temp, unit, top, bottom, size}); */
(function(){
if(window.WeatherFX) return;

var CSS = `
.wfx{position:relative;overflow:hidden;border-radius:13px;isolation:isolate;color:#fff;box-shadow:0 10px 22px -12px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.25);perspective:600px}
.wfx-lg{min-height:132px}.wfx-md{min-height:108px}.wfx-sm{min-height:96px;border-radius:11px}
.wfx-sky{position:absolute;inset:0;z-index:0}
.wfx-grad{position:absolute;inset:0;z-index:3;background:linear-gradient(180deg,rgba(0,0,0,.06) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,.46) 76%,rgba(0,0,0,.64) 100%);pointer-events:none}
.wfx-info{position:relative;z-index:4;display:flex;flex-direction:column;justify-content:flex-end;height:100%;min-height:inherit;padding:12px 14px;text-shadow:0 1px 5px rgba(0,0,0,.7),0 0 2px rgba(0,0,0,.4)}
.wfx-sm .wfx-info{padding:8px 9px;align-items:center;text-align:center}
.wfx-top{font-size:.66rem;font-weight:700;letter-spacing:.04em;opacity:.92;margin-bottom:auto}
.wfx-sm .wfx-top{margin-bottom:4px;font-size:.6rem}
.wfx-temp{font-family:'Spectral',Georgia,serif;font-weight:700;font-size:2.2rem;line-height:1}
.wfx-sm .wfx-temp{font-size:1.35rem}
.wfx-cond{font-size:.9rem;font-weight:600;margin-top:3px}
.wfx-sm .wfx-cond{font-size:.66rem;line-height:1.2;margin-top:3px;opacity:.95}
.wfx-bot{font-size:.72rem;opacity:.85;margin-top:4px}
/* tint skies */
.wfx-sunny .wfx-sky{background:linear-gradient(165deg,#2f8fd4 0%,#5fb0e6 50%,#bfe0f4 100%)}
.wfx-partly .wfx-sky{background:linear-gradient(165deg,#3f93cf 0%,#7cb8e2 55%,#cfe3f2 100%)}
.wfx-cloudy .wfx-sky{background:linear-gradient(165deg,#6c8194 0%,#9aacbb 60%,#c4ced6 100%)}
.wfx-rain .wfx-sky{background:linear-gradient(165deg,#3c4f5f 0%,#5d7384 60%,#869aa8 100%)}
.wfx-storm .wfx-sky{background:linear-gradient(165deg,#2b313c 0%,#454e5c 60%,#5d6675 100%)}
.wfx-snow .wfx-sky{background:linear-gradient(165deg,#6985a0 0%,#9fb4c8 55%,#dde7ef 100%)}
.wfx-fog .wfx-sky{background:linear-gradient(165deg,#7c8a92 0%,#a7b1b6 55%,#ccd3d6 100%)}
.wfx-smoke .wfx-sky{background:linear-gradient(165deg,#9a8f7e 0%,#b8ab97 50%,#d8ccb6 100%)}
.wfx-wind .wfx-sky{background:linear-gradient(165deg,#3f8fa6 0%,#74b3c6 55%,#c2e2ea 100%)}
/* sun */
.wfx-sun{position:absolute;z-index:1;top:14px;right:18px;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 38% 35%,#fff3c4,#ffd24a 60%,#f6b21e);box-shadow:0 0 26px 8px rgba(255,206,80,.7);animation:wfx-pulse 3s ease-in-out infinite}
.wfx-sm .wfx-sun{width:30px;height:30px;top:9px;right:10px}
.wfx-sun.sm{width:34px;height:34px}
.wfx-rays{position:absolute;z-index:0;top:14px;right:18px;width:46px;height:46px;transform-origin:center;animation:wfx-spin 26s linear infinite}
.wfx-rays:before,.wfx-rays:after{content:'';position:absolute;inset:-22px;border-radius:50%;background:conic-gradient(from 0deg,rgba(255,221,120,.55) 0 6deg,transparent 6deg 30deg,rgba(255,221,120,.55) 30deg 36deg,transparent 36deg 60deg,rgba(255,221,120,.55) 60deg 66deg,transparent 66deg 90deg,rgba(255,221,120,.55) 90deg 96deg,transparent 96deg 120deg,rgba(255,221,120,.55) 120deg 126deg,transparent 126deg 150deg,rgba(255,221,120,.55) 150deg 156deg,transparent 156deg 180deg,rgba(255,221,120,.55) 180deg 186deg,transparent 186deg 210deg,rgba(255,221,120,.55) 210deg 216deg,transparent 216deg 240deg,rgba(255,221,120,.55) 240deg 246deg,transparent 246deg 270deg,rgba(255,221,120,.55) 270deg 276deg,transparent 276deg 300deg,rgba(255,221,120,.55) 300deg 306deg,transparent 306deg 330deg,rgba(255,221,120,.55) 330deg 336deg,transparent 336deg 360deg);-webkit-mask:radial-gradient(circle,transparent 30px,#000 31px);mask:radial-gradient(circle,transparent 30px,#000 31px);opacity:.5}
.wfx-sm .wfx-rays{top:9px;right:10px;width:30px;height:30px}
/* clouds */
.wfx-cloud{position:absolute;z-index:2;border-radius:50px;background:linear-gradient(180deg,#ffffff,#e3ebf2);box-shadow:0 6px 14px rgba(20,30,40,.28)}
.wfx-cloud:before,.wfx-cloud:after{content:'';position:absolute;border-radius:50%;background:inherit}
.wfx-cloud.c1{width:70px;height:22px;top:24px;left:-20px;animation:wfx-drift 16s linear infinite}
.wfx-cloud.c2{width:88px;height:26px;top:14px;left:30%;animation:wfx-drift 22s linear infinite;animation-delay:-6s}
.wfx-cloud.c3{width:60px;height:20px;top:44px;left:55%;opacity:.92;animation:wfx-drift 19s linear infinite;animation-delay:-3s}
.wfx-cloud.c1:before{width:30px;height:30px;top:-13px;left:12px}.wfx-cloud.c1:after{width:24px;height:24px;top:-9px;left:36px}
.wfx-cloud.c2:before{width:36px;height:36px;top:-16px;left:16px}.wfx-cloud.c2:after{width:28px;height:28px;top:-11px;left:46px}
.wfx-cloud.c3:before{width:26px;height:26px;top:-11px;left:12px}.wfx-cloud.c3:after{width:20px;height:20px;top:-7px;left:32px}
.wfx-cloud.dark{background:linear-gradient(180deg,#9fb0bd,#6f828f)}
.wfx-sm .wfx-cloud{transform:scale(.7);transform-origin:left top}
/* rain */
.wfx-drop{position:absolute;z-index:2;top:-12px;width:2px;height:15px;border-radius:2px;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(225,240,250,.95));animation:wfx-fall linear infinite}
/* snow */
.wfx-flake{position:absolute;z-index:2;top:-10px;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(255,255,255,.7));box-shadow:0 0 4px rgba(255,255,255,.8);animation:wfx-snowfall linear infinite}
/* bolt */
.wfx-bolt{position:absolute;z-index:2;inset:0;background:radial-gradient(circle at 60% 30%,rgba(255,247,200,.95),transparent 38%);opacity:0;animation:wfx-flash 4.2s ease-out infinite;mix-blend-mode:screen}
/* fog */
.wfx-fog{position:absolute;z-index:2;left:-30%;width:160%;height:14px;border-radius:20px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);filter:blur(4px)}
.wfx-fog.f1{top:34%;animation:wfx-fogmove 9s linear infinite}
.wfx-fog.f2{top:54%;animation:wfx-fogmove 12s linear infinite reverse;opacity:.6}
.wfx-fog.f3{top:74%;animation:wfx-fogmove 15s linear infinite;opacity:.45}
/* smoke — a soft hazy veil + dim sun, distinct from white fog */
.wfx-haze{position:absolute;z-index:2;inset:0;background:linear-gradient(180deg,rgba(190,180,160,.55),rgba(150,138,120,.35) 60%,rgba(120,110,95,.3));animation:wfx-pulse 7s ease-in-out infinite}
.wfx-hazesun{position:absolute;z-index:1;top:18%;left:50%;transform:translateX(-50%);width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(255,226,170,.85),rgba(220,180,130,.4) 60%,transparent 75%);filter:blur(2px)}
/* wind */
.wfx-wind{position:absolute;z-index:2;left:-40%;width:70%;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)}
.wfx-wind.w1{top:38%;animation:wfx-gust 3.2s ease-in-out infinite}
.wfx-wind.w2{top:58%;width:55%;animation:wfx-gust 3.8s ease-in-out infinite;animation-delay:-1.4s}
@keyframes wfx-pulse{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.08);filter:brightness(1.12)}}
@keyframes wfx-spin{to{transform:rotate(360deg)}}
@keyframes wfx-drift{from{transform:translateX(-30px)}to{transform:translateX(260px)}}
@keyframes wfx-fall{0%{transform:translateY(-14px);opacity:0}8%{opacity:1}92%{opacity:.95}100%{transform:translateY(460px);opacity:0}}
@keyframes wfx-snowfall{0%{transform:translateY(-10px) translateX(0);opacity:0}10%{opacity:1}92%{opacity:.9}100%{transform:translateY(440px) translateX(22px);opacity:0}}
@keyframes wfx-flash{0%,7%,11%,100%{opacity:0}4%{opacity:1}9%{opacity:.85}}
@keyframes wfx-fogmove{from{transform:translateX(-12%)}to{transform:translateX(12%)}}
@keyframes wfx-gust{0%{transform:translateX(0);opacity:0}30%{opacity:1}100%{transform:translateX(220%);opacity:0}}
@media(prefers-reduced-motion:reduce){.wfx *{animation:none!important}}
`;
var st=document.createElement('style'); st.id='weatherfx-css'; st.textContent=CSS; document.head.appendChild(st);

function kindOf(text){
  var t=(text||'').toLowerCase();
  if(/thunder|t-?storm|lightning/.test(t)) return 'storm';
  if(/snow|flurr|sleet|wintry|blizzard|ice|freezing/.test(t)) return 'snow';
  if(/rain|shower|drizzle|precip/.test(t)) return 'rain';
  if(/smoke/.test(t)) return 'smoke';
  if(/fog|haze|mist/.test(t)) return 'fog';
  if(/wind|breez|gust/.test(t)) return 'wind';
  if(/partly|few clouds|scattered|mostly sunny|mostly clear/.test(t)) return 'partly';
  if(/overcast|mostly cloudy|cloudy/.test(t)) return 'cloudy';
  if(/clear|sunny|fair|hot/.test(t)) return 'sunny';
  return 'partly';
}
function rep(n,fn){var s='';for(var i=0;i<n;i++)s+=fn(i);return s;}
function drops(n){return rep(n,function(i){var l=(7+i*(86/n)+(i%2?4:0));var d=((i*0.13)%1.1).toFixed(2);var du=(0.55+((i*7)%5)/10).toFixed(2);return '<i class="wfx-drop" style="left:'+l.toFixed(0)+'%;animation-delay:'+d+'s;animation-duration:'+du+'s"></i>';});}
function flakes(n){return rep(n,function(i){var l=(6+i*(88/n));var d=((i*0.27)%2.4).toFixed(2);var du=(2.4+((i*5)%6)/2).toFixed(2);var sc=(0.6+((i*3)%5)/7).toFixed(2);return '<i class="wfx-flake" style="left:'+l.toFixed(0)+'%;animation-delay:'+d+'s;animation-duration:'+du+'s;transform:scale('+sc+')"></i>';});}
function inner(k){
  switch(k){
    case 'sunny': return '<div class="wfx-sky"></div><div class="wfx-rays"></div><div class="wfx-sun"></div>';
    case 'partly': return '<div class="wfx-sky"></div><div class="wfx-rays"></div><div class="wfx-sun sm"></div><div class="wfx-cloud c1"></div><div class="wfx-cloud c3"></div>';
    case 'cloudy': return '<div class="wfx-sky"></div><div class="wfx-cloud c2"></div><div class="wfx-cloud c1"></div><div class="wfx-cloud c3"></div>';
    case 'rain': return '<div class="wfx-sky"></div><div class="wfx-cloud c1"></div><div class="wfx-cloud c2 dark"></div><div class="wfx-cloud c3"></div>'+drops(28);
    case 'storm': return '<div class="wfx-sky"></div><div class="wfx-bolt"></div><div class="wfx-cloud c1"></div><div class="wfx-cloud c2 dark"></div><div class="wfx-cloud c3"></div>'+drops(22);
    case 'snow': return '<div class="wfx-sky"></div><div class="wfx-cloud c1"></div><div class="wfx-cloud c2"></div>'+flakes(24);
    case 'fog': return '<div class="wfx-sky"></div><div class="wfx-fog f1"></div><div class="wfx-fog f2"></div><div class="wfx-fog f3"></div>';
    case 'smoke': return '<div class="wfx-sky"></div><div class="wfx-hazesun"></div><div class="wfx-haze"></div><div class="wfx-fog f1" style="opacity:.4"></div><div class="wfx-fog f3" style="opacity:.3"></div>';
    case 'wind': return '<div class="wfx-sky"></div><div class="wfx-cloud c1"></div><div class="wfx-wind w1"></div><div class="wfx-wind w2"></div>';
  }
  return '<div class="wfx-sky"></div>';
}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function card(o){
  o=o||{}; var k=kindOf(o.text); var size=o.size||'md';
  var top=o.top?'<div class="wfx-top">'+esc(o.top)+'</div>':'';
  var temp=(o.temp!=null&&o.temp!=='')?'<div class="wfx-temp">'+esc(o.temp)+(o.unit||'°')+'</div>':'';
  var cond=o.text?'<div class="wfx-cond">'+esc(o.text)+'</div>':'';
  var bot=o.bottom?'<div class="wfx-bot">'+esc(o.bottom)+'</div>':'';
  return '<div class="wfx wfx-'+k+' wfx-'+size+'">'+inner(k)+'<div class="wfx-grad"></div><div class="wfx-info">'+top+temp+cond+bot+'</div></div>';
}
window.WeatherFX={card:card,kind:kindOf,scene:function(t,o){o=o||{};return '<div class="wfx wfx-'+kindOf(t)+' wfx-'+(o.size||'md')+'">'+inner(kindOf(t))+'<div class="wfx-grad"></div></div>';}};
})();
