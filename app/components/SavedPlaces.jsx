"use client";

// "Saved Places" — the account-panel section. Lives here rather than in Explore on
// purpose: browsing should stay clean, so the ♥ is the only trace of saving out
// there and the shelf itself is somewhere you go deliberately.
//
// Three views inside one section, matching the panel's existing back-arrow pattern:
//   home   → the default shelf + your buckets
//   bucket → the places in one bucket, selectable, with the bridge to Trip Studio
//   file   → pick a bucket for one place ("Add to bucket")
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getBuckets, bucketItems, unfiled, savedCount, subscribeSaved,
  createBucket, deleteBucket, addToBucket, removeFromBucket,
  unsave, toStops, kindLabel,
} from "../lib/saved";
import { getStops, setStops } from "../lib/trip";

const mono = "var(--pb-mono)";
const serif = "var(--pb-serif)";
const micro = { fontFamily: mono, fontSize: ".54rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--pb-muted)" };
const ghostBtn = { cursor: "pointer", fontFamily: "var(--pb-sans)", fontWeight: 600, fontSize: ".8rem", color: "var(--pb-ink)", background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "8px 14px" };
const goldBtn = { cursor: "pointer", fontFamily: "var(--pb-sans)", fontWeight: 700, fontSize: ".88rem", color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 12, padding: "12px 16px", width: "100%" };

// Re-render whenever the store changes, wherever the change came from.
function useSavedState() {
  const [n, setN] = useState(0);
  useEffect(() => subscribeSaved(() => setN((x) => x + 1)), []);
  return n;
}

