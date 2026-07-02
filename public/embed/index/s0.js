
const D = {"parks": [{"id": 1, "name": "Denali", "state": "Alaska", "year": 1917, "lat": 63.1148, "lng": -151.1926, "region": "alaska", "desc": "North America's highest peak at 20,310 ft, surrounded by six million acres of wild subarctic wilderness."}, {"id": 2, "name": "Gates of the Arctic", "state": "Alaska", "year": 1980, "lat": 67.7806, "lng": -153.3006, "region": "alaska", "desc": "The northernmost US national park \u2014 entirely roadless and trailless. Pure arctic wilderness above the Arctic Circle."}, {"id": 3, "name": "Glacier Bay", "state": "Alaska", "year": 1980, "lat": 58.6658, "lng": -136.9002, "region": "alaska", "desc": "A UNESCO World Heritage Site where massive tidewater glaciers calve directly into the sea."}, {"id": 4, "name": "Katmai", "state": "Alaska", "year": 1980, "lat": 58.5, "lng": -154.0, "region": "alaska", "desc": "World-famous for brown bears catching sockeye salmon at Brooks Falls. Home of the Valley of Ten Thousand Smokes."}, {"id": 5, "name": "Kenai Fjords", "state": "Alaska", "year": 1980, "lat": 59.9187, "lng": -150.1533, "region": "alaska", "desc": "Exit Glacier and the vast Harding Icefield drain into stunning coastal fjords teeming with marine wildlife."}, {"id": 6, "name": "Kobuk Valley", "state": "Alaska", "year": 1980, "lat": 67.3561, "lng": -159.1229, "region": "alaska", "desc": "An arctic sand dune field 25 miles long surrounded by the Brooks Range. No roads exist anywhere in the park."}, {"id": 7, "name": "Lake Clark", "state": "Alaska", "year": 1980, "lat": 60.9728, "lng": -153.4169, "region": "alaska", "desc": "Where the Alaska Range meets the Alaska Peninsula \u2014 wild salmon rivers, volcanic peaks, and critical brown bear habitat."}, {"id": 8, "name": "Wrangell\u2013St. Elias", "state": "Alaska", "year": 1980, "lat": 61.4937, "lng": -142.6028, "region": "alaska", "desc": "America's largest national park \u2014 bigger than Switzerland \u2014 with nine of the 16 highest peaks in the US."}, {"id": 9, "name": "Grand Canyon", "state": "Arizona", "year": 1919, "lat": 36.0544, "lng": -112.1401, "region": "lower48", "desc": "A mile deep, ten miles wide, 277 river miles long \u2014 one of Earth's most sublime geological wonders."}, {"id": 10, "name": "Petrified Forest", "state": "Arizona", "year": 1962, "lat": 34.9828, "lng": -109.788, "region": "lower48", "desc": "Ancient logs turned to rainbow crystal over 225 million years, scattered across the Painted Desert badlands."}, {"id": 11, "name": "Saguaro", "state": "Arizona", "year": 1994, "lat": 32.2967, "lng": -111.1666, "region": "lower48", "desc": "The giant saguaro cactus \u2014 icon of the American Southwest \u2014 lives here up to 200 years, growing its first arm after 75."}, {"id": 12, "name": "Hot Springs", "state": "Arkansas", "year": 1921, "lat": 34.5217, "lng": -93.0424, "region": "lower48", "desc": "Forty-seven naturally hot thermal springs flow from Hot Springs Mountain along the historic Bathhouse Row."}, {"id": 13, "name": "Channel Islands", "state": "California", "year": 1980, "lat": 34.0069, "lng": -119.7785, "region": "lower48", "desc": "Five islands off Southern California \u2014 the 'Gal\u00e1pagos of North America' \u2014 preserving a rare Mediterranean island ecosystem."}, {"id": 14, "name": "Death Valley", "state": "California", "year": 1994, "lat": 36.5323, "lng": -116.9325, "region": "lower48", "desc": "The hottest, driest, lowest national park. Badwater Basin at 282 ft below sea level is North America's lowest point."}, {"id": 15, "name": "Joshua Tree", "state": "California", "year": 1994, "lat": 33.8734, "lng": -115.901, "region": "lower48", "desc": "Where the Mojave and Colorado deserts collide. Otherworldly Joshua trees and sculpted boulders under impossibly clear skies."}, {"id": 16, "name": "Kings Canyon", "state": "California", "year": 1940, "lat": 36.8879, "lng": -118.5551, "region": "lower48", "desc": "One of the deepest canyons in North America \u2014 deeper than the Grand Canyon \u2014 carved by the Kings River through the Sierra Nevada."}, {"id": 17, "name": "Lassen Volcanic", "state": "California", "year": 1916, "lat": 40.4977, "lng": -121.4207, "region": "lower48", "desc": "Boiling springs, fumaroles, mud pots, and a recently active volcano. The southernmost Cascade peak, alive with geothermal energy."}, {"id": 18, "name": "Pinnacles", "state": "California", "year": 2013, "lat": 36.4906, "lng": -121.1825, "region": "lower48", "desc": "Volcanic rock spires rising from a gentle valley, with talus cave systems and a sanctuary for the endangered California condor."}, {"id": 19, "name": "Redwood", "state": "California", "year": 1968, "lat": 41.2132, "lng": -124.0046, "region": "lower48", "desc": "Home to the world's tallest trees \u2014 coast redwoods exceeding 380 feet \u2014 in ancient forests draped in Northern California fog."}, {"id": 20, "name": "Sequoia", "state": "California", "year": 1890, "lat": 36.4864, "lng": -118.5658, "region": "lower48", "desc": "Home to General Sherman \u2014 the largest living tree on Earth by volume, 274 feet tall and roughly 2,200 years old."}, {"id": 21, "name": "Yosemite", "state": "California", "year": 1890, "lat": 37.8651, "lng": -119.5383, "region": "lower48", "desc": "El Capitan, Half Dome, Bridalveil Fall. A glacier-carved valley of incomparable beauty that launched American conservation."}, {"id": 22, "name": "Black Canyon of the Gunnison", "state": "Colorado", "year": 1999, "lat": 38.5754, "lng": -107.7416, "region": "lower48", "desc": "One of the world's most sheer gorges \u2014 2,700 feet deep but barely 40 feet wide at the Narrows."}, {"id": 23, "name": "Great Sand Dunes", "state": "Colorado", "year": 2004, "lat": 37.7325, "lng": -105.5945, "region": "lower48", "desc": "The tallest sand dunes in North America \u2014 up to 750 feet \u2014 backed by the snow-capped Sangre de Cristo Mountains."}, {"id": 24, "name": "Mesa Verde", "state": "Colorado", "year": 1906, "lat": 37.1853, "lng": -108.4896, "region": "lower48", "desc": "The best-preserved Ancestral Puebloan cliff dwellings in North America, including the 150-room Cliff Palace."}, {"id": 25, "name": "Rocky Mountain", "state": "Colorado", "year": 1915, "lat": 40.3428, "lng": -105.6836, "region": "lower48", "desc": "Trail Ridge Road crests at 12,183 feet through alpine tundra. The Continental Divide runs the length of the park."}, {"id": 26, "name": "Biscayne", "state": "Florida", "year": 1980, "lat": 25.4824, "lng": -80.43, "region": "lower48", "desc": "95% water \u2014 a turquoise paradise of coral reefs, mangroves, and tropical islands at the northern edge of the Florida Keys."}, {"id": 27, "name": "Dry Tortugas", "state": "Florida", "year": 1992, "lat": 24.6283, "lng": -82.8733, "region": "lower48", "desc": "70 miles west of Key West, accessible only by boat or seaplane. Fort Jefferson rises from turquoise shallows above Florida's finest coral."}, {"id": 28, "name": "Everglades", "state": "Florida", "year": 1934, "lat": 25.2866, "lng": -80.8987, "region": "lower48", "desc": "The largest subtropical wilderness in the US \u2014 a 60-mile-wide, inch-deep river of water flowing south through sawgrass prairie."}, {"id": 29, "name": "Haleakal\u0101", "state": "Hawaii", "year": 1916, "lat": 20.7204, "lng": -156.1552, "region": "hawaii", "desc": "Maui's dormant shield volcano rises to 10,023 feet. Its summit crater hosts a moonscape of cinder cones and rare silversword plants."}, {"id": 30, "name": "Hawai'i Volcanoes", "state": "Hawaii", "year": 1916, "lat": 19.4194, "lng": -155.2885, "region": "hawaii", "desc": "K\u012blauea and Mauna Loa \u2014 two of Earth's most active volcanoes \u2014 are constantly reshaping the Big Island with new lava flows."}, {"id": 31, "name": "Indiana Dunes", "state": "Indiana", "year": 2019, "lat": 41.653, "lng": -87.0524, "region": "lower48", "desc": "Towering sand dunes rising 200 feet above Lake Michigan's southern shore, surrounding one of the most biodiverse national park landscapes."}, {"id": 32, "name": "Mammoth Cave", "state": "Kentucky", "year": 1941, "lat": 37.1862, "lng": -86.1003, "region": "lower48", "desc": "The world's longest known cave system \u2014 over 400 miles of explored passages beneath the karst landscape of south-central Kentucky."}, {"id": 33, "name": "Acadia", "state": "Maine", "year": 1919, "lat": 44.3386, "lng": -68.2733, "region": "lower48", "desc": "Rugged granite summits, cobblestone shores, and dense boreal forests on Mount Desert Island on the Atlantic coast of Maine."}, {"id": 34, "name": "Isle Royale", "state": "Michigan", "year": 1940, "lat": 48.0, "lng": -88.8327, "region": "lower48", "desc": "A remote island wilderness in Lake Superior, famous for the world's longest-running wolf and moose predator-prey study."}, {"id": 35, "name": "Voyageurs", "state": "Minnesota", "year": 1975, "lat": 48.4839, "lng": -92.8387, "region": "lower48", "desc": "A watery wilderness of four interconnected lakes and 500 islands along the Canadian border, best explored by houseboat or canoe."}, {"id": 36, "name": "Gateway Arch", "state": "Missouri", "year": 2018, "lat": 38.6247, "lng": -90.1851, "region": "lower48", "desc": "The iconic 630-foot stainless steel Gateway Arch on the St. Louis riverfront, commemorating Jefferson's vision of westward expansion."}, {"id": 37, "name": "Glacier", "state": "Montana", "year": 1910, "lat": 48.7596, "lng": -113.787, "region": "lower48", "desc": "Going-to-the-Sun Road traverses one of the most pristine alpine ecosystems in the world. Over 700 miles of trails through ice-carved terrain."}, {"id": 38, "name": "Great Basin", "state": "Nevada", "year": 1986, "lat": 38.9831, "lng": -114.3006, "region": "lower48", "desc": "Ancient bristlecone pines over 5,000 years old, the Lehman Caves marble system, and some of the darkest skies in the continental US."}, {"id": 39, "name": "Carlsbad Caverns", "state": "New Mexico", "year": 1930, "lat": 32.1479, "lng": -104.5567, "region": "lower48", "desc": "Over 119 caves beneath the Chihuahuan Desert, including the Big Room \u2014 8.2 acres at 750 feet underground."}, {"id": 40, "name": "White Sands", "state": "New Mexico", "year": 2019, "lat": 32.7791, "lng": -106.1717, "region": "lower48", "desc": "The world's largest gypsum dune field \u2014 275 square miles of brilliantly white sand formed from an ancient evaporated lake."}, {"id": 41, "name": "Great Smoky Mountains", "state": "NC / Tennessee", "year": 1934, "lat": 35.6532, "lng": -83.507, "region": "lower48", "desc": "America's most visited national park. Ancient mountains wreathed in blue mist with extraordinary biodiversity on both sides of the Appalachian crest."}, {"id": 42, "name": "Theodore Roosevelt", "state": "North Dakota", "year": 1978, "lat": 46.9789, "lng": -103.5387, "region": "lower48", "desc": "Colorful badlands carved by the Little Missouri River \u2014 the landscape that transformed Roosevelt and ignited his conservation mission."}, {"id": 43, "name": "Cuyahoga Valley", "state": "Ohio", "year": 2000, "lat": 41.2808, "lng": -81.5678, "region": "lower48", "desc": "A patchwork of forests, wetlands, and farms along the Cuyahoga River between Cleveland and Akron."}, {"id": 44, "name": "Crater Lake", "state": "Oregon", "year": 1902, "lat": 42.9446, "lng": -122.109, "region": "lower48", "desc": "The deepest lake in the US at 1,943 feet, filling the caldera of a collapsed volcano. Its water is the clearest and bluest imaginable."}, {"id": 45, "name": "Congaree", "state": "South Carolina", "year": 2003, "lat": 33.7948, "lng": -80.782, "region": "lower48", "desc": "The largest intact old-growth bottomland hardwood forest in the southeastern US, with some of the tallest trees east of the Mississippi."}, {"id": 46, "name": "Badlands", "state": "South Dakota", "year": 1978, "lat": 43.8554, "lng": -102.3397, "region": "lower48", "desc": "Sharply eroded buttes, spires, and gullies in an otherworldly landscape \u2014 home to bison, bighorn sheep, and black-footed ferrets."}, {"id": 47, "name": "Wind Cave", "state": "South Dakota", "year": 1903, "lat": 43.5569, "lng": -103.4784, "region": "lower48", "desc": "One of the world's longest cave systems, famous for rare boxwork formations covering the walls like a geometric honeycomb."}, {"id": 48, "name": "Big Bend", "state": "Texas", "year": 1944, "lat": 29.1275, "lng": -103.242, "region": "lower48", "desc": "Where the Chihuahuan Desert meets the Rio Grande. Remote, vast, brilliantly starlit \u2014 one of the best dark-sky parks in the US."}, {"id": 49, "name": "Guadalupe Mountains", "state": "Texas", "year": 1966, "lat": 31.923, "lng": -104.8714, "region": "lower48", "desc": "The remnant of an ancient Permian reef rising from the desert floor, containing the highest peak in Texas at 8,751 feet."}, {"id": 50, "name": "Arches", "state": "Utah", "year": 1971, "lat": 38.683, "lng": -109.5925, "region": "lower48", "desc": "Over 2,000 natural sandstone arches \u2014 the highest concentration on Earth \u2014 including the famous 65-foot Delicate Arch."}, {"id": 51, "name": "Bryce Canyon", "state": "Utah", "year": 1928, "lat": 37.593, "lng": -112.1871, "region": "lower48", "desc": "A geological amphitheater of thousands of hoodoos \u2014 orange, red, and white spires shaped by millennia of frost and erosion."}, {"id": 52, "name": "Canyonlands", "state": "Utah", "year": 1964, "lat": 38.2, "lng": -109.93, "region": "lower48", "desc": "A vast stone wilderness where the Colorado and Green rivers carve the Colorado Plateau into mesas, canyons, and soaring spires."}, {"id": 53, "name": "Capitol Reef", "state": "Utah", "year": 1971, "lat": 38.0877, "lng": -111.1495, "region": "lower48", "desc": "A 100-mile wrinkle in the Earth's crust \u2014 the Waterpocket Fold \u2014 concealing slot canyons, domes, and Fremont petroglyphs."}, {"id": 54, "name": "Zion", "state": "Utah", "year": 1919, "lat": 37.2982, "lng": -113.0263, "region": "lower48", "desc": "Sheer 2,000-foot walls of Navajo sandstone frame the Virgin River. Angels Landing, The Narrows, and Emerald Pools draw millions each year."}, {"id": 55, "name": "Shenandoah", "state": "Virginia", "year": 1935, "lat": 38.2928, "lng": -78.6795, "region": "lower48", "desc": "Skyline Drive winds 105 miles along the Blue Ridge crest, with 500 miles of trails through forest above the Shenandoah Valley."}, {"id": 56, "name": "Mount Rainier", "state": "Washington", "year": 1899, "lat": 46.8523, "lng": -121.7603, "region": "lower48", "desc": "An active stratovolcano draped in 26 named glaciers \u2014 the most glaciated peak in the contiguous US \u2014 rising 14,411 feet."}, {"id": 57, "name": "North Cascades", "state": "Washington", "year": 1968, "lat": 48.7718, "lng": -121.2985, "region": "lower48", "desc": "The American Alps \u2014 over 300 glaciers, jagged peaks, and dense wilderness seeing fewer visitors than almost any other national park."}, {"id": 58, "name": "Olympic", "state": "Washington", "year": 1938, "lat": 47.8021, "lng": -123.6044, "region": "lower48", "desc": "Three distinct ecosystems: glacier-capped peaks, the world's finest temperate rainforest, and a wild Pacific coastline \u2014 all in one park."}, {"id": 59, "name": "New River Gorge", "state": "West Virginia", "year": 2020, "lat": 38.0742, "lng": -80.9998, "region": "lower48", "desc": "One of the deepest Appalachian gorges \u2014 world-class whitewater, rock climbing, and one of the world's longest steel arch bridges."}, {"id": 60, "name": "Grand Teton", "state": "Wyoming", "year": 1929, "lat": 43.7904, "lng": -110.6818, "region": "lower48", "desc": "Cathedral-like granite peaks rise abruptly 7,000 feet above the sagebrush flats of Jackson Hole with no foothills to ease the drama."}, {"id": 61, "name": "Yellowstone", "state": "Wyoming", "year": 1872, "lat": 44.428, "lng": -110.5885, "region": "lower48", "desc": "The world's first national park. Half of Earth's geothermal features \u2014 including Old Faithful \u2014 sit above one of the largest active supervolcanoes."}, {"id": 62, "name": "Virgin Islands", "state": "U.S. Virgin Islands", "year": 1956, "lat": 18.3458, "lng": -64.7281, "region": "territory", "desc": "Crystalline turquoise bays, white sand beaches, and some of the Caribbean's finest coral reefs on the island of St. John."}, {"id": 63, "name": "Nat. Park of American Samoa", "state": "American Samoa", "year": 1988, "lat": -14.2592, "lng": -170.0807, "region": "territory", "desc": "The only US national park south of the equator \u2014 pristine ancient rainforest, coral reefs, and fruit bat colonies on tropical Samoan islands."}], "fips": {"01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY"}, "skip": ["09", "10", "11", "25", "33", "34", "44", "50"], "stateFips": {"Alaska": ["02"], "Arizona": ["04"], "Arkansas": ["05"], "California": ["06"], "Colorado": ["08"], "Florida": ["12"], "Hawaii": ["15"], "Indiana": ["18"], "Kentucky": ["21"], "Maine": ["23"], "Michigan": ["26"], "Minnesota": ["27"], "Missouri": ["29"], "Montana": ["30"], "NC / Tennessee": ["37", "47"], "Nevada": ["32"], "New Mexico": ["35"], "North Dakota": ["38"], "Ohio": ["39"], "Oregon": ["41"], "South Carolina": ["45"], "South Dakota": ["46"], "Texas": ["48"], "Utah": ["49"], "Virginia": ["51"], "Washington": ["53"], "West Virginia": ["54"], "Wyoming": ["56"], "U.S. Virgin Islands": [], "American Samoa": []}, "stateInfo": {"Alaska": "Alaska's eight national parks protect more wilderness than all other parks combined \u2014 vast, roadless, and spectacularly wild. From North America's highest peak to active volcanoes, glacial fjords, and untouched arctic tundra.", "Arizona": "Three parks showcase Arizona's geological grandeur: the Grand Canyon's mile-deep chasm carved over five million years, ancient logs crystallized into rainbow stone at Petrified Forest, and the iconic giant saguaro cacti of the Sonoran Desert.", "Arkansas": "Hot Springs is one of America's oldest federally protected areas, centered on 47 naturally flowing thermal springs that have drawn visitors since the 1800s along the beautifully restored historic Bathhouse Row.", "California": "No state rivals California's nine national parks \u2014 the world's tallest and biggest trees, a glacier-carved valley of incomparable beauty, North America's lowest point, towering coastal redwoods, and alien desert landscapes.", "Colorado": "Colorado's four parks span elevations from Rocky Mountain alpine tundra above 12,000 feet to ancient Ancestral Puebloan cliff dwellings, North America's tallest sand dunes, and one of the continent's most sheer river canyons.", "Florida": "Florida's three parks protect extraordinary subtropical ecosystems: the vast Everglades river of grass, the offshore coral reefs and mangroves of Biscayne, and the remote Civil War-era island fortress of Dry Tortugas.", "Hawaii": "Two parks on two islands capture Hawaii's volcanic heart: Haleakal\u0101's otherworldly summit crater on Maui and the continuously active K\u012blauea and Mauna Loa volcanoes reshaping the Big Island with new lava.", "Indiana": "Indiana Dunes is a surprising biodiversity hotspot \u2014 towering Lake Michigan sand dunes rising 200 feet above the shoreline, surrounded by swamps, bogs, prairie, and forests that support more plant species per acre than many tropical rainforests.", "Kentucky": "Mammoth Cave preserves the world's longest known cave system \u2014 over 400 miles of explored passages \u2014 beneath the rolling karst landscape of south-central Kentucky, carved by centuries of water through limestone.", "Maine": "Acadia is New England's only national park, protecting rugged pink granite coastline, forested mountains, and pristine lakes on Mount Desert Island. Cadillac Mountain is the first place in the continental US to see the sunrise.", "Michigan": "Isle Royale is one of the least-visited parks in the lower 48 \u2014 a remote wilderness island accessible only by boat or seaplane in Lake Superior, home to the world's longest continuously running wolf-moose predator-prey study.", "Minnesota": "Voyageurs covers a vast network of four interconnected lakes and more than 500 islands along the US-Canada border, a waterway wilderness best explored by houseboat, canoe, or snowmobile in winter.", "Missouri": "Gateway Arch in St. Louis commemorates America's westward expansion with the world's tallest man-made arch \u2014 630 feet of gleaming stainless steel on the banks of the Mississippi River.", "Montana": "Glacier National Park preserves one of the most pristine alpine ecosystems in North America. Going-to-the-Sun Road crosses the Continental Divide through tundra alive with mountain goats, grizzly bears, and wildflowers.", "Nevada": "Great Basin is one of the least-visited parks in the US \u2014 protecting ancient bristlecone pine trees over 5,000 years old, the dramatic Lehman Caves marble system, and some of the darkest, most star-filled skies in the country.", "New Mexico": "Two parks reveal New Mexico's geological extremes: Carlsbad Caverns hides an underground cathedral 750 feet below the Chihuahuan Desert, while White Sands spreads 275 square miles of impossibly bright gypsum dunes across the Tularosa Basin.", "NC / Tennessee": "Great Smoky Mountains straddles the Appalachian crest across two states and is America's most visited national park. Ancient mountains draped in blue mist harbor more tree species than all of northern Europe.", "North Dakota": "Theodore Roosevelt National Park preserves the rugged badlands that shaped a young Roosevelt into America's greatest conservation president \u2014 colorful buttes, wild bison herds, and the winding Little Missouri River.", "Ohio": "Cuyahoga Valley protects a green corridor of forests, wetlands, waterfalls, and historic farms along the Cuyahoga River between Cleveland and Akron, one of the most urban national parks in the country.", "Oregon": "Crater Lake holds the deepest water in the United States at 1,943 feet and some of the clearest, most intensely blue water on Earth \u2014 filling the collapsed caldera of ancient Mount Mazama, which erupted 7,700 years ago.", "South Carolina": "Congaree protects the largest intact old-growth bottomland hardwood forest in the southeastern US. Its ancient trees \u2014 some of the tallest east of the Mississippi \u2014 form a cathedral-like canopy above a wild floodplain.", "South Dakota": "South Dakota's two parks reveal contrasting wonders: Wind Cave's honeycomb boxwork formations deep underground, and Badlands' dramatic surface of sharply eroded spires and gullies stretching to the horizon.", "Texas": "Big Bend's vast Chihuahuan Desert meets the Rio Grande in one of the most remote parks in the lower 48. Guadalupe Mountains rises from the same ancient Permian reef, containing the highest peak in Texas.", "Utah": "Utah's Mighty Five are among the most spectacular parks on Earth \u2014 more than 2,000 stone arches at Arches, hoodoo amphitheaters at Bryce Canyon, the Colorado Plateau wilderness of Canyonlands, Capitol Reef's 100-mile fold, and Zion's sheer canyon walls.", "Virginia": "Shenandoah's Skyline Drive winds 105 miles along the Blue Ridge crest, offering sweeping views over the Shenandoah Valley with 500 miles of trails through second-growth forest recovering since the 1930s.", "Washington": "Washington's three parks showcase the Pacific Northwest at its most dramatic: Mount Rainier's 26 glaciers, Olympic's rainforest-to-coastline ecosystems, and North Cascades' 300+ glaciers in the remote American Alps.", "West Virginia": "New River Gorge \u2014 America's newest national park \u2014 protects one of the oldest rivers on Earth carving one of the Appalachians' deepest gorges, with world-class whitewater and the longest steel arch bridge in the Western Hemisphere.", "Wyoming": "Yellowstone and Grand Teton together form one of Earth's greatest protected landscapes. Yellowstone holds half the world's geothermal features above a supervolcano; Grand Teton's cathedral peaks rise without foothills from the Jackson Hole valley floor.", "U.S. Virgin Islands": "Virgin Islands National Park covers nearly two-thirds of St. John, protecting crystalline turquoise bays, white sand beaches, and some of the finest coral reefs in the entire Caribbean.", "American Samoa": "The only US national park in the Southern Hemisphere \u2014 and one of the most remote \u2014 protects pristine tropical rainforest, thriving coral reefs, and ancient Samoan culture across three island groups in the South Pacific."}, "C": {"land": "#d6e8c0", "landHover": "#c4dca8", "border": "#7fa060", "water": "#aecfe8", "bg": "#ddeef7", "tree": "#2d4a1e", "treeHov": "#b87808", "treeOn": "#e8a020", "cardBg": "#fffdf5", "header": "#233418", "accent": "#3d5c24"}};
const C = D.C, PARKS = D.parks, FIPS = D.fips, SKIP = new Set(D.skip), SF = D.stateFips, SI = D.stateInfo;
Object.assign(C,{water:'#dde6ea',land:'#dbe2c4',landHover:'#cdd7b0',border:'#c3b596'});
const REGION_LABELS={all:"All",lower48:"Lower 48",alaska:"Alaska",hawaii:"Hawaii",territory:"Territories"};
const W=960,H=600;
let projs=null, selected=null, hovered=null, search="", regionFilter="all", stateFilter="", sideDetail=null;
const SVG=null;

