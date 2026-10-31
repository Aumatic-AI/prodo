-- 0022 · The client's own videos are watched once and their best moments are used in ads.
-- Safe to run once on a database that has 0001–0021.

-- =====================================================================
-- What a video shows, from one Twelve Labs read: its length and its usable moments
-- ({duration, summary, moments: [{start, end, shows, shot, people, talking, product, quality, use, frame, lines}]}).
-- Null for photos and for videos not watched yet.
-- =====================================================================

alter table public.brand_assets add column if not exists analysis jsonb;

-- Videos still to watch, per business
create index if not exists idx_brand_assets_unwatched
  on public.brand_assets (business_id)
  where analysis is null;
