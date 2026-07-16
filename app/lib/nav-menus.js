// Shared platform navigation menus — the single source of truth for the Explore /
// Book / Shop dropdowns. Used by the React SiteHeader AND the /shop storefront (so
// the shop's native hamburger menu carries the exact same destinations as the rest
// of the platform). Pure data, no component deps — safe to import anywhere without
// pulling in the header's modal/auth tree.

// Explore — ways to experience the parks. Park-anchored activities (dive/climb the
// parks) lean on the real park data spine, not standalone apps.
export const EXPLORE_MENU = [
  { icon: "🗺", label: "The Live Map", desc: "Parks, forests & state parks — live", href: "/explore" },
  { icon: "🧭", label: "Trip Studio", desc: "Plan a national-parks road trip", href: "/build-trip" },
  { icon: "🛣", label: "Scenic Drives", desc: "Byways & road trips", href: "/scenic-drives" },
  { icon: "◉", label: "Trip Mode", desc: "Live on-trip: photos, checklist, alerts", href: "/trip-mode" },
  { icon: "🚢", label: "Cruises", desc: "Reach the parks by sea", href: "/cruises" },
  { icon: "🤿", label: "Diving the Parks", desc: "Dry Tortugas · Channel Islands", href: "/diving", soon: true },
  { icon: "🧗", label: "Climbing the Parks", desc: "Yosemite · Zion · Joshua Tree", href: "/climbing", soon: true },
];

// Book — everything you can reserve, split by category. Each deep-links to
// /book?cat=… which filters the grid there.
export const BOOK_MENU = [
  { icon: "🗂", label: "All bookings", desc: "Everything you can reserve", href: "/book" },
  { icon: "🏡", label: "Stays", desc: "Lodges, cabins & vacation rentals", href: "/book?cat=stays" },
  { icon: "🏕", label: "Campgrounds & RV", desc: "Recreation.gov sites + RV parks", href: "/book?cat=camp" },
  { icon: "🚗", label: "Rental cars", desc: "For the drive & scenic byways", href: "/book?cat=cars" },
  { icon: "⚓", label: "Cruises", desc: "Reach the parks by sea", href: "/book?cat=cruises" },
  { icon: "🧭", label: "Tours & experiences", desc: "Guided hikes, rafting, climbs", href: "/book?cat=tours" },
  { icon: "🎫", label: "Permits & reservations", desc: "Timed-entry & wilderness permits", href: "/book?cat=permits" },
  { icon: "🚌", label: "Shuttles & transport", desc: "Park shuttles & gateway transfers", href: "/book?cat=shuttles" },
];

// Platform "go anywhere" directory — the destinations the top-bar bubble opens as a
// tile sheet (same display as Explore). One flat list of the main places across the
// whole platform, so from any page you can jump anywhere.
export const PLATFORM_MENU = [
  { icon: "🗺", label: "The Live Map", desc: "Parks, forests & state parks — live", href: "/explore" },
  { icon: "🧭", label: "Trip Studio", desc: "Plan a national-parks road trip", href: "/build-trip" },
  { icon: "🛣", label: "Scenic Drives", desc: "Byways & road trips", href: "/scenic-drives" },
  { icon: "◉", label: "Trip Mode", desc: "Live on-trip: photos, checklist, alerts", href: "/trip-mode" },
  { icon: "🎒", label: "My Trips", desc: "Your saved trips & itineraries", href: "/trips" },
  { icon: "📅", label: "Book", desc: "Stays, campsites, cars, permits", href: "/book" },
  { icon: "🛍", label: "Shop", desc: "Trip Book, gear & apparel", href: "/shop" },
  { icon: "🌲", label: "Pines", desc: "Reels, but for the wild", href: "/pines" },
  { icon: "🚢", label: "Cruises", desc: "Reach the parks by sea", href: "/cruises" },
  { icon: "🤿", label: "Diving the Parks", desc: "Dry Tortugas · Channel Islands", href: "/diving", soon: true },
  { icon: "🧗", label: "Climbing the Parks", desc: "Yosemite · Zion · Joshua Tree", href: "/climbing", soon: true },
];

// Shop — the store by category. The Park Buddy Store (the exclusive apparel &
// art storefront at /shop) and Trip Book are live; the rest open in stages (Soon).
export const SHOP_MENU = [
  { icon: "🏔", label: "The Park Buddy Store", desc: "Exclusive Park Buddy apparel & art", href: "/shop" },
  { icon: "📖", label: "Trip Book", desc: "Your trip, printed & bound — live", href: "/trip-book" },
  { icon: "🎟", label: "Passes", desc: "America the Beautiful + park passes", href: "/shop?cat=passes", soon: true },
  { icon: "🎒", label: "Gear & Apparel", desc: "Packs, layers, footwear", href: "/shop?cat=gear", soon: true },
  { icon: "⛺", label: "Camp & Cook", desc: "Tents, bags, stoves", href: "/shop?cat=camp", soon: true },
  { icon: "🧭", label: "Navigation & Safety", desc: "GPS, satellite, first-aid", href: "/shop?cat=nav", soon: true },
  { icon: "🗺", label: "Maps & Guides", desc: "Topo maps & guidebooks", href: "/shop?cat=maps", soon: true },
  { icon: "🔭", label: "Optics & Cameras", desc: "Binoculars & scopes", href: "/shop?cat=optics", soon: true },
];
