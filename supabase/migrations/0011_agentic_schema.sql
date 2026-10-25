-- Phase 1.3 (part 2): the agentic data model (Prodo Data Model artifact).
-- 27 tables total: 21 new, 4 changed (business_profile, media, posts, post_targets).
-- Embedding size 1536 = OpenAI text-embedding-3-small. Changing the model means a
-- new migration that alters both vector columns and re-embeds every row.

create extension if not exists vector with schema extensions;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- SETTINGS (singletons)
-- =====================================================================

alter table business_profile
  add column if not exists description text not null default '',
  add column if not exists business_type text check (business_type in ('product', 'service')),
  add column if not exists timezone text,
  add column if not exists countries text[] not null default '{}',
  add column if not exists primary_goal text check (primary_goal in ('awareness', 'leads', 'sales', 'bookings', 'followers')),
  add column if not exists social_urls jsonb not null default '{}'::jsonb,
  add column if not exists cta_links jsonb not null default '{}'::jsonb,
  add column if not exists tone jsonb not null default '{}'::jsonb,
  add column if not exists liked_brands text[] not null default '{}',
  add column if not exists compliance jsonb not null default '{"avoid_words": [], "forbidden_claims": [], "disclaimers": []}'::jsonb,
  add column if not exists posting_prefs jsonb not null default '{}'::jsonb,
  add column if not exists voice_id text,
  add column if not exists music_mood text,
  add column if not exists onboarding jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'collecting', 'analyzing', 'review', 'done')),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists app_settings (
  id smallint primary key default 1 check (id = 1),
  autopilot_mode text not null default 'approve_plan' check (autopilot_mode in ('full', 'approve_plan', 'approve_each')),
  paused boolean not null default false,
  plan_weekday smallint not null default 0 check (plan_weekday between 0 and 6), -- 0 = Sunday
  plan_time time not null default '09:00',
  approval_timeout_hours integer not null default 24 check (approval_timeout_hours > 0),
  monthly_budget_usd numeric(10, 2) not null default 50 check (monthly_budget_usd >= 0),
  notify_email text,
  updated_at timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists brand_kit (
  id smallint primary key default 1 check (id = 1),
  colors jsonb not null default '{}'::jsonb,        -- {primary, secondary, accent, bg, text}
  fonts jsonb not null default '{}'::jsonb,         -- {heading, body}
  logo_variants jsonb not null default '{}'::jsonb, -- storage keys: {full, mark, light, dark}
  photo_style text,
  layout_style text,
  template_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into brand_kit (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- BRAND KNOWLEDGE
-- =====================================================================

create table if not exists brand_bible (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded')),
  content jsonb not null default '{}'::jsonb, -- positioning, value_prop, tone_guide, visual_rules, offer_stack, do_dont, never_say
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
-- Only one approved Bible at a time
create unique index if not exists brand_bible_one_approved on brand_bible (status) where status = 'approved';

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  summary text,
  pains text[] not null default '{}',
  desires text[] not null default '{}',
  objections text[] not null default '{}',
  triggers text[] not null default '{}',
  phrases text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_pillars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  target_share numeric(4, 3) not null default 0 check (target_share between 0 and 1),
  funnel_stage text check (funnel_stage in ('tofu', 'mofu', 'bofu')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists offerings (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('product', 'service')),
  name text not null,
  description text,
  url text,
  price numeric(12, 2),
  currency text,
  price_model text check (price_model in ('fixed', 'from', 'hourly', 'quote', 'subscription')),
  benefits text[] not null default '{}',
  objections text[] not null default '{}',
  audience text,
  is_hero boolean not null default false,
  priority smallint not null default 0,
  attributes jsonb not null default '{}'::jsonb, -- product: variants, specs; service: process, turnaround, area
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_offerings_active on offerings (active, kind);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid references offerings (id) on delete cascade, -- null = store-wide deal
  title text not null,
  details text,
  code text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists idx_offers_offering_id on offers (offering_id);
create index if not exists idx_offers_ends_at on offers (ends_at) where active;

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  social_urls jsonb not null default '{}'::jsonb,
  analysis jsonb, -- {angles, offers, formats, gaps}
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  kind text not null check (kind in ('holiday', 'sale', 'launch', 'trend')),
  relevance smallint not null default 3 check (relevance between 1 and 5),
  source text not null check (source in ('system', 'client', 'serp')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_calendar_events_date on calendar_events (date);

-- =====================================================================
-- BRAND BRAIN
-- =====================================================================

create table if not exists brand_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('web_page', 'social_post', 'competitor', 'serp', 'review', 'upload')),
  competitor_id uuid references competitors (id) on delete cascade,
  url text,
  title text,
  content_md text,
  content_hash text, -- skip unchanged pages on refresh
  metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);
create index if not exists idx_brand_sources_competitor_id on brand_sources (competitor_id);
create index if not exists idx_brand_sources_url on brand_sources (url);

create table if not exists brand_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references brand_sources (id) on delete cascade,
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb, -- {offering_id, kind} for filtered search
  created_at timestamptz not null default now()
);
create index if not exists idx_brand_chunks_source_id on brand_chunks (source_id);
create index if not exists idx_brand_chunks_embedding on brand_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists idx_brand_chunks_metadata on brand_chunks using gin (metadata);

create table if not exists proof_items (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid references offerings (id) on delete set null, -- null = about the whole business
  source_id uuid references brand_sources (id) on delete set null,
  kind text not null check (kind in ('review', 'testimonial', 'case_study', 'stat', 'award', 'certification')),
  content text not null,
  author text,
  rating numeric(2, 1) check (rating between 0 and 5),
  verified boolean not null default false, -- client-confirmed or from a real source
  created_at timestamptz not null default now()
);
create index if not exists idx_proof_items_offering_id on proof_items (offering_id);
create index if not exists idx_proof_items_source_id on proof_items (source_id);

create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid references offerings (id) on delete set null,
  kind text not null check (kind in ('product_photo', 'team', 'location', 'work', 'reference_video', 'doc')),
  storage_key text not null, -- never a URL
  ai_description text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_brand_assets_offering_id on brand_assets (offering_id);

-- =====================================================================
-- PLANNING & CREATIVE
-- =====================================================================

create table if not exists content_plans (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  brand_bible_id uuid references brand_bible (id) on delete restrict,
  status text not null default 'planning'
    check (status in ('planning', 'producing', 'review', 'approved', 'scheduled', 'done', 'failed')),
  strategy jsonb not null default '{}'::jsonb, -- {theme, mix, rationale}
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references content_plans (id) on delete cascade,
  slot_at timestamptz not null,
  platforms text[] not null default '{}',
  format text not null check (format in ('static', 'carousel', 'video', 'text')),
  pillar_id uuid references content_pillars (id) on delete set null,
  persona_id uuid references personas (id) on delete set null,
  offering_id uuid references offerings (id) on delete set null,
  offer_id uuid references offers (id) on delete set null,
  funnel_stage text,
  objective text,
  angle text,
  framework text,
  hook_type text,
  hook_text text,
  levers text[] not null default '{}',
  is_experiment boolean not null default false,
  brief jsonb,
  captions jsonb, -- {platform: text}
  rationale text,
  brief_score numeric(4, 2),
  qa_score numeric(4, 2),
  qa_report jsonb,
  attempts smallint not null default 0 check (attempts between 0 and 3),
  status text not null default 'planned'
    check (status in ('planned', 'briefed', 'producing', 'qa', 'needs_review', 'approved', 'rejected', 'scheduled', 'published', 'failed')),
  selected_media_id uuid references media (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_plan_items_plan_id on plan_items (plan_id, slot_at);
create index if not exists idx_plan_items_status on plan_items (status);
create index if not exists idx_plan_items_pillar_id on plan_items (pillar_id);
create index if not exists idx_plan_items_persona_id on plan_items (persona_id);
create index if not exists idx_plan_items_offering_id on plan_items (offering_id);
create index if not exists idx_plan_items_offer_id on plan_items (offer_id);
create index if not exists idx_plan_items_selected_media_id on plan_items (selected_media_id);

create table if not exists hook_library (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  hook_type text,
  platform text,
  source text not null check (source in ('generated', 'own_winner', 'competitor')),
  plan_item_id uuid references plan_items (id) on delete set null,
  score numeric, -- performance vs. baseline (1.0 = average)
  uses integer not null default 0,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);
create index if not exists idx_hook_library_plan_item_id on hook_library (plan_item_id);
create index if not exists idx_hook_library_embedding on hook_library
  using hnsw (embedding extensions.vector_cosine_ops);

-- =====================================================================
-- MEDIA (media changed, media_files new)
-- =====================================================================

alter table media drop constraint if exists media_type_check;
alter table media add constraint media_type_check check (type in ('image', 'video', 'text', 'carousel'));

alter table media
  add column if not exists plan_item_id uuid references plan_items (id) on delete set null,
  add column if not exists offering_id uuid references offerings (id) on delete set null,
  add column if not exists variant_of uuid references media (id) on delete set null,
  add column if not exists creative_spec jsonb,
  add column if not exists video_analysis jsonb,
  add column if not exists cost_usd numeric(10, 4) not null default 0;
create index if not exists idx_media_plan_item_id on media (plan_item_id);
create index if not exists idx_media_offering_id on media (offering_id);
create index if not exists idx_media_variant_of on media (variant_of);

create table if not exists media_files (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references media (id) on delete cascade,
  role text not null check (role in ('slide', 'rendition', 'thumbnail', 'voice', 'music', 'subtitles')),
  position smallint not null default 0,
  aspect_ratio text,
  storage_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_media_files_media_id on media_files (media_id, role, position);

-- =====================================================================
-- PUBLISHING & PERFORMANCE (posts, post_targets changed)
-- =====================================================================

alter table posts
  add column if not exists plan_item_id uuid unique references plan_items (id) on delete set null,
  add column if not exists origin text not null default 'manual' check (origin in ('manual', 'agent'));

-- provider default switches to 'zernio' in Phase 1.5, together with the Zernio adapter
alter table post_targets
  add column if not exists provider_post_id text,
  add column if not exists published_at timestamptz;

create table if not exists post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_target_id uuid not null references post_targets (id) on delete cascade,
  captured_on date not null,
  impressions integer,
  reach integer,
  views integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  clicks integer,
  followers_gained integer,
  avg_watch_sec numeric,
  completion_rate numeric,
  engagement_rate numeric,
  raw jsonb,
  unique (post_target_id, captured_on)
);

create table if not exists account_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  account_id text not null,
  captured_on date not null,
  followers integer,
  raw jsonb,
  unique (platform, account_id, captured_on)
);

create table if not exists learnings (
  id uuid primary key default gen_random_uuid(),
  dimension text not null
    check (dimension in ('angle', 'hook_type', 'format', 'framework', 'lever', 'pillar', 'persona', 'time_slot')),
  value text not null, -- name, or id as text for pillar/persona (no FK on purpose)
  platform text,       -- null = all platforms
  sample_size integer not null default 0,
  score numeric,       -- vs. the account's baseline (1.0 = average)
  confidence numeric,
  insight text,
  updated_at timestamptz not null default now(),
  unique nulls not distinct (dimension, value, platform)
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  plan_item_id uuid not null references plan_items (id) on delete cascade,
  media_id uuid references media (id) on delete set null,
  action text not null check (action in ('approve', 'reject', 'edit', 'regenerate')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_plan_item_id on feedback (plan_item_id);
create index if not exists idx_feedback_media_id on feedback (media_id);

-- =====================================================================
-- SYSTEM
-- =====================================================================

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null, -- website_analyst, planner, producer…
  plan_id uuid references content_plans (id) on delete set null,
  plan_item_id uuid references plan_items (id) on delete set null,
  media_id uuid references media (id) on delete set null,
  inngest_run_id text,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  summary text,
  input jsonb,
  output jsonb,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(10, 4) not null default 0,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_runs_created_at on agent_runs (created_at desc); -- monthly budget sum
create index if not exists idx_agent_runs_plan_id on agent_runs (plan_id);
create index if not exists idx_agent_runs_plan_item_id on agent_runs (plan_item_id);
create index if not exists idx_agent_runs_media_id on agent_runs (media_id);
create index if not exists idx_agent_runs_inngest_run_id on agent_runs (inngest_run_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_unread on notifications (created_at desc) where read_at is null;

-- =====================================================================
-- updated_at triggers
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'business_profile', 'app_settings', 'brand_kit', 'personas', 'content_pillars',
    'offerings', 'offers', 'plan_items', 'learnings'
  ] loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format('create trigger set_updated_at before update on %I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- =====================================================================
-- Vector search over the Brand Brain
-- =====================================================================

create or replace function public.match_brand_chunks(
  query_embedding extensions.vector(1536),
  match_count integer default 8,
  filter jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.source_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from brand_chunks c
  where c.embedding is not null
    and c.metadata @> filter
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_brand_chunks(extensions.vector, integer, jsonb) from public, anon;
grant execute on function public.match_brand_chunks(extensions.vector, integer, jsonb) to authenticated, service_role;

-- =====================================================================
-- RLS and grants: authenticated only, no anon (same rules as 0009)
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'app_settings', 'brand_kit', 'brand_bible', 'personas', 'content_pillars', 'offerings',
    'offers', 'competitors', 'calendar_events', 'brand_sources', 'brand_chunks', 'proof_items',
    'brand_assets', 'content_plans', 'plan_items', 'hook_library', 'media_files', 'post_metrics',
    'account_snapshots', 'learnings', 'feedback', 'agent_runs', 'notifications'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end;
$$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant all privileges on all tables in schema public to authenticated, service_role;
grant all privileges on all sequences in schema public to authenticated, service_role;