function makeProjections(){
  const p48=d3.geoAlbers().parallels([29.5,45.5]).rotate([96,0]).center([-0.6,38.7]).scale(1080).translate([W*0.5,H*0.495]);
  const pAK=d3.geoAlbers().parallels([55,65]).rotate([154,0]).center([0,56.5]).scale(380).translate([W*0.145,H*0.8]);
  const pHI=d3.geoAlbers().parallels([8,18]).rotate([157,0]).center([0,21]).scale(1500).translate([W*0.285,H*0.845]);
  return {p48,pAK,pHI};
}
function projectPark(p){ if(p.region==="alaska")return projs.pAK([p.lng,p.lat]); if(p.region==="hawaii")return projs.pHI([p.lng,p.lat]); if(p.region==="territory")return null; return projs.p48([p.lng,p.lat]); }
const ALL_STATES=[...new Set(PARKS.map(p=>p.state))].sort();

function treeSVG(){
  return `<g class="g"><rect x="-1.5" y="-6" width="3" height="6" rx="0.5"/>`+
    `<polygon points="0,-6 7.5,4 -7.5,4"/><polygon points="0,-13 6.5,-3 -6.5,-3"/>`+
    `<polygon points="0,-20 5.5,-9.5 -5.5,-9.5"/>`+
    `<polygon points="0,-20 5.5,-9.5 -5.5,-9.5" fill="white" fill-opacity="0.15"/></g>`;
}
function loadMap(urls){
  fetch(urls[0]).then(r=>{if(!r.ok)throw 0;return r.json()}).then(draw)
   .catch(()=>{ if(urls.length>1) loadMap(urls.slice(1)); else showError(); });
}
function showError(){
  document.getElementById('overlay').innerHTML='<div class="box"><h3>Map needs to be online</h3>'+
   '<p>This map downloads the U.S. map shape from the web, so it draws once the page is served over the internet (or a local server) — not from a raw double-click of the file. Publish it (the steps I gave you) and it appears instantly.</p></div>';
}
function draw(us){
  document.getElementById('overlay').style.display='none';
  document.getElementById('note').style.display='block';
  const states=topojson.feature(us, us.objects.states).features;
  const g=SVG.append("g").attr("id","mapg").style("transition","transform .6s cubic-bezier(.4,0,.2,1)");
  g.append("rect").attr("width",W).attr("height",H).attr("fill",C.water);
  // state fills
  const fillG=g.append("g");
  states.forEach(f=>{
    const fid=String(f.id).padStart(2,"0");
    const proj=fid==="02"?projs.pAK:fid==="15"?projs.pHI:projs.p48;
    const path=d3.geoPath(proj);
    fillG.append("path").attr("d",path(f)||"").attr("data-fips",fid).attr("fill",C.land).attr("stroke","none").style("transition","fill .3s");
    const c=path.centroid(f), abbr=FIPS[fid];
    if(abbr&&!SKIP.has(fid)&&c[0]&&c[1])
      g.append("text").attr("x",c[0]).attr("y",c[1]+3.5).attr("text-anchor","middle")
       .attr("font-size",(fid==="02"||fid==="15")?7:8.5).attr("font-weight",600)
       .attr("fill","#4a6030").attr("fill-opacity",.75).style("pointer-events","none").text(abbr);
  });
  // borders
  const border=d3.geoPath(projs.p48)(topojson.mesh(us,us.objects.states,(a,b)=>a!==b))||"";
  g.append("path").attr("d",border).attr("fill","none").attr("stroke",C.border).attr("stroke-width",.55);
  // highlighted outline holder
  g.append("g").attr("id","hl");
  // inset boxes
  [["ALASKA",72,465,148,108,76,479],["HAWAII",230,505,110,72,234,519]].forEach(b=>{
    g.append("rect").attr("x",b[1]).attr("y",b[2]).attr("width",b[3]).attr("height",b[4]).attr("rx",4)
     .attr("fill","none").attr("stroke",C.border).attr("stroke-width",.8).attr("stroke-dasharray","4,2");
    g.append("text").attr("x",b[5]).attr("y",b[6]).attr("font-size",8).attr("fill",C.border).attr("font-weight",600).attr("letter-spacing",1).text(b[0]);
  });
  // trees
  const tg=g.append("g").attr("id","trees");
  PARKS.forEach(p=>{
    const pt=projectPark(p); if(!pt)return;
    const node=tg.append("g").attr("class","tree").attr("data-id",p.id)
      .attr("transform",`translate(${pt[0]},${pt[1]})`)
      .attr("filter","url(#ss)").html(treeSVG());
    node.append("title").text(`${p.name} National Park · ${p.state}`);
    node.on("click",e=>{e.stopPropagation();selectPark(p);})
        .on("mouseenter",()=>{hovered=p.id;paintTrees();showLabel(p,pt);})
        .on("mouseleave",()=>{hovered=null;paintTrees();if(!selected)hideLabel();else{const sp=projectPark(selected);if(sp)showLabel(selected,sp);}});
  });
  // floating name label
  g.append("g").attr("id","plabel").style("pointer-events","none");
  // defs shadows
  const defs=SVG.insert("defs",":first-child");
  defs.html('<filter id="ss"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#00000030"/></filter><filter id="sl"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#00000060"/></filter>');
  SVG.on("click",()=>{closePeek();paintStates();});
  paintTrees();paintStates();renderSide();
}
function paintTrees(){
  d3.selectAll(".tree").each(function(){
    const id=+this.getAttribute("data-id"), p=PARKS.find(x=>x.id===id);
    const on=selected&&selected.id===id, hov=hovered===id;
    const inState=!stateFilter||p.state===stateFilter;
    this.classList.toggle("on",!!on);
    this.style.opacity=(stateFilter&&!inState)?0.15:1;
    this.style.cursor=inState?"pointer":"default";
    this.setAttribute("filter",(on||hov)?"url(#sl)":"url(#ss)");
    const col=on?C.treeOn:hov?C.treeHov:C.tree;
    this.querySelectorAll("rect,polygon:not([fill='white'])").forEach(el=>el.setAttribute("fill",col));
  });
}
function showLabel(p,pt){
  const lg=d3.select("#plabel"); if(lg.empty())return;
  lg.selectAll("*").remove();
  const txt=p.name, w=txt.length*6.6+18;
  const s=1/(curScale||1);
  const x=pt[0], y=pt[1]-20*s;
  const grp=lg.append("g").attr("transform",`translate(${x},${y}) scale(${s})`);
  grp.append("rect").attr("x",-w/2).attr("y",-16).attr("width",w).attr("height",21).attr("rx",6)
     .attr("fill","#233418").attr("opacity",.94);
  grp.append("path").attr("d","M-5,5 L5,5 L0,11 Z").attr("fill","#233418").attr("opacity",.94);
  grp.append("text").attr("text-anchor","middle").attr("y",-1).attr("fill","#fff")
     .attr("font-size",11).attr("font-weight",600).text(txt);
}
function hideLabel(){ const lg=d3.select("#plabel"); if(!lg.empty())lg.selectAll("*").remove(); }
function paintStates(){
  const active=stateFilter?(SF[stateFilter]||[]):[];
  d3.selectAll("#trees ~ *");
  d3.selectAll("path[data-fips]").each(function(){
    const fid=this.getAttribute("data-fips");
    const isA=active.includes(fid), dim=stateFilter&&!isA;
    this.setAttribute("fill", isA?"#a8cc78":dim?"#cddcba":C.land);
  });
  const hl=d3.select("#hl"); hl.selectAll("*").remove();
  if(stateFilter){ active.forEach(fid=>{
    const pth=d3.select(`path[data-fips='${fid}']`).attr("d");
    if(pth) hl.append("path").attr("d",pth).attr("fill","none").attr("stroke","#5a8a30").attr("stroke-width",2).attr("stroke-linejoin","round");
  });}
  zoomToState(active);
}
let curScale=1;
function zoomToState(fids){
  const g=document.getElementById("mapg"); if(!g)return;
  if(!fids||!fids.length){ g.style.transform="translate(0px,0px) scale(1)"; curScale=1; if(selected){const sp=projectPark(selected);if(sp)showLabel(selected,sp);} return; }
  // combined bounding box of the state's paths (in the 960x600 viewBox space)
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,found=false;
  fids.forEach(fid=>{
    const el=document.querySelector(`path[data-fips='${fid}']`); if(!el)return;
    const b=el.getBBox(); found=true;
    x0=Math.min(x0,b.x); y0=Math.min(y0,b.y); x1=Math.max(x1,b.x+b.width); y1=Math.max(y1,b.y+b.height);
  });
  if(!found){ g.style.transform="translate(0px,0px) scale(1)"; return; }
  const W=960,H=600,pad=60;
  const bw=x1-x0, bh=y1-y0;
  let scale=Math.min((W-pad)/bw,(H-pad)/bh);
  scale=Math.max(1,Math.min(scale,6)); // never zoom out past full, cap close-in
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  const tx=W/2 - scale*cx, ty=H/2 - scale*cy;
  g.style.transformOrigin="0 0";
  g.style.transform=`translate(${tx}px,${ty}px) scale(${scale})`;
  curScale=scale;
  if(selected){const sp=projectPark(selected);if(sp)showLabel(selected,sp);}
}
let myTrip=[];
function selectPark(p){
  selected=p; renderDash(); paintTrees();
  const pt=projectPark(p); if(pt)showLabel(p,pt);
  const info=document.getElementById("info"); if(info)info.classList.add("open");
}
function closePeek(){ selected=null; paintTrees(); hideLabel(); const info=document.getElementById("info"); if(info)info.classList.remove("open"); }

