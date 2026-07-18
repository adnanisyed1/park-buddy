"use client";
// Order desk. Unlocked with ORDERS_ADMIN_SECRET (held in sessionStorage for the tab only,
// same as the Pines queue). Shows customer email addresses, so it is noindex and never
// linked from the site.
//
// The screen is built around one question — "is anything going wrong?" — so orders that
// need attention sort to the top and carry the reason in words, rather than leaving the
// owner to compare dates across a table.
import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../lib/theme";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const serif = 'Georgia, "Iowan Old Style", serif';

export default function AdminOrders() {
  useTheme();
  const [secret, setSecret] = useState("");
  const [entered, setEntered] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState("");
  const [sendState, setSendState] = useState("");

  useEffect(() => {
    const s = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("pb_orders_secret") : "";
    if (s) { setSecret(s); setEntered(true); }
  }, []);

  const load = useCallback(async (sec, live) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/orders" + (live ? "?live=1" : ""), { headers: { "x-admin-secret": sec } });
      if (r.status === 401) { setErr("Wrong secret."); setEntered(false); sessionStorage.removeItem("pb_orders_secret"); setData(null); return; }
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't load orders."); setData({ orders: [] }); return; }
      setData(d);
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (entered && secret) load(secret, true); }, [entered, secret, load]);

  const send = async (order) => {
    setSendState("sending");
    try {
      const r = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": secret },
        body: JSON.stringify({ email: order.email, title: order.title, message: draft }),
      });
      const d = await r.json();
      if (!r.ok) { setSendState("error:" + (d.error || "failed")); return; }
      setSendState("sent"); setDraft("");
      setTimeout(() => { setSendState(""); setOpenId(null); }, 1400);
    } catch { setSendState("error:network"); }
  };

  if (!entered) {
    return (
      <div className="pb-theme" style={wrap}>
        <form onSubmit={(e) => { e.preventDefault(); if (!secret.trim()) return; sessionStorage.setItem("pb_orders_secret", secret.trim()); setEntered(true); }}
          style={{ maxWidth: 340, margin: "18vh auto", textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: "1.7rem", color: "var(--pb-ink)", margin: "0 0 6px" }}>Order desk</h1>
          <p style={{ fontSize: ".8rem", color: "var(--pb-muted)", margin: "0 0 18px" }}>Enter the admin secret to continue.</p>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ORDERS_ADMIN_SECRET" autoFocus
            style={{ width: "100%", fontFamily: mono, fontSize: ".85rem", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--pb-line)", background: "var(--pb-surface)", color: "var(--pb-ink)" }} />
          <button style={{ ...primary, width: "100%", marginTop: 10 }}>Unlock</button>
          {err && <div style={{ marginTop: 12, fontSize: ".78rem", color: "#a6592c" }}>{err}</div>}
        </form>
      </div>
    );
  }

  const orders = (data && data.orders) || [];
  // Anything wrong floats up; then newest first.
  const sorted = [...orders].sort((a, b) => {
    const rank = (o) => (o.concern ? (o.concern.level === "error" ? 0 : 1) : 2);
    return rank(a) - rank(b) || String(b.createdAt).localeCompare(String(a.createdAt));
  });
  const attention = orders.filter((o) => o.concern).length;

  return (
    <div className="pb-theme" style={wrap}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: "1.8rem", color: "var(--pb-ink)", margin: 0 }}>Order desk</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => load(secret, true)} disabled={busy} style={ghost}>{busy ? "Checking…" : "Refresh"}</button>
          <button onClick={() => { sessionStorage.removeItem("pb_orders_secret"); setEntered(false); setData(null); }} style={ghost}>Lock</button>
        </div>
      </div>

      <div style={{ fontSize: ".8rem", color: "var(--pb-muted)", marginBottom: 18 }}>
        {orders.length} order{orders.length === 1 ? "" : "s"}
        {attention > 0
          ? <> · <b style={{ color: "#a6592c" }}>{attention} need{attention === 1 ? "s" : ""} attention</b></>
          : orders.length > 0 ? " · all on track" : ""}
        {data && !data.liveChecked && <> · <span title="Print-job status wasn't refreshed">printer status not checked</span></>}
        {data && data.canEmail === false && <> · <span style={{ color: "#a6592c" }}>email not configured</span></>}
      </div>

      {err && <div style={{ ...card, borderColor: "#a6592c", color: "#a6592c", fontSize: ".82rem" }}>{err}</div>}

      {!orders.length && !busy && !err && (
        <div style={{ ...card, color: "var(--pb-muted)", fontSize: ".85rem" }}>
          No orders yet. They appear here the moment someone pays.
        </div>
      )}

      {sorted.map((o) => {
        const open = openId === o.id;
        const tone = o.concern ? (o.concern.level === "error" ? "#a6592c" : "#9A7B2E") : "var(--pb-line)";
        return (
          <div key={o.id} style={{ ...card, borderColor: tone, borderLeftWidth: o.concern ? 3 : 1 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, color: "var(--pb-ink)" }}>{o.title || "Trip Book"}</div>
                <div style={{ fontFamily: mono, fontSize: ".62rem", color: "var(--pb-muted)", marginTop: 3 }}>
                  {o.email} · {o.size || "—"}{o.quantity > 1 ? ` · ×${o.quantity}` : ""} · {o.ageDays != null ? `day ${o.ageDays}` : ""}
                  {o.jobId ? ` · job ${o.jobId}` : " · no print job"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: mono, fontSize: ".62rem", letterSpacing: ".08em", textTransform: "uppercase", color: o.status === "shipped" ? "#3E7A4C" : "var(--pb-gold)" }}>
                  {o.status === "shipped" ? "Shipped" : "In production"}
                </div>
                {o.jobStatus && <div style={{ fontFamily: mono, fontSize: ".58rem", color: "var(--pb-muted)", marginTop: 2 }}>printer: {o.jobStatus}</div>}
              </div>
            </div>

            {o.concern && (
              <div style={{ marginTop: 10, fontSize: ".8rem", color: o.concern.level === "error" ? "#a6592c" : "var(--pb-ink-2)" }}>
                {o.concern.level === "error" ? "⚠ " : "• "}{o.concern.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {o.tracking && <a href={o.tracking} target="_blank" rel="noopener" style={{ ...ghost, textDecoration: "none", display: "inline-block" }}>Tracking</a>}
              <button onClick={() => { setOpenId(open ? null : o.id); setDraft(""); setSendState(""); }} style={ghost}>
                {open ? "Cancel" : "Message customer"}
              </button>
            </div>

            {open && (
              <div style={{ marginTop: 12 }}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
                  placeholder={`Write to ${o.email} about "${o.title}" — what's happened, and what you're doing about it.`}
                  style={{ width: "100%", fontFamily: "inherit", fontSize: ".84rem", lineHeight: 1.5, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--pb-line)", background: "var(--pb-surface-2)", color: "var(--pb-ink)", resize: "vertical" }} />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => send(o)} disabled={sendState === "sending" || draft.trim().length < 10} style={primary}>
                    {sendState === "sending" ? "Sending…" : "Send"}
                  </button>
                  {sendState === "sent" && <span style={{ fontSize: ".78rem", color: "#3E7A4C" }}>Sent.</span>}
                  {sendState.startsWith("error:") && <span style={{ fontSize: ".78rem", color: "#a6592c" }}>{sendState.slice(6)}</span>}
                  <span style={{ fontSize: ".7rem", color: "var(--pb-muted)" }}>Goes out from Park Buddy; replies come back to you.</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const wrap = { minHeight: "100vh", background: "var(--pb-bg)", padding: "40px 20px 80px", maxWidth: 860, margin: "0 auto" };
const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 };
const ghost = { cursor: "pointer", fontFamily: "inherit", fontSize: ".76rem", fontWeight: 600, color: "var(--pb-ink-2)", background: "transparent", border: "1px solid var(--pb-line)", borderRadius: 8, padding: "7px 12px" };
const primary = { cursor: "pointer", fontFamily: "inherit", fontSize: ".78rem", fontWeight: 700, color: "#0a1712", background: "var(--pb-gold, #c9a35f)", border: "none", borderRadius: 8, padding: "8px 15px" };
