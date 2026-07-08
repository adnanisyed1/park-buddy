// Server-only Facebook Page auto-poster (Graph API). Posts approved Pines to your
// Facebook Page. Env (add in Vercel, never in chat):
//   FACEBOOK_PAGE_ID              — your Page's numeric id
//   FACEBOOK_PAGE_ACCESS_TOKEN    — a long-lived PAGE access token with
//                                   pages_manage_posts (+ pages_read_engagement)
// Posting to a Page YOU manage works with the app in Development mode (you're the
// admin) — full App Review is only needed to post to pages you don't own.
// Setup: developers.facebook.com → create app (Business) → add your Page → Graph API
// Explorer / token tool → get a long-lived Page token → paste into Vercel env.
const API = "https://graph.facebook.com/v21.0";

export function fbConfigured() {
  return !!(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
}

// Post to the Page. If imageUrl is given → a photo post (best engagement) with the
// caption; otherwise a plain link/message post. Returns the Graph response (has an
// id / post_id) or throws { status, message }.
export async function postToPage({ message = "", link, imageUrl }) {
  if (!fbConfigured()) { const e = new Error("Facebook not configured"); e.status = 503; throw e; }
  const pid = process.env.FACEBOOK_PAGE_ID, tok = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const caption = message + (link ? "\n\n" + link : "");

  const url = imageUrl ? API + "/" + pid + "/photos" : API + "/" + pid + "/feed";
  const body = imageUrl
    ? new URLSearchParams({ url: imageUrl, caption, access_token: tok })
    : new URLSearchParams({ message, access_token: tok, ...(link ? { link } : {}) });

  const r = await fetch(url, { method: "POST", body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const e = new Error((d.error && d.error.message) || "Facebook post failed (" + r.status + ")");
    e.status = 502; throw e;
  }
  return d; // { id } for feed, { id, post_id } for photos
}

// Compose the Page post text for a Pine.
export function pinePostText(pine, siteUrl) {
  const place = pine.place_name ? " at " + pine.place_name : "";
  const cap = pine.caption && pine.caption !== "Adventure" ? "“" + pine.caption + "”\n\n" : "";
  return cap + "A new Adventure" + place + " on Park Buddy Pines. 🌲\nReels, but for the wild.";
}
