-- Persists Instagram post performance + category classification across runs.
-- Needed because a post's engagement score can stay the best in the account
-- long after it ages out of the live fetch window — without a saved snapshot
-- it would silently disappear from the ranking instead of staying on top.
create table "ig_creative_stats" (
  post_id text primary key,
  account text not null,
  caption text,
  media_type text,
  permalink text not null,
  thumbnail_url text,
  posted_at timestamptz not null,
  likes integer not null default 0,
  comments integer not null default 0,
  saved integer,
  shares integer,
  reach integer,
  engagement_score integer not null,
  engagement_rate numeric,
  categoria text,
  categoria_metodo text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index ig_creative_stats_account_score_idx
  on "ig_creative_stats" (account, engagement_score desc);

alter table "ig_creative_stats" enable row level security;

create policy "ig_creative_stats_authenticated_read"
  on "ig_creative_stats" for select
  to authenticated
  using (true);

-- No write policy for authenticated/anon — writes only via the service role
-- client from the server (lib/supabase/server.ts createServiceClient),
-- which bypasses RLS entirely. Matches the access pattern used elsewhere
-- in this app (migration 021).
