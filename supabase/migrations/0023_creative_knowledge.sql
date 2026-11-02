-- 0023 · The creative knowledge base: every planned post records its strategy, and the
-- Performance Analyst learns from it.
-- Safe to run once on a database that has 0001–0022.

-- =====================================================================
-- 1. The Planner's strategy per post: what it is for (code, from the client's goal mix), the one
--    desire it taps and the audience's awareness level (AI)
-- =====================================================================

alter table public.plan_items add column if not exists ad_objective text
  check (ad_objective in ('awareness', 'converting', 'retargeting'));
alter table public.plan_items add column if not exists desire text
  check (desire in ('health', 'attraction', 'status', 'belonging', 'control', 'comfort'));
alter table public.plan_items add column if not exists awareness_level text
  check (awareness_level in ('unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'));

-- =====================================================================
-- 2. The Performance Analyst learns by objective, desire, awareness level and style modifier too
-- =====================================================================

alter table public.learnings drop constraint if exists learnings_dimension_check;
alter table public.learnings add constraint learnings_dimension_check
  check (dimension in (
    'baseline', 'angle', 'hook_type', 'format', 'framework', 'lever', 'pillar', 'persona', 'time_slot', 'style',
    'ad_objective', 'desire', 'awareness_level', 'style_modifier'
  ));
