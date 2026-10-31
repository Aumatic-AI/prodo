-- 0021 · The weekly loop follows the client's content choices from onboarding.
-- Safe to run once on a database that has 0001–0020.

-- =====================================================================
-- 1. Each planned post has a content style (the client's image or video styles, e.g. "tips",
--    "showcase"), picked by the Planner's code
-- =====================================================================

alter table public.plan_items add column if not exists style text;

-- =====================================================================
-- 2. The Performance Analyst learns which styles work
-- =====================================================================

alter table public.learnings drop constraint if exists learnings_dimension_check;
alter table public.learnings add constraint learnings_dimension_check
  check (dimension in ('baseline', 'angle', 'hook_type', 'format', 'framework', 'lever', 'pillar', 'persona', 'time_slot', 'style'));
