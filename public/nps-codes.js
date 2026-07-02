/* ParkBuddy — NPS park codes → official map links.
   Lets us link straight to each park's official NPS map page WITHOUT the API.
   window.PB_NPS_MAP(parkName) → "https://www.nps.gov/<code>/planyourvisit/maps.htm" (or "" if unknown). */
(function () {
  if (window.PB_NPS_MAP) return;
  var CODES = {
    acadia: 'acad', arches: 'arch', badlands: 'badl', bigbend: 'bibe', biscayne: 'bisc',
    blackcanyonofthegunnison: 'blca', brycecanyon: 'brca', canyonlands: 'cany', capitolreef: 'care',
    carlsbadcaverns: 'cave', channelislands: 'chis', congaree: 'cong', craterlake: 'crla',
    cuyahogavalley: 'cuva', deathvalley: 'deva', denali: 'dena', drytortugas: 'drto', everglades: 'ever',
    gatesofthearctic: 'gaar', gatewayarch: 'jeff', glacier: 'glac', glacierbay: 'glba', grandcanyon: 'grca',
    grandteton: 'grte', greatbasin: 'grba', greatsanddunes: 'grsa', greatsmokymountains: 'grsm',
    guadalupemountains: 'gumo', haleakala: 'hale', hawaiivolcanoes: 'havo', hotsprings: 'hosp',
    indianadunes: 'indu', isleroyale: 'isro', joshuatree: 'jotr', katmai: 'katm', kenaifjords: 'kefj',
    kingscanyon: 'seki', kobukvalley: 'kova', lakeclark: 'lacl', lassenvolcanic: 'lavo', mammothcave: 'maca',
    mesaverde: 'meve', mountrainier: 'mora', newrivergorge: 'neri', northcascades: 'noca', olympic: 'olym',
    petrifiedforest: 'pefo', pinnacles: 'pinn', redwood: 'redw', rockymountain: 'romo', saguaro: 'sagu',
    sequoia: 'seki', shenandoah: 'shen', theodoreroosevelt: 'thro', virginislands: 'viis', voyageurs: 'voya',
    whitesands: 'whsa', windcave: 'wica', wrangellstelias: 'wrst', yellowstone: 'yell', yosemite: 'yose',
    zion: 'zion', nationalparkofamericansamoa: 'npsa', americansamoa: 'npsa', newrivergorgenationalparkpreserve: 'neri'
  };
  function norm(n) { return String(n || '').toLowerCase().replace(/national park.*$/, '').replace(/&/g, 'and').replace(/[^a-z]/g, ''); }
  window.PB_NPS_CODE = function (name) { return CODES[norm(name)] || ''; };
  window.PB_NPS_MAP = function (name) { var c = CODES[norm(name)]; return c ? ('https://www.nps.gov/' + c + '/planyourvisit/maps.htm') : ''; };
})();
