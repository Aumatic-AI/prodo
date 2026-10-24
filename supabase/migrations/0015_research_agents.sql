-- Phase 1.8: brand research agents.

-- Facts pulled from the website keep their page and wait for the client.
-- Client-entered rows: verified = true. Extracted rows: active = false, verified = false
-- until confirmed (confirm sets both true; reject keeps active = false, verified = true).
alter table offerings
  add column if not exists source_id uuid references brand_sources (id) on delete set null,
  add column if not exists verified boolean not null default true;
alter table offers
  add column if not exists source_id uuid references brand_sources (id) on delete set null,
  add column if not exists verified boolean not null default true;

-- Competitors the client named vs. ones the Social & Market Analyst found
alter table competitors
  add column if not exists source text not null default 'client' check (source in ('client', 'discovered'));

-- Per-platform baseline (median engagement rate and views) lives in learnings
alter table learnings drop constraint if exists learnings_dimension_check;
alter table learnings add constraint learnings_dimension_check
  check (dimension in ('baseline', 'angle', 'hook_type', 'format', 'framework', 'lever', 'pillar', 'persona', 'time_slot'));

-- Groups the steps of one workflow run, e.g. one onboarding research
alter table agent_runs add column if not exists run_id text;
create index if not exists agent_runs_run_id on agent_runs (run_id, created_at);

-- Research progress is written by agents running in parallel, so each write is one atomic
-- statement with no read first: sets onboarding.research.<path>, e.g. {agents, website_analyst}.
-- Parent keys must exist (submit creates research.agents).
create or replace function public.set_research_state(path text[], value jsonb)
returns void
language sql
set search_path = public
as $$
  update business_profile
  set onboarding = jsonb_set(coalesce(onboarding, '{}'::jsonb), array['research'] || path, value, true)
  where id = 1;
$$;
revoke execute on function public.set_research_state(text[], jsonb) from public, anon, authenticated;
grant execute on function public.set_research_state(text[], jsonb) to service_role;
