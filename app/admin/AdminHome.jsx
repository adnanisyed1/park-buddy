"use client";
// Employee portal — the one screen to open in the morning.
//
// Ordered by what the owner actually needs to know, in order:
//   1. Can the shop take an order right now?   (a broken key is worse than a slow day)
//   2. Does anything need a human today?       (a late book, a rejected print job)
//   3. What came in?                           (money, honestly labelled)
//   4. Everything else                         (the desks)
//
// Sections that can't be read say so. A dashboard showing "$0" when it means "couldn't
// check" reads as a bad day rather than a broken connection, and that's the failure mode
// that gets acted on wrongly.
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTheme } from "../lib/theme";

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
const serif = 'Georgia, "Iowan Old Style", serif';

export default function AdminHome() {
  useTheme();
  const [secret, setSecret] = useState("");
  const [entered, setEntered] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("pb_admin") : "";
    if (s) { setSecret(s); setEntered(true); }
  }, []);

  const load = useCallback(async (sec) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/overview", { headers: { "x-admin-secret": sec } });
      const d = await r.json();
      if (r.status === 401) { setErr("Wrong secret."); setEntered(false); sessionStorage.removeItem("pb_admin"); setData(null); return; }
      if (!r.ok) { setErr(d.error || "Couldn't load."); setData(null); return; }
      setData(d);
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (entered && secret) load(secret); }, [entered, secret, load]);

  if (!entered) {
    return (
      <div className="pb-theme" style={wrap}>
        <form onSubmit={(e) => { e.preventDefault(); if (!secret.trim()) return; sessionStorage.setItem("pb_admin", secret.trim()); setEntered(true); }}
          style={{ maxWidth: 340, margin: "18vh auto", textAlign: "center" }}>
          <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: "1.8rem", color: "var(--pb-ink)", margin: "0 0 6px" }}>Park Buddy</h1>
          <p style={{ fontSize: ".8rem", color: "var(--pb-muted)", margin: "0 0 18px" }}>Staff portal.</p>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Admin secret" autoFocus
            style={{ width: "100%", fontFamily: mono, fontSize: ".85rem", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--pb-line)", background: "var(--pb-surface)", color: "var(--pb-ink)" }} />
          <button style={{ ...primary, width: "100%", marginTop: 10 }}>Unlock</button>
          {err && <div style={{ marginTop: 12, fontSize: ".78rem", color: "#a6592c" }}>{err}</div>}
        </form>
      </div>
    );
  }

  const m = data && data.money, o = data && data.orders, h = (data && data.health) || [];
  const needsYou = o && o.available ? o.late + (o.dueSoon || 0) : 0;

  return (
    <div className="pb-theme" style={wrap}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: "1.9rem", color: "var(--pb-ink)", margin: 0 }}>Park Buddy</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => load(secret)} disabled={busy} style={ghost}>{busy ? "Checking…" : "Refresh"}</button>
          <button onClick={() => { sessionStorage.removeItem("pb_admin"); setEntered(false); setData(null); }} style={ghost}>Lock</button>
        </div>
      </div>
      <div style={{ fontFamily: mono, fontSize: ".58rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pb-muted)", margin: "4px 0 22px" }}>
        Staff portal{data ? " · checked " + new Date(data.generatedAt).toLocaleTimeString() : ""}
      </div>

      {err && <div style={{ ...card, borderColor: "#a6592c", color: "#a6592c", fontSize: ".84rem" }}>{err}</div>}

      {/* 1 — can we sell? */}
      {data && (
        <div style={{ ...card, borderLeft: "3px solid " + (data.canSell ? "#3E7A4C" : "#a6592c") }}>
          <div style={{ fontWeight: 700, color: data.canSell ? "#3E7A4C" : "#a6592c", fontSize: ".95rem" }}>
            {data.canSell ? "Ready to take orders" : "Can't complete a sale right now"}
          </div>
          {!data.canSell && (
            <div style={{ fontSize: ".82rem", color: "var(--pb-ink-2)", marginTop: 6 }}>
              Waiting on: {data.blocking.join(", ")}.
            </div>
          )}
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", marginTop: 14 }}>
            {h.map((x) => (
              <div key={x.key} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span aria-hidden style={{ flex: "none", marginTop: 3, width: 8, height: 8, borderRadius: 999, background: x.ok ? "#3E7A4C" : "#a6592c" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: ".8rem", color: "var(--pb-ink)" }}>{x.label}</div>
                  <div style={{ fontSize: ".68rem", color: "var(--pb-muted)", lineHeight: 1.4 }}>{x.detail}</div>
                  {x.warn && <div style={{ fontSize: ".68rem", color: "var(--pb-gold)", marginTop: 2 }}>{x.warn}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2 — anything needing a human */}
      {o && o.available && (
        <div style={{ ...card, borderLeft: needsYou ? "3px solid #a6592c" : undefined }}>
          <Row label="Needs you today" value={needsYou ? String(needsYou) : "Nothing"} tone={needsYou ? "bad" : "good"} />
          {o.late > 0 && <Note>{o.late} book{o.late === 1 ? "" : "s"} unshipped past 14 days.</Note>}
          {o.dueSoon > 0 && <Note>{o.dueSoon} due to ship about now.</Note>}
          {!needsYou && <Note>Every order is inside its normal window.</Note>}
          <div style={{ marginTop: 12 }}>
            <Link href="/admin/orders" style={{ ...ghost, textDecoration: "none", display: "inline-block" }}>Open the order desk →</Link>
          </div>
        </div>
      )}

      {/* 3 — money */}
      <div style={card}>
        <div style={sectionTitle}>Takings</div>
        {!m || !m.available ? (
          <Note>{(m && m.why) || "Not available."}</Note>
        ) : (
          <>
            {m.mode === "test" && <Note>Test mode — these are test payments, not real money.</Note>}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", marginTop: 10 }}>
              <Stat k="Today" v={"$" + m.today.gross.toFixed(2)} n={m.today.count + " order" + (m.today.count === 1 ? "" : "s")} />
              <Stat k="7 days" v={"$" + m.week.gross.toFixed(2)} n={m.week.count + " orders"} />
              <Stat k="30 days" v={"$" + m.month.gross.toFixed(2)} n={m.month.count + " orders"} />
              <Stat k="Average order" v={"$" + m.averageOrder.toFixed(2)} n="last 30 days" />
            </div>
            <div style={{ marginTop: 12, fontSize: ".76rem", color: "var(--pb-muted)", lineHeight: 1.5 }}>
              That&rsquo;s money in, not profit. After printing, shipping and card fees you keep roughly{" "}
              <b style={{ color: "var(--pb-ink-2)" }}>${m.estimatedProfit.low.toFixed(0)}–{m.estimatedProfit.typical.toFixed(0)}</b>{" "}
              of the last 30 days. {m.estimatedProfit.note}
              {m.abandoned > 0 && <> {m.abandoned} checkout{m.abandoned === 1 ? "" : "s"} started and not finished.</>}
            </div>
          </>
        )}
      </div>

      {/* 4 — orders at a glance */}
      {o && o.available && (
        <div style={card}>
          <div style={sectionTitle}>Orders</div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", margin: "10px 0 4px" }}>
            <Stat k="All time" v={String(o.total)} />
            <Stat k="Being printed" v={String(o.inProduction)} />
            <Stat k="Shipped" v={String(o.shipped)} />
          </div>
          {o.recent.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid var(--pb-line)", paddingTop: 10 }}>
              {o.recent.map((r) => (
                <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: ".78rem" }}>
                  <span style={{ color: "var(--pb-ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title} <span style={{ color: "var(--pb-muted)", fontFamily: mono, fontSize: ".64rem" }}>{r.email}</span>
                  </span>
                  <span style={{ flex: "none", fontFamily: mono, fontSize: ".64rem", color: r.late ? "#a6592c" : r.status === "shipped" ? "#3E7A4C" : "var(--pb-muted)" }}>
                    {r.status === "shipped" ? "shipped" : "day " + r.ageDays}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {o && !o.available && <div style={card}><div style={sectionTitle}>Orders</div><Note>{o.why}</Note></div>}

      {/* 5 — the desks */}
      <div style={card}>
        <div style={sectionTitle}>Desks</div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", marginTop: 10 }}>
          <Desk href="/admin/orders" name="Orders" desc="Track, chase, message customers" />
          <Desk href="/admin/pines" name="Pines" desc="Moderate submitted photos" />
          <Desk href="/trip-book" name="Book Studio" desc="See what customers see" />
        </div>
      </div>
    </div>
  );
}

const Stat = ({ k, v, n }) => (
  <div>
    <div style={{ fontFamily: mono, fontSize: ".56rem", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--pb-muted)" }}>{k}</div>
    <div style={{ fontFamily: serif, fontSize: "1.5rem", color: "var(--pb-ink)", marginTop: 4 }}>{v}</div>
    {n && <div style={{ fontSize: ".66rem", color: "var(--pb-muted)", marginTop: 1 }}>{n}</div>}
  </div>
);
const Row = ({ label, value, tone }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
    <span style={{ fontWeight: 600, color: "var(--pb-ink)" }}>{label}</span>
    <span style={{ fontFamily: serif, fontSize: "1.3rem", color: tone === "bad" ? "#a6592c" : "#3E7A4C" }}>{value}</span>
  </div>
);
const Note = ({ children }) => <div style={{ fontSize: ".8rem", color: "var(--pb-muted)", marginTop: 6, lineHeight: 1.5 }}>{children}</div>;
const Desk = ({ href, name, desc }) => (
  <Link href={href} style={{ textDecoration: "none", border: "1px solid var(--pb-line)", borderRadius: 10, padding: "11px 13px", display: "block" }}>
    <div style={{ fontWeight: 600, fontSize: ".85rem", color: "var(--pb-ink)" }}>{name}</div>
    <div style={{ fontSize: ".7rem", color: "var(--pb-muted)", marginTop: 2 }}>{desc}</div>
  </Link>
);

const wrap = { minHeight: "100vh", background: "var(--pb-bg)", padding: "40px 20px 80px", maxWidth: 900, margin: "0 auto" };
const card = { background: "var(--pb-surface)", border: "1px solid var(--pb-line)", borderRadius: 12, padding: "16px 18px", marginBottom: 14 };
const sectionTitle = { fontFamily: mono, fontSize: ".58rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--pb-gold)" };
const ghost = { cursor: "pointer", fontFamily: "inherit", fontSize: ".76rem", fontWeight: 600, color: "var(--pb-ink-2)", background: "transparent", border: "1px solid var(--pb-line)", borderRadius: 8, padding: "7px 12px" };
const primary = { cursor: "pointer", fontFamily: "inherit", fontSize: ".78rem", fontWeight: 700, color: "#0a1712", background: "var(--pb-gold, #c9a35f)", border: "none", borderRadius: 8, padding: "9px 15px" };
