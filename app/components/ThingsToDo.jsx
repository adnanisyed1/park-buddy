// "Things to do" — the NPS's own curated activities for the park (real ranger
// content with NPS photos), nearest to the page's spot first. Server component;
// data from statusData.getThingsToDo(). Images are direct NPS URLs.
import { SectionTitle } from "./StatusShell";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

export default function ThingsToDo({ items }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginBottom: 26 }}>
      <SectionTitle right="Curated by the National Park Service">Things to do</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {items.map((t, i) => (
          <a key={i} href={t.url} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", background: "#fffdf8", border: "1px solid #e2dac8", borderRadius: 18, overflow: "hidden", color: "#22261f" }}>
            <figure style={{ position: "relative", aspectRatio: "16/10", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,#ece5d4 0 12px,#e6dfcd 12px 24px)" }}>
              {t.img && <img src={t.img} alt={t.title} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
              {t.distMi != null && <span style={{ position: "absolute", left: 9, top: 9, background: "rgba(21,36,28,.85)", color: "#f3ede0", fontFamily: mono, fontSize: ".6rem", fontWeight: 700, letterSpacing: ".08em", borderRadius: 999, padding: "3px 9px" }}>{Math.round(t.distMi)} MI</span>}
            </figure>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: ".88rem", fontWeight: 800, lineHeight: 1.3 }}>{t.title}</div>
              <div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".08em", textTransform: "uppercase", color: "#8a8471", marginTop: 4 }}>
                {[t.activities[0], t.duration, t.reservation ? "Reservation" : null].filter(Boolean).join(" · ") || "NPS activity"}
              </div>
              {t.short && <div style={{ fontSize: ".76rem", color: "#6d7263", lineHeight: 1.5, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.short}</div>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
