# Park Buddy — Launch Runbook (Netlify → Vercel + theparkbuddy.com)

_Everything the code needs is done and pushed (commit d300a15+). This is the
click-and-paste config work — the parts that need your accounts/secrets, which
Claude can't do. Follow top to bottom; each step is quick. ~20–30 min total._

**Golden rule:** don't attach the domain until Steps 1–4 are green. Vercel serves
your build on a free `*.vercel.app` URL the whole time — verify there first.

---

## Step 1 — Connect the repo to Vercel  ⏱️ 2 min
1. vercel.com → **Add New… → Project**.
2. Import GitHub repo **`adnanisyed1/park-buddy`**. (Authorize GitHub if asked.)
3. Framework preset auto-detects **Next.js** — leave build/output settings default.
4. **Don't deploy yet** — click into **Environment Variables** first (Step 2). If it
   deploys before env vars exist, that's fine; just redeploy after Step 2.

---

## Step 2 — Paste environment variables  ⏱️ 8 min
Project → **Settings → Environment Variables**. Add each NAME below and paste the
VALUE from your **Netlify** dashboard (Site settings → Environment variables).
Set scope to **Production + Preview + Development** for all of them.

Full reference with descriptions is in [`.env.example`](.env.example).

**Required**
- [ ] `NPS_API_KEY`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `AIRNOW_API_KEY`
- [ ] `RIDB_API_KEY`
- [ ] `NEXT_PUBLIC_GMAPS_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_KEY`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL` → **for now, set to your Vercel URL** (e.g.
      `https://park-buddy-xxxx.vercel.app`). You'll change it to
      `https://theparkbuddy.com` in Step 5.

**Recommended**
- [ ] `CRON_SECRET` → make up a long random string (e.g. run `openssl rand -hex 24`).
      Locks the cron endpoint so only Vercel can trigger the daily ingest.
- [ ] `INGEST_SECRET` → copy from Netlify if you set it there (optional).

> After adding vars, trigger a fresh deploy: Deployments → ⋯ → **Redeploy**.

---

## Step 3 — Create the Supabase table  ⏱️ 1 min
The AI-assistant rate-limiter + daily spend cap now live in Supabase.
1. Supabase dashboard → your project → **SQL Editor → New query**.
2. Paste the contents of [`supabase-kv.sql`](supabase-kv.sql) → **Run**.
3. You should see `Success. No rows returned`.

_(If you skip this, the app still works — the cost cap just falls back to
in-memory instead of durable. But do it; it's one paste.)_

---

## Step 4 — Verify the Vercel deploy (before touching DNS)  ⏱️ 5 min
Open your `*.vercel.app` URL and check:
- [ ] Home page loads, styled correctly.
- [ ] `/explore` map renders (Google Maps key working — no "add a key" overlay).
- [ ] `/scenic-drives` shows the full grid (~141 drives).
- [ ] Open a park's live status → real weather / alerts appear (NPS key working).
- [ ] Ask Park Buddy (the assistant) returns an answer (Anthropic key working).
- [ ] **Cron registered:** Project → **Settings → Cron Jobs** shows
      `/api/cron/ingest` scheduled `0 9 * * *`. (It runs daily; you don't need to
      trigger it now. To test manually later: `curl -H "Authorization: Bearer
      <CRON_SECRET>" https://<your-vercel-url>/api/cron/ingest`.)

If all green → proceed. If anything's red, note which and we'll fix before launch.

---

## Step 5 — Attach theparkbuddy.com  ⏱️ 5 min + DNS propagation
1. Vercel → Project → **Settings → Domains → Add** → `theparkbuddy.com`
   (add `www.theparkbuddy.com` too; Vercel will offer to redirect one to the other —
   pick `theparkbuddy.com` as primary).
2. Vercel shows the exact DNS records to create. They will be (current standard):

   | Type  | Name / Host | Value |
   |-------|-------------|-------|
   | `A`     | `@` (apex)  | `76.76.21.21` |
   | `CNAME` | `www`       | `cname.vercel-dns.com` |

   **Use whatever Vercel's own panel displays** if it differs — it's authoritative.
3. Add those records at your **domain registrar** (where you bought it) under DNS
   settings. Delete any old parked-domain A/CNAME records first.
4. Back in Vercel, the domain flips to **Valid Configuration** once DNS propagates
   (minutes to a couple hours; Vercel issues HTTPS automatically).
5. **Flip the canonical URL:** Settings → Environment Variables → edit
   `NEXT_PUBLIC_SITE_URL` → `https://theparkbuddy.com` → **Redeploy** once.

---

## Step 6 — Post-launch cleanup  ⏱️ 2 min
- [ ] Load `https://theparkbuddy.com` — confirm HTTPS padlock + everything from Step 4.
- [ ] `https://theparkbuddy.com/sitemap.xml` and `/robots.txt` show the new domain.
- [ ] **Retire Netlify** so it doesn't shadow-serve or auto-deploy: in Netlify, either
      unlink the GitHub repo (Site config → Build & deploy → stop auto-publishing) or
      delete the site. Keep the API keys noted somewhere until you're 100% cut over.
- [ ] (Optional) Point Google Search Console at the new domain; submit the sitemap.

---

## Rollback (if anything goes wrong)
The Netlify site is untouched and still live during all of this. If the Vercel
deploy misbehaves, just **don't attach the domain** — nothing user-facing changes.
Your live site stays on Netlify until you deliberately flip DNS in Step 5.

---

## What Claude already did (no action needed)
- Netlify Blobs → Supabase `pb_kv` for the agent limiter (+ `supabase-kv.sql`).
- Netlify Scheduled Function → Vercel Cron (`/api/cron/ingest` + `vercel.json`).
- API-key gating now fires on Vercel (`NETLIFY || VERCEL`).
- Agent route `maxDuration = 60`; removed `netlify.toml` + `@netlify/blobs`.
- Canonical `SITE_URL` fallback → `https://theparkbuddy.com`.
- Production build verified green (all routes incl. `/api/cron/ingest` compile).
