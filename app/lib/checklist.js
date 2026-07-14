"use client";

// The one Pack & Go checklist for the whole trip. Trip Studio's Pack & Go panel writes
// here; Trip Mode and the trip PDF/share read from here, so what you pack rides along.
// Items: { id, cat: "pack"|"grab"|"do", label, why, done }. Persisted to localStorage.

const KEY = "pb_checklist_v2";
const subs = new Set();
let counter = 0;

function read() {
  if (typeof window === "undefined") return [];
  try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}
function write(items) {
  if (typeof window !== "undefined") { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }
  subs.forEach((f) => { try { f(); } catch {} });
}

export function getChecklist() { return read(); }
export function subscribeChecklist(fn) { subs.add(fn); return () => subs.delete(fn); }

// Add items, skipping ones whose label already exists. Returns how many were added.
export function addChecklistItems(newItems) {
  const cur = read();
  const have = new Set(cur.map((i) => (i.label || "").toLowerCase()));
  const add = (newItems || [])
    .filter((i) => i && i.label && !have.has(i.label.toLowerCase()))
    .map((i) => ({ id: "ck_" + Date.now().toString(36) + "_" + (counter++), cat: ["pack", "grab", "do"].includes(i.cat) ? i.cat : "pack", label: String(i.label).slice(0, 80), why: i.why || "", done: false }));
  if (add.length) write([...cur, ...add]);
  return add.length;
}
export function addChecklistItem(cat, label) { return addChecklistItems([{ cat, label }]); }
export function toggleChecklistItem(id) { write(read().map((i) => (i.id === id ? { ...i, done: !i.done } : i))); }
export function removeChecklistItem(id) { write(read().filter((i) => i.id !== id)); }
export function clearChecklist() { write([]); }
