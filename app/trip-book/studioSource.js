// AUTO-GENERATED from Downloads/trip-book-studio-preview.html by scratchpad/transform.js.
// The imperative Trip Book Studio engine, ported 1:1 with three swaps: Wikipedia
// fetch -> server-cached /api/photo, demo <image-slot> -> real photo capture,
// and added photos persisted to localStorage (pb_book_diary). Mounted by TripBook.jsx.
/* eslint-disable */

export const MARKUP = "<div style=\"min-height:100vh;background:#0e0e0c\">\n\n  <!-- TOP BAR -->\n  <header style=\"position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 clamp(14px,4vw,36px);height:60px;background:rgba(14,14,12,.85);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border-bottom:1px solid rgba(217,183,121,.18)\">\n    <div style=\"display:flex;align-items:center;gap:10px;flex:none\">\n      <span style=\"width:28px;height:28px;border-radius:8px;background:linear-gradient(150deg,#e8cf9a,#c9a35f);display:flex;align-items:center;justify-content:center\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"#0e0e0c\"><path d=\"M12 2l5 9h-3l5 9H5l5-9H7z\"></path><rect x=\"11\" y=\"18\" width=\"2\" height=\"4\"></rect></svg></span>\n      <b style=\"font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.15rem\">Trip Book</b>\n    </div>\n    <div id=\"steps\" style=\"display:flex;align-items:center;gap:6px\"></div>\n    <button id=\"topAction\" style=\"cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:600;color:#0e0e0c;background:linear-gradient(120deg,#e8cf9a,#c9a35f);border:none;border-radius:999px;padding:9px 17px;flex:none\">Next →</button>\n  </header>\n\n  <!-- STEP 1 · TRIP DIARY -->\n  <section id=\"stepTrip\" data-screen-label=\"Trip diary\" style=\"padding:clamp(18px,3vh,30px) clamp(14px,4vw,36px) 60px\">\n    <div style=\"max-width:640px;margin:0 auto\">\n      <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:16px\">\n        <span style=\"display:inline-flex;align-items:center;gap:7px;background:rgba(79,217,138,.12);border:1px solid rgba(79,217,138,.4);border-radius:999px;padding:5px 11px\"><span style=\"width:7px;height:7px;border-radius:50%;background:#4fd98a;animation:st-dot 1.6s infinite\"></span><span style=\"font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.14em;text-transform:uppercase;color:#7fe3a6\">Trip Mode</span></span>\n        <div style=\"font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;color:#8a8578\" id=\"tripModeLine\">Irving, TX → Rocky Mountain · Day 2 · 947 mi</div>\n      </div>\n      <div id=\"promptCard\" style=\"position:relative;border-radius:20px;overflow:hidden;border:1px solid rgba(217,183,121,.3);background:linear-gradient(160deg,rgba(31,40,32,.6),rgba(14,14,12,.6))\">\n        <div style=\"display:flex;align-items:center;gap:10px;padding:16px 18px 0\">\n          <span id=\"promptIcon\" style=\"width:40px;height:40px;flex:none;border-radius:12px;background:rgba(217,183,121,.14);border:1px solid rgba(217,183,121,.3);display:flex;align-items:center;justify-content:center;font-size:1.15rem;animation:st-ping 2.6s infinite\">🏡</span>\n          <div style=\"min-width:0\"><div style=\"font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.16em;text-transform:uppercase;color:#d9b779\">Park Buddy noticed a moment</div><div id=\"promptTitle\" style=\"font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.4rem;line-height:1.05;margin-top:2px\">You've reached Estes Park</div></div>\n        </div>\n        <div id=\"promptMsg\" style=\"padding:8px 18px 0;font-size:.9rem;color:#c8c3b6;line-height:1.5;font-weight:300\"></div>\n        <div style=\"padding:16px 18px 18px\">\n          <div style=\"position:relative;height:220px;border-radius:14px;overflow:hidden;background:#15150f\"><label id=\"st-live\" class=\"capzone\" style=\"position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#15150f;text-align:center;padding:16px;overflow:hidden\"><input type=\"file\" accept=\"image/*\" style=\"display:none\"><span class=\"capzone-ph\" style=\"font-family:'Space Mono',monospace;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#8a8578;pointer-events:none\">📷 Take / drop a photo of this moment</span><img class=\"capzone-img\" alt=\"\" style=\"display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover\"></label></div>\n          <input id=\"capCaption\" placeholder=\"Say something about it… (optional)\" style=\"width:100%;margin-top:12px;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.22);border-radius:12px;padding:12px 14px;color:#f4f1ea;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1.05rem;outline:none\">\n          <div style=\"display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap\">\n            <div id=\"capStamp\" style=\"display:flex;gap:10px;flex-wrap:wrap;font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.08em;text-transform:uppercase;color:#8a8578\"></div>\n            <button id=\"saveMoment\" style=\"cursor:pointer;font-family:inherit;font-size:.82rem;font-weight:600;color:#0e0e0c;background:linear-gradient(120deg,#e8cf9a,#c9a35f);border:none;border-radius:999px;padding:10px 20px\">Add to diary</button>\n          </div>\n        </div>\n      </div>\n      <div style=\"margin-top:16px\"><div style=\"font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.16em;text-transform:uppercase;color:#8a8578;margin-bottom:9px\">Capture anytime</div><div id=\"quickRow\" style=\"display:flex;gap:8px;flex-wrap:wrap\"></div></div>\n      <div style=\"display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:26px 0 4px\"><h2 style=\"font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.4rem\">The diary so far</h2><span id=\"momentCount\" style=\"font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.12em;text-transform:uppercase;color:#8a8578\"></span></div>\n      <div style=\"font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.08em;text-transform:uppercase;color:#6f6a5f;margin-bottom:16px\">These become your Trip Book — automatically</div>\n      <div id=\"feed\" style=\"position:relative\"></div>\n    </div>\n  </section>\n\n  <!-- STEP 2 · THEME & SETTINGS -->\n  <section id=\"stepTheme\" data-screen-label=\"Theme and settings\" style=\"display:none;padding:clamp(16px,3vh,28px) clamp(14px,3vw,32px) 40px\">\n    <div style=\"max-width:1500px;margin:0 auto\">\n      <div style=\"display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px\">\n        <div>\n          <div style=\"font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.26em;text-transform:uppercase;color:#d9b779\">Step 2 · Design your book</div>\n          <h1 style=\"font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(1.6rem,3.4vw,2.4rem);line-height:1.03;margin-top:4px\">Pick a look. Make it yours.</h1>\n        </div>\n      </div>\n      <div style=\"display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:22px;align-items:start\" id=\"themeSettingsGrid\">\n        <!-- LIVE PREVIEW (main, full area) -->\n        <div style=\"position:sticky;top:74px\">\n          <div style=\"background:radial-gradient(120% 100% at 50% 0,#1a1610,#0e0e0c 80%);border:1px solid rgba(217,183,121,.18);border-radius:18px;padding:clamp(16px,2.5vw,30px)\">\n            <div style=\"display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px\">\n              <span style=\"font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.16em;text-transform:uppercase;color:#7fe3a6\"><span style=\"display:inline-block;width:6px;height:6px;border-radius:50%;background:#4fd98a;margin-right:6px\"></span>Live preview</span>\n              <span id=\"previewMeta\" style=\"font-family:'Space Mono',monospace;font-size:.52rem;letter-spacing:.12em;text-transform:uppercase;color:#8a8578\"></span>\n            </div>\n            <div id=\"livePreview\" style=\"display:flex;justify-content:center\"></div>\n            <div style=\"display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px\">\n              <button id=\"pvToggle\" style=\"cursor:pointer;font-family:inherit;font-size:.74rem;font-weight:600;color:#f4f1ea;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.35);border-radius:999px;padding:8px 14px\">Open book</button>\n              <button id=\"pvPrev\" style=\"cursor:pointer;width:38px;height:38px;border-radius:50%;border:1px solid rgba(217,183,121,.35);background:rgba(255,255,255,.04);color:#f4f1ea;font-size:1rem\">‹</button>\n              <span id=\"pvLabel\" style=\"font-family:'Space Mono',monospace;font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:#8a8578;min-width:130px;text-align:center\">Opening</span>\n              <button id=\"pvNext\" style=\"cursor:pointer;width:38px;height:38px;border-radius:50%;border:1px solid rgba(217,183,121,.35);background:rgba(255,255,255,.04);color:#f4f1ea;font-size:1rem\">›</button>\n            </div>\n            <div id=\"pvDots\" style=\"display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;margin-top:12px\"></div>\n            <div id=\"pvCount\" style=\"text-align:center;font-family:'Space Mono',monospace;font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;color:#6f6a5f;margin-top:8px\"></div>\n          </div>\n        </div>\n        <!-- EDIT PANEL (side) -->\n        <div style=\"display:flex;flex-direction:column;gap:20px\">\n          <div style=\"background:rgba(255,255,255,.025);border:1px solid rgba(217,183,121,.13);border-radius:14px;overflow:hidden\">\n            <button id=\"themeToggle\" style=\"cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:transparent;border:none;padding:15px 16px\">\n              <span style=\"display:flex;align-items:center;gap:8px\"><span style=\"font-size:.82rem;opacity:.85\">🎭</span><span style=\"font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.18em;text-transform:uppercase;color:#c7ba9e\">Theme</span><span id=\"themeCurrent\" style=\"font-family:'Cormorant Garamond',serif;font-size:1.05rem;color:#f4f1ea\"></span></span>\n              <span id=\"themeChevron\" style=\"color:#8a8578;font-size:.8rem;transition:transform .3s\">▾</span>\n            </button>\n            <div id=\"themeWrap\" style=\"display:none;padding:0 16px 16px\">\n              <div id=\"themeGrid\" style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px\"></div>\n            </div>\n          </div>\n          <div id=\"settingsPanel\" style=\"background:#15140f;border:1px solid rgba(217,183,121,.18);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:18px\"></div>\n        </div>\n      </div>\n    </div>\n  </section>\n\n  <!-- STEP 3 · OPENABLE BOOK -->\n  <section id=\"stepBook\" data-screen-label=\"Your book\" style=\"display:none;background:radial-gradient(120% 90% at 50% 0,#171410,#0c0b09 70%);min-height:calc(100vh - 60px)\">\n    <div style=\"display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px,4vw,40px);gap:16px;min-height:calc(100vh - 60px)\">\n      <div style=\"text-align:center\"><div style=\"font-family:'Space Mono',monospace;font-size:.58rem;letter-spacing:.24em;text-transform:uppercase;color:#d9b779\">Step 3 · Your book</div><div id=\"bookStatus\" style=\"font-family:'Space Mono',monospace;font-size:.54rem;letter-spacing:.14em;text-transform:uppercase;color:#6f6a5f;margin-top:6px\">Tap the cover to open</div></div>\n      <div id=\"stage\" style=\"position:relative;width:min(96vw,1060px);height:min(74vh,700px);perspective:3000px;display:flex;align-items:center;justify-content:center\">\n        <div id=\"book\" style=\"position:relative;width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;transform-style:preserve-3d;box-shadow:0 60px 120px -50px rgba(0,0,0,.9)\">\n          <div id=\"pageL\" style=\"position:relative;overflow:hidden;border-radius:4px 0 0 4px\"></div>\n          <div id=\"pageR\" style=\"position:relative;overflow:hidden;border-radius:0 4px 4px 0\"></div>\n          <div id=\"spine\" style=\"position:absolute;top:0;bottom:0;left:50%;width:44px;transform:translateX(-50%);pointer-events:none;z-index:5;opacity:0;transition:opacity .5s;background:linear-gradient(90deg,transparent,rgba(0,0,0,.04) 30%,rgba(0,0,0,.2) 49%,rgba(0,0,0,.2) 51%,rgba(0,0,0,.04) 70%,transparent)\"></div>\n          <div id=\"ribbon\" style=\"position:absolute;top:-6px;left:calc(50% + 40px);width:16px;height:120px;background:linear-gradient(#e8cf9a,#c9a35f);z-index:6;opacity:0;transition:opacity .5s;clip-path:polygon(0 0,100% 0,100% 100%,50% 84%,0 100%);box-shadow:0 6px 12px -4px rgba(0,0,0,.5)\"></div>\n          <div id=\"leaf\" style=\"position:absolute;top:0;bottom:0;width:50%;transform-style:preserve-3d;z-index:8;display:none;transform-origin:left center\"></div>\n          <div id=\"cover\" style=\"position:absolute;top:0;bottom:0;left:50%;width:50%;transform-origin:left center;transform-style:preserve-3d;z-index:10;cursor:pointer;border-radius:3px 7px 7px 3px;overflow:hidden;box-shadow:0 50px 100px -35px rgba(0,0,0,.95),10px 0 0 -2px rgba(0,0,0,.3),17px 0 0 -5px rgba(0,0,0,.18),23px 0 0 -8px rgba(0,0,0,.1);transition:transform 1.1s cubic-bezier(.5,0,.2,1)\"><div id=\"coverArt\" style=\"position:absolute;inset:0\"></div></div>\n        </div>\n      </div>\n      <div style=\"display:flex;align-items:center;gap:16px\">\n        <button id=\"prev\" style=\"cursor:pointer;width:44px;height:44px;border-radius:50%;border:1px solid rgba(217,183,121,.35);background:rgba(255,255,255,.04);color:#f4f1ea;font-size:1.1rem\">‹</button>\n        <span id=\"pageLabel\" style=\"font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:#8a8578;min-width:120px;text-align:center\">Cover</span>\n        <button id=\"next\" style=\"cursor:pointer;width:44px;height:44px;border-radius:50%;border:1px solid rgba(217,183,121,.35);background:rgba(255,255,255,.04);color:#f4f1ea;font-size:1.1rem\">›</button>\n        <button id=\"closeBook\" style=\"cursor:pointer;font-family:inherit;font-size:.78rem;font-weight:600;color:#f4f1ea;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.35);border-radius:999px;padding:9px 16px\">Close book</button>\n      </div>\n      <button id=\"orderBtn\" style=\"cursor:pointer;font-family:inherit;font-size:.84rem;font-weight:600;color:#0e0e0c;background:linear-gradient(120deg,#e8cf9a,#c9a35f);border:none;border-radius:999px;padding:12px 24px\">Order printed copy · <span id=\"orderPrice\">$65</span></button>\n    </div>\n  </section>\n</div>";

