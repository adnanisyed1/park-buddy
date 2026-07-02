/* ParkPulse configuration.
   The Google Maps key is NO LONGER hardcoded here (the previously committed key
   was leaked and has been rotated). It is injected as window.GMAPS_KEY by
   app/layout.js from the NEXT_PUBLIC_GMAPS_KEY environment variable (set in the
   Netlify dashboard). This file only guarantees the global exists so legacy
   embed scripts can read it safely; it never overwrites the injected value. */
window.GMAPS_KEY = window.GMAPS_KEY || "";
