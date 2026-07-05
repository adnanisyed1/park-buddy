"use client";

// Park Buddy shared UI kit — the reusable components the whole platform ships on,
// ported from the approved Claude-design component sheet. Structure lives here;
// interactive states (hover/focus/disabled) live in app/ui.css, all keyed to the
// --pb-* design tokens. Import what you need: `import { Button, Card } from "@/app/components/ui"`.

import { useEffect, useState } from "react";

const G = { gold: "var(--pb-gold)", gold2: "var(--pb-gold-2)", grad: "var(--pb-grad-gold)", ink: "var(--pb-ink)", ink2: "var(--pb-ink-2)", muted: "var(--pb-muted)", surface: "var(--pb-surface)", bg: "var(--pb-bg)", serif: "var(--pb-serif)", mono: "var(--pb-mono)" };

/* ---------------- Buttons ---------------- */
export function Button({ variant = "primary", as: As = "button", className = "", children, ...rest }) {
  return <As className={`pb-btn pb-btn--${variant} ${className}`} {...rest}>{children}</As>;
}
export function IconButton({ className = "", children, ...rest }) {
  return <button className={`pb-btn pb-btn--icon ${className}`} {...rest}>{children}</button>;
}
export function TextLink({ as: As = "a", className = "", children, ...rest }) {
  return <As className={`pb-link ${className}`} {...rest}>{children}</As>;
}

/* ---------------- Inputs ---------------- */
export function Input({ error, className = "", ...rest }) {
  return <input className={`pb-input ${error ? "pb-input--error" : ""} ${className}`} {...rest} />;
}
export function Textarea({ className = "", ...rest }) { return <textarea className={`pb-textarea ${className}`} {...rest} />; }
export function Select({ className = "", children, ...rest }) { return <select className={`pb-select ${className}`} {...rest}>{children}</select>; }
export function Field({ label, error, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span className="pb-micro" style={{ color: error ? "var(--pb-hold)" : "var(--pb-muted)" }}>{label}</span>}
      {children}
      {error && <span style={{ fontSize: ".72rem", color: "var(--pb-hold)" }}>{error}</span>}
    </label>
  );
}
export function SearchInput({ className = "", ...rest }) {
  return (
    <div className={`pb-searchwrap ${className}`}>
      <span style={{ color: G.ink2 }}>⌕</span>
      <input {...rest} />
    </div>
  );
}

/* ---------------- Toggle / Checkbox / Radio / Tabs ---------------- */
export function Toggle({ on: onProp, defaultOn = false, onChange, label }) {
  const [onState, setOn] = useState(defaultOn);
  const on = onProp !== undefined ? onProp : onState;
  const toggle = () => { const next = !on; if (onProp === undefined) setOn(next); onChange && onChange(next); };
  const row = (
    <span role="switch" aria-checked={on} tabIndex={0} onClick={toggle} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}
      style={{ cursor: "pointer", position: "relative", width: 46, height: 26, borderRadius: 999, flex: "none", background: on ? G.grad : "rgba(255,255,255,.09)", border: on ? "1px solid transparent" : "1px solid var(--pb-line-strong)", transition: "background .3s" }}>
      <span style={{ position: "absolute", top: 2, left: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transform: `translateX(${on ? 20 : 0}px)`, transition: "transform .3s", boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
    </span>
  );
  if (!label) return row;
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><span style={{ fontSize: ".9rem", color: "#d3d8d1" }}>{label}</span>{row}</div>;
}

export function Checkbox({ checked, defaultChecked = false, onChange, label, disabled }) {
  const [c, setC] = useState(defaultChecked);
  const on = checked !== undefined ? checked : c;
  const toggle = () => { if (disabled) return; const n = !on; if (checked === undefined) setC(n); onChange && onChange(n); };
  return (
    <label onClick={toggle} style={{ display: "flex", alignItems: "center", gap: 11, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? .4 : 1 }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: G.surface, fontSize: ".7rem", background: on ? G.grad : "transparent", border: on ? "1px solid transparent" : "1.5px solid rgba(217,183,121,.4)" }}>{on ? "✓" : ""}</span>
      <span style={{ fontSize: ".9rem", color: "#d3d8d1" }}>{label}</span>
    </label>
  );
}

