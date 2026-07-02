
(function(){
  var D={"parks":[{"id":1,"name":"Denali","state":"Alaska","year":1917,"region":"alaska"},{"id":2,"name":"Gates of the Arctic","state":"Alaska","year":1980,"region":"alaska"},{"id":3,"name":"Glacier Bay","state":"Alaska","year":1980,"region":"alaska"},{"id":4,"name":"Katmai","state":"Alaska","year":1980,"region":"alaska"},{"id":5,"name":"Kenai Fjords","state":"Alaska","year":1980,"region":"alaska"},{"id":6,"name":"Kobuk Valley","state":"Alaska","year":1980,"region":"alaska"},{"id":7,"name":"Lake Clark","state":"Alaska","year":1980,"region":"alaska"},{"id":8,"name":"Wrangell\u2013St. Elias","state":"Alaska","year":1980,"region":"alaska"},{"id":9,"name":"Grand Canyon","state":"Arizona","year":1919,"region":"lower48"},{"id":10,"name":"Petrified Forest","state":"Arizona","year":1962,"region":"lower48"},{"id":11,"name":"Saguaro","state":"Arizona","year":1994,"region":"lower48"},{"id":12,"name":"Hot Springs","state":"Arkansas","year":1921,"region":"lower48"},{"id":13,"name":"Channel Islands","state":"California","year":1980,"region":"lower48"},{"id":14,"name":"Death Valley","state":"California","year":1994,"region":"lower48"},{"id":15,"name":"Joshua Tree","state":"California","year":1994,"region":"lower48"},{"id":16,"name":"Kings Canyon","state":"California","year":1940,"region":"lower48"},{"id":17,"name":"Lassen Volcanic","state":"California","year":1916,"region":"lower48"},{"id":18,"name":"Pinnacles","state":"California","year":2013,"region":"lower48"},{"id":19,"name":"Redwood","state":"California","year":1968,"region":"lower48"},{"id":20,"name":"Sequoia","state":"California","year":1890,"region":"lower48"},{"id":21,"name":"Yosemite","state":"California","year":1890,"region":"lower48"},{"id":22,"name":"Black Canyon of the Gunnison","state":"Colorado","year":1999,"region":"lower48"},{"id":23,"name":"Great Sand Dunes","state":"Colorado","year":2004,"region":"lower48"},{"id":24,"name":"Mesa Verde","state":"Colorado","year":1906,"region":"lower48"},{"id":25,"name":"Rocky Mountain","state":"Colorado","year":1915,"region":"lower48"},{"id":26,"name":"Biscayne","state":"Florida","year":1980,"region":"lower48"},{"id":27,"name":"Dry Tortugas","state":"Florida","year":1992,"region":"lower48"},{"id":28,"name":"Everglades","state":"Florida","year":1934,"region":"lower48"},{"id":29,"name":"Haleakal\u0101","state":"Hawaii","year":1916,"region":"hawaii"},{"id":30,"name":"Hawai'i Volcanoes","state":"Hawaii","year":1916,"region":"hawaii"},{"id":31,"name":"Indiana Dunes","state":"Indiana","year":2019,"region":"lower48"},{"id":32,"name":"Mammoth Cave","state":"Kentucky","year":1941,"region":"lower48"},{"id":33,"name":"Acadia","state":"Maine","year":1919,"region":"lower48"},{"id":34,"name":"Isle Royale","state":"Michigan","year":1940,"region":"lower48"},{"id":35,"name":"Voyageurs","state":"Minnesota","year":1975,"region":"lower48"},{"id":36,"name":"Gateway Arch","state":"Missouri","year":2018,"region":"lower48"},{"id":37,"name":"Glacier","state":"Montana","year":1910,"region":"lower48"},{"id":38,"name":"Great Basin","state":"Nevada","year":1986,"region":"lower48"},{"id":39,"name":"Carlsbad Caverns","state":"New Mexico","year":1930,"region":"lower48"},{"id":40,"name":"White Sands","state":"New Mexico","year":2019,"region":"lower48"},{"id":41,"name":"Great Smoky Mountains","state":"NC / Tennessee","year":1934,"region":"lower48"},{"id":42,"name":"Theodore Roosevelt","state":"North Dakota","year":1978,"region":"lower48"},{"id":43,"name":"Cuyahoga Valley","state":"Ohio","year":2000,"region":"lower48"},{"id":44,"name":"Crater Lake","state":"Oregon","year":1902,"region":"lower48"},{"id":45,"name":"Congaree","state":"South Carolina","year":2003,"region":"lower48"},{"id":46,"name":"Badlands","state":"South Dakota","year":1978,"region":"lower48"},{"id":47,"name":"Wind Cave","state":"South Dakota","year":1903,"region":"lower48"},{"id":48,"name":"Big Bend","state":"Texas","year":1944,"region":"lower48"},{"id":49,"name":"Guadalupe Mountains","state":"Texas","year":1966,"region":"lower48"},{"id":50,"name":"Arches","state":"Utah","year":1971,"region":"lower48"},{"id":51,"name":"Bryce Canyon","state":"Utah","year":1928,"region":"lower48"},{"id":52,"name":"Canyonlands","state":"Utah","year":1964,"region":"lower48"},{"id":53,"name":"Capitol Reef","state":"Utah","year":1971,"region":"lower48"},{"id":54,"name":"Zion","state":"Utah","year":1919,"region":"lower48"},{"id":55,"name":"Shenandoah","state":"Virginia","year":1935,"region":"lower48"},{"id":56,"name":"Mount Rainier","state":"Washington","year":1899,"region":"lower48"},{"id":57,"name":"North Cascades","state":"Washington","year":1968,"region":"lower48"},{"id":58,"name":"Olympic","state":"Washington","year":1938,"region":"lower48"},{"id":59,"name":"New River Gorge","state":"West Virginia","year":2020,"region":"lower48"},{"id":60,"name":"Grand Teton","state":"Wyoming","year":1929,"region":"lower48"},{"id":61,"name":"Yellowstone","state":"Wyoming","year":1872,"region":"lower48"},{"id":62,"name":"Virgin Islands","state":"U.S. Virgin Islands","year":1956,"region":"territory"},{"id":63,"name":"Nat. Park of American Samoa","state":"American Samoa","year":1988,"region":"territory"}],"questions":[{"id":"duration","agent":"Hi! I'm your ParkPulse planning assistant. \ud83c\udf32 A few quick questions and I'll suggest parks for your trip. How many days do you have?","options":["3\u20134 days","5\u20137 days","8\u201314 days","2+ weeks"]},{"id":"region","agent":"Which region pulls at you most?","options":["Southwest","Pacific Northwest","California","Rocky Mountains","East & Southeast","Alaska","Hawaii","Anywhere \u2014 surprise me"]},{"id":"experience","agent":"What kind of experience are you after?","options":["Epic hiking","Wildlife & photography","Scenic drives","Unique geology","History & culture","A mix"]},{"id":"fitness","agent":"What's your energy level for this trip?","options":["Easy walks","Moderate hikes","Strenuous full-day hikes","Backcountry / multi-day"]},{"id":"priority","agent":"Last one \u2014 what matters most?","options":["Avoid crowds","Iconic landmarks","Max parks visited","Deep in fewer parks","Best photos"]}],"cats":{"hiking":[21,54,50,37,56,25,33,57,58,60,9,22,51,52,53,55,59,44,48],"wildlife":[61,37,4,1,34,28,42,60,7,29,30,44,48,27,35],"scenic":[9,61,50,54,21,51,60,44,48,33,37,56,58,55,23,29,30],"geology":[50,51,52,53,9,23,22,39,40,10,17,61,38,48,30,46,47],"history":[24,36,12,32,31,43,10,55,33,45],"iconic":[9,21,54,61,50,37,60,29,33,56,25,51,48,44,30],"offBeat":[2,6,34,35,38,42,45,49,59,22,7,3,8,57,18,47],"photo":[50,51,9,21,60,37,44,54,29,30,56,33,23,14]},"rp":{"Southwest":[9,10,11,39,40,50,51,52,53,54],"Pacific Northwest":[56,57,58],"California":[13,14,15,16,17,18,19,20,21],"Rocky Mountains":[22,23,24,25,37,38,60,61],"East":[31,32,33,34,35,36,41,43,45,55,59,12,26,27,28],"Alaska":[1,2,3,4,5,6,7,8],"Hawaii":[29,30]}}, Q=D.questions, CATS=D.cats, RP=D.rp, PARKS=D.parks;
  var byId={}; PARKS.forEach(function(p){byId[p.id]=p;});
  var step=0, ans={}, started=false;
  var fab=document.getElementById('ppb-fab'), panel=document.getElementById('ppb-panel'), body=document.getElementById('ppb-body');
  function scroll(){body.scrollTop=body.scrollHeight;}
  function agent(t){var d=document.createElement('div');d.className='ppb-a';d.innerHTML='<span class="av">🌲</span><div class="bub">'+t+'</div>';body.appendChild(d);scroll();}
  function you(t){var d=document.createElement('div');d.className='ppb-u';d.innerHTML='<div class="bub">'+t+'</div>';body.appendChild(d);scroll();}
  function ask(){
    if(step>=Q.length){finish();return;}
    var q=Q[step];
    agent(q.agent);
    var wrap=document.createElement('div');wrap.className='ppb-opts';
    q.options.forEach(function(opt){var b=document.createElement('button');b.textContent=opt;
      b.onclick=function(){ans[q.id]=opt;you(opt);wrap.remove();step++;setTimeout(ask,160);};
      wrap.appendChild(b);});
    body.appendChild(wrap);scroll();
  }
  function recommend(){
    var score={};PARKS.forEach(function(p){score[p.id]=0;});
    function bump(ids,pts){ids.forEach(function(id){score[id]=(score[id]||0)+pts;});}
    var rKey=(ans.region||'').split(' ')[0];
    var rMap={"Southwest":"Southwest","Pacific":"Pacific Northwest","California":"California","Rocky":"Rocky Mountains","East":"East","Alaska":"Alaska","Hawaii":"Hawaii"};
    if(rMap[rKey])bump(RP[rMap[rKey]]||[],5);
    var e=ans.experience||'';
    if(e.indexOf('hiking')>-1)bump(CATS.hiking,3);
    else if(e.indexOf('Wildlife')>-1)bump(CATS.wildlife,3);
    else if(e.indexOf('Scenic')>-1)bump(CATS.scenic,3);
    else if(e.indexOf('geology')>-1)bump(CATS.geology,3);
    else if(e.indexOf('History')>-1)bump(CATS.history,3);
    else bump(CATS.iconic,2);
    var f=ans.fitness||'';if(f.indexOf('Easy')>-1)bump([1,2,6,57,8],-3);
    var pr=ans.priority||'';
    if(pr.indexOf('crowds')>-1){bump(CATS.offBeat,3);bump([21,9,54,61],-2);}
    if(pr.indexOf('Iconic')>-1)bump(CATS.iconic,3);
    if(pr.indexOf('photos')>-1||pr.indexOf('photo')>-1)bump(CATS.photo,3);
    var dur=ans.duration||'';var max=dur.indexOf('3')>-1?3:dur.indexOf('5')>-1?4:dur.indexOf('8')>-1?6:8;
    var ranked=PARKS.filter(function(p){return score[p.id]>0;}).sort(function(a,b){return score[b.id]-score[a.id];});
    if(!ranked.length)ranked=CATS.iconic.map(function(id){return byId[id];}).filter(Boolean);
    return ranked.slice(0,max);
  }
  function finish(){
    agent("Here's a starting itinerary based on your answers:");
    var picks=recommend();
    picks.forEach(function(p){var d=document.createElement('div');d.className='ppb-pcard';
      d.innerHTML='<b>'+p.name+'</b><div class="s">'+p.state+' · est. '+p.year+'</div><a href="/park-status?park='+p.id+'">View live status →</a>';
      body.appendChild(d);});
    var act=document.createElement('div');act.className='ppb-act';
    act.innerHTML='<a class="p" href="/plan">Open full planner →</a><button class="g" id="ppb-restart">Start over</button>';
    body.appendChild(act);
    document.getElementById('ppb-restart').onclick=function(){step=0;ans={};body.innerHTML='';ask();};
    scroll();
  }
  function openPanel(){panel.classList.add('open');fab.classList.add('hide');if(!started){started=true;ask();}}
  function closePanel(){panel.classList.remove('open');panel.classList.remove('pinned');document.body.classList.remove('ppb-pinned-pad');fab.classList.remove('hide');}
  function togglePin(){var on=panel.classList.toggle('pinned');document.body.classList.toggle('ppb-pinned-pad',on);}
  fab.onclick=openPanel;
  document.getElementById('ppb-close').onclick=closePanel;
  document.getElementById('ppb-pin').onclick=togglePin;
})();