function renderDash(){
  renderLive(); renderAbout(); renderCart();
}
function pickPrompt(verb){ return `<div class="empty"><span class="big">🧭</span>Click a marker on the map (or a park below) to ${verb}.</div>`; }

function renderLive(){
  const el=document.getElementById("ip-live"); if(!el)return;
  if(!selected){ el.innerHTML=pickPrompt("see its live weather and alerts"); return; }
  const p=selected;
  el.innerHTML=`<div class="phero" id="phero"><div class="phero-fade"></div><div class="phero-name">${p.name}<span>${p.state} · live conditions</span></div></div>`+
    `<div class="alertflag" id="pkalert" style="display:none"></div>`+
    `<div class="wxcard"><div class="lbl">Current Conditions</div><div id="wxbody">Loading live conditions…</div></div>`+
    `<div class="pcard-acts"><button class="pca-add" id="pca-add">＋ Add to trip</button><button class="pca-stamp" id="pca-stamp">🛂 Stamp</button></div>`+
    `<a class="gobtn" href="/park-status?park=${p.id}">View full live status &rarr;</a>`;
  loadHero(p);
  wirePcardActions(p);
  if(p.region!=="territory"){ loadWeather(p); loadPeekAlert(p); }
  else { const b=document.getElementById("wxbody"); if(b)b.innerHTML='<span style="color:#9a937f">Outside the National Weather Service coverage area.</span>'; }
}
function loadHero(p){
  var h=document.getElementById("phero"); if(!h)return;
  fetchNPS(p.name).then(function(d){
    var img=d&&d.park&&d.park.images&&d.park.images[0]?d.park.images[0].url:null;
    var hh=document.getElementById("phero"); if(hh&&img){hh.style.backgroundImage="url('"+img+"')";hh.classList.add("loaded");}
  }).catch(function(){});
}
function wirePcardActions(p){
  var add=document.getElementById("pca-add");
  if(add){
    var inTrip=myTrip&&myTrip.some(function(x){return x.id===p.id;});
    if(inTrip){add.textContent="✓ In your trip";add.classList.add("added");add.disabled=true;}
    add.onclick=function(){ if(typeof addToTrip==='function')addToTrip(p); add.textContent="✓ In your trip";add.classList.add("added");add.disabled=true; };
  }
  var st=document.getElementById("pca-stamp");
  if(st)st.onclick=function(){
    try{var arr=JSON.parse(localStorage.getItem("pp_stamped")||"[]");if(!arr.some(function(x){return x.id===p.id;})){arr.push({id:p.id,year:String(new Date().getFullYear())});localStorage.setItem("pp_stamped",JSON.stringify(arr));}}catch(e){}
    st.textContent="🛂 Stamped!";
  };
}
function renderAbout(){
  const el=document.getElementById("ip-about"); if(!el)return;
  if(!selected){ el.innerHTML=pickPrompt("read about it"); return; }
  const p=selected;
  el.innerHTML=`<div class="dh2">${p.name}</div><div class="dh2sub">${p.state} · est. ${p.year} · ${REGION_LABELS[p.region]}</div>`+
    `<p class="ddesc">${p.desc}</p>`+
    `<div class="wxcard" id="todopeek"><div class="lbl">Things to do</div><div id="todopeekbody" style="font-size:.84rem;color:#9a937f">Loading…</div></div>`+
    (SI[p.state]?`<div class="wxcard"><div class="lbl">About ${p.state}'s parks</div><div style="font-size:.84rem;line-height:1.5;color:#4c5443">${SI[p.state]}</div></div>`:``)+
    `<a class="gobtn" href="/park-status?park=${p.id}">Full status &amp; official info &rarr;</a>`;
  loadTodoPeek(p);
}
const _npsCache={};
function fetchNPS(name){
  if(_npsCache[name]) return _npsCache[name];
  const pr=fetch('/api/nps?name='+encodeURIComponent(name),{headers:{Accept:'application/json'}})
    .then(r=>{if(!r.ok)throw 0;return r.json()})
    .then(d=>{ if(d&&d.error)throw 0; return d; })
    .catch(e=>{ delete _npsCache[name]; throw e; }); // don't cache failures
  _npsCache[name]=pr;
  return pr;
}
function loadTodoPeek(p){
  const body=document.getElementById("todopeekbody"); if(!body)return;
  fetchNPS(p.name)
   .then(d=>{
     const body=document.getElementById("todopeekbody"); if(!body)return;
     const park=d.park||{}; const acts=(park.activities||[]).slice(0,5); const td=(d.thingsToDo||[]).slice(0,3);
     let html="";
     if(acts.length) html+=`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${td.length?'9px':'0'}">${acts.map(a=>`<span style="font-size:.72rem;background:#eef3e6;border:1px solid var(--border);color:var(--accent);padding:3px 9px;border-radius:999px;font-weight:600">${a}</span>`).join('')}</div>`;
     if(td.length) html+=td.map(t=>`<div style="margin-bottom:5px;line-height:1.35">• ${t.title||''}</div>`).join('');
     if(!html) html='<span style="color:#9a937f">No activities listed for this park.</span>';
     html+=`<a href="/park-status?park=${p.id}" style="display:inline-block;margin-top:8px;font-size:.78rem;color:var(--accent);font-weight:600;text-decoration:none">See all things to do &rarr;</a>`;
     body.innerHTML=html;
   })
   .catch(()=>{ const body=document.getElementById("todopeekbody"); if(body)body.innerHTML='<span style="color:#9a937f">Things to do load on the published site.</span>'; });
}
function haversine(a,b){var R=3958.8,t=Math.PI/180,dLat=(b.lat-a.lat)*t,dLng=(b.lng-a.lng)*t,la1=a.lat*t,la2=b.lat*t;var h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function tripStats(){
  const states=new Set(myTrip.map(p=>p.state));
  let miles=0; for(let i=1;i<myTrip.length;i++) miles+=haversine(myTrip[i-1],myTrip[i]);
  const days=myTrip.length?(myTrip.length*2+Math.max(0,myTrip.length-1)):0;
  return {parks:myTrip.length,states:states.size,days:days,miles:Math.round(miles)};
}
function nearbyParks(p,n){
  return PARKS.filter(x=>x.id!==p.id && x.region!=='territory' && !myTrip.some(m=>m.id===x.id))
    .map(x=>({p:x,d:haversine(p,x)})).sort((a,b)=>a.d-b.d).slice(0,n).map(o=>o.p);
}
function saveTrip(){ try{localStorage.setItem('pp_map_trip',JSON.stringify(myTrip.map(p=>p.id)));}catch(e){} }
function loadTrip(){ try{var ids=JSON.parse(localStorage.getItem('pp_map_trip')||'[]');myTrip=ids.map(id=>PARKS.find(p=>p.id===id)).filter(Boolean);}catch(e){myTrip=[];} }
function addToTrip(p){ if(p&&!myTrip.some(x=>x.id===p.id)){myTrip.push(p);saveTrip();renderCart();paintMarkers();} }
function removeFromTrip(id){ myTrip=myTrip.filter(x=>x.id!==id);saveTrip();renderCart();paintMarkers(); }
function buildTripURL(){ return '/build-trip?trip='+encodeURIComponent(JSON.stringify({n:'My map trip',s:myTrip.map(p=>({p:p.id}))})); }
function updateMobtab(){ const mob=document.getElementById('mobtab'); if(!mob)return; const d=document.getElementById('dash'); mob.textContent=(d&&d.classList.contains('open'))?'\u25bc Close':('\u25b2 My Trip ('+myTrip.length+')'); }
function updateTripBadge(){ var b=document.getElementById('tripBadge'); if(!b)return; if(myTrip.length){ b.textContent=myTrip.length; b.style.display=''; } else b.style.display='none'; }
let cartDrag=null;
function renderCart(){
  const body=document.getElementById('cart-body'); if(!body)return;
  const st=tripStats();
  const sub=document.getElementById('cart-sub');
  if(sub) sub.textContent=myTrip.length?(st.parks+' park'+(st.parks!==1?'s':'')+' \u00b7 '+st.states+' state'+(st.states!==1?'s':'')+(st.miles?(' \u00b7 ~'+st.miles.toLocaleString()+' mi'):'')):'Tap markers to add parks';
  const clr=document.getElementById('cart-clear');
  if(clr){ clr.style.display=myTrip.length?'':'none'; clr.onclick=()=>{ if(myTrip.length&&confirm('Clear your trip?')){myTrip=[];saveTrip();renderCart();paintMarkers();} }; }
  const stats=document.getElementById('cart-stats');
  if(stats) stats.innerHTML=`<div class="s"><b>${st.parks}</b><span>Parks</span></div><div class="s"><b>${st.states}</b><span>States</span></div><div class="s"><b>${myTrip.length?'~'+st.days:0}</b><span>Days</span></div>`;
  let html='';
  if(selected){
    const inTrip=myTrip.some(x=>x.id===selected.id);
    html+=`<button class="cart-add ${inTrip?'added':''}" id="cart-addbtn" ${inTrip?'disabled':''}>${inTrip?'\u2713 '+selected.name+' added':'+ Add '+selected.name}</button>`;
  }
  if(myTrip.length){
    html+=`<div class="cart-sec">Your route \u2014 drag to reorder</div><div id="cart-list">`+
      myTrip.map((p,i)=>`<div class="cart-item" draggable="true" data-id="${p.id}" data-i="${i}"><span class="ci-n">${i+1}</span><div class="ci-i"><b>${p.name}</b><span>${p.state}</span></div><button class="ci-x" data-id="${p.id}" title="Remove">\u00d7</button></div>`).join('')+`</div>`;
  } else if(!selected){
    html+=`<div class="cart-empty"><span class="big">\ud83e\udded</span>Tap any park marker on the map to start collecting stops for your road trip.</div>`;
  }
  if(selected){
    const near=nearbyParks(selected,3);
    if(near.length) html+=`<div class="cart-sec">Add nearby</div><div class="cart-near">`+
      near.map(x=>`<button data-add="${x.id}"><span style="display:flex;flex-direction:column;min-width:0"><b style="font-size:.82rem;color:var(--head);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.name}</b><span style="font-size:.68rem;color:var(--muted)">${x.state} \u00b7 ${Math.round(haversine(selected,x)).toLocaleString()} mi away</span></span><span class="pl">+</span></button>`).join('')+`</div>`;
  }
  body.innerHTML=html;
  const foot=document.getElementById('cart-foot');
  if(foot){
    foot.innerHTML=`<a class="cart-build ${myTrip.length?'':'dis'}" href="${myTrip.length?buildTripURL():'#'}">Build full itinerary \u2192</a>`+
      `<button class="cart-passport ${myTrip.length?'':'dis'}" id="cart-passport" ${myTrip.length?'':'disabled'}>🛂 Create Trip Passport</button>`+
      `<div class="hint">${myTrip.length?('Sends your '+st.parks+' park'+(st.parks!==1?'s':'')+' to the planner for real drive times, dates &amp; costs.'):'Add parks, then send them to the trip planner.'}</div>`;
    const pp=document.getElementById('cart-passport');
    if(pp)pp.onclick=()=>{
      if(window.__ppPassport){
        const ts=tripStats();
        window.__ppPassport.saveTrip({
          name:'My map trip',
          days:ts.days,
          miles:ts.miles,
          parkIds:myTrip.map(p=>p.id)
        });
      }
    };
  }
  const ab=document.getElementById('cart-addbtn'); if(ab)ab.onclick=()=>addToTrip(selected);
  body.querySelectorAll('.ci-x').forEach(b=>b.onclick=()=>removeFromTrip(+b.dataset.id));
  body.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addToTrip(PARKS.find(p=>p.id===+b.getAttribute('data-add'))));
  const list=document.getElementById('cart-list');
  if(list) list.querySelectorAll('.cart-item').forEach(row=>{
    row.addEventListener('dragstart',e=>{cartDrag=+row.dataset.i;row.style.opacity='.4';e.dataTransfer.effectAllowed='move';});
    row.addEventListener('dragend',()=>{row.style.opacity='';});
    row.addEventListener('dragover',e=>e.preventDefault());
    row.addEventListener('drop',e=>{e.preventDefault();const to=+row.dataset.i;if(cartDrag==null||cartDrag===to)return;const m=myTrip.splice(cartDrag,1)[0];myTrip.splice(to,0,m);cartDrag=null;saveTrip();renderCart();});
  });
  updateMobtab();
  updateTripBadge();
}
function loadPeekAlert(p){
  fetch(`https://api.weather.gov/alerts/active?point=${p.lat.toFixed(4)},${p.lng.toFixed(4)}`,{headers:{Accept:"application/geo+json"}})
    .then(r=>{if(!r.ok)throw 0;return r.json()})
    .then(d=>{ const el=document.getElementById("pkalert"); if(!el)return;
      const n=(d.features||[]).length;
      if(n){ el.style.display="flex"; el.innerHTML=`<span>⚠</span><span><b>${n} active weather alert${n>1?"s":""}</b> — see full status for details.</span>`; }
    }).catch(()=>{});
}
function loadWeather(p){
  if(!document.getElementById("wxbody"))return;
  fetch(`https://api.weather.gov/points/${p.lat.toFixed(4)},${p.lng.toFixed(4)}`,{headers:{Accept:"application/geo+json"}})
    .then(r=>{if(!r.ok)throw 0;return r.json()})
    .then(d=>fetch(d.properties.forecast,{headers:{Accept:"application/geo+json"}}))
    .then(r=>{if(!r.ok)throw 0;return r.json()})
    .then(d=>{ const b=document.getElementById("wxbody"); if(!b)return;
      const per=d.properties.periods[0];
      b.innerHTML=(window.WeatherFX)?WeatherFX.card({text:per.shortForecast,temp:per.temperature,unit:'°'+per.temperatureUnit,bottom:per.name+' · live from weather.gov',size:'md'}):
        `<div style="display:flex;align-items:center;gap:10px"><span style="font-size:1.55rem;font-weight:700;color:var(--accent)">${per.temperature}&deg;${per.temperatureUnit}</span><span style="font-size:.82rem;color:#555">${per.shortForecast}</span></div>`;
    })
    .catch(()=>{ const b=document.getElementById("wxbody"); if(b) b.innerHTML='<span style="color:#9a937f">Live conditions show on the published site — weather can\'t load from a raw local file.</span>'; });
}
function filteredParks(){
  const q=search.toLowerCase();
  return PARKS.filter(p=>(p.name.toLowerCase().includes(q)||p.state.toLowerCase().includes(q))
    &&(regionFilter==="all"||p.region===regionFilter)&&(!stateFilter||p.state===stateFilter))
    .sort((a,b)=>a.name.localeCompare(b.name));
}
function pickFromSearch(p){ if(!p)return; search=''; renderSide(); applyMapFilter(false); selectPark(p); }
function renderSide(){
  const items=filteredParks();
  const cnt=document.getElementById("count"); if(cnt)cnt.textContent=PARKS.length+" parks";
  // slim top bar
  const topbar=document.getElementById("topbar");
  if(topbar){ topbar.innerHTML=''; }
  // bottom strip
  const strip=document.getElementById("strip");
  if(strip){
    strip.innerHTML=items.length?items.map(p=>`<button class="pchip ${selected&&selected.id===p.id?'sel':''}" data-id="${p.id}"><div class="nm">${p.name}</div><div class="sub">${p.state} · ${p.year}</div></button>`).join(""):`<p style="color:#a7a08c;padding:10px;font-size:.85rem">No parks found</p>`;
    strip.querySelectorAll(".pchip").forEach(r=>r.onclick=()=>selectPark(PARKS.find(p=>p.id===+r.dataset.id)));
  }
}
// boot
function setSheet(which){ var d=document.getElementById("dash"),i=document.getElementById("info"); if(d)d.classList.toggle("open",which==="trip"); if(i)i.classList.toggle("open",which==="live"); updateToggle(); }
function closeSheets(){ var d=document.getElementById("dash"),i=document.getElementById("info"); if(d)d.classList.remove("open"); if(i)i.classList.remove("open"); updateToggle(); }
function updateToggle(){ var t=document.getElementById("vtoggle"); if(!t)return; var d=document.getElementById("dash"),i=document.getElementById("info"); var bt=t.querySelector('[data-v="trip"]'),bl=t.querySelector('[data-v="live"]'); if(bt)bt.classList.toggle("on",!!(d&&d.classList.contains("open"))); if(bl)bl.classList.toggle("on",!!(i&&i.classList.contains("open"))); }
function setupDash(){
  document.querySelectorAll(".dtab").forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll(".dtab").forEach(x=>x.classList.remove("on"));
      document.querySelectorAll(".dpane").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      document.getElementById("dp-"+b.dataset.tab).classList.add("on");
    };
  });
  document.querySelectorAll(".itab").forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll(".itab").forEach(x=>x.classList.remove("on"));
      document.querySelectorAll(".ipane").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      document.getElementById("ip-"+b.dataset.itab).classList.add("on");
    };
  });
  const ix=document.getElementById("ix");
  if(ix)ix.onclick=()=>{ const info=document.getElementById("info"); if(info)info.classList.remove("open"); updateToggle(); };
  const mob=document.getElementById("mobtab");
  if(mob)mob.onclick=()=>{ document.getElementById("dash").classList.toggle("open"); updateMobtab(); };
  const bt=document.getElementById("bantoggle");
  if(bt)bt.onclick=()=>{ const b=document.getElementById("banner"); b.classList.toggle("open"); bt.textContent=b.classList.contains("open")?"About ▴":"About ▾"; };
  loadTrip();
  const vt=document.getElementById("vtoggle");
  if(vt) vt.querySelectorAll("button").forEach(b=>b.onclick=()=>{ const v=b.dataset.v; const open=(v==="trip")?document.getElementById("dash").classList.contains("open"):document.getElementById("info").classList.contains("open"); if(open)closeSheets(); else setSheet(v); });
  renderDash();
  updateToggle();
}
window.addEventListener("load",()=>{
  setupDash();
  setupSearch();
  var info=document.getElementById('info'); if(info&&!window.matchMedia('(max-width:860px)').matches){ info.classList.add('open'); document.body.classList.add('pb-panel-open'); }
  var ph=document.getElementById('panelHide'), ps=document.getElementById('panelShow');
  if(ph) ph.onclick=function(){ var i=document.getElementById('info'); if(i)i.classList.remove('open'); document.body.classList.remove('pb-panel-open'); if(ps)ps.style.display=''; };
  if(ps) ps.onclick=function(){ var i=document.getElementById('info'); if(i)i.classList.add('open'); document.body.classList.add('pb-panel-open'); ps.style.display='none'; };
  renderDash();
  renderSide();
  buildLegend();
  loadGoogle(function(){ if(typeof google!=='undefined'&&google.maps) initMap(); });
});

