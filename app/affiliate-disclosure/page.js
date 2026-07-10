import LegalShell from "../components/LegalShell";

export const metadata = {
  title: "Affiliate Disclosure",
  description:
    "How Park Buddy earns from partner links — plainly. Some links to stays, gear, and tours are affiliate links; we may earn a commission, and it never changes your price.",
  alternates: { canonical: "/affiliate-disclosure" },
};

export default function AffiliateDisclosurePage() {
  return (
    <LegalShell title="Affiliate Disclosure" updated="July 2026">
      <p><b>The short version:</b> some links on Park Buddy are affiliate links. If you book or buy through one, we may earn a commission. <b>It never changes the price you pay</b>, and it never changes what we show you — we recommend places and gear on their merits, not their payout.</p>

      <h2>Where this applies</h2>
      <ul>
        <li><b>Forest stays</b> — cabins, lodges and glamping we link to (e.g. Vrbo, Booking.com, Hipcamp, Glamping Hub). We link to cabin &amp; nature inventory, not generic hotels.</li>
        <li><b>Rental cars</b> — links to car-rental partners for the drive.</li>
        <li><b>Tours &amp; experiences</b> — guided hikes, rafting and the like, via partners such as Viator.</li>
        <li><b>Gear &amp; shop</b> — recommended equipment and products via partners such as REI, Garmin and B&amp;H (and Amazon, once we join their program).</li>
      </ul>
      <p>Where we link Amazon products, we carry Amazon's required notice: <em>&ldquo;As an Amazon Associate, Park Buddy earns from qualifying purchases.&rdquo;</em></p>

      <h2>Where it does <em>not</em> apply</h2>
      <p>Some things we link to pay us nothing and we link them anyway because they're the right answer — for example <b>Recreation.gov</b> campsites, cabins and fire-lookout towers, and <b>state-park</b> reservation systems. Government booking is a public service, not a commission source.</p>

      <h2>Our honesty rules</h2>
      <ul>
        <li>We <b>never invent</b> inventory, prices, availability or reviews. Prices and availability come live from each partner at the time you click.</li>
        <li>Commissions <b>never influence rankings</b> or what we call a good fit for your trip.</li>
        <li>Reviews on Park Buddy are genuine user content only — we don't buy, sell, or fabricate them.</li>
        <li>Every place we recommend has to relate back to a real park, forest, or the route to one.</li>
      </ul>

      <h2>Questions</h2>
      <p>Anything unclear about how we earn? Email <a href="mailto:hello@theparkbuddy.com">hello@theparkbuddy.com</a> and we'll explain plainly.</p>
    </LegalShell>
  );
}
