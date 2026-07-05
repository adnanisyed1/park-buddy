// "Things to do" — the NPS's own curated activities for the park (real ranger
// content with NPS photos), nearest to the page's spot first. Server component;
// data from statusData.getThingsToDo(). Images are direct NPS URLs.
import { SectionTitle } from "./StatusShell";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Internal-first: cards link to OUR /todo-status reference page (which carries
// the coordinates, park phone, and the official NPS link as its leaf) — never
// straight out to nps.gov from a listing.
function todoHref(t, pc) {
  const qs = new URLSearchParams({ t: t.title, pc: pc || "" });
  if (t.short) qs.set("d", t.short);
  if (t.img) qs.set("img", t.img);
  if (t.duration) qs.set("dur", t.duration);
  if (t.url) qs.set("url", t.url);
  if (t.lat != null && t.lng != null) { qs.set("lat", t.lat); qs.set("lng", t.lng); }
  if (t.activities && t.activities.length) qs.set("act", t.activities.join("|"));
  if (t.reservation) qs.set("res", "1");
  return "/todo-status?" + qs.toString();
}

export default function ThingsToDo({ items, parkCode }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginBottom: 26 }}>
      <SectionTitle right="Curated by the National Park Service">Things to do</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {items.map((t, i) => (
          <a key={i} href={todoHref(t, parkCode)} style={{ display: "block", textDecoration: "none", background: "var(--pb-surface)", border: "1px solid rgba(217,183,121,.16)", borderRadius: 18, overflow: "hidden", color: "var(--pb-ink)" }}>
            <figure style={{ position: "relative", aspectRatio: "16/10", margin: 0, overflow: "hidden", background: "repeating-linear-gradient(135deg,var(--pb-surface-2) 0 12px,var(--pb-surface) 12px 24px)" }}>
              {t.img && <img src={t.img} alt={t.title} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
              {t.distMi != null && <span style={{ position: "absolute", left: 9, top: 9, background: "rgba(21,36,28,.85)", color: "var(--pb-ink)", fontFamily: mono, fontSize: ".6rem", fontWeight: 700, letterSpacing: ".08em", borderRadius: 999, padding: "3px 9px" }}>{Math.round(t.distMi)} MI</span>}
            </figure>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: ".88rem", fontWeight: 800, lineHeight: 1.3 }}>{t.title}</div>
              <div style={{ fontFamily: mono, fontSize: ".6rem", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--pb-muted)", marginTop: 4 }}>
                {[t.activities[0], t.duration, t.reservation ? "Reservation" : null].filter(Boolean).join(" · ") || "NPS activity"}
              </div>
              {t.short && <div style={{ fontSize: ".76rem", color: "var(--pb-muted)", lineHeight: 1.5, marginTop: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.short}</div>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