export function RadioGroup({ options = [], value, defaultValue, onChange }) {
  const [v, setV] = useState(defaultValue ?? (options[0] && options[0].value));
  const cur = value !== undefined ? value : v;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {options.map((o) => {
        const on = cur === o.value;
        return (
          <label key={o.value} onClick={() => { if (value === undefined) setV(o.value); onChange && onChange(o.value); }} style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: on ? "1.5px solid var(--pb-gold-2)" : "1.5px solid rgba(217,183,121,.4)" }}>
              {on && <span style={{ width: 10, height: 10, borderRadius: "50%", background: G.grad }} />}
            </span>
            <span style={{ fontSize: ".9rem", color: "#d3d8d1" }}>{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function SegmentedTabs({ tabs = [], value, defaultValue, onChange }) {
  const [v, setV] = useState(defaultValue ?? (tabs[0] && (tabs[0].value ?? tabs[0])));
  const cur = value !== undefined ? value : v;
  return (
    <div style={{ display: "inline-flex", background: "rgba(255,255,255,.04)", border: "1px solid rgba(217,183,121,.18)", borderRadius: 999, padding: 4, gap: 2 }}>
      {tabs.map((t) => {
        const val = t.value ?? t, label = t.label ?? t, on = cur === val;
        return (
          <button key={val} onClick={() => { if (value === undefined) setV(val); onChange && onChange(val); }}
            style={{ cursor: "pointer", fontFamily: "var(--pb-sans)", fontSize: ".82rem", fontWeight: 600, border: "none", borderRadius: 999, padding: "8px 18px", background: on ? G.grad : "transparent", color: on ? G.surface : "#c3c8d0", transition: "background .25s, color .25s" }}>{label}</button>
        );
      })}
    </div>
  );
}

/* ---------------- Cards ---------------- */
export function Card({ hover = false, className = "", style, children, ...rest }) {
  return <div className={`pb-card ${hover ? "pb-card--hover" : ""} ${className}`} style={style} {...rest}>{children}</div>;
}
export function StatCard({ value, label }) {
  return (
    <div className="pb-card" style={{ textAlign: "center" }}>
      <div style={{ fontFamily: G.serif, fontWeight: 600, fontSize: "3rem", lineHeight: 1, background: "linear-gradient(110deg,#f0dcae,#c9a35f)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{value}</div>
      <div className="pb-micro" style={{ marginTop: 6, color: "var(--pb-muted)" }}>{label}</div>
    </div>
  );
}

/* ---------------- Chips / badges ---------------- */
export function Chip({ on = false, className = "", children, ...rest }) {
  return <button className={`pb-chip ${on ? "pb-chip--on" : ""} ${className}`} {...rest}>{on ? "✓ " : ""}{children}</button>;
}
export function Tag({ children, className = "", ...rest }) { return <span className={`pb-tag ${className}`} {...rest}>{children}</span>; }
export function VerdictBadge({ verdict = "GO" }) {
  const c = { GO: "var(--pb-go)", PREPARE: "var(--pb-prepare)", HOLD: "var(--pb-hold)" }[verdict] || "var(--pb-go)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: G.mono, fontSize: ".62rem", fontWeight: 700, letterSpacing: ".1em", color: c, border: `1px solid ${c}66`, borderRadius: 999, padding: "5px 11px" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}` }} />{verdict}
    </span>
  );
}

/* ---------------- Feedback ---------------- */
export function Spinner({ label }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}><span className="pb-spinner" />{label && <span style={{ fontSize: ".82rem", color: G.ink2 }}>{label}</span>}</span>;
}
export function Skeleton({ lines = 3, widths = ["70%", "90%", "50%"] }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{Array.from({ length: lines }).map((_, i) => <span key={i} className="pb-skel" style={{ width: widths[i % widths.length] }} />)}</div>;
}
export function EmptyState({ icon = "◎", title, body, action }) {
  return (
    <div className="pb-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, minHeight: 180, justifyContent: "center" }}>
      <span style={{ fontSize: "1.8rem", opacity: .5 }}>{icon}</span>
      <div style={{ fontFamily: G.serif, fontSize: "1.3rem", color: "#e7e3d8" }}>{title}</div>
      {body && <p style={{ fontSize: ".82rem", color: "#9aa7a0", fontWeight: 300, maxWidth: "28ch" }}>{body}</p>}
      {action}
    </div>
  );
}
export function Toast({ tone = "info", children }) {
  const map = { success: ["var(--pb-go)", "✓", "rgba(79,217,138,.1)", "rgba(79,217,138,.35)"], info: ["var(--pb-gold)", "ⓘ", "rgba(217,183,121,.08)", "rgba(217,183,121,.3)"], warn: ["var(--pb-hold)", "⚠", "rgba(224,144,106,.08)", "rgba(224,144,106,.35)"] };
  const [color, icon, bg, bd] = map[tone] || map.info;
  return <div style={{ display: "flex", alignItems: "center", gap: 10, background: bg, border: `1px solid ${bd}`, borderRadius: 12, padding: "11px 14px" }}><span style={{ color }}>{icon}</span><span style={{ fontSize: ".84rem", color: "#e7e3d8" }}>{children}</span></div>;
}

export function Modal({ open, onClose, eyebrow = "Dialog", title, children, actions }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(6,16,11,.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
      <div style={{ position: "relative", width: "min(420px,100%)", background: "linear-gradient(160deg,#0e2016,#0a1712)", border: "1px solid rgba(217,183,121,.28)", borderRadius: 24, padding: 28, boxShadow: "var(--pb-shadow)" }}>
        {eyebrow && <div className="pb-micro" style={{ color: "var(--pb-gold-soft)", letterSpacing: ".16em" }}>{eyebrow}</div>}
        {title && <h3 style={{ fontFamily: G.serif, fontWeight: 500, fontSize: "1.7rem", marginTop: 8 }}>{title}</h3>}
        {children && <div style={{ color: G.ink2, fontSize: ".9rem", lineHeight: 1.6, fontWeight: 300, marginTop: 8 }}>{children}</div>}
        {actions && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>{actions}</div>}
      </div>
    </div>
  );
}

/* ---------------- Navigation / data ---------------- */
export function Breadcrumb({ items = [] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".82rem", color: G.ink2, flexWrap: "wrap" }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {it.href && i < items.length - 1 ? <a href={it.href} style={{ color: G.gold, textDecoration: "none" }}>{it.label}</a> : <span style={{ color: i === items.length - 1 ? G.ink : G.ink2 }}>{it.label}</span>}
          {i < items.length - 1 && <span style={{ color: "#4a5450" }}>/</span>}
        </span>
      ))}
    </div>
  );
}
export function ProgressBar({ value = 0, label }) {
  return (
    <div>
      {label && <div className="pb-micro" style={{ display: "flex", justifyContent: "space-between", color: "var(--pb-muted)", marginBottom: 7 }}><span>{label}</span><span>{value}%</span></div>}
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,.06)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${value}%`, borderRadius: 999, background: G.grad }} /></div>
    </div>
  );
}
