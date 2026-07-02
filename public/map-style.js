/* ParkBuddy — custom Google Maps style. Google Maps stays the engine;
   this just restyles the default 'roadmap' to match the brand (cream/sage land,
   muted teal water, gold-tinted parks, minimal labels). Terrain/satellite remain
   selectable. Used by the Explore map and the Build-a-trip map. */
window.PARKBUDDY_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#eef1e2" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5c6b54" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f7f3e6" }, { weight: 2 }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#cdbf9e" }, { weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#c3b48f" }, { weight: 1 }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#a99668" }, { weight: 1.2 }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#dfe6cc" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#d4dcbb" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cdd9ab" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5b7a3a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#efe9d6" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e3d9bd" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#d6c8a3" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ece4cf" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a9cdc9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5c8a86" }] }
];