// Unified cross-type search: 63 national parks + state parks & national forests (destinations table).
var _destCache=null, _destFetched=false;
function setupSearch(){
  var inp=document.getElementById('pbq'), res=document.getElementById('pbqres'), x=document.getElementById('pbqx');
  if(!inp||!res)return;
  function close(){ res.classList.remove('on'); res.innerHTML=''; }
  function color(t){ return t==='national_forest'?'#3f7a34':t==='state_park'?'#5a7d33':'#c79a4b'; }
  function label(t){ return t==='national_forest'?'National Forest':t==='state_park'?'State Park':'National Park'; }
  function run(q){
    q=q.trim().toLowerCase(); x.style.display=q?'':'none';
    if(q.length<2){ close(); return; }
    var hits=[];
    PARKS.forEach(function(p){ if(p.name.toLowerCase().indexOf(q)>-1||(p.state||'').toLowerCase().indexOf(q)>-1) hits.push({name:p.name,t:'national_park',state:p.state,park:p}); });
    (_destCache||[]).forEach(function(d){ if(d.name.toLowerCase().indexOf(q)>-1||(d.state||'').toLowerCase().indexOf(q)>-1) hits.push({name:d.name,t:d.type,state:d.state,dest:d}); });
    hits=hits.slice(0,40);
    if(!hits.length){ res.innerHTML='<div style="padding:12px;font-size:.82rem;color:#a7a08c">No matches. Try a park, forest, or state.</div>'; res.classList.add('on'); return; }
    res.innerHTML=hits.map(function(h,i){ return '<button class="qr" data-i="'+i+'"><span class="qd" style="background:'+color(h.t)+'"></span><span class="qn">'+h.name+'</span><span class="qt">'+label(h.t)+(h.state?' \u00b7 '+h.state:'')+'</span></button>'; }).join('');
    res.classList.add('on');
    res.querySelectorAll('.qr').forEach(function(b){ b.onclick=function(){ var h=hits[+b.getAttribute('data-i')]; inp.value=''; close();
      if(h.park){ pickFromSearch(h.park); }
      else if(h.dest){ try{ sessionStorage.setItem('pb_dest', JSON.stringify({id:h.dest.id,name:h.dest.name,state:h.dest.state,lat:h.dest.lat,lng:h.dest.lng,source:h.dest.source,url:h.dest.url})); }catch(e){} location.href='/park-status?dest='+encodeURIComponent(h.dest.id); }
    }; });
  }
  inp.addEventListener('input',function(){ run(inp.value); if(!_destFetched&&inp.value.trim().length>=2){ _destFetched=true; fetch('/api/destinations?limit=500').then(function(r){return r.ok?r.json():null;}).then(function(d){ if(d&&d.destinations){ _destCache=d.destinations; run(inp.value); } }).catch(function(){}); } });
  x.onclick=function(){ inp.value=''; close(); inp.focus(); };
  document.addEventListener('click',function(e){ if(!e.target.closest('.pbsearch')) close(); });
}

