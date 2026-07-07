"use client";

// Park Buddy auth — a client-side module store (same pattern as trip.js): ONE
// Supabase client, session state, per-user cloud sync, and all sign-in methods.
// Supersedes the legacy public/auth.js on React pages. The anon key is a
// publishable key (safe in the client; also in public/supabase-config.js).
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fsgmwersernbtjugkuhk.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XWefJHwU9mPJ9frijodnfQ_XBXFEUnn";

// localStorage keys mirrored to Supabase `user_data` per signed-in user.
const TRACK = ["pp_trip2", "pp_map_trip", "pp_favorites", "pp_prefs", "pp_stamped", "pp_passports", "pb_trip", "pb_trip_meta", "pb_trip_checklist", "pb_trip_story"];

let supa = null, user = null, ready = false, modalOpen = false, pushT = null, inited = false;
const subs = new Set();
function notify() { subs.forEach((fn) => { try { fn(); } catch {} }); }

function client() {
  if (supa) return supa;
  if (typeof window === "undefined") return null;
  // Reuse the legacy auth.js client if a page loaded it, to avoid two GoTrue
  // clients fighting over the same session.
  if (window.__ppAuth && window.__ppAuth.supa) { supa = window.__ppAuth.supa; return supa; }
  supa = createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return supa;
}
function redirectTo() { return typeof location !== "undefined" ? location.origin + location.pathname : undefined; }

// ---------- cloud sync (ported from auth.js) ----------
function gather() { const o = {}; TRACK.forEach((k) => { const v = localStorage.getItem(k); if (v != null) { try { o[k] = JSON.parse(v); } catch { o[k] = v; } } }); return o; }
function pushCloud() {
  const s = client(); if (!s || !user) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => { s.from("user_data").upsert({ id: user.id, data: gather(), updated_at: new Date().toISOString() }).then(() => {}, () => {}); }, 600);
}
async function pullCloud() {
  const s = client(); if (!s || !user) return;
  try {
    const { data } = await s.from("user_data").select("data").eq("id", user.id).maybeSingle();
    const d = data && data.data;
    if (!d || !Object.keys(d).length) { pushCloud(); return; }
    let tripChanged = false;
    TRACK.forEach((k) => { if (d[k] != null) { const nv = JSON.stringify(d[k]); if (localStorage.getItem(k) !== nv) { localStorage.setItem(k, nv); if (k.indexOf("pb_trip") === 0) tripChanged = true; } } });
    if (tripChanged) { try { window.dispatchEvent(new CustomEvent("pb:trip")); window.dispatchEvent(new CustomEvent("pb:tripmode")); } catch {} }
    notify();
  } catch {}
}

export function initAuth() {
  if (inited || typeof window === "undefined") return; inited = true;
  const s = client(); if (!s) { ready = true; return; }
  // push TRACK changes to the cloud (same-tab writes)
  if (!window.__pbSetItemPatched) {
    window.__pbSetItemPatched = true;
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) { orig(k, v); if (user && TRACK.indexOf(k) >= 0) pushCloud(); };
  }
  s.auth.getSession().then(({ data }) => { user = data && data.session ? data.session.user : null; ready = true; notify(); if (user) pullCloud(); });
  s.auth.onAuthStateChange((_e, session) => { const was = user && user.id; user = session ? session.user : null; ready = true; notify(); if (user && user.id !== was) pullCloud(); });
}

// ---------- state accessors ----------
export function getUser() { return user; }
export function getClient() { return client(); }
export function subscribeAuth(fn) { subs.add(fn); return () => subs.delete(fn); }
export function openAuth() { modalOpen = true; notify(); }
export function closeAuth() { modalOpen = false; notify(); }

// ---------- sign-in methods ----------
export async function signOut() { const s = client(); if (s) await s.auth.signOut(); }
export function signInGoogle() { return client().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } }); }
export function signInApple() { return client().auth.signInWithOAuth({ provider: "apple", options: { redirectTo: redirectTo() } }); }
export function signInMagicLink(email) { return client().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } }); }
export function signInPassword(email, password) { return client().auth.signInWithPassword({ email, password }); }
export function signUpPassword(email, password) { return client().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } }); }
export function resetPassword(email) { return client().auth.resetPasswordForEmail(email, { redirectTo: redirectTo() }); }

// ---------- preferences (pp_prefs; auto-synced via TRACK) ----------
export function getPrefs() { try { return JSON.parse(localStorage.getItem("pp_prefs") || "{}") || {}; } catch { return {}; } }
export function setPrefs(p) { try { localStorage.setItem("pp_prefs", JSON.stringify(p)); } catch {} notify(); }

// ---------- React hook ----------
export function useAuth() {
  const [, force] = useState(0);
  useEffect(() => { initAuth(); return subscribeAuth(() => force((n) => n + 1)); }, []);
  return { user, ready, open: modalOpen, openAuth, closeAuth, signOut, signInGoogle, signInApple, signInMagicLink, signInPassword, signUpPassword, resetPassword, getPrefs, setPrefs };
}
