import "./globals.css";
import "./ui.css";
import { Spectral, Hanken_Grotesk, Space_Grotesk, Cormorant_Garamond, Inter, Space_Mono } from "next/font/google";

const spectral = Spectral({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-spectral" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-hanken" });
// Stat numbers on the /trail-status, /lake-status, /campground-status pages.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-space-grotesk" });

// Park Buddy design system (see DESIGN.md): Cormorant Garamond (display serif) +
// Inter (body) + Space Mono (micro-labels), matching the landing page. These
// power the --pb-serif / --pb-sans / --pb-mono tokens in globals.css.
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant" });
const inter = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-inter" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

// Set NEXT_PUBLIC_SITE_URL to whatever domain is CURRENTLY serving (the Vercel
// preview URL until launch, then https://theparkbuddy.com) so canonical URLs,
// Open Graph images and the sitemap resolve to absolute URLs. The fallback is the
// long-term production domain, used only when the env var is unset.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://theparkbuddy.com";

// Lock the mobile viewport so the app behaves like a native app: no pinch-zoom, no
// double-tap zoom, and no iOS auto-zoom-into-inputs. (Emits
// width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no.)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Park Buddy — Discover, plan & collect the outdoors",
    template: "%s · Park Buddy",
  },
  description:
    "Discover the best national parks and lakes near you, build real-road trips with live weather and conditions, and collect a digital Trip Passport.",
  applicationName: "Park Buddy",
  keywords: [
    "national parks", "trip planner", "road trip", "hiking", "camping",
    "park weather", "park conditions", "outdoors", "trail finder",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Park Buddy",
    title: "Park Buddy — Discover, plan & collect the outdoors",
    description:
      "Discover the best national parks and lakes near you, build real-road trips, and collect a digital Trip Passport.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Park Buddy — Discover, plan & collect the outdoors",
    description:
      "Discover the best national parks and lakes near you, build real-road trips, and collect a digital Trip Passport.",
  },
  robots: { index: true, follow: true },
};

// Site-wide structured data so search engines understand the brand + search action.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Park Buddy",
  url: SITE_URL,
  description:
    "Discover the best national parks and lakes near you, build real-road trips, and collect a digital Trip Passport.",
  publisher: { "@type": "Organization", name: "Park Buddy", url: SITE_URL },
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly et al.) inject
    // attributes into <html>/<body> before React hydrates, throwing minified
    // errors #418/#423/#425 in production. React recovers, but noisily.
    <html lang="en" className={`${spectral.variable} ${hanken.variable} ${spaceGrotesk.variable} ${cormorant.variable} ${inter.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Google Maps key, injected from the environment (Netlify env var).
            Runs before any embed-pipeline script (config.js no longer carries a
            literal key — the leaked one was rotated). NEXT_PUBLIC_* values are
            inlined at build time, so this is a static string in the HTML. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.GMAPS_KEY=${JSON.stringify(process.env.NEXT_PUBLIC_GMAPS_KEY || "")};`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
