"use client";

// The trail sub-view: what you get after picking a trail out of a park's list.
//
// This was the single largest thing the Explore rebuild dropped. The old page
// had a full drill-down here — computed statistics, a photo, and reviews backed
// by a real Supabase table with real rows in it — and the rebuild rendered
// trails as inert rows. None of this is new work; it's the same three shared
// modules (trailStats, elevationClient, auth) the /trail-status page uses,
// pointed at the panel.
//
// Restyled onto the --pb-* tokens rather than copied pixel-for-pixel: the old
// version hardcoded rgba() values tuned for a permanently dark page, and this
// one follows the theme.
import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient, initAuth, openAuth } from "../lib/auth";
import { estimateTimeLabel, estimateDifficulty, routeTypeFor } from "../lib/trailStats";
import { fetchElevationProfile } from "../lib/elevationClient";
import { usePhoto } from "../components/PhotoThumb";
import SaveButton from "../components/SaveButton";

const micro = { fontFamily: "var(--pb-mono)", fontSize: ".58rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-muted)" };
const CAT_LABEL = { hiking: "Hiking trail", offroad: "Off-road / 4x4 route", ski: "Ski route" };

/* ------------------------------------------------------------------ stats */
// Elevation is a live Google Elevation call, so it's the one stat that can be
// genuinely unavailable. Three states, not two: still loading, unavailable, or a
// number — an unknown gain must not render as "0 ft".
function TrailStats({ tr, parkName }) {
  const [gainFt, setGainFt] = useState(undefined);   // undefined = loading, null = unavailable
  useEffect(() => {
    let on = true;
    setGainFt(undefined);
    fetchElevationProfile("trail:" + parkName + "|" + tr.name, tr.path)
      .then((p) => { if (on) setGainFt(p && p.gainFt); })
      .catch(() => { if (on) setGainFt(null); });
    return () => { on = false; };
  }, [parkName, tr.name, tr.path]);

  const lengthMi = tr.lengthMi > 0 ? tr.lengthMi : null;
  const canEstimate = lengthMi != null && typeof gainFt === "number";

  const cells = [
    ["Length", lengthMi != null ? lengthMi + " mi" : "Unknown"],
    ["Elevation gain", gainFt === undefined ? "…" : gainFt == null ? "Unknown" : gainFt + " ft"],
    ["Est. route type", routeTypeFor(tr.path)],
    canEstimate ? ["Est. time", estimateTimeLabel(lengthMi, gainFt)] : null,
    canEstimate ? ["Est. difficulty", estimateDifficulty(lengthMi, gainFt)] : null,
    tr.surface ? ["Surface", tr.surface] : null,
    tr.trailClass ? ["Trail class", tr.trailClass] : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12,
      padding: "14px 16px", borderRadius: 13, background: "var(--pb-tint)", border: "1px solid var(--pb-line)" }}>
      {cells.map(([label, value]) => (
        <div key={label}>
          <div style={micro}>{label}</div>
          <b style={{ display: "block", marginTop: 4, fontSize: ".95rem", fontWeight: 600 }}>{value}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- reviews */
function StarRow({ value, onChange, size }) {
  return (
    <div style={{ display: "flex", gap: 2 }} role={onChange ? "radiogroup" : "img"}
      aria-label={onChange ? "Your rating" : value + " out of 5"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={onChange ? () => onChange(n) : undefined}
          role={onChange ? "radio" : undefined} aria-checked={onChange ? n === value : undefined}
          style={{ cursor: onChange ? "pointer" : "default", lineHeight: 1, fontSize: size || "1.1rem",
            color: n <= value ? "var(--pb-gold)" : "color-mix(in srgb, var(--pb-gold) 18%, transparent)" }}>★</span>
      ))}
    </div>
  );
}

// Keyed on the NPS OBJECTID (tr.id). Without one there's nothing stable to hang
// a review on, so the section renders nothing rather than collecting notes that
// can never be found again.
function ReviewsSection({ tr }) {
  const [supa, setSupa] = useState(null);
  const [reviews, setReviews] = useState(null);   // null = loading
  const [user, setUser] = useState(null);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { initAuth(); setSupa(getClient()); }, []);

  useEffect(() => {
    if (!supa) return;
    let on = true;
    supa.auth.getSession().then(({ data }) => { if (on) setUser((data && data.session && data.session.user) || null); });
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => { if (on) setUser((session && session.user) || null); });
    return () => { on = false; if (sub && sub.subscription) sub.subscription.unsubscribe(); };
  }, [supa]);

  useEffect(() => {
    if (!supa || tr.id == null) return;
    let on = true;
    setReviews(null); setFailed(false);
    supa.from("trail_reviews").select("*").eq("trail_id", String(tr.id))
      .order("created_at", { ascending: false })
      .then(({ data, error }) => { if (!on) return; setFailed(!!error); setReviews(error ? [] : (data || [])); });
    return () => { on = false; };
  }, [supa, tr.id]);

  // Pre-fill with whatever this person already said, so submitting again edits
  // their review rather than silently replacing it with a blank one.
  useEffect(() => {
    if (!user || !reviews) return;
    const mine = reviews.find((r) => r.user_id === user.id);
    if (mine) { setMyRating(mine.rating); setMyText(mine.review_text || ""); }
  }, [user, reviews]);

  if (tr.id == null) return null;

  const avg = reviews && reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  async function submit() {
    if (!supa || !user || !myRating) return;
    setSaving(true);
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || (user.email || "Explorer").split("@")[0];
    const { error } = await supa.from("trail_reviews").upsert({
      user_id: user.id, trail_id: String(tr.id), park_code: tr.parkCode || "", trail_name: tr.name,
      rating: myRating, review_text: myText.trim(), author_name: name, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,trail_id" });
    if (!error) {
      const { data } = await supa.from("trail_reviews").select("*").eq("trail_id", String(tr.id))
        .order("created_at", { ascending: false });
      setReviews(data || []);
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={micro}>Reviews</span>
        {avg != null && (
          <span style={{ fontSize: ".78rem", color: "var(--pb-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <StarRow value={Math.round(avg)} size=".85rem" /> {avg.toFixed(1)} ({reviews.length})
          </span>
        )}
      </div>

      {(!supa || reviews === null) && (
        <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginBottom: 10 }}>
          {supa ? "Loading reviews…" : "Reviews need an account connection, which isn't available here."}
        </div>
      )}
      {failed && (
        <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginBottom: 10 }}>
          Couldn&rsquo;t load reviews for this trail.
        </div>
      )}
      {supa && reviews && reviews.length === 0 && !failed && (
        <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginBottom: 10 }}>
          No notes from the trail yet — be the first to leave one.
        </div>
      )}

      {supa && reviews && reviews.map((r) => (
        <div key={r.id} style={{ background: "var(--pb-tint)", border: "1px solid var(--pb-line)",
          borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <b style={{ fontSize: ".82rem" }}>{r.author_name || "Explorer"}</b>
            <StarRow value={r.rating} size=".8rem" />
          </div>
          {r.review_text && (
            <div style={{ fontSize: ".8rem", color: "var(--pb-ink-2)", lineHeight: 1.5 }}>{r.review_text}</div>
          )}
        </div>
      ))}

      {supa && !user && (
        <button onClick={() => openAuth()}
          style={{ width: "100%", cursor: "pointer", marginTop: 4, padding: 10, borderRadius: 10,
            border: "1px solid var(--pb-line-strong)", background: "var(--pb-tint)",
            color: "var(--pb-ink)", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 600 }}>
          Sign in to write a review
        </button>
      )}

      {supa && user && (
        <div style={{ background: "var(--pb-tint)", border: "1px solid var(--pb-line)", borderRadius: 12,
          padding: 12, marginTop: 4 }}>
          <div style={{ fontSize: ".76rem", fontWeight: 600, marginBottom: 6 }}>
            {myRating ? "Your review" : "Rate this trail"}
          </div>
          <StarRow value={myRating} onChange={setMyRating} size="1.2rem" />
          <textarea value={myText} onChange={(e) => setMyText(e.target.value)} rows={3}
            placeholder="Share tips, conditions, or highlights (optional)"
            style={{ width: "100%", boxSizing: "border-box", marginTop: 8, padding: 8, borderRadius: 8,
              border: "1px solid var(--pb-line-strong)", background: "var(--pb-surface-2)",
              color: "var(--pb-ink)", fontFamily: "inherit", fontSize: ".8rem", resize: "vertical", outline: "none" }} />
          <button onClick={submit} disabled={!myRating || saving}
            style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "none",
              fontFamily: "inherit", fontSize: ".8rem", fontWeight: 700,
              cursor: myRating && !saving ? "pointer" : "default",
              background: myRating ? "var(--pb-grad-gold)" : "var(--pb-surface-2)",
              color: myRating ? "var(--pb-bg)" : "var(--pb-muted)" }}>
            {saving ? "Saving…" : "Submit review"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- the screen */
export default function TrailDetail({ trail, place, onBack }) {
  // Candidates, most specific first — a bare trail name is far too generic to
  // find the right photograph ("East Shore Trail" exists in dozens of places).
  // The "trail:" prefix the old page used was a CACHE KEY, not part of the
  // query; sending it as a search term is how you get no result at all.
  const photo = usePhoto(
    trail.name + " " + place.name + "|" + trail.name + " trail " + (place.state || ""),
    null, null, "trail:" + place.name + "|" + trail.name, 900
  );
  const statusHref = trail.id != null
    ? "/trail-status?trail=" + encodeURIComponent(trail.id) + (place.npsCode ? "&park=" + encodeURIComponent(place.npsCode) : "")
    : "";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} aria-label={"Back to trails in " + place.name}
          style={{ cursor: "pointer", width: 28, height: 28, borderRadius: "50%", flex: "none",
            border: "1px solid var(--pb-line-strong)", background: "transparent",
            color: "var(--pb-ink)", fontSize: ".95rem", lineHeight: 1 }}>‹</button>
        <button onClick={onBack} style={{ flex: 1, textAlign: "left", cursor: "pointer", background: "none",
          border: "none", padding: 0, color: "var(--pb-gold)", fontFamily: "var(--pb-sans)", fontSize: ".8rem" }}>
          Back to trails in {place.name}
        </button>
        <SaveButton variant="bare" size={28} place={{
          kind: "trail", name: trail.name, ref: place.npsCode || place.name, state: place.state,
          lat: null, lng: null, sub: CAT_LABEL[trail.cat] || "Trail", href: statusHref,
        }} />
      </div>

      {photo && photo.url && (
        <div style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "16/7",
          background: "var(--pb-surface-2)", border: "1px solid var(--pb-line)" }}>
          <img src={photo.url} alt={trail.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <div>
        <div style={micro}>{CAT_LABEL[trail.cat] || "Trail"}</div>
        <h2 style={{ margin: "6px 0 0", fontFamily: "var(--pb-serif)", fontWeight: 300, fontSize: "1.8rem", lineHeight: 1.1 }}>
          {trail.name}
        </h2>
      </div>

      <TrailStats tr={trail} parkName={place.name} />

      {trail.seasonal && (
        <div style={{ padding: "11px 14px", borderRadius: 12,
          background: "color-mix(in srgb, var(--pb-prepare) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--pb-prepare) 45%, transparent)" }}>
          <b style={{ fontSize: ".84rem" }}>Seasonal route</b>
          <div style={{ fontSize: ".79rem", color: "var(--pb-ink-2)", marginTop: 3, lineHeight: 1.45 }}>
            {trail.seasonNote || "This route isn't open year-round — check with the park before you go."}
          </div>
        </div>
      )}

      {trail.notes && (
        <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", lineHeight: 1.55 }}>{trail.notes}</div>
      )}

      {statusHref && (
        <Link href={statusHref}
          style={{ display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box",
            padding: "13px 16px", borderRadius: 12, fontWeight: 700, fontSize: ".9rem",
            background: "var(--pb-grad-gold)", color: "var(--pb-bg)" }}>
          Open full trail status →
        </Link>
      )}

      <ReviewsSection tr={{ ...trail, parkCode: place.npsCode || "" }} />

      {/* The same disclosure the old panel carried. Trail geometry and attributes
          are the Park Service's; whether a trail is passable today is not
          something this data can answer. */}
      <div style={{ ...micro, lineHeight: 1.7, letterSpacing: ".06em", textTransform: "none",
        fontFamily: "var(--pb-sans)", fontSize: ".72rem" }}>
        Trail data from the National Park Service public trails dataset. Length, surface and class are
        as published; elevation, time and difficulty are estimates. None of it reflects today&rsquo;s
        closures or conditions — check with the park before you go.
      </div>
    </div>
  );
}