// ===== Interactive map (Google Maps) =====
var gmap=null, gmarkersById={}, mapReady=false;
function styleMarker(p){ var m=gmarkersById[p.id]; if(!m)return;
  var on=!!(selected&&selected.id===p.id);
  var inTrip=!!(myTrip&&myTrip.some(function(x){return x.id===p.id;}));
  var fill=on?'#1d4a37':inTrip?'#3f7a4a':'#c79a4b';
  m.setIcon({path:google.maps.SymbolPath.CIRCLE,scale:on?10:inTrip?7.5:6.5,fillColor:fill,fillOpacity:1,strokeColor:'#fffdf7',strokeWeight:on?3:2});
  m.setZIndex(on?999:inTrip?500:1);
}
function paintMarkers(){ if(mapReady)PARKS.forEach(styleMarker); }
function loadGoogle(cb){
  if(typeof google!=='undefined'&&google.maps){cb();return;}
  var key=window.GMAPS_KEY||'';
  var lm=document.getElementById('lmap');
  if(!key){ if(lm)lm.innerHTML='<div class="overlay"><div class="box"><h3>Add a Google Maps key</h3><p>Set your Google Maps API key in <b>config.js</b> to enable the map.</p></div></div>'; return; }
  window.__gmReady=function(){cb();};
  window.gm_authFailure=function(){ if(lm)lm.innerHTML='<div class="overlay"><div class="box"><h3>Map could not authorize</h3><p>Google Maps could not authorize this key for this site. Check the key&rsquo;s allowed websites &amp; enabled APIs in Google Cloud.</p></div></div>'; };
  var s=document.createElement('script');s.async=true;s.defer=true;
  s.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&libraries=geometry&callback=__gmReady';
  s.onerror=function(){ if(lm)lm.innerHTML='<div class="overlay"><div class="box"><h3>Map failed to load</h3><p>Google Maps failed to load — check your connection or key.</p></div></div>'; };
  document.head.appendChild(s);
}
function initMap(){
  var mob=window.matchMedia('(max-width:560px)').matches;
  gmap=new google.maps.Map(document.getElementById('lmap'),{
    center:{lat:39.5,lng:-98.35},zoom:4,mapTypeId:'terrain',
    mapTypeControl:!mob,mapTypeControlOptions:{mapTypeIds:['roadmap','terrain','satellite','hybrid'],position:google.maps.ControlPosition.BOTTOM_LEFT,style:mob?google.maps.MapTypeControlStyle.DROPDOWN_MENU:google.maps.MapTypeControlStyle.HORIZONTAL_BAR},
    streetViewControl:false,fullscreenControl:false,zoomControl:!mob,zoomControlOptions:{position:google.maps.ControlPosition.RIGHT_BOTTOM},gestureHandling:'greedy',
    styles: window.PARKBUDDY_MAP_STYLE || [{featureType:'poi',stylers:[{visibility:'off'}]},{featureType:'transit',stylers:[{visibility:'off'}]}]
  });
  PARKS.forEach(function(p){
    var mk=new google.maps.Marker({position:{lat:p.lat,lng:p.lng},title:p.name+' · '+p.state,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:6.5,fillColor:'#c79a4b',fillOpacity:1,strokeColor:'#fffdf7',strokeWeight:2}});
    mk.addListener('click',function(){ selectPark(p); });
    gmarkersById[p.id]=mk;
  });
  gmap.addListener('click',function(){ closePeek(); });
  gmap.addListener('idle',function(){ loadDestinationsInView(); });
  mapReady=true;
  applyMapFilter(false);
  paintMarkers();
  setupLocate();
  buildLegend();
}
/* ----- "Parks near me": fly to location, ripple nearby parks ----- */
function setupLocate(){
  if(document.getElementById('ex-locate'))return;
  var root=document.querySelector('.map')||document.getElementById('embed-root'); if(!root)return;
  var btn=document.createElement('button');
  btn.id='ex-locate';
  btn.innerHTML='<span class="pin"></span>Parks near me';
  root.appendChild(btn);
  btn.onclick=flyToMe;
}
function flyToMe(){
  var btn=document.getElementById('ex-locate');
  if(!navigator.geolocation){ if(typeof toast==='function')toast('Location not available on this device.'); return; }
  if(btn)btn.innerHTML='<span class="pin"></span>Locating…';
  navigator.geolocation.getCurrentPosition(function(pos){
    var me={lat:pos.coords.latitude,lng:pos.coords.longitude};
    if(btn)btn.innerHTML='<span class="pin"></span>Parks near me';
    // "you are here" marker
    if(window._meMarker)window._meMarker.setMap(null);
    window._meMarker=new google.maps.Marker({position:me,map:gmap,zIndex:9999,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:8,fillColor:'#2a6fdb',fillOpacity:1,strokeColor:'#fff',strokeWeight:3}});
    // nearest parks by distance
    var near=PARKS.filter(function(p){return p.region!=='territory';})
      .map(function(p){return {p:p,d:haversine(me,p)};}).sort(function(a,b){return a.d-b.d;}).slice(0,6);
    gmap.panTo(me); gmap.setZoom(6);
    // ripple rings outward, then reveal nearest
    rippleRings(me);
    near.forEach(function(o,i){ setTimeout(function(){ bounceMarker(o.p); },350+i*180); });
    setTimeout(function(){
      var b=new google.maps.LatLngBounds(); b.extend(me); near.slice(0,4).forEach(function(o){b.extend({lat:o.p.lat,lng:o.p.lng});});
      gmap.fitBounds(b,80);
      if(typeof toast==='function')toast('Nearest park: '+near[0].p.name+' · '+Math.round(near[0].d)+' mi');
    },1700);
  },function(){ if(btn)btn.innerHTML='<span class="pin"></span>Parks near me'; if(typeof toast==='function')toast('Could not get your location.'); },{enableHighAccuracy:true,timeout:8000});
}
function rippleRings(center){
  var n=0;
  var iv=setInterval(function(){
    if(n++>=3){clearInterval(iv);return;}
    var c=new google.maps.Circle({center:center,radius:1,map:gmap,strokeColor:'#e4be78',strokeOpacity:.8,strokeWeight:2,fillColor:'#e4be78',fillOpacity:.08,clickable:false,zIndex:1});
    var r=1,grow=setInterval(function(){
      r+=18000; c.setRadius(r);
      var op=Math.max(0,.8-(r/420000)); c.setOptions({strokeOpacity:op,fillOpacity:op*0.1});
      if(r>420000){clearInterval(grow);c.setMap(null);}
    },24);
  },360);
}
function bounceMarker(p){
  var mk=gmarkersById[p.id]; if(!mk||!mapReady)return;
  if(window.google&&google.maps.Animation){ mk.setAnimation(google.maps.Animation.BOUNCE); setTimeout(function(){mk.setAnimation(null);},1400); }
}
function applyMapFilter(fit){
  if(!mapReady)return;
  var ids={}, pts=[];
  filteredParks().forEach(function(p){ ids[p.id]=1; });
  PARKS.forEach(function(p){ var m=gmarkersById[p.id]; if(!m)return;
    if(ids[p.id]){ m.setMap(gmap); pts.push(p); }
    else m.setMap(null);
  });
  if(fit && !selected){
    if(regionFilter==='all' && !stateFilter){ gmap.setCenter({lat:39.5,lng:-98.35});gmap.setZoom(4); }
    else if(pts.length===1){ gmap.setCenter({lat:pts[0].lat,lng:pts[0].lng});gmap.setZoom(7); }
    else if(pts.length){ var b=new google.maps.LatLngBounds();pts.forEach(function(p){b.extend({lat:p.lat,lng:p.lng});});gmap.fitBounds(b,48); }
  }
}
function focusPark(p){ if(!mapReady)return; gmap.panTo({lat:p.lat,lng:p.lng}); gmap.setZoom(Math.max(gmap.getZoom(),6)); }
// ---- official NPS boundary shading (per selected park) ----
var NPS_CODE={1:'dena',2:'gaar',3:'glba',4:'katm',5:'kefj',6:'kova',7:'lacl',8:'wrst',9:'grca',10:'pefo',11:'sagu',12:'hosp',13:'chis',14:'deva',15:'jotr',16:'kica',17:'lavo',18:'pinn',19:'redw',20:'sequ',21:'yose',22:'blca',23:'grsa',24:'meve',25:'romo',26:'bisc',27:'drto',28:'ever',29:'hale',30:'havo',31:'indu',32:'maca',33:'acad',34:'isro',35:'voya',36:'jeff',37:'glac',38:'grba',39:'cave',40:'whsa',41:'grsm',42:'thro',43:'cuva',44:'crla',45:'cong',46:'badl',47:'wica',48:'bibe',49:'gumo',50:'arch',51:'brca',52:'cany',53:'care',54:'zion',55:'shen',56:'mora',57:'noca',58:'olym',59:'neri',60:'grte',61:'yell',62:'viis',63:'npsa'};
var boundaryFeatures=[], _bnd={};
function clearBoundary(){ if(gmap&&boundaryFeatures.length){ boundaryFeatures.forEach(function(f){ try{gmap.data.remove(f);}catch(e){} }); boundaryFeatures=[]; } }
function showBoundary(p){
  clearBoundary();
  if(!mapReady)return;
  var code=NPS_CODE[p.id];
  function fly(){ gmap.panTo({lat:p.lat,lng:p.lng}); gmap.setZoom(Math.max(gmap.getZoom(),7)); }
  if(!code||typeof topojson==='undefined'){ fly(); return; }
  function draw(geo){
    if(!(selected&&selected.id===p.id))return;
    try{
      boundaryFeatures=gmap.data.addGeoJson(geo);
      gmap.data.setStyle({strokeColor:'#1d4a37',strokeWeight:2,fillColor:'#3f7a4a',fillOpacity:.22});
      var b=new google.maps.LatLngBounds();
      boundaryFeatures.forEach(function(f){ f.getGeometry().forEachLatLng(function(ll){ b.extend(ll); }); });
      if(!b.isEmpty()) gmap.fitBounds(b,70); else fly();
    }catch(e){ fly(); }
  }
  if(_bnd[code]){ draw(_bnd[code]); return; }
  fetch('https://raw.githubusercontent.com/nationalparkservice/data/gh-pages/base_data/boundaries/parks/'+code+'.topojson')
    .then(function(r){ if(!r.ok)throw 0; return r.json(); })
    .then(function(topo){ var o=topo.objects&&(topo.objects.collection||topo.objects[Object.keys(topo.objects)[0]]); var geo=topojson.feature(topo,o); _bnd[code]=geo; draw(geo); })
    .catch(function(){ fly(); });
}
// ---- overrides wiring the side panel + filters to the real map ----
function selectPark(p){ selected=p; renderDash(); paintMarkers(); showBoundary(p); loadMapPlaces(p); var info=document.getElementById("info"); if(info)info.classList.add("open"); if(window.matchMedia('(max-width:860px)').matches){var d=document.getElementById("dash"); if(d)d.classList.remove("open");} if(typeof updateToggle==='function')updateToggle(); }
function closePeek(){ selected=null; clearBoundary(); clearMapPlaces(); paintMarkers(); var info=document.getElementById("info"); if(info)info.classList.remove("open"); if(typeof updateToggle==='function')updateToggle(); }
function paintTrees(){ paintMarkers(); }

