/* ParkBuddy — About page motion: scroll reveals, parallax hero, count-up stats,
   sticky-nav solidify. Runs in the embed pipeline. */
(function(){
  function ridge(){
    var r=document.getElementById('ridge'); if(!r)return;
    r.style.height='52%';
    r.innerHTML=
      '<div style="position:absolute;left:-6%;right:-6%;bottom:0;height:70%;background:#2c5d52;opacity:.55;clip-path:polygon(0 60%,18% 44%,34% 56%,52% 38%,70% 54%,86% 42%,100% 56%,100% 100%,0 100%)"></div>'+
      '<div style="position:absolute;left:-6%;right:-6%;bottom:0;height:50%;background:#173f30;opacity:.9;clip-path:polygon(0 70%,22% 58%,44% 70%,64% 56%,82% 66%,100% 58%,100% 100%,0 100%)"></div>'+
      '<div style="position:absolute;left:-6%;right:-6%;bottom:0;height:34%;background:#0f2c20;clip-path:polygon(0 60%,30% 50%,60% 60%,100% 50%,100% 100%,0 100%)"></div>';
  }

  function reveal(){
    var els=[].slice.call(document.querySelectorAll('.rv'));
    if(!('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
    var io=new IntersectionObserver(function(ents){
      ents.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); if(en.target.querySelector&&en.target.matches('.stat'))countOne(en.target); io.unobserve(en.target);} });
    },{threshold:.18,rootMargin:'0px 0px -8% 0px'});
    els.forEach(function(e){ if(!e.classList.contains('in'))io.observe(e); });
    // also kick off any stats already in view
    document.querySelectorAll('.stat').forEach(function(s){var r=s.getBoundingClientRect();if(r.top<innerHeight)countOne(s);});
  }

  function countOne(stat){
    var b=stat.querySelector('b[data-count]'); if(!b||b._done)return; b._done=true;
    var target=+b.getAttribute('data-count'), suffix=b.getAttribute('data-suffix')||'';
    var t0=null, dur=1400;
    function step(ts){ t0=t0||ts; var p=Math.min(1,(ts-t0)/dur); var e=1-Math.pow(1-p,3);
      b.textContent=Math.round(target*e)+suffix; if(p<1)requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }

  function nav(){
    var n=document.getElementById('nav'); if(!n)return;
    function on(){ n.classList.toggle('solid', (window.scrollY||document.documentElement.scrollTop)>40); }
    window.addEventListener('scroll',on,{passive:true}); on();
  }

  function parallax(){
    var sun=document.querySelector('.hero-sun'), rg=document.getElementById('ridge'), sky=document.querySelector('.hero-sky');
    window.addEventListener('scroll',function(){
      var y=window.scrollY||document.documentElement.scrollTop;
      if(sun)sun.style.transform='translateY('+(y*.35)+'px)';
      if(rg)rg.style.transform='translateY('+(y*.12)+'px)';
      if(sky)sky.style.transform='translateY('+(y*.05)+'px)';
    },{passive:true});
  }

  function boot(){ ridge(); reveal(); nav(); parallax();
    // safety net: ensure everything is visible even if observers never fire
    setTimeout(function(){document.querySelectorAll('.rv').forEach(function(e){e.classList.add('in');});document.querySelectorAll('.stat').forEach(countOne);},2600);
  }
  if(document.getElementById('nav')){boot();} else {document.addEventListener('DOMContentLoaded',boot);}
})();
