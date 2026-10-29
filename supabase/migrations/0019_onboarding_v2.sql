-- 0019 · Onboarding v2: website first, then "Your content", Basics, products or services, connect, review.
-- Adds the answers the new steps ask for and moves inspiration brands next to competitors.
-- Safe to run once on a database that has 0001–0018.

-- =====================================================================
-- 1. business_profile: new answers
-- =====================================================================

alter table public.business_profile
  add column if not exists industry text,
  -- Default currency for every price (each product keeps its own)
  add column if not exists currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  -- The one next step on every post; the link itself is in cta_links
  add column if not exists primary_cta text check (primary_cta is null or primary_cta in ('shop', 'whatsapp', 'book', 'call')),
  -- "Your content": goals (1–2, in order), images or videos, post styles in order, people, logo
  add column if not exists content_prefs jsonb not null default '{}'::jsonb,
  add column if not exists cities text[] not null default '{}';

-- Cities were a comma-separated answer inside the onboarding JSON
update public.business_profile
set cities = coalesce(
  (select array_agg(c) from (select btrim(c) as c from unnest(string_to_array(onboarding->>'cities', ',')) as c) t where c <> ''),
  '{}'
)
where onboarding ? 'cities';
update public.business_profile set onboarding = onboarding - 'cities' where onboarding ? 'cities';

-- The single main goal becomes the first of the goals list
update public.business_profile
set content_prefs = content_prefs || jsonb_build_object('goals', jsonb_build_array(primary_goal))
where primary_goal is not null and not content_prefs ? 'goals';

-- Currency from the business's first priced product
update public.business_profile p
set currency = o.currency
from (
  select distinct on (business_id) business_id, currency
  from public.offerings
  where currency is not null
  order by business_id, created_at
) o
where o.business_id = p.business_id and p.currency is null;

-- =====================================================================
-- 2. competitors: brands to learn from are competitors or inspiration
-- =====================================================================

alter table public.competitors
  add column if not exists relation text not null default 'competitor' check (relation in ('competitor', 'inspiration'));

-- "Brands you admire" were names only; they become inspiration rows the client added
insert into public.competitors (business_id, name, source, relation)
select p.business_id, btrim(b.name), 'client', 'inspiration'
from public.business_profile p
cross join lateral unnest(p.liked_brands) as b(name)
where btrim(b.name) <> ''
  and not exists (
    select 1 from public.competitors c
    where c.business_id = p.business_id and lower(c.name) = lower(btrim(b.name))
  );

alter table public.business_profile drop column if exists liked_brands;

-- =====================================================================
-- 3. brand_assets: photos found on the website keep their page; new kinds
-- =====================================================================

alter table public.brand_assets add column if not exists source_id uuid;
alter table public.brand_assets drop constraint if exists brand_assets_source_id_fkey;
alter table public.brand_assets
  add constraint brand_assets_source_id_fkey foreign key (source_id, business_id)
  references public.brand_sources (id, business_id) on delete set null (source_id);
create index if not exists idx_brand_assets_source_id on public.brand_assets (source_id);

-- person: photos of people who appear in posts · reference_image: posts and ads the client likes
-- general: the client's own photos and videos, not tied to a product
alter table public.brand_assets drop constraint if exists brand_assets_kind_check;
alter table public.brand_assets add constraint brand_assets_kind_check check (
  kind in ('product_photo', 'team', 'location', 'work', 'reference_video', 'doc', 'person', 'reference_image', 'general')
);

-- =====================================================================
-- 4. brand_sources: links to posts the client likes
-- =====================================================================

alter table public.brand_sources drop constraint if exists brand_sources_kind_check;
alter table public.brand_sources add constraint brand_sources_kind_check check (
  kind in ('web_page', 'social_post', 'competitor', 'serp', 'review', 'upload', 'reference')
);

-- =====================================================================
-- 5. Website scan state, written by the scan job one key at a time
-- =====================================================================

-- Same idea as set_research_state: one atomic update, so the client's own saves of the
-- onboarding JSON and the job's writes never overwrite each other
create or replace function public.set_scan_state(path text[], value jsonb, p_business_id uuid)
returns void
language sql
set search_path = public
as $$
  update business_profile
  set onboarding = jsonb_set(
    case when coalesce(onboarding, '{}'::jsonb) ? 'scan' then onboarding else coalesce(onboarding, '{}'::jsonb) || '{"scan": {}}'::jsonb end,
    array['scan'] || path, value, true
  )
  where business_id = p_business_id;
$$;
revoke execute on function public.set_scan_state(text[], jsonb, uuid) from public, anon, authenticated;
grant execute on function public.set_scan_state(text[], jsonb, uuid) to service_role;

-- Merges answers into the onboarding JSON without touching keys the request didn't send
-- (the scan job writes "scan" while the client saves steps)
create or replace function public.merge_onboarding(patch jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update business_profile
  set onboarding = coalesce(onboarding, '{}'::jsonb) || patch
  where business_id = public.current_business_id();
$$;
revoke execute on function public.merge_onboarding(jsonb) from public, anon;
grant execute on function public.merge_onboarding(jsonb) to authenticated;
