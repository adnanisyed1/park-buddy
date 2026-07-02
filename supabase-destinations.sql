-- Park Buddy — destinations table (state parks + national forests + national parks).
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
create table if not exists destinations (
  id          text primary key,          -- namespaced: nps:zion, usfs:..., state:...
  name        text not null,
  type        text,                       -- national_park | national_forest | state_park
  source      text,                       -- nps | usfs | state
  lat         double precision,
  lng         double precision,
  state       text,
  url         text,
  detail      text,
  tier        int default 1,              -- 1 = surface by default; higher = curated/secondary
  fetched_at  timestamptz,
  updated_at  timestamptz default now()
);
-- proximity reads: a simple bounding-box query uses lat/lng btree indexes.
create index if not exists destinations_lat_idx on destinations (lat);
create index if not exists destinations_lng_idx on destinations (lng);
create index if not exists destinations_type_idx on destinations (type);

-- Allow the public (anon) key to READ destinations; writes happen only via the
-- service-role key in the ingest job. Enable RLS + a read policy:
alter table destinations enable row level security;
drop policy if exists "destinations are public read" on destinations;
create policy "destinations are public read"
  on destinations for select using (true);
