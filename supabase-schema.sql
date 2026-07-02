-- Park Buddy — cached, reconciled places table (Supabase / Postgres).
-- Run this once in the Supabase SQL editor to create the ingestion target.
--
-- The ingestion job (/api/ingest) pulls every source, reconciles them, and upserts
-- rows here. The app then reads from this table (instant, complete, offline-safe)
-- instead of fetching live every time.

create table if not exists pb_places (
  id            text primary key,           -- stable hash of name+rounded coords
  name          text not null,
  type          text,                       -- campground | facility | recreation-area | water
  lat           double precision not null,
  lng           double precision not null,
  url           text,
  detail        text,
  sources       text[] default '{}',        -- e.g. {Recreation.gov/RIDB, OpenStreetMap}
  park_code     text,                       -- nearest NPS park this was ingested for
  fetched_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Fast nearby lookups + per-park reads.
create index if not exists pb_places_park on pb_places (park_code);
create index if not exists pb_places_latlng on pb_places (lat, lng);

-- Optional: enable Row Level Security and allow public READ (the data is public).
alter table pb_places enable row level security;
create policy "public read pb_places" on pb_places for select using (true);
-- Writes happen only from the server with the service-role key (bypasses RLS).
