-- 0027 · The Ad library ("Copy a video" → Ad library): each page of Meta Ad Library results a business
-- fetched, kept 48 hours. Every live call costs a ScrapeCreators credit, so the same search, or going back a
-- page, is read from here instead; the day's rows also count the business's live calls for its daily limit.
-- Rows older than 48 hours are deleted by the app when it saves a new page.
-- Safe to run once on a database that has 0001–0026.

create table if not exists public.ad_library_searches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default public.current_business_id() references public.businesses (id) on delete cascade,
  -- 'keyword' (ads whose words match) or 'brand' (one advertiser's ads)
  kind text not null check (kind in ('keyword', 'brand')),
  -- What was searched, lower-cased and trimmed
  query text not null,
  -- ISO 3166-1 code, or 'ALL'
  country text not null,
  page integer not null check (page >= 1),
  -- The page's video ads (id, brand, text, video and preview links, start date, platforms)
  ads jsonb not null default '[]'::jsonb,
  -- Where the next page starts; null on the last page
  next_cursor text,
  fetched_at timestamptz not null default now(),
  constraint ad_library_searches_page_key unique (business_id, kind, query, country, page)
);

create index if not exists idx_ad_library_searches_business_fetched on public.ad_library_searches (business_id, fetched_at);

alter table public.ad_library_searches enable row level security;
drop policy if exists "own_business" on public.ad_library_searches;
create policy "own_business" on public.ad_library_searches for all to authenticated
  using (business_id = (select public.current_business_id())) with check (business_id = (select public.current_business_id()));
revoke all on public.ad_library_searches from anon;
grant all privileges on public.ad_library_searches to authenticated, service_role;
drop trigger if exists keep_business_id on public.ad_library_searches;
create trigger keep_business_id before update of business_id on public.ad_library_searches
  for each row execute function public.keep_business_id();
