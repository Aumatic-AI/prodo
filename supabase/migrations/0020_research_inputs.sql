-- 0020 · Research uses the onboarding answers, and vector search is exact per business.
-- Safe to run once on a database that has 0001–0019.

-- =====================================================================
-- 1. Hooks from posts the client chose as examples, and from brands they admire
-- =====================================================================

alter table public.hook_library drop constraint if exists hook_library_source_check;
alter table public.hook_library add constraint hook_library_source_check
  check (source in ('generated', 'own_winner', 'competitor', 'reference'));

-- =====================================================================
-- 2. Vector search: exact, within one business
-- =====================================================================
-- The HNSW indexes are shared by every business. Postgres takes the nearest rows across all
-- businesses first and only then keeps this business's ones, so with many businesses a search can
-- come back short or empty. One business has a few thousand passages at most, so an exact search
-- over just its own rows is fast and always complete. "materialized" stops the planner from using
-- the shared index for the ordering.

create or replace function public.match_brand_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  filter jsonb default '{}'::jsonb,
  p_business_id uuid default null
)
returns table (id uuid, source_id uuid, content text, metadata jsonb, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  with own as materialized (
    select c.id, c.source_id, c.content, c.metadata, c.embedding
    from brand_chunks c
    where c.business_id = coalesce(p_business_id, public.current_business_id())
      and c.embedding is not null
      and c.metadata @> filter
  )
  select own.id, own.source_id, own.content, own.metadata, 1 - (own.embedding <=> query_embedding) as similarity
  from own
  order by own.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_recent_hooks(
  query_embedding extensions.vector(1536),
  since timestamptz,
  match_count integer default 5,
  p_business_id uuid default null
)
returns table (id uuid, text text, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  with own as materialized (
    select h.id, h.text, h.embedding
    from hook_library h
    where h.business_id = coalesce(p_business_id, public.current_business_id())
      and h.embedding is not null
      and (h.created_at >= since or h.plan_item_id is not null)
  )
  select own.id, own.text, 1 - (own.embedding <=> query_embedding) as similarity
  from own
  order by own.embedding <=> query_embedding
  limit match_count;
$$;

-- Each business's rows are found through its business_id index instead
drop index if exists public.idx_brand_chunks_embedding;
drop index if exists public.idx_hook_library_embedding;
