import About from "./About";

// About = the premium animated story page (concept, what we do, the Passport).
// Fully migrated off the embed pipeline into a real React component so the copy
// server-renders into the HTML (SEO) and the page carries proper metadata.
export const metadata = {
  title: "About ParkBuddy",
  description:
    "ParkBuddy is the home for everyone who loves the outdoors — discover parks and lakes, plan real-road trips, and collect a digital Trip Passport.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About ParkBuddy",
    description:
      "The wild, made simple. Discover, plan and collect the outdoors in one beautiful place.",
    url: "/about",
  },
};

export default function AboutPage() {
  return <About />;
}
