import Link from "next/link";

// Reusable FTC affiliate disclosure — drop it on any surface that carries affiliate
// links (Book, Shop, gear recommendations). The FTC requires disclosure to be "clear
// and conspicuous" in plain language where it can't be missed, so this is a visible
// line near the links, not a buried footnote. `variant="mono"` matches the existing
// small-caps disclosure rows on /book and /shop; default is a readable inline note.
export default function AffiliateDisclosure({ variant = "default", amazon = false, style }) {
  const full = <Link href="/affiliate-disclosure" style={{ color: "var(--pb-gold)", textDecoration: "underline", textUnderlineOffset: 2 }}>How we earn ↗</Link>;

  if (variant === "mono") {
    return (
      <p style={{ textAlign: "center", fontFamily: "var(--pb-mono)", fontSize: ".58rem", letterSpacing: ".05em", color: "var(--pb-muted)", lineHeight: 1.6, ...style }}>
        Some links are affiliate links — Park Buddy may earn a commission, and it never changes your price.
        {amazon ? " As an Amazon Associate, we earn from qualifying purchases." : ""}
        <br />Prices &amp; availability come live from each partner. We never invent inventory or reviews. {full}
      </p>
    );
  }

  return (
    <p style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", lineHeight: 1.55, ...style }}>
      Some links here are affiliate links — Park Buddy may earn a commission if you book or buy, and <b style={{ color: "var(--pb-ink)" }}>it never changes your price</b>.
      {amazon ? " As an Amazon Associate, we earn from qualifying purchases." : ""} {full}
    </p>
  );
}
