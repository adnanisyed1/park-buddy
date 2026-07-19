// Node test for app/lib/saved.js — no framework, no browser.
//   node test/saved.test.mjs
import fs from "fs";
// Stub the browser bits saved.js expects.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const listeners = {};
globalThis.window = {
  addEventListener: (t, f) => ((listeners[t] ||= []).push(f)),
  removeEventListener: () => {},
  dispatchEvent: (e) => ((listeners[e.type] || []).forEach((f) => f(e)), true),
};
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
globalThis.Event = class { constructor(t) { this.type = t; } };

const src = fs.readFileSync(new URL("../app/lib/saved.js", import.meta.url), "utf8")
  .replace(/^"use client";\s*/, "");
const tmp = new URL("./.saved.compiled.mjs", import.meta.url);
fs.writeFileSync(tmp, src);
const S = await import(tmp);
fs.unlinkSync(tmp);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra !== undefined ? "  → " + JSON.stringify(extra) : "")); }
};

// --- ids -----------------------------------------------------------------
const zion = { kind: "park", name: "Zion", ref: "zion", state: "Utah" };
ok("id is deterministic", S.makeId(zion) === S.makeId({ ...zion }));
ok("id shape", S.makeId(zion) === "park:zion:zion", S.makeId(zion));
ok("same name, different kind → different id",
   S.makeId({ kind: "park", name: "Emerald Lake" }) !== S.makeId({ kind: "water", name: "Emerald Lake" }));
ok("same name, different ref → different id",
   S.makeId({ kind: "trail", name: "Emerald Lake", ref: "ROMO" }) !==
   S.makeId({ kind: "trail", name: "Emerald Lake", ref: "ZION" }));
ok("accents/punctuation slug cleanly",
   S.makeId({ kind: "town", name: "Cañon City, CO" }) === "town:canon-city-co",
   S.makeId({ kind: "town", name: "Cañon City, CO" }));

// --- save / dedupe -------------------------------------------------------
const r1 = S.savePlace({ kind: "park", name: "Zion", ref: "zion", state: "Utah", lat: 37.29, lng: -113.02 });
ok("save returns ok+id", r1.ok && !!r1.id);
ok("savedCount 1", S.savedCount() === 1, S.savedCount());
ok("isSaved", S.isSaved(r1.id));
const firstAt = S.getItem(r1.id).savedAt;
await new Promise((r) => setTimeout(r, 5));
const r2 = S.savePlace({ kind: "park", name: "Zion", ref: "zion", state: "Utah", sub: "National park · Utah" });
ok("re-save dedupes", S.savedCount() === 1, S.savedCount());
ok("re-save flagged already", r2.already === true);
ok("re-save keeps original savedAt", S.getItem(r1.id).savedAt === firstAt);
ok("re-save refreshes details", S.getItem(r1.id).sub === "National park · Utah");
ok("thin re-save must NOT wipe coords", S.getItem(r1.id).lat === 37.29, S.getItem(r1.id));

// --- more items ----------------------------------------------------------
const t = S.savePlace({ kind: "trail", name: "Angels Landing", ref: "zion", lat: 37.26, lng: -112.94 });
const c = S.savePlace({ kind: "camp", name: "Watchman Campground", ref: "zion" });
const d = S.savePlace({ kind: "drive", name: "Highway 12", ref: "highway-12-scenic-byway" });
const w = S.savePlace({ kind: "water", name: "Sand Hollow Reservoir", state: "Utah" });
ok("5 saved", S.savedCount() === 5, S.savedCount());
ok("lakes+campgrounds are savable", S.isSaved(c.id) && S.isSaved(w.id));

// --- buckets -------------------------------------------------------------
const b = S.createBucket("Utah, spring");
ok("bucket created", b.ok && !!b.bucket.id);
ok("duplicate bucket name refused", S.createBucket("utah, SPRING").ok === false);
ok("unfiled = all 5 before filing", S.unfiled().length === 5, S.unfiled().length);
S.addToBucket(b.bucket.id, [r1.id, t.id, c.id]);
ok("bucket holds 3", S.bucketItems(b.bucket.id).length === 3);
ok("unfiled drops to 2", S.unfiled().length === 2, S.unfiled().length);
ok("addToBucket is idempotent", S.addToBucket(b.bucket.id, [r1.id]).added === 0);
ok("item can be in two buckets",
   (S.createBucket("Someday").ok && S.addToBucket(S.getBuckets().find(x=>x.name==="Someday").id,[r1.id]).added === 1
    && S.bucketsHolding(r1.id).length === 2), S.bucketsHolding(r1.id).map(x=>x.name));

// --- deleting a bucket must not delete places ---------------------------
const someday = S.getBuckets().find((x) => x.name === "Someday");
S.deleteBucket(someday.id);
ok("bucket deleted", S.getBuckets().length === 1);
ok("places SURVIVE bucket deletion", S.savedCount() === 5, S.savedCount());

// --- unsave cleans bucket refs ------------------------------------------
S.unsave(t.id);
ok("unsaved", S.savedCount() === 4);
ok("bucket no longer references it", S.bucketItems(b.bucket.id).length === 2,
   S.bucketItems(b.bucket.id).map((i) => i.name));

// --- toStops bridge ------------------------------------------------------
const stops = S.toStops([r1.id, c.id, d.id, w.id]);
ok("toStops maps all 4", stops.length === 4, stops);
ok("park gets 2 nights", stops[0].nights === 2);
ok("campground gets 0 nights", stops.find((s) => s.name === "Watchman Campground").nights === 0);
ok("drive → kind byway + slug", (() => { const s = stops.find((x) => x.name === "Highway 12");
   return s.kind === "byway" && s.slug === "highway-12-scenic-byway"; })(), stops.find((x)=>x.name==="Highway 12"));
ok("lake marked custom", stops.find((s) => s.name === "Sand Hollow Reservoir").custom === true);
ok("park NOT marked custom", stops[0].custom === undefined);

// --- persistence round-trip ---------------------------------------------
const raw = store.get("pb_saved");
ok("persisted under pb_saved", !!raw);
ok("survives reload", (() => { const parsed = JSON.parse(raw);
   return Object.keys(parsed.items).length === 4 && parsed.buckets.length === 1; })());

// --- corruption tolerance ------------------------------------------------
store.set("pb_saved", "{not json");
ok("garbage JSON → empty, no throw", S.savedCount() === 0);
store.set("pb_saved", JSON.stringify({ v: 1, items: { x: { name: "Ghost" } },
  buckets: [{ name: "B", itemIds: ["x", "missing-id"] }] }));
ok("dangling bucket refs dropped", S.getBuckets()[0].itemIds.length === 1, S.getBuckets()[0].itemIds);

// --- subscribe -----------------------------------------------------------
store.clear();
let fired = 0, lastSaved = null;
const off = S.subscribeSaved(() => fired++);
if (listeners["pb:saved"]) listeners["pb:saved"].push((e) => (lastSaved = e.detail && e.detail.saved));
S.savePlace({ kind: "park", name: "Arches", ref: "arch" });
ok("subscriber fired", fired === 1, fired);
ok("save carries the item in detail", lastSaved && lastSaved.name === "Arches", lastSaved);
S.unsave(S.makeId({ kind: "park", name: "Arches", ref: "arch" }));
ok("unsave fires with null detail", fired === 2 && lastSaved === null, { fired, lastSaved });
off();
S.savePlace({ kind: "park", name: "Bryce", ref: "brca" });
ok("unsubscribed stops firing", fired === 2, fired);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
