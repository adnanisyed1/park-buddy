-- Park Buddy — trail reviews & ratings.
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
--
-- Unlike pb_places/destinations (public-read caches, written only by the
-- service-role key), reviews are genuinely user-owned rows: any signed-in
-- user can read all reviews, but can only write/edit/delete their OWN —
-- enforced with real Postgres Row Level Security via auth.uid(), the same
-- pattern the app's existing user_data table (public/auth.js) relies on.
create table if not exists trail_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  trail_id      text not null,        -- the NPS ArcGIS OBJECTID (see /api/trails ?id=)
  park_code     text,                 -- NPS unit code, e.g. "romo" — for filtering by park
  trail_name    text,                 -- denormalized so review lists don't need a trail lookup
  rating        int not null check (rating between 1 and 5),
  review_text   text,
  photo_url     text,                 -- optional, Supabase Storage public URL
  author_name   text,                 -- denormalized display name at time of posting
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, trail_id)          -- one review per user per trail (edit, don't duplicate)
);
create index if not exists trail_reviews_trail_id on trail_reviews (trail_id);
create index if not exists trail_reviews_user_id on trail_reviews (user_id);

alter table trail_reviews enable row level security;

drop policy if exists "trail reviews are public read" on trail_reviews;
create policy "trail reviews are public read"
  on trail_reviews for select using (true);

drop policy if exists "users can insert their own reviews" on trail_reviews;
create policy "users can insert their own reviews"
  on trail_reviews for insert with check (auth.uid() = user_id);

drop policy if exists "users can update their own reviews" on trail_reviews;
create policy "users can update their own reviews"
  on trail_reviews for update using (auth.uid() = user_id);

drop policy if exists "users can delete their own reviews" on trail_reviews;
create policy "users can delete their own reviews"
  on trail_reviews for delete using (auth.uid() = user_id);
