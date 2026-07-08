import { ImageResponse } from "next/og";

// Branded share card for /pines — what unfurls when the link is posted anywhere
// (iMessage, Slack, X, Instagram, etc.). Self-contained: no external assets/fonts.
export const runtime = "edge";
export const alt = "Pines — reels, but for the wild";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg,#0e2016,#0a1712 55%,#08130d)", padding: 72, color: "#f4f1ea", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="#0a1712"><path d="M12 2l5 9h-3l5 9H5l5-9H7z" /><rect x="11" y="18" width="2" height="4" /></svg>
          </div>
          <div style={{ fontSize: 30, letterSpacing: 8, color: "#d9b779", textTransform: "uppercase" }}>Park Buddy · Pines</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.02, color: "#f4f1ea", letterSpacing: -1 }}>Reels, but for the wild.</div>
          <div style={{ fontSize: 34, color: "#aab0ba", marginTop: 24, maxWidth: 900, lineHeight: 1.4 }}>Real Adventures from the national parks — captured on-site, pinned to the place, next to today's live conditions.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "#0a1712", fontSize: 28, fontWeight: 700, padding: "14px 28px", borderRadius: 999 }}>Get early access</div>
          <div style={{ fontSize: 26, color: "#7f8a82" }}>theparkbuddy.com/pines</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
