import { redirect } from "next/navigation";

// /explore-next was the staging route while this was being built and compared
// against the old page. It took over at /explore on 2026-07-19, so anything
// still pointing here — a bookmark, a link shared during review — lands on the
// real page rather than a second copy competing for the same search queries.
//
// Permanent, because the route is not coming back.
export default function ExploreNextRedirect() {
  redirect("/explore");
}