export function mountStudio(data){


class Studio {
  TRIP={title:'Six Days Through the Colorado Plateau',dates:'May 12–18, 2026',edition:'No. 0247',dedication:'For the one who said yes to the detour.'};
  SEED=[
    {type:'Departure',ic:'🚗',place:'Irving, TX',time:'Mon · 5:12 AM',w:'58° dark',q:['Palo Duro Canyon State Park','Great Plains'],cap:'Mile zero. Coffee, a cold windshield, and 940 miles of anticipation.'},
    {type:'Gateway town',ic:'🏡',place:'Estes Park, CO',time:'Mon · 7:05 PM',w:'54° clear',q:['Estes Park, Colorado'],cap:'Checked into the cabin. An elk was grazing the lawn like he owned it.'},
    {type:'Trailhead',ic:'🥾',place:'Bear Lake, RMNP',time:'Tue · 7:12 AM',w:'44° clear',q:['Bear Lake (Colorado)','Rocky Mountain National Park'],cap:'Started up toward Sky Pond before the sun cleared the ridge.'},
    {type:'Remember this',ic:'✨',place:'Sky Pond, RMNP',time:'Tue · 11:40 AM',w:'41° clear',q:['Sky Pond','Rocky Mountain National Park'],cap:'The Cathedral Spires rose straight off the water. Nobody spoke.'}
  ];
  PROMPTS=[
    {type:'Gateway town',ic:'🏡',title:"You've reached Estes Park",msg:"You made it to the gateway town. Grab a photo of where you're staying.",place:'Estes Park, CO',w:'54° clear',q:['Estes Park, Colorado']},
    {type:'Scenic pullout',ic:'⛰',title:'You stopped on Trail Ridge Road',msg:"Pulled over? This view is worth a frame — you're at 12,000 feet.",place:'Trail Ridge Road',w:'39° windy',q:['Trail Ridge Road','Rocky Mountain National Park']},
    {type:'Remember this',ic:'✨',title:'Something worth remembering?',msg:"Tag this as a highlight — the story spreads in your book are built from these.",place:'Alberta Falls, RMNP',w:'46° clear',q:['Alberta Falls','Rocky Mountain National Park']}
  ];
  QUICK=[['🍽','Meal','Estes Park, CO','46° crisp',['Estes Park, Colorado']],['🥾','Trailhead','Glacier Gorge, RMNP','44° clear',['Bear Lake (Colorado)']],['⛰','Scenic stop','Trail Ridge Road','39° windy',['Trail Ridge Road']],['✨','Remember this','RMNP','clear',['Rocky Mountain National Park']]];

  THEMES=[
    {id:'field',name:'Field Notes',bg:'#f6efe3',ink:'#33291f',soft:'#8a7d6a',accent:'#b5542f',title:"'Cormorant Garamond',serif",tw:600,story:"'Cormorant Garamond',serif",si:true,gray:false,frame:'mount',up:false},
    {id:'editorial',name:'Editorial',bg:'#ffffff',ink:'#0b0b0d',soft:'#8b8b90',accent:'#ff5a2e',title:"'Inter',sans-serif",tw:900,story:"'Inter',sans-serif",si:false,gray:false,frame:'bleed',up:true},
    {id:'nightfall',name:'Nightfall',bg:'#0e1420',ink:'#eef2f8',soft:'#8b93a3',accent:'#d9b779',title:"'Playfair Display',serif",tw:600,story:"'Cormorant Garamond',serif",si:true,gray:false,frame:'glow',up:false},
    {id:'kodachrome',name:'Kodachrome',bg:'#f3ead6',ink:'#3a2c1e',soft:'#9a7d55',accent:'#c0392b',title:"'Playfair Display',serif",tw:700,story:"'Cormorant Garamond',serif",si:true,gray:false,frame:'film',up:false},
    {id:'silver',name:'Silver',bg:'#f4f4f2',ink:'#141414',soft:'#8a8a8a',accent:'#141414',title:"'Cormorant Garamond',serif",tw:600,story:"'Cormorant Garamond',serif",si:true,gray:true,frame:'gallery',up:false},
    {id:'alpenglow',name:'Alpenglow',bg:'#fbeee6',ink:'#3d2320',soft:'#b08574',accent:'#e0623d',title:"'Playfair Display',serif",tw:700,story:"'Cormorant Garamond',serif",si:true,gray:false,frame:'mount',up:false},
    {id:'blueprint',name:'Blueprint',bg:'#0f2a3f',ink:'#eaf4fb',soft:'#7fa6c0',accent:'#8fd3ff',title:"'Space Mono',monospace",tw:700,story:"'Inter',sans-serif",si:false,gray:false,frame:'film',up:true},
    {id:'sagebrush',name:'Sagebrush',bg:'#eef0e6',ink:'#2c3327',soft:'#8a9478',accent:'#5c7a4a',title:"'Cormorant Garamond',serif",tw:600,story:"'Cormorant Garamond',serif",si:true,gray:false,frame:'gallery',up:false},
    {id:'canyon',name:'Canyon',bg:'#231512',ink:'#f7e9dc',soft:'#b98d72',accent:'#e08a3c',title:"'Playfair Display',serif",tw:700,story:"'Cormorant Garamond',serif",si:true,gray:false,frame:'glow',up:false}
  ];
  ACCENTS=['#b5542f','#c9a35f','#3d6b4f','#2f6d7a','#7a4f8a','#c0392b'];
  PRINTS=[['8×8"','$45'],['10×10"','$65'],['12×12"','$89']];

  renderVals(){ return {}; }
  componentDidMount(){
    this.step=0; this.sel=0; this.open=false; this.idx=0; this.anim=false; this.bookDirty=true;
    if(this.REAL&&this.REAL.trip){ Object.assign(this.TRIP,this.REAL.trip); } if(this.REAL&&this.REAL.prompts&&this.REAL.prompts.length){ this.PROMPTS=this.REAL.prompts; } this.S={framing:null, typeScale:1, accent:null, gray:null, ribbon:true, print:1, photos:1, title:this.TRIP.title, dates:this.TRIP.dates, ded:this.TRIP.dedication};
    this.userEntries=this.loadUser(); var __base=(this.REAL&&this.REAL.entries&&this.REAL.entries.length)?this.REAL.entries:this.SEED; this.entries=__base.concat(this.userEntries); this.pIdx=0; this.pvOpen=true;
    this.renderSteps(); this.renderPrompt(); this.renderQuick(); this.renderFeed(); this.initCapture();
    this.renderThemeGrid(); this.renderSettings();
    this.wire(); this.setStep(0); this.reveal(); if(this.TRIP.modeLine){ var __ml=document.getElementById('tripModeLine'); if(__ml)__ml.textContent=this.TRIP.modeLine; }
  }
  T(){ var t=Object.assign({},this.THEMES[this.sel]); if(this.S.accent)t.accent=this.S.accent; if(this.S.gray!==null)t.gray=this.S.gray; if(this.S.framing)t.frame=this.S.framing; return t; }
  ms(s,l,c){ return "font-family:'Space Mono',monospace;font-size:"+s+";letter-spacing:"+l+";text-transform:uppercase;color:"+c+";"; }
  img(q,st){ return '<img data-wiki="'+q.join('|')+'" alt="" style="opacity:0;transition:opacity .7s;'+st+'">'; }
  entryImg(e,st){ if(e.userImg) return '<img src="'+e.userImg+'" alt="" style="'+st+'">'; return this.img(e.q||['Rocky Mountain National Park'],st); }

  /* ---- STEPS ---- */
  renderSteps(){
    var box=document.getElementById('steps'), self=this, names=['Trip','Theme','Book'];
    box.innerHTML=names.map(function(n,i){ return '<button data-p="'+i+'" class="st-step" style="cursor:pointer;background:none;border:none;display:flex;align-items:center;gap:6px;font-family:\'Space Mono\',monospace;font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:#8a8578"><span class="st-num" style="width:19px;height:19px;border-radius:50%;border:1px solid rgba(217,183,121,.4);display:flex;align-items:center;justify-content:center;font-size:.56rem">'+(i+1)+'</span>'+n+'</button>'+(i<2?'<span style="width:16px;height:1px;background:rgba(217,183,121,.25)"></span>':''); }).join('');
    box.querySelectorAll('.st-step').forEach(function(b){ b.onclick=function(){ self.setStep(+b.getAttribute('data-p')); }; });
  }
  setStep(p){
    this.step=p;
    document.getElementById('stepTrip').style.display=p===0?'':'none';
    document.getElementById('stepTheme').style.display=p===1?'':'none';
    document.getElementById('stepBook').style.display=p===2?'':'none';
    document.querySelectorAll('.st-step').forEach(function(b,i){ var on=i===p,done=i<p,num=b.querySelector('.st-num'); b.style.color=on?'#f4f1ea':(done?'#d9b779':'#8a8578'); num.style.background=on||done?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'transparent'; num.style.color=on||done?'#0e0e0c':'#8a8578'; num.style.borderColor=on||done?'transparent':'rgba(217,183,121,.4)'; num.innerHTML=done?'✓':(i+1); });
    document.getElementById('topAction').textContent=p===2?'Order this book →':'Next →';
    if(p===2) this.enterBook();
    window.scrollTo({top:0,behavior:'smooth'});
    this.reveal();
  }

  /* ---- STEP 1 DIARY ---- */
  stamp(place,w){ return '<span>◷ '+(new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}))+'</span><span>◎ '+place+'</span><span style="color:#7fe3a6">'+w+'</span>'; }
  renderPrompt(){ var p=this.PROMPTS[this.pIdx]; if(!p){ document.getElementById('promptCard').style.display='none'; return; } document.getElementById('promptCard').style.display=''; document.getElementById('promptIcon').textContent=p.ic; document.getElementById('promptTitle').textContent=p.title; document.getElementById('promptMsg').textContent=p.msg; document.getElementById('capStamp').innerHTML=this.stamp(p.place,p.w); this._ap=p; }
  renderQuick(){ var box=document.getElementById('quickRow'),self=this; box.innerHTML=this.QUICK.map(function(q,i){ return '<button data-i="'+i+'" style="cursor:pointer;font-family:inherit;font-size:.8rem;font-weight:600;color:#e7e3d8;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.25);border-radius:999px;padding:9px 15px">'+q[0]+' '+q[1]+'</button>'; }).join(''); box.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ var q=self.QUICK[+b.getAttribute('data-i')]; self._ap={type:q[1],ic:q[0],title:q[1],msg:'Capture this '+q[1].toLowerCase()+' moment.',place:q[2],w:q[3],q:q[4]}; document.getElementById('promptIcon').textContent=q[0]; document.getElementById('promptTitle').textContent=q[1]; document.getElementById('promptMsg').textContent=self._ap.msg; document.getElementById('capStamp').innerHTML=self.stamp(q[2],q[3]); window.scrollTo({top:0,behavior:'smooth'}); }; }); }
  readLive(){ var el=document.getElementById('st-live'); if(!el)return null; var im=el.querySelector('.capzone-img'); if(im&&im.getAttribute('src')&&im.style.display!=='none')return im.getAttribute('src'); return null; }
  downscale(file,cb){ if(!file){cb(null);return;} var rd=new FileReader(); rd.onload=function(){ var img=new Image(); img.onload=function(){ var w=img.width,h=img.height,mx=1000,s=Math.min(1,mx/Math.max(w,h)); w=Math.round(w*s); h=Math.round(h*s); var c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); try{ cb(c.toDataURL('image/jpeg',0.82)); }catch(e){ cb(rd.result); } }; img.onerror=function(){cb(rd.result);}; img.src=rd.result; }; rd.onerror=function(){cb(null);}; rd.readAsDataURL(file); }
  initCapture(){ var self=this,el=document.getElementById('st-live'); if(!el)return; var input=el.querySelector('input[type=file]'),ph=el.querySelector('.capzone-ph'),im=el.querySelector('.capzone-img'); var set=function(f){ self.downscale(f,function(url){ if(!url)return; im.src=url; im.style.display='block'; if(ph)ph.style.display='none'; }); }; if(input)input.onchange=function(e){ set(e.target.files&&e.target.files[0]); }; el.addEventListener('dragover',function(e){ e.preventDefault(); el.style.outline='2px solid #d9b779'; el.style.outlineOffset='-4px'; }); el.addEventListener('dragleave',function(){ el.style.outline='none'; }); el.addEventListener('drop',function(e){ e.preventDefault(); el.style.outline='none'; set(e.dataTransfer.files&&e.dataTransfer.files[0]); }); this._capReset=function(){ if(im){im.src='';im.style.display='none';} if(ph)ph.style.display=''; if(input)input.value=''; }; }
  loadUser(){ try{ var v=JSON.parse(localStorage.getItem('pb_book_diary')); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  persist(){ try{ localStorage.setItem('pb_book_diary', JSON.stringify(this.userEntries||[])); }catch(e){} }
  destroy(){ this._dead=true; var t=document.getElementById('st-toast'); if(t)t.remove(); }
  saveMoment(){ var p=this._ap; if(!p)return; var cap=document.getElementById('capCaption').value.trim(); var _e={type:p.type,ic:p.ic,place:p.place,time:'Just now',w:p.w,cap:cap,userImg:this.readLive(),q:p.q||['Rocky Mountain National Park']}; this.entries.push(_e); this.userEntries.push(_e); this.persist(); document.getElementById('capCaption').value=''; if(this._capReset)this._capReset(); if(this.pIdx<this.PROMPTS.length&&p===this.PROMPTS[this.pIdx])this.pIdx++; this.renderPrompt(); this.renderFeed(); this.bookDirty=true; this.toast('Added to your diary ✓'); }
  renderFeed(){ var box=document.getElementById('feed'),self=this,list=this.entries.slice().reverse(); document.getElementById('momentCount').textContent=this.entries.length+' moments';
    box.innerHTML='<div style="position:absolute;left:19px;top:6px;bottom:6px;width:2px;background:linear-gradient(#d9b779,rgba(217,183,121,.15));z-index:0"></div>'+list.map(function(e){ var big=(e.type==='Remember this'||e.type==='Gateway town'); var img=self.entryImg(e,'width:100%;height:100%;object-fit:cover');
      return '<div class="st-rev" style="position:relative;z-index:1;display:flex;gap:14px;margin-bottom:16px"><div style="flex:none;width:40px;display:flex;justify-content:center;padding-top:4px"><span style="width:40px;height:40px;border-radius:50%;background:#161611;border:2px solid #d9b779;display:flex;align-items:center;justify-content:center;font-size:1rem">'+e.ic+'</span></div><div style="flex:1;min-width:0;background:#17130c;border:1px solid rgba(217,183,121,.16);border-radius:16px;overflow:hidden"><div style="position:relative;width:100%;'+(big?'aspect-ratio:4/3':'aspect-ratio:16/9')+';background:#e8decb;overflow:hidden">'+img+'<span style="position:absolute;left:10px;top:10px;'+self.ms('.5rem','.1em','#fff')+'background:rgba(0,0,0,.55);border-radius:999px;padding:3px 9px">'+e.type+'</span></div><div style="padding:'+(big?'16px 18px':'13px 15px')+'">'+(e.cap?'<p style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:'+(big?'1.25rem':'1.08rem')+';line-height:1.45;color:#f0ece1">'+e.cap+'</p>':'<p style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:1rem;color:#6f6a5f">No words — just the photo.</p>')+'<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;'+self.ms('.52rem','.08em','#8a8578')+'"><span>◷ '+e.time+'</span><span>◎ '+e.place+'</span><span style="color:#7fe3a6">'+e.w+'</span></div></div></div></div>'; }).join('');
    this.hydrate(box); this.reveal();
  }

  /* ---- STEP 2 THEME + SETTINGS ---- */
  renderThemeGrid(){ var box=document.getElementById('themeGrid'),self=this;
    var cur=document.getElementById('themeCurrent'); if(cur) cur.textContent='· '+this.THEMES[this.sel].name;
    box.innerHTML=this.THEMES.map(function(t,i){ var on=i===self.sel; return '<div class="st-tcard" data-i="'+i+'" style="cursor:pointer;border-radius:12px;overflow:hidden;border:2px solid '+(on?'#d9b779':'transparent')+';background:#1a1a17;transition:border-color .3s"><div style="position:relative;aspect-ratio:4/5;background:'+t.bg+';overflow:hidden">'+self.miniCover(t)+'</div><div style="padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:6px"><span style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:.98rem;color:#f4f1ea">'+t.name+'</span><span class="st-tck" style="width:18px;height:18px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#0e0e0c;background:'+(on?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'transparent')+';border:1px solid '+(on?'transparent':'rgba(217,183,121,.4)')+'">'+(on?'✓':'')+'</span></div></div>'; }).join('');
    box.querySelectorAll('.st-tcard').forEach(function(c){ c.onclick=function(){ self.sel=+c.getAttribute('data-i'); self.S.accent=null; self.S.gray=null; self.S.framing=null; self.bookDirty=true; self.renderThemeGrid(); self.renderSettings(); }; });
    this.hydrate(box);
  }
  miniCover(t){ var im=this.img(this.SEED[3].q,'position:absolute;width:100%;height:100%;object-fit:cover'+(t.gray?';filter:grayscale(1)':''));
    return im+'<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.6))"></div><div style="position:absolute;left:0;right:0;bottom:0;padding:10px;text-align:center"><div style="font-family:'+t.title+';font-weight:'+t.tw+';font-size:.9rem;color:#fff;line-height:1;'+(t.up?'text-transform:uppercase;letter-spacing:-.02em':'')+'">Colorado</div></div>'; }
  renderSettings(){
    var p=document.getElementById('settingsPanel'), self=this, t=this.THEMES[this.sel];
    var seg=function(label,opts,cur,cb){ var id='seg'+label.replace(/\W/g,''); return '<div><div style="'+self.ms('.52rem','.14em','#8a8578')+'margin-bottom:8px">'+label+'</div><div data-seg="'+id+'" style="display:flex;gap:5px;flex-wrap:wrap">'+opts.map(function(o,i){ var on=i===cur; return '<button data-i="'+i+'" style="cursor:pointer;font-family:inherit;font-size:.74rem;font-weight:600;border-radius:8px;padding:7px 11px;border:1px solid '+(on?'transparent':'rgba(217,183,121,.25)')+';background:'+(on?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'transparent')+';color:'+(on?'#0e0e0c':'#c3c8d0')+'">'+o+'</button>'; }).join('')+'</div></div>'; };
    var framings=['Mounted','Full-bleed','Film','Gallery'], fmap=['mount','bleed','film','gallery'];
    var curFrame=fmap.indexOf(this.S.framing||t.frame); if(curFrame<0)curFrame=0;
    var grp=function(icon,label,inner){ return '<div style="background:rgba(255,255,255,.025);border:1px solid rgba(217,183,121,.13);border-radius:14px;padding:15px 16px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:13px"><span style="font-size:.82rem;opacity:.85">'+icon+'</span><span style="font-family:\'Space Mono\',monospace;font-size:.54rem;letter-spacing:.18em;text-transform:uppercase;color:#c7ba9e">'+label+'</span></div>'+inner+'</div>'; };
    var row=function(label,ctrl){ return '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0"><span style="font-size:.85rem;color:#d8d2c4">'+label+'</span>'+ctrl+'</div>'; };
    var tog=function(id,on){ return '<button id="'+id+'" style="cursor:pointer;position:relative;width:44px;height:24px;border-radius:999px;border:none;flex:none;background:'+(on?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'rgba(255,255,255,.12)')+'"><span style="position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .3s;transform:translateX('+(on?'20px':'0')+')"></span></button>'; };
    p.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div style="font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:1.4rem;color:#f4f1ea">Design</div><span style="font-family:\'Space Mono\',monospace;font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;color:#7fe3a6">'+this.THEMES[this.sel].name+'</span></div>'
      +grp('🖼','Layout', seg('Photo framing',framings,curFrame)+'<div style="height:14px"></div>'+seg('Photos / page',['One','Two','Grid'],[1,2,4].indexOf(this.S.photos)<0?0:[1,2,4].indexOf(this.S.photos)))
      +grp('🎨','Look','<div style="'+this.ms('.52rem','.14em','#8a8578')+'margin-bottom:9px">Accent</div><div id="accentRow" style="display:flex;gap:8px;flex-wrap:wrap"></div>'
        +'<div style="'+this.ms('.52rem','.14em','#8a8578')+'margin:15px 0 8px">Type scale · <span id="tsVal" style="color:#c7ba9e">'+Math.round(this.S.typeScale*100)+'%</span></div><input id="tsRange" type="range" min="0.85" max="1.3" step="0.05" value="'+this.S.typeScale+'" style="width:100%">'
        +'<div style="height:6px"></div>'+row('Black &amp; white',tog('grayTog',(this.S.gray!==null?this.S.gray:t.gray)))+row('Ribbon bookmark',tog('ribTog',this.S.ribbon)))
      +grp('✍️','Cover text','<input id="setTitle" value="'+this.S.title.replace(/"/g,'&quot;')+'" style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.22);border-radius:10px;padding:11px 13px;color:#f4f1ea;font-family:\'Cormorant Garamond\',serif;font-size:1.05rem;outline:none"><div style="height:9px"></div><input id="setDed" value="'+this.S.ded.replace(/"/g,'&quot;')+'" style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(217,183,121,.22);border-radius:10px;padding:11px 13px;color:#d8d2c4;font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:.98rem;outline:none">')
      +grp('📖','Print & bind', seg('Print size',['8×8"','10×10"','12×12"'],this.S.print)+'<div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:13px;padding-top:12px;border-top:1px solid rgba(217,183,121,.12)"><span style="font-size:.82rem;color:#8a8578">Hardcover · '+this.PRINTS[this.S.print][0]+'</span><span style="font-family:\'Cormorant Garamond\',serif;font-size:1.5rem;color:#e8cf9a">'+this.PRINTS[this.S.print][1]+'</span></div>');
    // accents
    var ar=document.getElementById('accentRow'), curAcc=this.S.accent||t.accent;
    ar.innerHTML=this.ACCENTS.map(function(c){ var on=c===curAcc; return '<button data-c="'+c+'" style="cursor:pointer;width:26px;height:26px;border-radius:50%;background:'+c+';border:2px solid '+(on?'#fff':'transparent')+';box-shadow:0 0 0 1px rgba(217,183,121,.3)"></button>'; }).join('');
    ar.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ self.S.accent=b.getAttribute('data-c'); self.bookDirty=true; self.renderSettings(); }; });
    // framing seg
    p.querySelector('[data-seg="segPhotoframing"]').querySelectorAll('button').forEach(function(b){ b.onclick=function(){ self.S.framing=fmap[+b.getAttribute('data-i')]; self.bookDirty=true; self.renderSettings(); }; });
    // print seg
    p.querySelector('[data-seg="segPrintsize"]').querySelectorAll('button').forEach(function(b){ b.onclick=function(){ self.S.print=+b.getAttribute('data-i'); self.renderSettings(); }; });
    // photos-per-page seg
    var ppMap=[1,2,4];
    p.querySelector('[data-seg="segPhotospage"]').querySelectorAll('button').forEach(function(b){ b.onclick=function(){ self.S.photos=ppMap[+b.getAttribute('data-i')]; self.bookDirty=true; self.renderSettings(); }; });
    document.getElementById('tsRange').oninput=function(e){ self.S.typeScale=+e.target.value; document.getElementById('tsVal').textContent=Math.round(self.S.typeScale*100)+'%'; self.bookDirty=true; };
    document.getElementById('grayTog').onclick=function(){ var cur=self.S.gray!==null?self.S.gray:t.gray; self.S.gray=!cur; self.bookDirty=true; self.renderSettings(); };
    document.getElementById('ribTog').onclick=function(){ self.S.ribbon=!self.S.ribbon; self.bookDirty=true; self.renderSettings(); };
    document.getElementById('setTitle').oninput=function(e){ self.S.title=e.target.value; self.bookDirty=true; self.renderPreview(); };
    document.getElementById('setDed').oninput=function(e){ self.S.ded=e.target.value; self.bookDirty=true; self.renderPreview(); };
    document.getElementById('tsRange').addEventListener('input',function(){ self.renderPreview(); });
    this.renderPreview();
  }
  renderPreview(){
    var box=document.getElementById('livePreview'); if(!box) return;
    var t=this.T(), self=this;
    document.getElementById('previewMeta').textContent=this.THEMES[this.sel].name+' · '+(this.S.framing||t.frame)+' · '+this.PRINTS[this.S.print][0];
    var tog=document.getElementById('pvToggle');
    if(tog){ tog.textContent=this.pvOpen?'Close book':'Open book'; tog.onclick=function(){ self.pvOpen=!self.pvOpen; self.renderPreview(); }; }
    var pv=document.getElementById('pvPrev'), nx=document.getElementById('pvNext'), lab=document.getElementById('pvLabel'), dots=document.getElementById('pvDots'), cnt=document.getElementById('pvCount');
    // CLOSED — show the hardcover front only
    if(!this.pvOpen){
      if(lab) lab.textContent='Cover';
      if(pv) pv.style.visibility='hidden';
      if(nx) nx.style.visibility='hidden';
      if(dots) dots.innerHTML='';
      if(cnt) cnt.textContent='Closed · tap Open book';
      box.innerHTML='<div style="position:relative;width:min(300px,72%)"><div style="position:relative;aspect-ratio:3/4;border-radius:3px 8px 8px 3px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(0,0,0,.9),9px 0 0 -2px rgba(0,0,0,.3),15px 0 0 -5px rgba(0,0,0,.16)">'+this.coverHTML()+'</div><div style="position:absolute;left:0;top:0;bottom:0;width:12px;background:linear-gradient(90deg,rgba(0,0,0,.5),transparent);border-radius:3px 0 0 3px"></div></div>';
      this.hydrate(box);
      return;
    }
    if(pv) pv.style.visibility='visible';
    if(nx) nx.style.visibility='visible';
    // build spreads fresh so the preview reflects every setting, and turn pages within it
    var spreads=this.buildSpreads();
    if(this.pIdx==null) this.pIdx=0;
    if(this.pIdx>=spreads.length) this.pIdx=spreads.length-1;
    if(this.pIdx<0) this.pIdx=0;
    var s=spreads[this.pIdx];
    var lab=document.getElementById('pvLabel'); if(lab) lab.textContent=s.lab||('Spread '+(this.pIdx+1));
    var creaseL='<div style="position:absolute;top:0;bottom:0;right:0;width:22%;pointer-events:none;z-index:4;background:linear-gradient(90deg,transparent,rgba(0,0,0,.16))"></div>';
    var creaseR='<div style="position:absolute;top:0;bottom:0;left:0;width:22%;pointer-events:none;z-index:4;background:linear-gradient(270deg,transparent,rgba(0,0,0,.16))"></div>';
    var edgeL='<div style="position:absolute;top:6px;bottom:6px;left:-5px;width:5px;border-radius:2px 0 0 2px;background:repeating-linear-gradient(180deg,#e8dcc6,#e8dcc6 1px,#d8c9ac 1px,#d8c9ac 2px)"></div>';
    var edgeR='<div style="position:absolute;top:6px;bottom:6px;right:-5px;width:5px;border-radius:0 2px 2px 0;background:repeating-linear-gradient(180deg,#e8dcc6,#e8dcc6 1px,#d8c9ac 1px,#d8c9ac 2px)"></div>';
    box.innerHTML='<div style="position:relative;width:min(560px,100%)">'
      +edgeL+edgeR
      +'<div style="position:relative;padding:9px;background:linear-gradient(120deg,#2a2a26,#141412);border-radius:6px 8px 8px 6px;box-shadow:0 40px 80px -34px rgba(0,0,0,.85)">'
        +'<div style="position:relative;display:grid;grid-template-columns:1fr 1fr;border-radius:2px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)">'
          +'<div style="position:relative;overflow:hidden;aspect-ratio:3/4;background:'+t.bg+'">'+s.l+creaseL+this.pageNum(this.pIdx*2+1)+'</div>'
          +'<div style="position:relative;overflow:hidden;aspect-ratio:3/4;background:'+t.bg+'">'+s.r+creaseR+this.pageNum(this.pIdx*2+2,true)+'</div>'
          +'<div style="position:absolute;top:0;bottom:0;left:50%;width:16px;transform:translateX(-50%);pointer-events:none;z-index:6;background:linear-gradient(90deg,transparent,rgba(0,0,0,.28) 48%,rgba(0,0,0,.28) 52%,transparent)"></div>'
          +'<div style="position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-50%);pointer-events:none;z-index:7;background:rgba(0,0,0,.35)"></div>'
          +(this.S.ribbon?'<div style="position:absolute;top:-9px;left:calc(50% + 30px);width:13px;height:96px;background:linear-gradient(#e8cf9a,#c9a35f);z-index:8;clip-path:polygon(0 0,100% 0,100% 100%,50% 84%,0 100%);box-shadow:0 5px 10px -3px rgba(0,0,0,.5)"></div>':'')
        +'</div>'
      +'</div>'
      +'<div style="position:absolute;left:6%;right:6%;bottom:-14px;height:22px;background:radial-gradient(60% 100% at 50% 0,rgba(0,0,0,.5),transparent 70%);filter:blur(4px);z-index:-1"></div>'
      +'</div>';
    var pv=document.getElementById('pvPrev'), nx=document.getElementById('pvNext');
    if(pv){ pv.style.opacity=this.pIdx===0?'.35':'1'; pv.onclick=function(){ if(self.pIdx>0){ self.pIdx--; self.renderPreview(); } }; }
    if(nx){ nx.style.opacity=this.pIdx>=spreads.length-1?'.35':'1'; nx.onclick=function(){ if(self.pIdx<spreads.length-1){ self.pIdx++; self.renderPreview(); } }; }
    var dots=document.getElementById('pvDots');
    if(dots){ dots.innerHTML=spreads.map(function(sp,k){ var on=k===self.pIdx; return '<button data-k="'+k+'" title="'+(sp.lab||'')+'" style="cursor:pointer;width:'+(on?'22px':'9px')+';height:9px;border-radius:999px;border:none;background:'+(on?'linear-gradient(120deg,#e8cf9a,#c9a35f)':'rgba(217,183,121,.3)')+';transition:width .3s,background .3s"></button>'; }).join('');
      dots.querySelectorAll('button').forEach(function(b){ b.onclick=function(){ self.pIdx=+b.getAttribute('data-k'); self.renderPreview(); }; }); }
    var cnt=document.getElementById('pvCount');
    if(cnt) cnt.textContent='Spread '+(this.pIdx+1)+' of '+spreads.length+' · '+(spreads.length*2)+' pages';
    this.hydrate(box);
  }

  /* ---- STEP 3 OPENABLE BOOK ---- */
  enterBook(){
    document.getElementById('orderPrice').textContent=this.PRINTS[this.S.print][1];
    if(this.bookDirty){ this.spreads=this.buildSpreads(); this.bookDirty=false; }
    // reset to closed
    this.open=false; this.idx=0;
    document.getElementById('coverArt').innerHTML=this.coverHTML();
    var book=document.getElementById('book'); book.style.transition='transform 1.1s cubic-bezier(.5,0,.2,1)'; book.style.transform='translateX(-25%)';
    document.getElementById('pageL').style.visibility='hidden';
    document.getElementById('spine').style.opacity='0'; document.getElementById('ribbon').style.opacity='0';
    var cov=document.getElementById('cover'); cov.style.transform='none'; cov.style.opacity='1'; cov.style.pointerEvents='auto';
    document.getElementById('bookStatus').textContent='Tap the cover to open';
    document.getElementById('pageLabel').textContent='Cover';
    this.hydrateAll();
  }
  fs(px){ return (px*this.S.typeScale).toFixed(2)+'rem'; }
  coverEntry(){ return this.entries.find(function(e){return e.type==='Remember this';})||this.entries.find(function(e){return e.type==='Gateway town';})||this.entries[this.entries.length-1]||this.entries[0]; }
  coverHTML(){ var t=this.T();
    return this.entryImg(this.coverEntry()||{q:this.SEED[3].q},'position:absolute;inset:0;width:100%;height:100%;object-fit:cover'+(t.gray?';filter:grayscale(1)':''))
      +'<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.05) 36%,rgba(0,0,0,.74))"></div><div style="position:absolute;left:0;top:0;bottom:0;width:12px;background:linear-gradient(90deg,rgba(0,0,0,.4),transparent)"></div>'
      +'<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:clamp(20px,5%,38px);text-align:center"><div style="'+this.ms('.54rem','.24em','rgba(255,255,255,.9)')+'">Trip Book — '+this.THEMES[this.sel].name+'</div><div><div style="width:30px;height:2px;background:'+t.accent+';margin:0 auto 14px"></div><h1 style="font-family:'+t.title+';font-weight:'+t.tw+';font-size:'+this.fs(2.4)+';line-height:1;color:#fff;'+(t.up?'text-transform:uppercase;letter-spacing:-.03em':'')+'">'+this.S.title+'</h1><div style="'+this.ms('.56rem','.16em','rgba(255,255,255,.85)')+'margin-top:12px">'+this.S.dates+'</div></div><div style="'+this.ms('.5rem','.14em','rgba(255,255,255,.6)')+'">'+this.TRIP.edition+'</div></div>';
  }
  frameWrap(inner,i){ var t=this.T();
    if(t.frame==='mount'||t.frame==='gallery') return '<div style="position:absolute;inset:0;padding:16px"><div style="position:relative;width:100%;height:100%;background:#fffdf8;padding:9px 9px 26px;box-shadow:0 16px 34px -18px rgba(0,0,0,.4);transform:rotate('+(i%2?'0.7':'-0.7')+'deg)"><div style="position:relative;width:100%;height:100%;overflow:hidden;background:#e8decb">'+inner+'</div></div></div>';
    if(t.frame==='film') return '<div style="position:absolute;inset:0;padding:14px;background:#111"><div style="position:relative;width:100%;height:100%;overflow:hidden;outline:2px solid '+t.accent+';outline-offset:-2px">'+inner+'</div></div>';
    if(t.frame==='glow') return '<div style="position:absolute;inset:0;box-shadow:inset 0 0 60px -10px rgba(217,183,121,.4)">'+inner+'</div>';
    return '<div style="position:absolute;inset:0">'+inner+'</div>';
  }
  photoPage(e,i){ var t=this.T(), self=this, n=this.S.photos||1;
    var gray='object-fit:cover'+(t.gray?';filter:grayscale(1) contrast(1.05)':'');
    if(n===1) return this.frameWrap(this.entryImg(e,'position:absolute;inset:0;width:100%;height:100%;'+gray),i);
    // collage: this entry + neighbours from the pool
    var pool=this.entries, imgs=[];
    for(var k=0;k<n;k++){ imgs.push(pool[(i+k)%pool.length]); }
    var cols=n===2?'1fr':'1fr 1fr', rows=n===2?'1fr 1fr':'1fr 1fr';
    var cells=imgs.map(function(en){ return '<div style="position:relative;overflow:hidden;background:#e8decb">'+self.entryImg(en,'position:absolute;inset:0;width:100%;height:100%;'+gray)+'</div>'; }).join('');
    var grid='<div style="position:absolute;inset:0;display:grid;grid-template-columns:'+cols+';grid-template-rows:'+rows+';gap:'+(t.frame==='film'?'3px':'6px')+';padding:'+(t.frame==='mount'||t.frame==='gallery'?'16px':t.frame==='film'?'14px':'0')+';'+(t.frame==='film'?'background:#111':t.frame==='mount'||t.frame==='gallery'?'background:'+t.bg:'')+'">'+cells+'</div>';
    return grid;
  }
  storyPage(e,i){ var t=this.T(),cap=e.cap||'A quiet moment on the road.',dc=cap.charAt(0),rest=cap.slice(1);
    return '<div style="position:absolute;inset:0;padding:clamp(20px,4%,38px);display:flex;flex-direction:column;justify-content:center;background:'+t.bg+'"><div style="'+this.ms('.5rem','.16em',t.accent)+'">'+e.type+' · '+e.place+'</div><p style="font-family:'+t.story+';font-weight:500;font-size:'+this.fs(1.15)+';line-height:1.5;'+(t.si?'font-style:italic;':'')+'color:'+t.ink+';margin-top:14px"><span style="float:left;font-family:\'Cormorant Garamond\',serif;font-weight:600;font-size:'+this.fs(2.8)+';line-height:.7;padding:6px 9px 0 0;color:'+t.accent+'">'+dc+'</span>'+rest+'</p><div style="clear:both;display:flex;gap:12px;margin-top:14px;padding-top:10px;border-top:1px solid '+t.soft+';'+this.ms('.5rem','.1em',t.soft)+'"><span>◷ '+e.time+'</span><span style="color:'+t.accent+'">'+e.w+'</span></div></div>';
  }
  titlePage(){ var t=this.T(); return '<div style="position:absolute;inset:0;padding:clamp(20px,4%,38px);display:flex;flex-direction:column;justify-content:center;text-align:center;background:'+t.bg+'"><div style="'+this.ms('.5rem','.18em',t.accent)+'">'+(this.TRIP.region||'The Colorado Plateau')+'</div><div style="font-family:'+t.title+';font-weight:'+t.tw+';font-size:'+this.fs(1.7)+';line-height:1.05;margin-top:12px;color:'+t.ink+';'+(t.up?'text-transform:uppercase':'')+'">'+this.S.title+'</div><div style="width:40px;height:1px;background:'+t.soft+';margin:16px auto"></div><p style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:'+this.fs(1.1)+';color:'+t.soft+'">'+this.S.ded+'</p></div>'; }
  dedPage(){ var t=this.T(); return '<div style="position:absolute;inset:0;padding:clamp(20px,4%,38px);display:flex;flex-direction:column;justify-content:center;text-align:center;background:'+t.bg+'"><div style="'+this.ms('.5rem','.2em',t.soft)+'">Dedication</div><p style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-weight:500;font-size:'+this.fs(1.5)+';line-height:1.35;color:'+t.ink+';margin-top:14px">'+this.S.ded+'</p></div>'; }
  orderPage(){ var t=this.T(); return '<div style="position:absolute;inset:0;padding:clamp(20px,4%,38px);display:flex;flex-direction:column;justify-content:center;text-align:center;background:'+(t.frame==='bleed'?'#0b0b0d':'rgba(0,0,0,.03)')+';color:'+(t.frame==='bleed'?'#fff':t.ink)+'"><div style="'+this.ms('.5rem','.18em',t.accent)+'">The end · for now</div><h3 style="font-family:'+t.title+';font-weight:'+t.tw+';font-size:'+this.fs(1.6)+';margin-top:10px;'+(t.up?'text-transform:uppercase':'')+'">Hold it in<br>your hands</h3><div style="'+this.ms('.5rem','.12em',t.soft)+'margin-top:12px">'+this.PRINTS[this.S.print][0]+' hardcover · '+this.PRINTS[this.S.print][1]+'</div></div>'; }
  buildSpreads(){ var self=this,sp=[],ent=this.entries;
    sp.push({l:this.titlePage(), r:this.photoPage(this.coverEntry(),0), lab:'Opening'});
    ent.forEach(function(e,i){ var nextPhoto=ent[i+1]; if(i<ent.length-1){ sp.push({l:self.storyPage(e,i), r:self.photoPage(nextPhoto,i+1), lab:e.type}); } else { sp.push({l:self.storyPage(e,i), r:self.dedPage(), lab:e.type}); } });
    sp.push({l:this.orderPage(), r:'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:'+this.T().bg+';'+this.ms('.5rem','.16em',this.T().soft)+'">Back cover · Park Buddy</div>', lab:'The end'});
    return sp;
  }
  pageNum(n,right){ return '<span style="position:absolute;bottom:12px;'+(right?'right:16px':'left:16px')+';z-index:4;'+this.ms('.48rem','.1em',this.T().soft)+'">'+n+'</span>'; }
  renderSpread(i){ var s=this.spreads[i]; document.getElementById('pageL').innerHTML=s.l+this.pageNum(i*2+1); document.getElementById('pageR').innerHTML=s.r+this.pageNum(i*2+2,true); document.getElementById('pageLabel').textContent=this.open?(s.lab+' · '+(i+1)+'/'+this.spreads.length):'Cover'; this.hydrateAll(); }
  openBook(){ if(this.open)return; this.open=true; document.getElementById('book').style.transform='translateX(0)'; document.getElementById('pageL').style.visibility='visible'; document.getElementById('spine').style.opacity='1'; if(this.S.ribbon)document.getElementById('ribbon').style.opacity='1'; this.renderSpread(0); document.getElementById('cover').style.transform='rotateY(-158deg)'; document.getElementById('bookStatus').textContent='Use ‹ › or the arrow keys to turn pages'; var self=this; setTimeout(function(){ var c=document.getElementById('cover'); c.style.pointerEvents='none'; c.style.opacity='0'; },1100); }
  flip(dir){ if(!this.open||this.anim)return; var ni=this.idx+dir; if(ni<0||ni>=this.spreads.length)return; this.anim=true; var self=this;
    // Robust page-turn: crossfade the spread in place — the same swap the Step 2
    // preview uses. The old 3D rotateY "leaf" ghosted (the outgoing image lingered
    // on the facing page) and janked on slower devices; a plain opacity swap doesn't.
    var pl=document.getElementById('pageL'), pr=document.getElementById('pageR'); if(!pl||!pr){ this.anim=false; return; }
    var leaf=document.getElementById('leaf'); if(leaf){ leaf.style.display='none'; leaf.innerHTML=''; }
    pl.style.transition=pr.style.transition='opacity .16s ease'; pl.style.opacity=pr.style.opacity='0';
    setTimeout(function(){ self.idx=ni; self.renderSpread(ni); pl.style.opacity=pr.style.opacity='1'; self.anim=false; },160);
  }

  wire(){ var self=this;
    document.getElementById('topAction').onclick=function(){ if(self.step<2)self.setStep(self.step+1); else self.toast('Added to cart — '+self.THEMES[self.sel].name+' · '+self.PRINTS[self.S.print][0]+' ✓'); };
    document.getElementById('saveMoment').onclick=function(){ self.saveMoment(); };
    document.getElementById('cover').onclick=function(){ self.openBook(); };
    document.getElementById('next').onclick=function(){ if(!self.open){self.openBook();return;} self.flip(1); };
    document.getElementById('prev').onclick=function(){ self.flip(-1); };
    document.getElementById('pageR').addEventListener('click',function(){ if(self.open)self.flip(1); });
    document.getElementById('pageL').addEventListener('click',function(){ if(self.open)self.flip(-1); });
    document.getElementById('orderBtn').onclick=function(){ self.toast('Added to cart — '+self.THEMES[self.sel].name+' · '+self.PRINTS[self.S.print][0]+' ✓'); };
    document.getElementById('closeBook').onclick=function(){ self.enterBook(); };
    var tt=document.getElementById('themeToggle');
    if(tt) tt.onclick=function(){ var w=document.getElementById('themeWrap'),ch=document.getElementById('themeChevron'); var open=w.style.display!=='none'; w.style.display=open?'none':'block'; ch.style.transform=open?'none':'rotate(180deg)'; };
    document.addEventListener('keydown',function(e){ if(self._dead||self.step!==2)return; if(!document.getElementById('book'))return; if(e.key==='ArrowRight'){ if(!self.open)self.openBook(); else self.flip(1);} if(e.key==='ArrowLeft')self.flip(-1); });
    // scroll / wheel turns pages
    var st=document.getElementById('stage'), acc=0, lock=false;
    st.addEventListener('wheel',function(e){ if(self.step!==2)return; e.preventDefault(); if(self.anim||lock)return; acc+=e.deltaY; if(Math.abs(acc)>55){ if(!self.open){ self.openBook(); } else { self.flip(acc>0?1:-1); } acc=0; lock=true; setTimeout(function(){lock=false;},260); } },{passive:false});
    // swipe on touch
    var sx=0; st.addEventListener('touchstart',function(e){ sx=e.touches[0].clientX; },{passive:true});
    st.addEventListener('touchend',function(e){ if(self.step!==2||self.anim)return; var dx=e.changedTouches[0].clientX-sx; if(Math.abs(dx)<40)return; if(!self.open){self.openBook();return;} self.flip(dx<0?1:-1); },{passive:true});
  }
  reveal(){ if(!('IntersectionObserver' in window)){ document.querySelectorAll('.st-rev').forEach(function(el){el.classList.add('st-in');}); return; } if(!this._io)this._io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)e.target.classList.add('st-in');});},{threshold:.12}); var io=this._io; document.querySelectorAll('.st-rev:not(.st-in)').forEach(function(el){io.observe(el);}); }
  toast(msg){ var t=document.getElementById('st-toast'); if(!t){ t=document.createElement('div'); t.id='st-toast'; t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);z-index:200;background:#f4f1ea;color:#0e0e0c;font-size:.84rem;font-weight:700;padding:11px 18px;border-radius:999px;box-shadow:0 16px 40px -16px rgba(0,0,0,.6);opacity:0;transition:opacity .3s,transform .3s;pointer-events:none'; document.body.appendChild(t); } t.textContent=msg; t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; },2400); }

  /* photo pipeline — server-cached /api/photo (Wikipedia/Wikimedia + NPS) */
  hydrate(scope){ var self=this; scope.querySelectorAll('img[data-wiki]').forEach(function(img,i){ var w=img.getAttribute('data-wiki'); if(img.getAttribute('data-done')===w||img.getAttribute('data-loading')==='1')return; self.loadWiki(img,w,0,i*40); }); }
  // Resolve one book photo. CRITICAL: only stamp data-done on SUCCESS — the old code
  // set it up-front, so a single transient failure (a 500/503 during the burst of
  // spread photos) permanently left that frame blank with no retry. Now failures
  // retry with backoff and re-attempt on the next render, so interior pages fill in.
  loadWiki(img,w,attempt,delay){ var self=this; setTimeout(function(){ if(self._dead||!img.isConnected)return; if(img.getAttribute('data-wiki')!==w)return; img.setAttribute('data-loading','1');
    fetch('/api/photo?q='+encodeURIComponent(w)+'&w=1200&v=6').then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(d&&d.found&&(d.image||d.thumb)){ img.removeAttribute('data-loading'); img.setAttribute('data-done',w); img.onload=function(){img.style.opacity='1';}; img.onerror=function(){img.style.opacity='0';}; img.src=d.image||d.thumb; return; }
      img.removeAttribute('data-loading'); if(attempt<3) self.loadWiki(img,w,attempt+1,700*(attempt+1)); // transient/miss → back off & retry
    }).catch(function(){ img.removeAttribute('data-loading'); if(attempt<3) self.loadWiki(img,w,attempt+1,700*(attempt+1)); });
  }, delay); }
  hydrateAll(){ this.hydrate(document); }
}


  var __studio = new Studio();
  __studio.REAL = data || null;
  __studio.componentDidMount();
  return __studio;
}
