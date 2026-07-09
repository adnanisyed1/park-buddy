// Server-only image moderation first-pass for Pines. Provider-agnostic:
//   1. MODERATION_WEBHOOK_URL  — POST { imageUrl } → expect { decision: approve|reject|manual }
//      (plug in Hive / AWS Rekognition / your own service)
//   2. OPENAI_API_KEY          — uses OpenAI omni-moderation on the image
//   3. neither configured      → { decision: "manual" }  (goes to the manual queue)
// Returns { decision, reason }. Never throws — moderation failing must not block posting
// (falls back to "manual"/pending, the safe state).
export function moderationConfigured() {
  return !!(process.env.MODERATION_WEBHOOK_URL || process.env.OPENAI_API_KEY);
}

export async function moderateImage(imageUrl) {
  try {
    if (process.env.MODERATION_WEBHOOK_URL) {
      const r = await fetch(process.env.MODERATION_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl }),
      });
      const d = await r.json().catch(() => ({}));
      const dec = ["approve", "reject", "manual"].includes(d.decision) ? d.decision : "manual";
      return { decision: dec, reason: d.reason || "webhook" };
    }
    if (process.env.OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url: imageUrl } }] }),
      });
      const d = await r.json().catch(() => ({}));
      const res = d && d.results && d.results[0];
      if (!res) return { decision: "manual", reason: "no result" };
      return res.flagged ? { decision: "reject", reason: "flagged" } : { decision: "approve", reason: "clean" };
    }
  } catch { /* fall through to manual */ }
  return { decision: "manual", reason: "no provider" };
}

// Text moderation for user-authored content (comments). Same providers as images.
// Comments are ephemeral (no manual queue), so callers treat "reject" as block and
// anything else as allow — a provider outage must never silently swallow comments.
export async function moderateText(text) {
  const t = String(text || "").trim();
  if (!t) return { decision: "approve", reason: "empty" };
  try {
    if (process.env.MODERATION_WEBHOOK_URL) {
      const r = await fetch(process.env.MODERATION_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }),
      });
      const d = await r.json().catch(() => ({}));
      const dec = ["approve", "reject", "manual"].includes(d.decision) ? d.decision : "manual";
      return { decision: dec, reason: d.reason || "webhook" };
    }
    if (process.env.OPENAI_API_KEY) {
      const r = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "omni-moderation-latest", input: t }),
      });
      const d = await r.json().catch(() => ({}));
      const res = d && d.results && d.results[0];
      if (!res) return { decision: "manual", reason: "no result" };
      return res.flagged ? { decision: "reject", reason: "flagged" } : { decision: "approve", reason: "clean" };
    }
  } catch { /* fall through to manual */ }
  return { decision: "manual", reason: "no provider" };
}