/* ----- My Trip panel collapse ----- */
(function(){
  function wire(){
    var btn=document.getElementById('cart-collapse'); if(!btn||btn._w)return; btn._w=1;
    var collapsed=false;
    btn.addEventListener('click',function(){
      collapsed=!collapsed;
      ['cart-stats','cart-body','cart-foot'].forEach(function(id){ var e=document.getElementById(id); if(e)e.style.display=collapsed?'none':''; });
      var sub=document.getElementById('cart-sub'); if(sub)sub.style.display=collapsed?'none':'';
      btn.textContent=collapsed?'+':'\u2212'; btn.title=collapsed?'Expand':'Collapse';
    });
  }
  if(document.getElementById('cart-collapse'))wire(); else document.addEventListener('DOMContentLoaded',wire); setTimeout(wire,800);
})();

/* ----- Map settings loading indicator ----- */
var _mapLoadN=0;
function mapLoad(delta){
  _mapLoadN=Math.max(0,_mapLoadN+delta);
  var s=document.getElementById('mapLegSpin'); if(!s)return;
  s.style.display=_mapLoadN>0?'inline-block':'none';
}

/* ----- Nearby places layer (Recreation.gov / RIDB) ----- */
var _placeMarkers=[], _placeIW=null;
var _layerOn={natpark:true,statepark:true,forest:true,places:true,water:true,hiking:true,offroad:true,ski:true};
function _vis(on){ return on?gmap:null; }
function applyLayers(){
  if(mapReady) PARKS.forEach(function(p){ var m=gmarkersById[p.id]; if(m) m.setMap(_layerOn.natpark?gmap:null); });
  _placeMarkers.forEach(function(m){ var L=m._layer; var on=L==='water'?_layerOn.water:L==='forest'?_layerOn.forest:L==='statepark'?_layerOn.statepark:_layerOn.places; m.setMap(on?gmap:null); });
  _trailLines.forEach(function(l){ l.setMap(_layerOn[l._layer]?gmap:null); });
}
function clearMapPlaces(){ _placeMarkers.forEach(function(m){ m.setMap(null); }); _placeMarkers=[]; if(_placeIW)_placeIW.close(); clearMapTrails(); }
var _trailLines=[];
function clearMapTrails(){ _trailLines.forEach(function(l){ l.setMap(null); }); _trailLines=[]; }
function loadMapTrails(p){
  if(!window.gmap||!p||typeof p.lat!=='number')return;
  clearMapTrails();
  mapLoad(1);
  fetch('/api/trails?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)+'&radius=30').then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||(selected&&selected.id!==p.id))return;
    var draw=function(arr,color,layer){ (arr||[]).forEach(function(x){ if(!x.path||x.path.length<2)return;
      var pl=new google.maps.Polyline({path:x.path.map(function(c){return {lat:c[0],lng:c[1]};}),map:(_layerOn[layer]?gmap:null),strokeColor:color,strokeOpacity:.85,strokeWeight:3,zIndex:30});
      pl._layer=layer;
      pl.addListener('click',function(){ if(_placeIW){ _placeIW.setContent('<div style="font-family:Hanken Grotesk,sans-serif"><b style="color:#1d3941">'+x.name+'</b>'+(x.difficulty?'<div style="font-size:12px;color:#5b6258">'+x.difficulty+'</div>':'')+'<div style="font-size:10px;color:#a79f8c;margin-top:5px">© OpenStreetMap</div></div>'); _placeIW.setPosition(x.path[Math.floor(x.path.length/2)]?{lat:x.path[Math.floor(x.path.length/2)][0],lng:x.path[Math.floor(x.path.length/2)][1]}:null); _placeIW.open(gmap); } });
      _trailLines.push(pl); }); };
    draw(d.hiking,'#3f7a34','hiking'); draw(d.offroad,'#a15a2a','offroad'); draw(d.ski,'#2a6f9e','ski');
  }).catch(function(){}).then(function(){ mapLoad(-1); });
}
// Viewport loader: show state parks + national forests across the whole map (not just near a selected park).
var _destMarkers={};
var _radiusCircle=null;
function _milesBetween(a,b){ var R=3959,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180,la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180; var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)*Math.sin(dLng/2); return 2*R*Math.asin(Math.sqrt(h)); }
function applyRadius(miles){
  if(!window.gmap||!window._radiusCenter)return;
  var c=window._radiusCenter;
  if(!_radiusCircle){ _radiusCircle=new google.maps.Circle({map:gmap,center:c,radius:miles*1609.34,fillColor:'#2c5562',fillOpacity:.06,strokeColor:'#2c5562',strokeOpacity:.5,strokeWeight:1.5,clickable:false,zIndex:5}); }
  else { _radiusCircle.setCenter(c); _radiusCircle.setRadius(miles*1609.34); _radiusCircle.setMap(gmap); }
  gmap.fitBounds(_radiusCircle.getBounds());
  // hide national-park pins outside the radius
  if(mapReady) PARKS.forEach(function(p){ var m=gmarkersById[p.id]; if(!m)return; var within=_milesBetween(c,{lat:p.lat,lng:p.lng})<=miles; m.setMap((_layerOn.natpark&&within)?gmap:null); });
  loadDestinationsInView();
}
function clearRadius(){ if(_radiusCircle){ _radiusCircle.setMap(null); } window._radiusCenter=null; if(mapReady)applyLayers(); }
function loadDestinationsInView(){
  if(!window.gmap)return;
  var b=gmap.getBounds(); if(!b)return;
  var sw=b.getSouthWest(), ne=b.getNorthEast();
  var bbox=sw.lng().toFixed(3)+','+sw.lat().toFixed(3)+','+ne.lng().toFixed(3)+','+ne.lat().toFixed(3);
  fetch('/api/destinations?bbox='+bbox+'&limit=400').then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||!d.destinations)return;
    if(!_placeIW&&window.google)_placeIW=new google.maps.InfoWindow();
    d.destinations.forEach(function(x){
      if(x.source==='nps'||typeof x.lat!=='number'||typeof x.lng!=='number')return;
      if(_destMarkers[x.id])return; // dedupe across pans
      var forest=x.type==='national_forest';
      var mk=new google.maps.Marker({position:{lat:x.lat,lng:x.lng},map:((forest?_layerOn.forest:_layerOn.statepark)?gmap:null),zIndex:48,title:x.name,
        icon:{path:'M0,-7 L7,0 L0,7 L-7,0 Z',scale:1,fillColor:forest?'#3f7a34':'#5a7d33',fillOpacity:1,strokeColor:'#fffdf7',strokeWeight:1.4}});
      mk._layer=forest?'forest':'statepark';
      mk.addListener('click',function(){ if(_placeIW){ var label=forest?'National Forest':'State Park';
        _placeIW.setContent('<div style="font-family:Hanken Grotesk,sans-serif;max-width:210px"><b style="color:#1d3941">'+x.name+'</b><div style="font-size:12px;color:#5b6258;margin-top:3px">'+label+(x.state?' \u00b7 '+x.state:'')+'</div><a href="/park-status?dest='+encodeURIComponent(x.id)+'" style="font-size:12px;color:#2c5562;font-weight:700;display:inline-block;margin-top:6px">View live status \u2192</a></div>'); _placeIW.open(gmap,mk); } });
      _destMarkers[x.id]=mk; _placeMarkers.push(mk);
    });
  }).catch(function(){});
}
function loadMapDestinations(p){
  if(!window.gmap||!p||typeof p.lat!=='number')return;
  fetch('/api/destinations?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)+'&radius=140').then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||!d.destinations||(selected&&selected.id!==p.id))return;
    if(!_placeIW&&window.google)_placeIW=new google.maps.InfoWindow();
    d.destinations.forEach(function(x){ if(typeof x.lat!=='number'||typeof x.lng!=='number')return;
      if(x.source==='nps')return; // national parks already have their own pins
      var mk=new google.maps.Marker({position:{lat:x.lat,lng:x.lng},map:((x.type==='national_forest'?_layerOn.forest:_layerOn.statepark)?gmap:null),zIndex:48,title:x.name,
        icon:{path:'M0,-7 L7,0 L0,7 L-7,0 Z',scale:1,fillColor:x.type==='national_forest'?'#3f7a34':'#5a7d33',fillOpacity:1,strokeColor:'#fffdf7',strokeWeight:1.4}});
      mk._layer=x.type==='national_forest'?'forest':'statepark';
      mk.addListener('click',function(){ if(_placeIW){ var label=x.type==='national_forest'?'National Forest':'State Park';
        _placeIW.setContent('<div style="font-family:Hanken Grotesk,sans-serif;max-width:210px"><b style="color:#1d3941">'+x.name+'</b><div style="font-size:12px;color:#5b6258;margin-top:3px">'+label+(x.state?' \u00b7 '+x.state:'')+'</div><a href="/park-status?dest='+encodeURIComponent(x.id)+'" style="font-size:12px;color:#2c5562;font-weight:700;display:inline-block;margin-top:6px">View live status \u2192</a><div style="font-size:10px;color:#a79f8c;margin-top:6px">PAD-US / USFS / OpenStreetMap</div></div>'); _placeIW.open(gmap,mk); } });
      _placeMarkers.push(mk);
    });
  }).catch(function(){});
}
function loadMapWater(p){
  if(!window.gmap||!p||typeof p.lat!=='number')return;
  mapLoad(1);
  fetch('/api/water?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)+'&radius=35').then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||!d.lakes||(selected&&selected.id!==p.id))return;
    if(!_placeIW&&window.google)_placeIW=new google.maps.InfoWindow();
    d.lakes.forEach(function(x){ if(typeof x.lat!=='number')return;
      var mk=new google.maps.Marker({position:{lat:x.lat,lng:x.lng},map:(_layerOn.water?gmap:null),zIndex:45,title:x.name,
        icon:{path:google.maps.SymbolPath.CIRCLE,scale:5,fillColor:'#3a8fc4',fillOpacity:.95,strokeColor:'#fffdf7',strokeWeight:1.5}});
      mk._layer='water';
      mk.addListener('click',function(){ if(_placeIW){ _placeIW.setContent('<div style="font-family:Hanken Grotesk,sans-serif"><b style="color:#1d3941">\uD83D\uDCA7 '+x.name+'</b><div style="font-size:12px;color:#5b6258;text-transform:capitalize">'+(x.kind||'lake')+'</div><div style="font-size:10px;color:#a79f8c;margin-top:5px">\u00a9 OpenStreetMap</div></div>'); _placeIW.open(gmap,mk); } });
      _placeMarkers.push(mk);
    });
  }).catch(function(){}).then(function(){ mapLoad(-1); });
}

