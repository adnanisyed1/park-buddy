// "Live webcams" — real NPS cameras for the park, nearest to the page's spot
// first. Server component; data from statusData.getWebcams(). We deep-link to
// NPS's own live player rather than re-hosting frames, so "LIVE" is honest.
import { SectionTitle } from "./StatusShell";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const serif = "var(--pb-serif), 'Spectral', Georgia, serif";

export default function WebcamsSection({ webcams }) {
  if (!webcams || !webcams.length) return null;
  return (
    <div style={{ marginBottom: 26 }}>
      <SectionTitle right="NPS cameras · view on nps.gov">Park webcams</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
        {webcams.map((w, i) => (
          <a key={i} href={w.pageUrl} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", background: "var(--pb-bg)", borderRadius: 20, padding: 16, color: "var(--pb-bg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ width: 9, height: 9, borderRadius: "50%", background: "#7fc98f", boxShadow: "0 0 8px 1px rgba(127,201,143,.7)", flex: "none" }} />
              {/* Most NPS cams are periodic still cameras, not video streams —
                  label them honestly rather than branding everything "live". */}
              <span style={{ fontFamily: mono, fontSize: ".58rem", fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: "#a9d8b4" }}>{w.isStreaming ? "Live stream" : "NPS camera · updates periodically"}</span>
              {w.distMi != null && <span style={{ marginLeft: "auto", fontFamily: mono, fontSize: ".6rem", color: "rgba(243,237,224,.6)" }}>{Math.round(w.distMi)} mi</span>}
            </div>
            <div style={{ fontFamily: serif, fontWeight: 700, fontSize: "1.05rem", marginTop: 8, color: "var(--pb-surface)" }}>{w.title}</div>
            {w.description && <div style={{ fontSize: ".76rem", color: "rgba(243,237,224,.75)", lineHeight: 1.5, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{w.description}</div>}
            <div style={{ marginTop: 12, display: "inline-block", background: "linear-gradient(120deg,#e8cf9a,#c9a35f)", color: "var(--pb-bg)", fontSize: ".74rem", fontWeight: 800, padding: "7px 13px", borderRadius: 999 }}>{w.isStreaming ? "Watch live ↗" : "View camera ↗"}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
