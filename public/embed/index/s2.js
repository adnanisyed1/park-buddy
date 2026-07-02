
(function(){
  var SEL='.card,.pcard,.pchip,.heroimg,.tdcard,.bitem,.feat,.wxcard,.revitem,.tripitem,.ppb-pcard';
  var cur=null;
  function reset(el){ if(el){ el.style.transition='transform .35s cubic-bezier(.2,.7,.2,1)'; el.style.transform=''; el.style.zIndex=''; } }
  function ok(el){ return el && !el.querySelector('input,textarea,select'); }
  document.addEventListener('pointermove',function(e){
    if(e.pointerType==='touch') return;
    var el=e.target.closest(SEL);
    if(!ok(el)) el=null;
    if(el!==cur){ reset(cur); cur=el; if(el){ el.style.zIndex='6'; } }
    if(!el) return;
    var r=el.getBoundingClientRect();
    var px=(e.clientX-r.left)/r.width-0.5, py=(e.clientY-r.top)/r.height-0.5;
    var small=el.classList.contains('pchip')||el.classList.contains('ppb-pcard');
    var max=small?6:9, lift=small?4:8;
    el.style.transition='transform 70ms linear';
    el.style.transform='perspective(900px) rotateX('+(-py*max).toFixed(2)+'deg) rotateY('+(px*max).toFixed(2)+'deg) translateY(-'+lift+'px) scale('+(small?1.04:1.03)+')';
  },{passive:true});
  window.addEventListener('blur',function(){reset(cur);cur=null;});
  document.addEventListener('pointerleave',function(){reset(cur);cur=null;},true);
})();
