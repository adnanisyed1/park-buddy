/* ParkBuddy — America's Byways (the FHWA National Scenic Byways + the elite
   All-American Roads). Core fields are real federal designation data: name,
   tier, states, length, and the intrinsic qualities each was designated for.
   Coordinates are approximate route centers (used for the map + geotagged
   photos, like forest-data.js). A flagship set carries hand-authored highlight
   overlooks (with real coordinates) + curated film captions; every other drive
   derives its highlights/photos from real data at render. No invented ratings.
   Source: Federal Highway Administration, America's Byways. */
window.BYWAYS_DATA=[
{
  "id":"going-to-the-sun","name":"Going-to-the-Sun Road","tier":"all-american",
  "region":"Rockies","regionLabel":"Northern Rockies","states":"Montana","sub":"Glacier National Park",
  "length":"50 mi","lengthMi":50,"time":"~2 hrs","lat":48.696,"lng":-113.718,"parkCode":"glac",
  "qualities":["Scenic","Natural","Historic"],
  "blurb":"A National Historic Landmark of engineering, Going-to-the-Sun Road threads 50 miles across the spine of Glacier National Park — from the forested shores of Lake McDonald, up the cliff-hung Garden Wall, over Logan Pass at 6,646 feet on the Continental Divide, and down to St. Mary Lake. Completed in 1932, it was the first road in the U.S. registered as a National Historic Civil Engineering Landmark.",
  "season":"Late June – mid-October","mapCap":"Lake McDonald → Logan Pass → St. Mary",
  "planNote":"The alpine section over Logan Pass is only fully open from roughly late June to mid-October, weather permitting — plowing the Big Drift can take crews until late spring. Vehicle-reservation and timed-entry systems apply in peak season; start early and use the free park shuttle to skip the Logan Pass lot.",
  "link":"https://www.nps.gov/glac/planyourvisit/goingtothesunroad.htm",
  "wiki":["Going-to-the-Sun Road","Logan Pass","Saint Mary Lake"],
  "film":[
    {"q":["Lake McDonald"],"cap":"Lake McDonald — the western gateway"},
    {"q":["Going-to-the-Sun Road","Garden Wall (Montana)"],"cap":"The Garden Wall traverse"},
    {"q":["Logan Pass"],"cap":"Logan Pass on the Continental Divide"},
    {"q":["Saint Mary Lake","Wild Goose Island"],"cap":"Wild Goose Island, St. Mary Lake"},
    {"q":["Jackson Glacier"],"cap":"Jackson Glacier overlook"}
  ],
  "highlights":[
    {"n":"Lake McDonald","q":["Lake McDonald"],"d":"Glacier's largest lake and the road's western start","lat":48.611,"lng":-113.876},
    {"n":"The Loop","q":["Going-to-the-Sun Road"],"d":"The single switchback climbing toward the pass","lat":48.762,"lng":-113.777},
    {"n":"Logan Pass","q":["Logan Pass"],"d":"6,646 ft on the Divide — wildflowers and goats","lat":48.696,"lng":-113.718},
    {"n":"Jackson Glacier Overlook","q":["Jackson Glacier"],"d":"The most visible glacier from the road","lat":48.669,"lng":-113.648},
    {"n":"Wild Goose Island","q":["Wild Goose Island","Saint Mary Lake"],"d":"The iconic islet on St. Mary Lake","lat":48.667,"lng":-113.573}
  ]
},
{
  "id":"trail-ridge","name":"Trail Ridge Road","tier":"all-american",
  "region":"Rockies","regionLabel":"Southern Rockies","states":"Colorado","sub":"Rocky Mountain National Park",
  "length":"48 mi","lengthMi":48,"time":"~2 hrs","lat":40.393,"lng":-105.68,"parkCode":"romo",
  "qualities":["Scenic","Natural","Historic"],
  "blurb":"Trail Ridge Road is the highest continuous paved road in the United States, cresting at 12,183 feet as it crosses Rocky Mountain National Park between Estes Park and Grand Lake. Eleven miles of the route run above treeline through fragile alpine tundra, with pullouts overlooking the Never Summer Mountains and the headwaters of the Colorado River.",
  "season":"Late May – mid-October","mapCap":"Estes Park → Alpine Visitor Center → Grand Lake",
  "planNote":"The high tundra section closes with the first heavy snows and reopens after Memorial Day plowing. Afternoon lightning is a real hazard above treeline — cross the exposed stretch in the morning, and stop at the Alpine Visitor Center for the highest facilities in the park.",
  "link":"https://www.nps.gov/romo/planyourvisit/trail_ridge_road.htm",
  "wiki":["Trail Ridge Road","Rocky Mountain National Park","Never Summer Mountains"],
  "film":[
    {"q":["Trail Ridge Road"],"cap":"Above the treeline on Trail Ridge"},
    {"q":["Forest Canyon"],"cap":"Forest Canyon overlook"},
    {"q":["Never Summer Mountains"],"cap":"The Never Summer Range"},
    {"q":["Rocky Mountain National Park"],"cap":"Alpine tundra at 12,000 ft"}
  ],
  "highlights":[
    {"n":"Many Parks Curve","q":["Rocky Mountain National Park"],"d":"Sweeping view back over the valleys","lat":40.393,"lng":-105.62},
    {"n":"Forest Canyon Overlook","q":["Forest Canyon"],"d":"A glacial gorge from the tundra rim","lat":40.392,"lng":-105.69},
    {"n":"Alpine Visitor Center","q":["Alpine Visitor Center"],"d":"Highest visitor center in the NPS","lat":40.441,"lng":-105.754},
    {"n":"Milner Pass","q":["Milner Pass"],"d":"The Continental Divide at Poudre Lake","lat":40.421,"lng":-105.812}
  ]
},
{
  "id":"blue-ridge","name":"Blue Ridge Parkway","tier":"all-american",
  "region":"East","regionLabel":"Appalachians","states":"Virginia · North Carolina","sub":"Shenandoah → Great Smokies",
  "length":"469 mi","lengthMi":469,"time":"Multi-day","lat":36.01,"lng":-81.62,"parkCode":"blri",
  "qualities":["Scenic","Natural","Historic","Cultural","Recreational"],
  "blurb":"“America's Favorite Drive” runs 469 miles along the crest of the Blue Ridge, connecting Shenandoah National Park to Great Smoky Mountains National Park. Free of commercial traffic and stoplights, the Parkway rolls past split-rail fences, restored mountain farms, and mile after mile of layered blue ridgelines, with overlooks numbered by milepost the whole way.",
  "season":"Year-round (spring–fall best)","mapCap":"Shenandoah → Blue Ridge crest → Great Smokies",
  "planNote":"Sections close in winter ice and for landslide repairs — check the real-time road map before you go. Fall color peaks from north to south through October; the Linn Cove Viaduct and the highlands around Mount Mitchell are the most photographed stretches.",
  "link":"https://www.nps.gov/blri/planyourvisit/index.htm",
  "wiki":["Linn Cove Viaduct","Mount Mitchell","Grandfather Mountain"],
  "film":[
    {"q":["Blue Ridge Parkway"],"cap":"Layered ridgelines from the crest"},
    {"q":["Linn Cove Viaduct"],"cap":"The Linn Cove Viaduct"},
    {"q":["Mount Mitchell"],"cap":"Mount Mitchell — highest peak in the East"},
    {"q":["Mabry Mill"],"cap":"Mabry Mill, milepost 176"}
  ],
  "highlights":[
    {"n":"Linn Cove Viaduct","q":["Linn Cove Viaduct"],"d":"The engineering marvel around Grandfather Mountain","lat":36.096,"lng":-81.809},
    {"n":"Mabry Mill","q":["Mabry Mill"],"d":"The most photographed spot on the Parkway","lat":36.752,"lng":-80.406},
    {"n":"Mount Mitchell","q":["Mount Mitchell"],"d":"Highest summit east of the Mississippi","lat":35.765,"lng":-82.265},
    {"n":"Craggy Gardens","q":["Craggy Gardens"],"d":"Rhododendron balds above Asheville","lat":35.699,"lng":-82.38}
  ]
},
{"id":"beartooth","name":"Beartooth Highway","tier":"all-american","region":"Rockies","regionLabel":"Northern Rockies","states":"Montana · Wyoming","sub":"Gateway to Yellowstone","length":"68 mi","lengthMi":68,"time":"~3 hrs","lat":45.0,"lng":-109.47,"parkCode":"yell","qualities":["Scenic","Natural","Recreational"],"blurb":"US 212 switchbacks to 10,947 feet at Beartooth Pass, a high-alpine roller-coaster of glacial cirques, tarns, and snowfields between Red Lodge, Montana, and the Northeast Entrance of Yellowstone. Often called the most beautiful drive in America, it's only open from late May into October.","season":"Late May – mid-October","link":"https://www.fhwa.dot.gov/byways/byways/2126","wiki":["Beartooth Highway","Beartooth Pass"]},
{"id":"san-juan-skyway","name":"San Juan Skyway","tier":"all-american","region":"Rockies","regionLabel":"Southern Rockies","states":"Colorado","sub":"Durango · Silverton · Telluride","length":"233 mi","lengthMi":233,"time":"Full day","lat":37.81,"lng":-107.66,"qualities":["Scenic","Historic","Cultural"],"blurb":"A 233-mile loop through the San Juan Mountains linking old mining towns, alpine passes, and the cliff dwellings of Mesa Verde. The stretch of US 550 known as the Million Dollar Highway hangs on ledges above the Uncompahgre Gorge with no guardrails.","season":"Year-round (passes may close in winter)","link":"https://www.fhwa.dot.gov/byways/byways/2181","wiki":["San Juan Skyway","Million Dollar Highway","Red Mountain Pass"]},
{"id":"scenic-byway-12","name":"Scenic Byway 12","tier":"all-american","region":"Southwest","regionLabel":"Utah Canyon Country","states":"Utah","sub":"Bryce Canyon → Capitol Reef","length":"124 mi","lengthMi":124,"time":"Half day","lat":37.79,"lng":-111.43,"qualities":["Scenic","Historic","Natural","Archaeological"],"blurb":"“A Journey Through Time,” Utah's Highway 12 crosses slickrock desert, the hoodoos near Bryce Canyon, the Grand Staircase-Escalante backcountry, and the Hogback — a knife-edge ridge with sheer drops on both sides — before climbing over Boulder Mountain to Capitol Reef.","season":"Year-round","link":"https://www.fhwa.dot.gov/byways/byways/2182","wiki":["Utah State Route 12","Bryce Canyon National Park","Escalante, Utah"]},
{"id":"natchez-trace","name":"Natchez Trace Parkway","tier":"all-american","region":"South","regionLabel":"Deep South","states":"Mississippi · Alabama · Tennessee","sub":"Natchez → Nashville","length":"444 mi","lengthMi":444,"time":"Multi-day","lat":33.5,"lng":-88.0,"parkCode":"natr","qualities":["Scenic","Historic","Natural","Cultural","Archaeological","Recreational"],"blurb":"A 444-mile parkway tracing the ancient footpath used by Native Americans, “Kaintuck” boatmen, and post riders between Natchez, Mississippi, and Nashville, Tennessee. Commercial-free and speed-limited, it passes burial mounds, cypress swamps, and preserved sections of the sunken original Trace.","season":"Year-round","link":"https://www.nps.gov/natr/index.htm","wiki":["Natchez Trace Parkway","Natchez, Mississippi"]},
{"id":"overseas-highway","name":"Overseas Highway","tier":"all-american","region":"South","regionLabel":"Florida Keys","states":"Florida","sub":"Miami → Key West","length":"106 mi","lengthMi":106,"time":"~3 hrs","lat":24.72,"lng":-81.05,"qualities":["Scenic","Historic"],"blurb":"US 1 island-hops 106 miles across 42 bridges from the mainland to Key West, riding the old Florida East Coast Railway route over turquoise flats and open ocean. The Seven Mile Bridge is the signature span, with the Atlantic on one side and the Gulf on the other.","season":"Year-round","link":"https://www.fhwa.dot.gov/byways/byways/2091","wiki":["Overseas Highway","Seven Mile Bridge"]},
{"id":"seward-highway","name":"Seward Highway","tier":"all-american","region":"Alaska","regionLabel":"Southcentral Alaska","states":"Alaska","sub":"Anchorage → Seward","length":"127 mi","lengthMi":127,"time":"Half day","lat":60.7,"lng":-149.4,"qualities":["Scenic","Historic","Natural","Recreational"],"blurb":"From Anchorage to the fishing port of Seward, this 127-mile highway runs beside the tidal bore of Turnagain Arm, past hanging glaciers and Dall-sheep cliffs, into the Kenai Mountains and the edge of Kenai Fjords National Park.","season":"Year-round (winter conditions)","link":"https://www.fhwa.dot.gov/byways/byways/2166","wiki":["Seward Highway","Turnagain Arm"]},
{"id":"acadia-loop","name":"Acadia Park Loop Road","tier":"all-american","region":"East","regionLabel":"Maine Coast","states":"Maine","sub":"Acadia National Park","length":"27 mi","lengthMi":27,"time":"~1.5 hrs","lat":44.34,"lng":-68.21,"parkCode":"acad","qualities":["Scenic","Natural","Historic"],"blurb":"The Park Loop Road curls 27 miles around Mount Desert Island — pink-granite headlands at Thunder Hole and Otter Cliff, the sand of Sand Beach, and a spur to the 1,530-foot summit of Cadillac Mountain, the first place to see sunrise in the U.S. for part of the year.","season":"Mid-April – November","link":"https://www.nps.gov/acad/planyourvisit/driving.htm","wiki":["Park Loop Road","Cadillac Mountain","Acadia National Park"]},
{"id":"big-sur-coast","name":"Big Sur Coast Highway","tier":"all-american","region":"West","regionLabel":"California Coast","states":"California","sub":"Carmel → San Simeon","length":"72 mi","lengthMi":72,"time":"~3 hrs","lat":36.27,"lng":-121.81,"qualities":["Scenic"],"blurb":"The 72 miles of California Highway 1 through Big Sur ride a ledge between the Santa Lucia Mountains and the Pacific — Bixby Creek Bridge, McWay Falls dropping onto a cove beach, and turnout after turnout above the surf. Slide closures are a recurring fact of life here.","season":"Year-round (slide closures possible)","link":"https://www.fhwa.dot.gov/byways/byways/2081","wiki":["Big Sur","Bixby Creek Bridge","McWay Falls"]},
{"id":"red-rock","name":"Red Rock Scenic Byway","tier":"all-american","region":"Southwest","regionLabel":"Arizona Red Rock","states":"Arizona","sub":"Sedona","length":"7.5 mi","lengthMi":7.5,"time":"~30 min","lat":34.83,"lng":-111.77,"qualities":["Scenic"],"blurb":"State Route 179 south of Sedona is short but stunning — a “museum without walls” winding beneath Bell Rock, Courthouse Butte, and Cathedral Rock through the red sandstone of the Coconino National Forest.","season":"Year-round","link":"https://www.fhwa.dot.gov/byways/byways/2124","wiki":["Sedona, Arizona","Cathedral Rock","Bell Rock (Arizona)"]},
{"id":"skyline-drive","name":"Skyline Drive","tier":"national-scenic-byway","region":"East","regionLabel":"Virginia Blue Ridge","states":"Virginia","sub":"Shenandoah National Park","length":"105 mi","lengthMi":105,"time":"~3 hrs","lat":38.53,"lng":-78.35,"parkCode":"shen","qualities":["Scenic","Historic","Natural"],"blurb":"Skyline Drive runs 105 miles down the center of Shenandoah National Park along the Blue Ridge crest, with 75 overlooks over the Shenandoah Valley and Piedmont. A 35 mph ribbon best in fall, when the ridges turn gold and crimson.","season":"Year-round (may close in ice/snow)","link":"https://www.nps.gov/shen/planyourvisit/skyline-drive.htm","wiki":["Skyline Drive","Shenandoah National Park"]},
{"id":"cherohala-skyway","name":"Cherohala Skyway","tier":"national-scenic-byway","region":"East","regionLabel":"Southern Appalachians","states":"Tennessee · North Carolina","sub":"Tellico Plains → Robbinsville","length":"43 mi","lengthMi":43,"time":"~1.5 hrs","lat":35.34,"lng":-84.03,"qualities":["Scenic","Natural"],"blurb":"A 43-mile climb across the Unicoi Mountains between the Cherokee and Nantahala National Forests, topping out near 5,400 feet. Uncrowded, sinuous, and brilliant in fall — mile-high views with far fewer cars than the Smokies next door.","season":"Year-round (higher elevations icy in winter)","link":"https://www.fhwa.dot.gov/byways/byways/2135","wiki":["Cherohala Skyway"]},
{"id":"peter-norbeck","name":"Peter Norbeck Scenic Byway","tier":"national-scenic-byway","region":"Plains","regionLabel":"Black Hills","states":"South Dakota","sub":"Custer State Park · Mount Rushmore","length":"68 mi","lengthMi":68,"time":"~3 hrs","lat":43.79,"lng":-103.42,"qualities":["Scenic","Natural","Historic"],"blurb":"A 68-mile figure-eight through the Black Hills linking Mount Rushmore, the granite Needles, and the wildlife loop of Custer State Park — famous for pigtail bridges and one-lane tunnels framed precisely on the presidents' faces.","season":"Year-round (Needles Hwy closed in winter)","link":"https://www.fhwa.dot.gov/byways/byways/2160","wiki":["Peter Norbeck Scenic Byway","Needles Highway","Custer State Park"]},
{"id":"volcanic-legacy","name":"Volcanic Legacy Scenic Byway","tier":"all-american","region":"West","regionLabel":"Cascades","states":"Oregon · California","sub":"Crater Lake → Lassen","length":"500 mi","lengthMi":500,"time":"Multi-day","lat":42.94,"lng":-122.11,"parkCode":"crla","qualities":["Scenic","Natural"],"blurb":"A 500-mile corridor connecting the Cascade volcanoes — the impossibly blue caldera of Crater Lake, Mount Shasta, and the hydrothermal basins of Lassen Volcanic National Park — through forests, lava flows, and high lakes.","season":"Summer–fall (high sections snow-closed)","link":"https://www.fhwa.dot.gov/byways/byways/2189","wiki":["Crater Lake National Park","Mount Shasta","Lassen Volcanic National Park"]}
];
