import LegalShell from "../components/LegalShell";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using Park Buddy — including the important safety note that conditions are informational, not a guarantee.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 2026">
      <p>Welcome to Park Buddy. By using the site or creating an account, you agree to these terms. We've kept them plain. Questions: <a href="mailto:support@theparkbuddy.com">support@theparkbuddy.com</a>.</p>

      <h2>⚠️ Safety — please read this one</h2>
      <p>Park Buddy shows live conditions and a GO / PREPARE / HOLD "verdict" built from public data (weather, alerts, wildfire, air quality). <b>This is information to help you plan — it is not a guarantee of safety or current conditions.</b> Nature changes fast. Always check official sources (the NPS park page, NWS, and rangers) before you go, and use your own judgment. You are responsible for your own safety in the outdoors.</p>

      <h2>Your account</h2>
      <p>You must be 13 or older. Keep your login secure; you're responsible for activity on your account. Don't misuse the service, break the law, scrape or overload it, or try to bypass its limits.</p>

      <h2>Your content (Pines, posts, reviews)</h2>
      <ul>
        <li>You keep ownership of what you post. By posting, you grant Park Buddy a non-exclusive, worldwide license to host, display, and promote it within the product (e.g. in the feed, on a place's page, and in shared links).</li>
        <li>Post only <b>real, on-site</b> content you have the right to share. No stock, no fakes, nothing illegal, hateful, dangerous, or infringing; no photos of identifiable minors without consent; respect wildlife and Leave No Trace.</li>
        <li>Everything is subject to moderation. We can remove content or accounts that break these rules.</li>
      </ul>

      <h2>Reporting &amp; copyright (DMCA)</h2>
      <p>See a Pine or post that shouldn't be here? Use the <b>Report</b> control on it, or email <a href="mailto:support@theparkbuddy.com">support@theparkbuddy.com</a>. If you believe content infringes your copyright, send a DMCA notice (identify the work, the URL, your contact info, and a good-faith statement) to <a href="mailto:dmca@theparkbuddy.com">dmca@theparkbuddy.com</a> and we'll act on valid notices.</p>

      <h2>Purchases</h2>
      <p>Printed Trip Books and any other paid items are made to order. Pricing and any refund/return terms are shown at checkout. Because print books are custom-made, returns are limited to defects or shipping damage — we'll make those right. Affiliate links to partners (stays, gear, tours) may earn us a commission at no extra cost to you; see our <a href="/attributions">disclosure</a>.</p>

      <h2>The basics</h2>
      <p>Park Buddy is provided "as is." To the extent the law allows, we're not liable for indirect or consequential damages, and our total liability is limited to what you paid us in the prior 12 months. We may update these terms; we'll post changes here.</p>
    </LegalShell>
  );
}