export default function SavedPlaces({ onClose }) {
  const tick = useSavedState();
  const router = useRouter();
  const [view, setView] = useState("home");
  const [bucketId, setBucketId] = useState(null);
  const [filing, setFiling] = useState(null);      // an item awaiting a bucket
  const [picked, setPicked] = useState(() => new Set());
  const [newName, setNewName] = useState("");
  const [flash, setFlash] = useState("");

  const buckets = useMemo(() => getBuckets(), [tick]);
  const shelf = useMemo(() => unfiled(), [tick]);
  const total = useMemo(() => savedCount(), [tick]);
  const current = useMemo(() => (bucketId ? buckets.find((b) => b.id === bucketId) : null), [buckets, bucketId]);
  const items = useMemo(() => (bucketId ? bucketItems(bucketId) : shelf), [bucketId, shelf, tick]);

  const say = useCallback((m) => { setFlash(m); setTimeout(() => setFlash(""), 2600); }, []);

  const openBucket = (id) => { setBucketId(id); setPicked(new Set()); setView("bucket"); };
  const openShelf = () => { setBucketId(null); setPicked(new Set()); setView("bucket"); };
  const home = () => { setView("home"); setBucketId(null); setPicked(new Set()); };

  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // The bridge. Merge into the existing trip rather than replacing it — someone
  // with a half-built itinerary must not lose it by sending two more places over.
  const sendToTrip = () => {
    const ids = Array.from(picked);
    if (!ids.length) return;
    const incoming = toStops(ids);
    const existing = getStops();
    const have = new Set(existing.map((s) => s.name));
    const fresh = incoming.filter((s) => !have.has(s.name));
    setStops(existing.concat(fresh));
    const skipped = incoming.length - fresh.length;
    say(fresh.length
      ? "Added " + fresh.length + " to your trip" + (skipped ? " · " + skipped + " already there" : "")
      : "Already in your trip");
    setPicked(new Set());
    if (fresh.length) setTimeout(() => { if (onClose) onClose(); router.push("/build-trip"); }, 700);
  };

  const makeBucket = () => {
    const r = createBucket(newName);
    if (!r.ok) { say(r.reason === "exists" ? "You already have a bucket with that name" : "Give it a name first"); return; }
    setNewName("");
    say("Bucket created");
  };

  // ---- file one place into a bucket -------------------------------------
  if (view === "file" && filing) {
    return (
      <div>
        <Back onClick={() => { setFiling(null); setView("home"); }} label={"Add “" + filing.name + "” to…"} />
        {!buckets.length && <p style={{ color: "var(--pb-ink-2)", fontSize: ".9rem" }}>No buckets yet — make one below.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {buckets.map((b) => (
            <button key={b.id} onClick={() => { addToBucket(b.id, [filing.id]); setFiling(null); setView("home"); say("Filed into " + b.name); }}
              style={rowBtn}>
              <span style={{ fontWeight: 600, color: "var(--pb-ink)" }}>{b.name}</span>
              <span style={{ ...micro }}>{b.itemIds.length} places</span>
            </button>
          ))}
        </div>
        <NewBucket value={newName} onChange={setNewName} onCreate={makeBucket} />
        <Flash text={flash} />
      </div>
    );
  }

  // ---- inside a bucket (or the default shelf) ---------------------------
  if (view === "bucket") {
    const title = current ? current.name : "Saved places";
    return (
      <div>
        <Back onClick={home} label={title} />
        {!items.length && (
          <Empty text={current
            ? "Nothing filed in here yet. Open a saved place and choose this bucket."
            : "Nothing saved yet. Tap the ♥ on any park, trail, campground or drive."} />
        )}

        <div style={{ display: "grid", gap: 8 }}>
          {items.map((it) => {
            const on = picked.has(it.id);
            return (
              <div key={it.id} style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "10px 12px", borderRadius: 13,
                background: on ? "var(--pb-surface-2)" : "var(--pb-tint)",
                border: "1px solid " + (on ? "var(--pb-gold-2)" : "var(--pb-line)"),
              }}>
                <button onClick={() => toggle(it.id)} aria-pressed={on}
                  aria-label={on ? "Deselect " + it.name : "Select " + it.name}
                  style={{
                    cursor: "pointer", flex: "none", width: 22, height: 22, borderRadius: "50%",
                    background: on ? "var(--pb-grad-gold)" : "transparent",
                    border: on ? "none" : "1.5px solid var(--pb-line-strong)",
                    color: "var(--pb-bg)", fontSize: ".7rem", fontWeight: 800, lineHeight: 1,
                  }}>{on ? "✓" : ""}</button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: ".92rem", color: "var(--pb-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  <div style={{ fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 2 }}>
                    {kindLabel(it.kind)}{it.state ? " · " + it.state : ""}{it.sub ? " · " + it.sub : ""}
                  </div>
                </div>

                {current
                  ? <button onClick={() => { removeFromBucket(current.id, [it.id]); say("Removed from " + current.name); }}
                      title="Take out of this bucket" style={iconBtn}>−</button>
                  : <button onClick={() => { setFiling(it); setView("file"); }}
                      title="Add to a bucket" style={iconBtn}>+</button>}
                <button onClick={() => { unsave(it.id); say("Unsaved"); }} title="Unsave" style={iconBtn}>♥</button>
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <button onClick={sendToTrip} disabled={!picked.size}
              style={{ ...goldBtn, opacity: picked.size ? 1 : 0.45, cursor: picked.size ? "pointer" : "default" }}>
              {picked.size ? "Add " + picked.size + " to Trip Studio" : "Select places to add"}
            </button>
            <div style={{ textAlign: "center", fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 8 }}>
              Your trip has {getStops().length} stop{getStops().length === 1 ? "" : "s"}
            </div>
          </div>
        )}

        {current && (
          <button onClick={() => { deleteBucket(current.id); home(); say("Bucket deleted — its places are back on the shelf"); }}
            style={{ ...ghostBtn, marginTop: 18, color: "var(--pb-hold)" }}>Delete this bucket</button>
        )}
        <Flash text={flash} />
      </div>
    );
  }

  // ---- home: shelf + buckets --------------------------------------------
  return (
    <div>
      {!total && <Empty text="Nothing saved yet. Tap the ♥ on any park, trail, campground, lake or scenic drive — it lands here." />}

      {total > 0 && (
        <>
          <button onClick={openShelf} style={{ ...rowBtn, marginBottom: 18, borderColor: "var(--pb-line-strong)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--pb-surface-2)", border: "1px solid var(--pb-line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--pb-gold)", fontSize: "1rem" }}>♥</span>
              <span style={{ textAlign: "left" }}>
                <span style={{ display: "block", fontWeight: 600, color: "var(--pb-ink)", fontSize: ".95rem" }}>Saved places</span>
                <span style={{ display: "block", fontSize: ".76rem", color: "var(--pb-muted)", marginTop: 2 }}>
                  {shelf.length ? shelf.length + " not filed yet" : "All filed into buckets"}
                </span>
              </span>
            </span>
            <span style={{ color: "var(--pb-muted)" }}>›</span>
          </button>

          <div style={{ ...micro, marginBottom: 9 }}>Your buckets</div>
          <div style={{ display: "grid", gap: 8 }}>
            {buckets.map((b) => (
              <button key={b.id} onClick={() => openBucket(b.id)} style={rowBtn}>
                <span style={{ textAlign: "left" }}>
                  <span style={{ display: "block", fontWeight: 600, color: "var(--pb-ink)", fontSize: ".92rem" }}>{b.name}</span>
                  <span style={{ display: "block", fontSize: ".74rem", color: "var(--pb-muted)", marginTop: 2 }}>
                    {b.itemIds.length ? b.itemIds.length + " place" + (b.itemIds.length === 1 ? "" : "s") : "Empty — nothing filed here yet"}
                  </span>
                </span>
                <span style={{ color: "var(--pb-muted)" }}>›</span>
              </button>
            ))}
            {!buckets.length && (
              <div style={{ fontSize: ".82rem", color: "var(--pb-muted)" }}>
                No buckets yet. A bucket is just a name for a set of places — “Utah, spring”, “With the kids”.
              </div>
            )}
          </div>
          <NewBucket value={newName} onChange={setNewName} onCreate={makeBucket} />
          <div style={{ fontSize: ".78rem", color: "var(--pb-muted)", marginTop: 16, lineHeight: 1.5 }}>
            Open a bucket to send its places to Trip Studio. Deleting a bucket keeps its places — they go back to the shelf.
          </div>
        </>
      )}
      <Flash text={flash} />
    </div>
  );
}

/* ---------------------------------------------------------------- bits */
const rowBtn = {
  cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 10, padding: "11px 13px", borderRadius: 13,
  background: "var(--pb-tint)", border: "1px solid var(--pb-line)",
  fontFamily: "var(--pb-sans)", fontSize: ".9rem", color: "var(--pb-ink)",
};
const iconBtn = {
  cursor: "pointer", flex: "none", width: 28, height: 28, borderRadius: "50%",
  background: "transparent", border: "1px solid var(--pb-line)",
  color: "var(--pb-gold)", fontSize: ".8rem", lineHeight: 1,
};

function Back({ onClick, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <button onClick={onClick} aria-label="Back"
        style={{ cursor: "pointer", width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--pb-line-strong)", background: "transparent", color: "var(--pb-ink)", fontSize: "1rem", lineHeight: 1, flex: "none" }}>‹</button>
      <div style={{ fontFamily: serif, fontWeight: 600, fontSize: "1.1rem", color: "var(--pb-ink)" }}>{label}</div>
    </div>
  );
}

function NewBucket({ value, onChange, onCreate }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onCreate(); }}
        placeholder="New bucket — e.g. Utah, spring" maxLength={60}
        style={{ flex: 1, background: "var(--pb-tint)", border: "1px solid var(--pb-line-strong)", borderRadius: 11, padding: "10px 12px", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", fontSize: ".86rem", outline: "none" }} />
      <button onClick={onCreate} style={ghostBtn}>Create</button>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ padding: "26px 18px", textAlign: "center", border: "1px dashed var(--pb-line-strong)", borderRadius: 14, color: "var(--pb-muted)", fontSize: ".86rem", lineHeight: 1.55 }}>
      {text}
    </div>
  );
}

function Flash({ text }) {
  if (!text) return null;
  return (
    <div role="status" style={{ marginTop: 14, padding: "10px 13px", borderRadius: 11, background: "var(--pb-surface-2)", border: "1px solid var(--pb-gold-2)", color: "var(--pb-ink)", fontSize: ".84rem" }}>
      {text}
    </div>
  );
}
