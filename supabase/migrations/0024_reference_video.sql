-- 0024 · A reference video for one post: "make this same video for my product".
-- The video is a brand_assets row (kind reference_video); its scene-by-scene breakdown is saved on
-- brand_assets.analysis the first time the post is made.
-- Safe to run once on a database that has 0001–0023.

create unique index if not exists brand_assets_id_business_id_uidx on public.brand_assets (id, business_id);

alter table public.plan_items add column if not exists reference_video_id uuid;
alter table public.plan_items drop constraint if exists plan_items_reference_video_id_fkey;
alter table public.plan_items
  add constraint plan_items_reference_video_id_fkey foreign key (reference_video_id, business_id)
  references public.brand_assets (id, business_id) on delete set null (reference_video_id);
create index if not exists idx_plan_items_reference_video_id on public.plan_items (reference_video_id);