/* ----- Unified Filters (persistent block at top of side panel) ----- */
function buildLegend(){
  var host=document.getElementById('ip-filters'); if(!host||host._built)return; host._built=true;
  var groups=[
    ['Destination types',[
      ['natpark','\u25cf','#c79a4b','National Parks'],
      ['statepark','\u25c6','#5a7d33','State Parks'],
      ['forest','\u25c6','#3f7a34','National Forests']
    ]],
    ['On the map',[
      ['places','\u25b2','#d2843a','Campgrounds & areas'],
      ['water','\u25cf','#3a8fc4','Lakes & water'],
      ['hiking','\u2014','#3f7a34','Hiking trails'],
      ['offroad','\u2014','#a15a2a','Off-road / 4x4'],
      ['ski','\u2014','#2a6f9e','Ski routes']
    ]]
  ];
  function row(r){
    return '<label class="pbfl-row" style="display:flex;align-items:center;gap:10px;padding:7px 5px;cursor:pointer;border-radius:10px">'+
      '<span style="width:22px;height:22px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:7px;background:'+r[2]+'1f;color:'+r[2]+';font-size:.78rem">'+r[1]+'</span>'+
      '<span style="flex:1;font-size:.84rem;font-weight:600;color:#1d3941">'+r[3]+'</span>'+
      '<span class="pbsw" style="position:relative;width:36px;height:21px;flex:none"><input type="checkbox" data-layer="'+r[0]+'" checked style="position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:2"><span class="pbsw-tr" style="position:absolute;inset:0;border-radius:999px;background:linear-gradient(120deg,#e4be78,#c79a4b);transition:.2s"></span><span class="pbsw-kn" style="position:absolute;top:2px;left:17px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:.2s"></span></span>'+
    '</label>';
  }
  host.innerHTML='<style>#ip-filters .pbfl-row:hover{background:#f6efdf}#ip-filters .pbsw input:not(:checked)+.pbsw-tr{background:#cdd3c2!important}#ip-filters .pbsw input:not(:checked)~.pbsw-kn{left:2px!important}</style>'+
    '<button id="flHead" style="display:flex;align-items:center;gap:9px;width:100%;cursor:pointer;font-family:inherit;font-weight:800;font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;color:#1d3941;background:none;border:none;padding:11px 13px">'+
      '<span style="font-size:.92rem">\u2699\ufe0f</span>Filters'+
      '<span id="flCount" style="font-size:.64rem;font-weight:800;color:#15241c;background:linear-gradient(120deg,#e4be78,#c79a4b);padding:2px 8px;border-radius:999px;letter-spacing:0">8</span>'+
      '<span id="flChev" style="margin-left:auto;color:#a98a4e;transition:transform .2s;transform:rotate(180deg)">\u25be</span></button>'+
    '<div id="flBody" style="padding:0 13px 12px">'+
      '<div style="font-size:.58rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a98a4e;margin:11px 2px 4px">Search radius</div>'+
      '<div style="background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.7);border-radius:12px;padding:11px 12px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:.8rem;font-weight:700;color:#1d3941">Within <b id="flRadVal" style="color:#2c5562">150 mi</b></span><button id="flNear" style="font-size:.7rem;font-weight:800;color:#15241c;background:linear-gradient(120deg,#e4be78,#c79a4b);border:none;padding:6px 11px;border-radius:999px;cursor:pointer">📍 Near me</button></div>'+
        '<input id="flRad" type="range" min="25" max="500" step="25" value="150" style="width:100%;accent-color:#c79a4b;cursor:pointer">'+
        '<div id="flRadHint" style="font-size:.7rem;color:#8c8473;margin-top:5px">Tap “Near me” or pick a place, then set the distance.</div>'+
      '</div>'+
      groups.map(function(g){return '<div style="font-size:.58rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#a98a4e;margin:11px 2px 2px">'+g[0]+'</div>'+g[1].map(row).join('');}).join('')+
      '<div style="display:flex;gap:7px;margin-top:11px"><button id="flAll" style="flex:1;border:1px solid #e7ddca;background:#fbf6ea;color:#1d3941;font-family:inherit;font-weight:700;font-size:.74rem;padding:7px;border-radius:9px;cursor:pointer">All</button><button id="flNone" style="flex:1;border:1px solid #e7ddca;background:#fbf6ea;color:#1d3941;font-family:inherit;font-weight:700;font-size:.74rem;padding:7px;border-radius:9px;cursor:pointer">None</button></div>'+
    '</div>';
  var count=host.querySelector('#flCount'), body=host.querySelector('#flBody'), chev=host.querySelector('#flChev'), open=true;
  function refreshCount(){ count.textContent=host.querySelectorAll('input[data-layer]:checked').length; }
  host.querySelector('#flHead').addEventListener('click',function(){ open=!open; body.style.display=open?'':'none'; chev.style.transform=open?'rotate(180deg)':''; });
  function paintSw(cb){ var sw=cb.parentNode, kn=sw.querySelector('.pbsw-kn'), tr=sw.querySelector('.pbsw-tr'); if(!kn||!tr)return; if(cb.checked){ kn.style.left='17px'; tr.style.background='linear-gradient(120deg,#e4be78,#c79a4b)'; } else { kn.style.left='2px'; tr.style.background='#cdd3c2'; } }
  host.querySelectorAll('input[data-layer]').forEach(function(cb){ paintSw(cb); cb.addEventListener('change',function(){ _layerOn[cb.getAttribute('data-layer')]=cb.checked; paintSw(cb); applyLayers(); refreshCount(); }); });
  function setAll(v){ host.querySelectorAll('input[data-layer]').forEach(function(cb){ cb.checked=v; _layerOn[cb.getAttribute('data-layer')]=v; paintSw(cb); }); applyLayers(); refreshCount(); }
  host.querySelector('#flAll').addEventListener('click',function(){ setAll(true); });
  host.querySelector('#flNone').addEventListener('click',function(){ setAll(false); });
  var radEl=host.querySelector('#flRad'), radVal=host.querySelector('#flRadVal'), radHint=host.querySelector('#flRadHint');
  radEl.addEventListener('input',function(){ radVal.textContent=radEl.value+' mi'; if(window._radiusCenter) applyRadius(+radEl.value); });
  host.querySelector('#flNear').addEventListener('click',function(){
    radHint.textContent='Locating\u2026';
    if(!navigator.geolocation){ radHint.textContent='Location unavailable on this device.'; return; }
    navigator.geolocation.getCurrentPosition(function(pos){ window._radiusCenter={lat:pos.coords.latitude,lng:pos.coords.longitude}; radHint.textContent='Showing within '+radEl.value+' mi of you.'; applyRadius(+radEl.value); }, function(){ radHint.textContent='Couldn\u2019t get your location — allow location access.'; });
  });
}
function loadMapPlaces(p){
  if(!window.gmap||!p||typeof p.lat!=='number')return;
  clearMapPlaces();
  mapLoad(1);
  fetch('/api/places?lat='+p.lat.toFixed(4)+'&lng='+p.lng.toFixed(4)+'&radius=50').then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||(selected&&selected.id!==p.id))return;
    if(!_placeIW&&window.google)_placeIW=new google.maps.InfoWindow();
    function mkIcon(kind){
      if(kind==='water') return {path:google.maps.SymbolPath.CIRCLE,scale:5,fillColor:'#3a8fc4',fillOpacity:.95,strokeColor:'#fffdf7',strokeWeight:1.5};
      if(kind==='camp') return {path:'M0,-8 L8,7 L-8,7 Z',scale:1.05,fillColor:'#d2843a',fillOpacity:1,strokeColor:'#fffdf7',strokeWeight:1.3};
      if(kind==='recarea') return {path:google.maps.SymbolPath.CIRCLE,scale:5.5,fillColor:'#2f7d4f',fillOpacity:1,strokeColor:'#fffdf7',strokeWeight:1.5};
      return {path:'M-4.5,-4.5 L4.5,-4.5 L4.5,4.5 L-4.5,4.5 Z',scale:1,fillColor:'#2c5562',fillOpacity:1,strokeColor:'#fffdf7',strokeWeight:1.3};
    }
    var isWater=function(x){ return /lake|reservoir|\bpond\b|\briver\b|marina|boat|waterway|\bbay\b|lagoon/i.test((x.name||'')+' '+(x.type||'')); };
    var add=function(x,kind){ if(typeof x.lat!=='number'||typeof x.lng!=='number')return;
      if(isWater(x)) kind='water';
      var water=(kind==='water');
      var mk=new google.maps.Marker({position:{lat:x.lat,lng:x.lng},map:((water?_layerOn.water:_layerOn.places)?gmap:null),zIndex:water?45:50,
        icon:mkIcon(kind),title:x.name});
      if(water) mk._layer='water';
      mk.addListener('click',function(){ if(_placeIW){ _placeIW.setContent('<div style="font-family:Hanken Grotesk,sans-serif;max-width:200px"><b style="color:#1d3941">'+x.name+'</b>'+(x.type||x.description?'<div style="font-size:12px;color:#5b6258;margin-top:3px">'+(x.type||x.description)+'</div>':'')+(x.url?'<a href="'+x.url+'" target="_blank" rel="noopener" style="font-size:12px;color:#2c5562;font-weight:700;display:inline-block;margin-top:5px">View on Recreation.gov ↗</a>':'')+'<div style="font-size:10px;color:#a79f8c;margin-top:6px">Recreation.gov / RIDB</div></div>'); _placeIW.open(gmap,mk); } });
      _placeMarkers.push(mk);
    };
    (d.recAreas||[]).forEach(function(x){ add(x,'recarea'); });
    (d.facilities||[]).forEach(function(x){ add(x, /camp/i.test(x.type||'')?'camp':'facility'); });
  }).catch(function(){}).then(function(){ mapLoad(-1); });
  loadMapTrails(p);
  loadMapWater(p);
  loadMapDestinations(p);
  // gateway / adventure town pin
  if(window.PB_GATEWAY){ var g=window.PB_GATEWAY(p.name); if(g&&typeof g.lat==='number'){ var gm=new google.maps.Marker({position:{lat:g.lat,lng:g.lng},map:(_layerOn.places?gmap:null),zIndex:60,title:g.town,icon:{path:'M0,-8 L2.2,-2.2 L8,-2.2 L3.4,1.6 L5.2,7.6 L0,4 L-5.2,7.6 L-3.4,1.6 L-8,-2.2 L-2.2,-2.2 Z',scale:1.5,fillColor:'#e4be78',fillOpacity:1,strokeColor:'#15241c',strokeWeight:1}}); gm.addListener('click',function(){ if(_placeIW){ _placeIW.setContent('<div style="font-family:Hanken Grotesk,sans-serif;max-width:210px"><div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#a98a4e">Adventure basecamp</div><b style="color:#1d3941">'+g.town+'</b><div style="font-size:12px;color:#5b6258;margin-top:3px">'+g.blurb+'</div></div>'); _placeIW.open(gmap,gm); } }); _placeMarkers.push(gm); } }
}function paintStates(){ applyMapFilter(true); }
function showLabel(){} function hideLabel(){}
