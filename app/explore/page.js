import { redirect } from "next/navigation";

// The map IS the homepage now — /explore permanently forwards to / so every
// existing link (headers, embeds, bookmarks, search results) keeps working.
export default function ExplorePage() {
  redirect("/");
}
