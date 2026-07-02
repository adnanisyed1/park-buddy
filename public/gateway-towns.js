/* Park Buddy — gateway / adventure towns for major national parks.
   Curated basecamp towns (the place you actually stay, eat, gas up, and outfit).
   window.PB_GATEWAY(parkName) -> { town, blurb, lat, lng } | null  */
(function () {
  if (window.PB_GATEWAY) return;
  var T = {
    zion: { town: "Springdale, UT", blurb: "Walkable gateway at the south entrance \u2014 lodges, cafes & outfitters, shuttle to the canyon.", lat: 37.1888, lng: -112.9986 },
    grandcanyon: { town: "Tusayan / Grand Canyon Village, AZ", blurb: "South Rim basecamp \u2014 lodging, IMAX, and the park shuttle hub.", lat: 35.9803, lng: -112.1235 },
    yosemite: { town: "Mariposa / El Portal, CA", blurb: "Historic Gold Rush towns on the way to the valley \u2014 lodging & supplies.", lat: 37.4849, lng: -119.9663 },
    yellowstone: { town: "West Yellowstone, MT", blurb: "Bustling west-entrance town \u2014 lodging, dining, gear & geyser access.", lat: 44.6621, lng: -111.1041 },
    grandteton: { town: "Jackson, WY", blurb: "Iconic mountain town \u2014 antler arches, dining, and Teton trailheads minutes away.", lat: 43.4799, lng: -110.7624 },
    rockymountain: { town: "Estes Park, CO", blurb: "Classic Rockies basecamp \u2014 riverwalk, lodging, and the east-entrance gateway.", lat: 40.3772, lng: -105.5217 },
    arches: { town: "Moab, UT", blurb: "Adventure hub for Arches & Canyonlands \u2014 4x4, rafting, biking & nightlife.", lat: 38.5733, lng: -109.5498 },
    canyonlands: { town: "Moab, UT", blurb: "Off-road and river capital \u2014 outfitters for every kind of desert adventure.", lat: 38.5733, lng: -109.5498 },
    bryce: { town: "Bryce Canyon City / Tropic, UT", blurb: "Small high-elevation gateway \u2014 lodging right by the hoodoos.", lat: 37.6705, lng: -112.1573 },
    brycecanyon: { town: "Bryce Canyon City / Tropic, UT", blurb: "Small high-elevation gateway \u2014 lodging right by the hoodoos.", lat: 37.6705, lng: -112.1573 },
    glacier: { town: "Whitefish / West Glacier, MT", blurb: "Lake town basecamp \u2014 lodging, dining and Going-to-the-Sun access.", lat: 48.4111, lng: -114.3376 },
    acadia: { town: "Bar Harbor, ME", blurb: "Coastal village gateway \u2014 lobster, inns, and the park loop road.", lat: 44.3876, lng: -68.2039 },
    greatsmoky: { town: "Gatlinburg / Townsend, TN", blurb: "Smoky Mountains basecamp \u2014 lodging, dining, and trailhead access.", lat: 35.7143, lng: -83.5102 },
    greatsmokymountains: { town: "Gatlinburg / Townsend, TN", blurb: "Smoky Mountains basecamp \u2014 lodging, dining, and trailhead access.", lat: 35.7143, lng: -83.5102 },
    joshuatree: { town: "Joshua Tree / Twentynine Palms, CA", blurb: "Funky high-desert towns \u2014 artsy lodging, gear, and dark-sky access.", lat: 34.1347, lng: -116.3131 },
    sequoia: { town: "Three Rivers, CA", blurb: "Foothill gateway to the giant forest \u2014 lodging & the south entrance.", lat: 36.4386, lng: -118.9023 },
    kingscanyon: { town: "Three Rivers, CA", blurb: "Foothill gateway \u2014 lodging on the way to the big trees & canyon.", lat: 36.4386, lng: -118.9023 },
    olympic: { town: "Port Angeles, WA", blurb: "Harbor-town basecamp \u2014 ferry, lodging, and Hurricane Ridge access.", lat: 48.1181, lng: -123.4307 },
    mountrainier: { town: "Ashford, WA", blurb: "Forest gateway at the Nisqually entrance \u2014 cabins & lodges.", lat: 46.7593, lng: -122.0331 },
    shenandoah: { town: "Luray, VA", blurb: "Valley town basecamp \u2014 caverns, lodging, and Skyline Drive access.", lat: 38.6651, lng: -78.4594 },
    deathvalley: { town: "Furnace Creek, CA", blurb: "In-park oasis \u2014 the basecamp for the hottest, lowest park.", lat: 36.4642, lng: -116.8694 },
    capitolreef: { town: "Torrey, UT", blurb: "Tiny scenic-byway town \u2014 lodging, pie, and the west entrance.", lat: 38.2989, lng: -111.4194 },
    saguaro: { town: "Tucson, AZ", blurb: "Desert city basecamp \u2014 splits Saguaro's east & west districts.", lat: 32.2226, lng: -110.9747 },
    badlands: { town: "Wall, SD", blurb: "Roadside gateway \u2014 Wall Drug, lodging, and the loop road.", lat: 43.9933, lng: -102.2411 },
    grandtetons: { town: "Jackson, WY", blurb: "Iconic mountain town minutes from the Tetons.", lat: 43.4799, lng: -110.7624 },

    // --- National Forests (multi-town basecamps) ---
    whiterivernationalforest: {
      blurb: "Colorado's busiest national forest \u2014 world-class ski towns ring the Elk, Gore and Sawatch ranges, each a full-service basecamp.",
      towns: [
        { name: "Aspen, CO", lat: 39.1911, lng: -106.8175 },
        { name: "Vail, CO", lat: 39.6403, lng: -106.3742 },
        { name: "Glenwood Springs, CO", lat: 39.5505, lng: -107.3248 },
        { name: "Breckenridge, CO", lat: 39.4817, lng: -106.0384 },
        { name: "Frisco, CO", lat: 39.5744, lng: -106.0975 }
      ]
    },
    sanjuannationalforest: {
      blurb: "The rugged San Juan Mountains \u2014 historic mining towns turned adventure hubs, ringed by 13ers and alpine trailheads.",
      towns: [
        { name: "Durango, CO", lat: 37.2753, lng: -107.8801 },
        { name: "Silverton, CO", lat: 37.8119, lng: -107.6645 },
        { name: "Ouray, CO", lat: 38.0228, lng: -107.6712 },
        { name: "Telluride, CO", lat: 37.9375, lng: -107.8123 },
        { name: "Pagosa Springs, CO", lat: 37.2695, lng: -107.0098 }
      ]
    },
    grandmesauncompahgreandgunnisonnationalforests: {
      blurb: "Basecamps for the Uncompahgre high country and the West Elks \u2014 box canyons, hot springs and wildflower passes.",
      towns: [
        { name: "Telluride, CO", lat: 37.9375, lng: -107.8123 },
        { name: "Ouray, CO", lat: 38.0228, lng: -107.6712 },
        { name: "Ridgway, CO", lat: 38.1533, lng: -107.7573 },
        { name: "Crested Butte, CO", lat: 38.8697, lng: -106.9878 },
        { name: "Gunnison, CO", lat: 38.5458, lng: -106.9253 }
      ]
    }
  };
  function norm(n) { return String(n || "").toLowerCase().replace(/national park.*$|national preserve.*$/, "").replace(/&/g, "and").replace(/[^a-z]/g, ""); }
  window.PB_GATEWAY = function (name) { return T[norm(name)] || null; };
})();
