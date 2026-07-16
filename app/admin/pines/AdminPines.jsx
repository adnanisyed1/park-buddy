"use client";

// Minimal Pines moderation queue: enter the PINES_ADMIN_SECRET, review Pines that
// are pending (new posts AI didn't auto-clear) or under_review (auto-hidden after
// reports), and approve/reject each. Talks to /api/pines/moderate (GET queue, POST
// approve|reject). The secret lives in sessionStorage for the tab only.
import { useEffect, useState } from "react";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

export default function AdminPines() {
  const [secret, setSecret] = useState("");
  const [entered, setEntered] = useState(false);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(0);

  useEffect(() => {
    const s = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("pb_admin_secret") : "";
    if (s) { setSecret(s); setEntered(true); }
  }, []);

  const load = async (sec) => {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/pines/moderate", { headers: { "x-admin-secret": sec } });
      if (r.status === 401) { setErr("Wrong secret."); setEntered(false); sessionStorage.removeItem("pb_admin_secret"); setQueue(null); return; }
      if (r.status === 503) { setErr("Moderation isn't configured (PINES_ADMIN_SECRET / Supabase missing)."); setQueue([]); return; }
      const d = await r.json().catch(() => ({}));
      setQueue(Array.isArray(d.pines) ? d.pines : []);
    } catch { setErr("Couldn't reach the backend."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (entered && secret) load(secret); }, [entered]);

  const act = async (id, action) => {
    setBusy(id);
    try {
      const r = await fetch("/api/pines/moderate", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-secret": secret }, body: JSON.stringify({ id, action }) });
      if (r.ok) setQueue((q) => (q || []).filter((p) => p.id !== id));
      else { const d = await r.json().catch(() => ({})); setErr(d.error || "Action failed."); }
    } catch { setErr("Couldn't reach the backend."); }
    finally { setBusy(0); }
  };

  const wrap = { minHeight: "100vh", background: "var(--pb-bg)", color: "var(--pb-ink)", fontFamily: "var(--pb-sans)", padding: "clamp(20px,5vw,48px)" };

  if (!entered) {
    return (
      <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <form onSubmit={(e) => { e.preventDefault(); if (!secret.trim()) return; sessionStorage.setItem("pb_admin_secret", secret.trim()); setEntered(true); }}
          style={{ width: "min(380px,100%)", display: "flex", flexDirection: "column", gap: 12, background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 16, padding: 22 }}>
          <div style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.3rem" }}>Pines moderation</div>
          <div style={{ fontSize: ".82rem", color: "var(--pb-ink-2)" }}>Enter the moderation secret to review flagged &amp; pending Pines.</div>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="PINES_ADMIN_SECRET" autoFocus
            style={{ background: "rgba(255,255,255,.05)", border: "1px solid var(--pb-line-strong)", borderRadius: 10, padding: "11px 13px", color: "var(--pb-ink)", fontFamily: mono, fontSize: ".85rem", outline: "none" }} />
          {err && <div style={{ color: "#e08a6a", fontSize: ".78rem" }}>{err}</div>}
          <button type="submit" style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 700, color: "var(--pb-bg)", background: "var(--pb-grad-gold)", border: "none", borderRadius: 10, padding: 12 }}>Open queue</button>
        </form>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "clamp(1.5rem,4vw,2rem)" }}>Pines moderation queue</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => load(secret)} style={ghost}>↻ Refresh</button>
            <button onClick={() => { sessionStorage.removeItem("pb_admin_secret"); setEntered(false); setQueue(null); }} style={ghost}>Lock</button>
          </div>
        </div>
        {err && <div style={{ color: "#e08a6a", fontSize: ".82rem", marginBottom: 14 }}>{err}</div>}
        {loading && <div style={{ color: "var(--pb-muted)" }}>Loading…</div>}
        {queue && queue.length === 0 && !loading && <div style={{ color: "var(--pb-muted)", padding: "40px 0", textAlign: "center" }}>✓ Nothing to review — the queue is clear.</div>}
        <div style={{ display: "grid", gap: 14 }}>
          {(queue || []).map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 14, background: "var(--pb-surface)", border: "1px solid " + (p.status === "under_review" ? "rgba(224,138,106,.5)" : "var(--pb-line)"), borderRadius: 14, padding: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 84, height: 84, borderRadius: 10, overflow: "hidden", background: "#0e1a12", flex: "none" }}>
                {(p.image_url || p.poster_url) ? <img src={p.image_url || p.poster_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "1.4rem" }}>🎬</div>}
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--pb-serif)", fontWeight: 600, fontSize: "1.05rem" }}>{p.place_name || "—"}</span>
                  <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".1em", textTransform: "uppercase", color: p.status === "under_review" ? "#e08a6a" : "var(--pb-gold-soft)", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "2px 8px" }}>{p.status}</span>
                  {p.report_count > 0 && <span style={{ fontFamily: mono, fontSize: ".54rem", letterSpacing: ".1em", textTransform: "uppercase", color: "#e08a6a" }}>⚑ {p.report_count} report{p.report_count > 1 ? "s" : ""}</span>}
                  <span style={{ fontFamily: mono, fontSize: ".54rem", color: "var(--pb-muted)" }}>{p.media_type}</span>
                </div>
                {p.caption && <div style={{ fontSize: ".84rem", color: "var(--pb-ink-2)", marginTop: 4, lineHeight: 1.4 }}>{p.caption}</div>}
                <div style={{ fontFamily: mono, fontSize: ".56rem", color: "var(--pb-muted)", marginTop: 5 }}>{p.author_name || "unknown"} · #{p.id} · {new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <button disabled={busy === p.id} onClick={() => act(p.id, "approve")} style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: ".82rem", color: "#0b1710", background: "var(--pb-grad-gold)", border: "none", borderRadius: 10, padding: "10px 16px" }}>{busy === p.id ? "…" : "Approve"}</button>
                <button disabled={busy === p.id} onClick={() => act(p.id, "reject")} style={{ cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: ".82rem", color: "#fff", background: "#8a3a2c", border: "none", borderRadius: 10, padding: "10px 16px" }}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ghost = { cursor: "pointer", fontFamily: "inherit", fontSize: ".8rem", fontWeight: 600, color: "var(--pb-ink-2)", background: "transparent", border: "1px solid var(--pb-line-strong)", borderRadius: 999, padding: "7px 14px" };
