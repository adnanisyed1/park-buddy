-- ============================================================
-- Park Buddy — PINES schema  (run once in Supabase → SQL Editor)
-- Also: create a PUBLIC Storage bucket named "pines" (for photo uploads).
-- All tables are written/read by server routes with the SERVICE key, so RLS is
-- enabled with NO policies → the public anon key can't touch them directly.
-- ============================================================

-- 1) Core table: one row per Pine (photo or video)
create table pines (
  id            bigint generated always as identity primary key,
  user_id       uuid not null,
  media_type    text default 'video',          -- 'photo' | 'video'
  cf_uid        text,                           -- video only (Cloudflare Stream id)
  image_url     text,                           -- photo only (Storage public URL)
  place_type    text, place_id text, place_name text,
  caption       text default 'Adventure',
  duration_s    int,
  poster_url    text, hls_url text, iframe_url text,
  lat float8, lng float8, accuracy_m float8, captured_at timestamptz,
  location_source text,                         -- 'photo' (EXIF) | 'manual'
  verified      boolean default false,
  display_lat float8, display_lng float8,
  status        text default 'processing',      -- processing|pending|approved|rejected|removed
  like_count    int default 0,
  comment_count int default 0,
  view_count    int default 0,
  created_at    timestamptz default now()
);
create index on pines (status, created_at desc);
create index on pines (status, like_count desc);
create index on pines (place_type, place_id, status);
create index on pines (user_id, created_at desc);

-- 2) Likes (trigger keeps pines.like_count in sync)
create table pine_likes (
  pine_id    bigint not null,
  user_id    uuid not null,
  created_at timestamptz default now(),
  primary key (pine_id, user_id)
);
create or replace function pines_sync_like_count() returns trigger language plpgsql as $$
begin
  update pines set like_count = (select count(*) from pine_likes
    where pine_id = coalesce(new.pine_id, old.pine_id))
  where id = coalesce(new.pine_id, old.pine_id);
  return null;
end $$;
create trigger t_pine_like after insert or delete on pine_likes
  for each row execute function pines_sync_like_count();

-- 3) Comments (trigger keeps pines.comment_count in sync)
create table pine_comments (
  id          bigint generated always as identity primary key,
  pine_id     bigint not null,
  user_id     uuid not null,
  author_name text,
  body        text not null,
  status      text default 'visible',
  created_at  timestamptz default now()
);
create index on pine_comments (pine_id, created_at);
create or replace function pines_sync_comment_count() returns trigger language plpgsql as $$
begin
  update pines set comment_count = (select count(*) from pine_comments
    where pine_id = coalesce(new.pine_id, old.pine_id) and status = 'visible')
  where id = coalesce(new.pine_id, old.pine_id);
  return null;
end $$;
create trigger t_pine_comment after insert or update or delete on pine_comments
  for each row execute function pines_sync_comment_count();

-- 4) Early-access waitlist
create table pines_waitlist (
  id         bigint generated always as identity primary key,
  email      text not null unique,
  source     text,
  created_at timestamptz default now()
);

-- 5) Lock the tables (RLS on, no policies → server-only via service key)
alter table pines          enable row level security;
alter table pine_likes     enable row level security;
alter table pine_comments  enable row level security;
alter table pines_waitlist enable row level security;
