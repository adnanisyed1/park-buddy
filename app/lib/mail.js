// Transactional email for order confirmations and shipping notices.
//
// There was no email sending anywhere in the app: a customer paid and then heard
// nothing at all until a parcel arrived. This is the smallest thing that fixes that.
//
// Provider is Resend (single POST, no SDK). Set RESEND_API_KEY and MAIL_FROM. With no
// key configured this does NOT throw and does NOT pretend to have sent — it returns
// { sent:false, reason } so callers can log it and carry on. Fulfillment must never fail
// because an email couldn't go out.
//
// KEEP THE PRINT PARTNER OUT OF THESE. The book is a Park Buddy product; the printer is
// not named in anything a customer reads. (Their name belongs in the privacy policy's
// sub-processor list, which is a legal disclosure, not marketing.)

const FROM = process.env.MAIL_FROM || "Park Buddy <orders@theparkbuddy.com>";

export function mailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

export async function sendMail({ to, subject, html, text }) {
  if (!to) return { sent: false, reason: "no recipient" };
  if (!mailConfigured()) return { sent: false, reason: "RESEND_API_KEY not set" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return { sent: false, reason: "provider " + r.status, detail: detail.slice(0, 200) };
    }
    const d = await r.json().catch(() => ({}));
    return { sent: true, id: d && d.id };
  } catch (e) {
    return { sent: false, reason: (e && e.message) || "network error" };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Inline styles only — email clients strip <style> blocks, and the palette is the book's
// own parchment/pine/brass so the message looks like the product.
function shell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F5EFE0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5EFE0;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFCF4;border:1px solid #D9CCAD;border-radius:12px;">
<tr><td style="padding:28px 30px 8px;">
<div style="font:600 11px/1 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#9A7B2E;">Park Buddy</div>
<h1 style="font:400 26px/1.2 Georgia,serif;color:#22301F;margin:14px 0 0;">${esc(title)}</h1>
</td></tr>
<tr><td style="padding:6px 30px 28px;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#22301F;">
${bodyHtml}
</td></tr>
<tr><td style="padding:0 30px 26px;">
<div style="border-top:1px solid #D9CCAD;padding-top:16px;font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#6C6452;">
Questions? Just reply to this message — it reaches a person.
</div>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

export function orderConfirmation({ name, title, pages, binding, size, total, etaText }) {
  const who = name ? esc(name.split(/\s+/)[0]) : "there";
  const body = `
<p style="margin:0 0 16px;">Thanks ${who} — your book is off to the press.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;">
  <tr><td style="color:#6C6452;padding:3px 0;">Book</td><td align="right" style="color:#22301F;">${esc(title)}</td></tr>
  <tr><td style="color:#6C6452;padding:3px 0;">Format</td><td align="right" style="color:#22301F;">${esc(size)} · ${esc(binding)}</td></tr>
  <tr><td style="color:#6C6452;padding:3px 0;">Pages</td><td align="right" style="color:#22301F;">${esc(pages)}</td></tr>
  <tr><td style="color:#6C6452;padding:3px 0;border-top:1px solid #E7DCC4;padding-top:9px;">Total</td>
      <td align="right" style="color:#22301F;font-weight:700;border-top:1px solid #E7DCC4;padding-top:9px;">${esc(total)}</td></tr>
</table>
<p style="margin:0 0 14px;">${etaText ? esc(etaText) : "Each book is printed and bound to order, so it takes a little while. We'll email you a tracking link the moment it ships."}</p>
<p style="margin:0;color:#6C6452;font-size:14px;">Because every book is made just for you, we can't take change-of-mind returns once printing starts — but if it arrives damaged or misprinted we'll replace or refund it.</p>`;
  return {
    subject: `Your Trip Book is being printed — ${title}`,
    html: shell("Your book is being made", body),
    text: `Thanks ${who} — your book is off to the press.\n\n${title}\n${size} · ${binding}\n${pages} pages\nTotal ${total}\n\nEach book is printed and bound to order. We'll email a tracking link as soon as it ships.\n\nQuestions? Just reply to this message.`,
  };
}

export function shippedNotice({ name, title, carrier, trackingUrls }) {
  const who = name ? esc(name.split(/\s+/)[0]) : "there";
  const urls = (trackingUrls || []).filter(Boolean);
  const links = urls.length
    ? urls.map((u) => `<p style="margin:0 0 10px;"><a href="${esc(u)}" style="color:#9A7B2E;">Track your parcel</a></p>`).join("")
    : `<p style="margin:0 0 10px;color:#6C6452;">Tracking details are on their way and will appear shortly.</p>`;
  const body = `
<p style="margin:0 0 16px;">Good news ${who} — <b>${esc(title)}</b> is on its way to you.</p>
${links}
${carrier ? `<p style="margin:12px 0 0;color:#6C6452;font-size:14px;">Carrier: ${esc(carrier)}</p>` : ""}`;
  return {
    subject: `Your Trip Book has shipped — ${title}`,
    html: shell("On its way", body),
    text: `Good news ${who} — "${title}" has shipped.\n\n${urls.join("\n") || "Tracking details are on their way."}\n${carrier ? "Carrier: " + carrier : ""}\n\nQuestions? Just reply to this message.`,
  };
}
