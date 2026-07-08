import LegalShell from "../components/LegalShell";

export const metadata = {
  title: "Privacy Policy",
  description: "How Park Buddy collects, uses, and protects your data — plainly. We never sell your personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 2026">
      <p>This is the plain-English version of how Park Buddy handles your data. If anything here isn't clear, email <a href="mailto:privacy@theparkbuddy.com">privacy@theparkbuddy.com</a> and we'll explain. <b>We never sell your personal information.</b></p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account info</b> — when you sign in (Google, Apple, or email), we store your email and basic profile from that provider.</li>
        <li><b>Things you create</b> — trips, packing lists, saved parks, Trip Passport stamps, and any Pines (photos) or posts you share.</li>
        <li><b>Emails you give us</b> — when you join a waitlist or turn on park alerts.</li>
        <li><b>Location</b> — only when you choose to use "near me," post a Pine (from the photo's own GPS), or turn on live trail navigation. A Pine's precise coordinates are kept private; only a place-level location is shown publicly.</li>
        <li><b>Basic technical data</b> — standard request logs your browser sends. We do not run advertising trackers today; if we ever add analytics or an ad pixel, we'll ask for consent first.</li>
      </ul>

      <h2>How we use it</h2>
      <p>To run the product you asked for: show live conditions, save and sync your trips across devices, send the alerts you signed up for, publish the Pines you post, and fulfill any orders you place. That's it — no selling your data, no surprise marketing.</p>

      <h2>Who we share it with (sub-processors)</h2>
      <p>We use trusted services to run Park Buddy, and share only what each needs: <b>Supabase</b> (accounts, database, photo storage), <b>Stripe</b> (payments), <b>Lulu</b> (print fulfillment), <b>Cloudflare</b> (video, if you post video), <b>OpenAI</b> (automated photo safety screening), and an email provider for alerts. Live conditions come from public sources (NPS, NWS, USGS, AirNow) — see <a href="/attributions">Data &amp; attributions</a>.</p>

      <h2>Your choices &amp; rights</h2>
      <ul>
        <li><b>Access or delete</b> — you can request a copy of your data or delete your account and its content at any time. Email <a href="mailto:privacy@theparkbuddy.com">privacy@theparkbuddy.com</a> (self-serve deletion is rolling out in the account panel). Deleting your account removes your profile, trips, Pines, orders, and alert subscriptions.</li>
        <li><b>Unsubscribe</b> — every alert/marketing email has an unsubscribe link; you can also turn off alerts in your account.</li>
        <li><b>Location</b> — you control it through your browser/OS permissions; the app works without it.</li>
      </ul>

      <h2>Kids</h2>
      <p>Park Buddy is for people 13 and older. We don't knowingly collect data from children under 13.</p>

      <h2>Changes</h2>
      <p>If we make a material change, we'll update this page and the "last updated" date. Questions any time: <a href="mailto:privacy@theparkbuddy.com">privacy@theparkbuddy.com</a>.</p>
    </LegalShell>
  );
}
