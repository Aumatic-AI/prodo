-- Sprint 2: the weekly content loop (Planner, Creative Director, QA Critic, Producer, Publisher).
-- Small additions to tables that already exist since 0011.

-- plan_items: 'ready' = passed both QA gates and waits for the client's approval.
-- (needs_review = QA still failed after two redos; approved = the client said yes.)
alter table plan_items drop constraint if exists plan_items_status_check;
alter table plan_items add constraint plan_items_status_check check (
  status in ('planned', 'briefed', 'producing', 'qa', 'ready', 'needs_review', 'approved', 'rejected', 'scheduled', 'published', 'failed')
);

-- content_plans: when full autopilot approves by itself, and the plain reason a plan failed.
alter table content_plans
  add column if not exists approval_due_at timestamptz,
  add column if not exists error text;

-- notifications: every notification can also go out by email. Sending is off until
-- EMAIL_ENABLED is set, so rows are marked 'skipped' instead of sent.
alter table notifications
  add column if not exists email_status text not null default 'none'
    check (email_status in ('none', 'pending', 'sent', 'skipped', 'failed')),
  add column if not exists email_to text,
  add column if not exists email_error text,
  add column if not exists emailed_at timestamptz;

-- Storage: the Producer saves caption files (.ass, plain text) and brand fonts (.ttf) for the
-- video renderer, next to images, videos and audio.
update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp',
  'video/mp4', 'video/quicktime',
  'audio/mpeg',
  'text/plain', 'font/ttf'
]
where id = 'media';

-- Hooks too close to recent ones are rejected by the Creative Director (embedding check).
create or replace function public.match_recent_hooks(
  query_embedding extensions.vector(1536),
  since timestamptz,
  match_count integer default 5
)
returns table (id uuid, text text, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  select h.id, h.text, 1 - (h.embedding <=> query_embedding) as similarity
  from hook_library h
  where h.embedding is not null
    and (h.created_at >= since or h.plan_item_id is not null)
  order by h.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_recent_hooks(extensions.vector, timestamptz, integer) from public, anon;
grant execute on function public.match_recent_hooks(extensions.vector, timestamptz, integer) to authenticated, service_role;

-- Weekly report from the Performance Analyst (agent 10): one per week, shown on Performance and emailed.
create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,   -- Monday of the week the report covers
  headline text not null,
  summary text not null,
  next_week text[] not null default '{}',
  stats jsonb not null default '{}'::jsonb, -- {posts, reach, engagements, er, prevEr, bestPostId, followers}
  created_at timestamptz not null default now()
);

alter table weekly_reports enable row level security;
drop policy if exists "authenticated_all" on weekly_reports;
create policy "authenticated_all" on weekly_reports for all to authenticated using (true) with check (true);
revoke all on weekly_reports from anon;
grant all privileges on weekly_reports to authenticated, service_role;
