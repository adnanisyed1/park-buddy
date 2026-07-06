-- Park Buddy — per-park condition alert subscriptions.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
--
-- Anyone can SUBSCRIBE with just an email (no account needed) — so INSERT is open
-- to the public (anon), like a newsletter signup. But emails are PRIVATE: you can
-- only read / change / delete a row you own (auth.uid() = user_id), so nobody can
-- list other people's subscriptions. Email-only subscribers (user_id null) manage
-- theirs via the unsubscribe link we'll email them (future sender job). One row
-- per (park_id, email); re-subscribing is a no-op via upsert ignoreDuplicates.
create table if not exists park_alerts (
  id             uuid primary key default gen_random_uuid(),
  park_id        text not null,        -- our park id / NPS unit code (e.g. "zion")
  park_name      text,                 -- denormalized for the email + admin views
  email          text not null,
  user_id        uuid references auth.users(id) on delete cascade,  -- null = email-only
  alert_verdict  boolean not null default true,   -- today's call flips (e.g. HOLD -> GO)
  alert_permit   boolean not null default false,  -- permits / timed-entry open up
  alert_road     boolean not null default false,  -- a road opens or closes
  alert_flood    boolean not null default false,  -- flash-flood watch / warning
  alert_snow     boolean not null default false,  -- first snow of the season
  active         boolean not null default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (park_id, email)              -- one subscription per email per park
);
create index if not exists park_alerts_park_id on park_alerts (park_id);
create index if not exists park_alerts_user_id on park_alerts (user_id);
create index if not exists park_alerts_email on park_alerts (email);

alter table park_alerts enable row level security;

-- Anyone (even signed-out) can subscribe. If a user_id is provided it must be the
-- caller's own, so the row stays theirs to manage.
drop policy if exists "anyone can subscribe to park alerts" on park_alerts;
create policy "anyone can subscribe to park alerts"
  on park_alerts for insert
  with check (user_id is null or auth.uid() = user_id);

-- Emails are private: only the owner can see / change / remove their subscriptions.
drop policy if exists "owners read their park alerts" on park_alerts;
create policy "owners read their park alerts"
  on park_alerts for select using (auth.uid() = user_id);

drop policy if exists "owners update their park alerts" on park_alerts;
create policy "owners update their park alerts"
  on park_alerts for update using (auth.uid() = user_id);

drop policy if exists "owners delete their park alerts" on park_alerts;
create policy "owners delete their park alerts"
  on park_alerts for delete using (auth.uid() = user_id);
