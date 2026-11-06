-- 0025 · Reference videos ("Copy a video") get their own table.
-- A video the owner liked enough to copy says something about what works, so its breakdown is kept for good,
-- with the link it came from, its numbers there, the product it was copied for and the video made from it.
-- The video file itself is not kept: it sits in tmp/ while it's read and storage deletes it after 7 days.
-- Before this, each reference was a brand_assets row (kind reference_video) with the file kept forever;
-- those rows move here with the same ids, so plan_items.reference_video_id keeps pointing at them.
-- Safe to run once on a database that has 0001–0024.

create table if not exists public.reference_videos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default public.current_business_id() references public.businesses (id) on delete cascade,
  -- An upload, or a pasted link (Meta Ad Library, Instagram, TikTok, YouTube, Facebook or a video file)
  source text not null check (source in ('upload', 'link')),
  source_url text,
  platform text check (platform in ('meta_ad', 'instagram', 'tiktok', 'youtube', 'facebook', 'other')),
  -- What the link's page said about the video: caption or ad text, account, views, likes, comments, shares, saves
  source_meta jsonb not null default '{}'::jsonb,
  offering_id uuid,
  -- The latest video made from it
  media_id uuid,
  -- The file while it's read (tmp/, deleted by storage after 7 days); older rows point at their kept file
  storage_key text,
  -- The scene-by-scene breakdown (prompts/agents/reference-video.ts), its summary and length
  analysis jsonb,
  summary text,
  duration_sec numeric,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reference_videos_id_business_key unique (id, business_id),
  constraint reference_videos_offering_id_fkey foreign key (offering_id, business_id)
    references public.offerings (id, business_id) on delete set null (offering_id),
  constraint reference_videos_media_id_fkey foreign key (media_id, business_id)
    references public.media (id, business_id) on delete set null (media_id)
);

create index if not exists idx_reference_videos_business_id on public.reference_videos (business_id);
create index if not exists idx_reference_videos_offering_id on public.reference_videos (offering_id);
create index if not exists idx_reference_videos_media_id on public.reference_videos (media_id);

alter table public.reference_videos enable row level security;
drop policy if exists "own_business" on public.reference_videos;
create policy "own_business" on public.reference_videos for all to authenticated
  using (business_id = (select public.current_business_id())) with check (business_id = (select public.current_business_id()));
revoke all on public.reference_videos from anon;
grant all privileges on public.reference_videos to authenticated, service_role;
drop trigger if exists keep_business_id on public.reference_videos;
create trigger keep_business_id before update of business_id on public.reference_videos
  for each row execute function public.keep_business_id();

-- The references already used for posts move over, with the latest video made from each
insert into public.reference_videos (id, business_id, source, offering_id, media_id, storage_key, analysis, summary, duration_sec, analyzed_at, created_at)
select
  a.id, a.business_id, 'upload', a.offering_id,
  (select m.id from public.media m join public.plan_items p on p.id = m.plan_item_id
    where p.reference_video_id = a.id and m.business_id = a.business_id order by m.created_at desc limit 1),
  a.storage_key, a.analysis, a.ai_description,
  nullif(a.analysis ->> 'duration', '')::numeric,
  case when a.analysis is not null then a.created_at end,
  a.created_at
from public.brand_assets a
where a.kind = 'reference_video' and exists (select 1 from public.plan_items p where p.reference_video_id = a.id)
on conflict (id) do nothing;

alter table public.plan_items drop constraint if exists plan_items_reference_video_id_fkey;
alter table public.plan_items
  add constraint plan_items_reference_video_id_fkey foreign key (reference_video_id, business_id)
  references public.reference_videos (id, business_id) on delete set null (reference_video_id);

delete from public.brand_assets a
where a.kind = 'reference_video' and exists (select 1 from public.reference_videos r where r.id = a.id);
