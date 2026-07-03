-- Park Buddy — trails table (hiking / off-road / ski routes), Supabase / Postgres.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
--
-- Lakes reuse the existing `pb_places` table (type = 'water') — no migration needed
-- there. Trails need their own table because each row carries a path (line
-- geometry), not just a point.
--
-- Populated by scripts/seed-nearby.mjs (run locally — Overpass/OpenStreetMap
-- blocks datacenter IPs, so this can't be ingested from Netlify directly) via
-- POST /api/ingest-overpass, which uses SUPABASE_SERVICE_KEY (already configured
-- in Netlify) to write. The app reads it back through /api/trails — fast and
-- reliable, no live Overpass dependency at request time.

create table if not exists pb_trails (
  id          text primary key,          -- stable hash of park_code+category+name+index
  name        text not null,
  category    text not null,             -- hiking | offroad | ski
  difficulty  text,
  path        jsonb not null,            -- array of [lat,lng] pairs, sampled to <=25 points
  lat         double precision not null, -- representative point (path midpoint) for bbox reads
  lng         double precision not null,
  park_code   text,                      -- which park this was ingested for
  fetched_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists pb_trails_latlng on pb_trails (lat, lng);
create index if not exists pb_trails_park on pb_trails (park_code);
create index if not exists pb_trails_category on pb_trails (category);

alter table pb_trails enable row level security;
drop policy if exists "public read pb_trails" on pb_trails;
create policy "public read pb_trails" on pb_trails for select using (true);
-- Writes happen only from the server with the service-role key (bypasses RLS).
