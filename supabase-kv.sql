-- Park Buddy — tiny key/value table backing the AI-agent rate limiter + spend cap.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- The limiter (app/api/agent/limiter.js) reads/writes here with the SERVICE-ROLE
-- key (server only). If this table is absent, the limiter falls back to an
-- in-memory store automatically — so the app keeps working, it just loses the
-- durable cross-instance cost caps until the table exists.

create table if not exists pb_kv (
  key text primary key,
  val jsonb,
  updated_at timestamptz default now()
);

-- No public access: only the service-role key (which bypasses RLS) may touch it.
alter table pb_kv enable row level security;
