-- One login = one business (multi-tenant).
--
-- Every login owns exactly one business; a new user gets a new, empty business and goes
-- through onboarding. Every table gets business_id:
--   * logged-in users (API routes) see and write only their own business through RLS, and
--     inserts fill business_id by themselves (column default current_business_id());
--   * agents and jobs use the service role through businessDb() in the app, which adds the
--     same filter to every query and stamps business_id on every insert.
-- Foreign keys between tables include business_id, so a row can never point at another
-- business's row, and a trigger stops any row moving to another business.
--
-- The data that exists today becomes the first business, owned by OWNER_EMAIL below
-- (falls back to the oldest login). Every other existing login gets its own empty business.
--
-- Needs Postgres 15 or newer (ON DELETE SET NULL with a column list). Run it once, as a whole.

-- =====================================================================
-- Helpers for this migration only (dropped at the end of the session)
-- =====================================================================

-- Drops the foreign key on exactly this one column, whatever it was named
create function pg_temp.drop_fk(tbl text, col text) returns void language plpgsql as $$
declare c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.conrelid = format('public.%I', tbl)::regclass
      and con.contype = 'f'
      and array_length(con.conkey, 1) = 1
      and att.attname = col
  loop
    execute format('alter table public.%I drop constraint %I', tbl, c);
  end loop;
end;
$$;

-- Drops the unique constraint on exactly these columns, whatever it was named
create function pg_temp.drop_unique(tbl text, cols text[]) returns void language plpgsql as $$
declare c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = format('public.%I', tbl)::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname)
        from pg_attribute att
        where att.attrelid = con.conrelid and att.attnum = any (con.conkey)
      ) = (select array_agg(x order by x) from unnest(cols) x)
  loop
    execute format('alter table public.%I drop constraint %I', tbl, c);
  end loop;
end;
$$;

-- Child (col, business_id) -> parent (id, business_id). Keeps the old constraint name, so
-- embedded selects that name it (e.g. plan_items!posts_plan_item_id_fkey) keep working.
-- SET NULL clears only the id column; business_id stays.
create function pg_temp.business_fk(tbl text, col text, parent text, rule text) returns void language plpgsql as $$
begin
  perform pg_temp.drop_fk(tbl, col);
  execute format(
    'alter table public.%I add constraint %I foreign key (%I, business_id) references public.%I (id, business_id) on delete %s',
    tbl, tbl || '_' || col || '_fkey', col, parent,
    case rule when 'set null' then format('set null (%I)', col) else rule end
  );
end;
$$;

-- =====================================================================
-- 1. Businesses
-- =====================================================================

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the login keeps the business and its data (no owner = nobody can open it)
  owner_id uuid unique references auth.users (id) on delete set null,
  -- Files from before this migration have no business folder; only this business may delete them
  owns_unfoldered_files boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.businesses enable row level security;
create policy "owner_reads" on public.businesses for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to authenticated;
grant all on public.businesses to service_role;

-- The logged-in user's business (null for the service role and for anyone without one)
create function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.businesses where owner_id = auth.uid()
$$;
revoke execute on function public.current_business_id() from public, anon;
grant execute on function public.current_business_id() to authenticated, service_role;

-- The existing data's business
do $$
declare
  owner_email constant text := 'prodo@gmail.com';
  owner uuid;
begin
  select id into owner from auth.users where lower(email) = owner_email;
  if owner is null then
    select id into owner from auth.users order by created_at limit 1;
  end if;
  insert into public.businesses (owner_id, owns_unfoldered_files) values (owner, true);
end;
$$;

-- =====================================================================
-- 2. business_id on every table (existing rows belong to the first business)
-- =====================================================================

do $$
declare
  t text;
  first_business uuid := (select id from public.businesses);
begin
  foreach t in array array[
    'business_profile', 'app_settings', 'brand_kit',
    'brand_bible', 'personas', 'content_pillars', 'offerings', 'offers', 'competitors', 'calendar_events',
    'brand_sources', 'brand_chunks', 'proof_items', 'brand_assets',
    'content_plans', 'plan_items', 'hook_library',
    'media', 'media_files', 'posts', 'post_targets', 'post_metrics', 'account_snapshots',
    'learnings', 'feedback', 'agent_runs', 'notifications', 'weekly_reports'
  ] loop
    -- A constant default fills existing rows without rewriting them or firing triggers
    execute format(
      'alter table public.%I add column business_id uuid not null default %L references public.businesses (id) on delete cascade',
      t, first_business
    );
    -- From now on: the logged-in user's business. The service role must set it (businessDb does).
    execute format('alter table public.%I alter column business_id set default public.current_business_id()', t);
    execute format('create index if not exists %I on public.%I (business_id)', 'idx_' || t || '_business_id', t);
  end loop;
end;
$$;

-- =====================================================================
-- 3. Settings: one row per business instead of one row with id = 1
-- =====================================================================

alter table public.business_profile drop column id;
alter table public.business_profile add primary key (business_id);
drop index if exists public.idx_business_profile_business_id;

alter table public.app_settings drop column id;
alter table public.app_settings add primary key (business_id);
drop index if exists public.idx_app_settings_business_id;

alter table public.brand_kit drop column id;
alter table public.brand_kit add primary key (business_id);
drop index if exists public.idx_brand_kit_business_id;

-- set_research_state wrote to the row with id = 1; now to one business's row
drop function if exists public.set_research_state(text[], jsonb);
create function public.set_research_state(path text[], value jsonb, p_business_id uuid)
returns void
language sql
set search_path = public
as $$
  update business_profile
  set onboarding = jsonb_set(coalesce(onboarding, '{}'::jsonb), array['research'] || path, value, true)
  where business_id = p_business_id;
$$;
revoke execute on function public.set_research_state(text[], jsonb, uuid) from public, anon, authenticated;
grant execute on function public.set_research_state(text[], jsonb, uuid) to service_role;

-- A new business gets its settings rows; notifications go to the owner's email by default
create function public.seed_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.business_profile (business_id) values (new.id) on conflict do nothing;
  insert into public.app_settings (business_id, notify_email)
    values (new.id, (select email from auth.users where id = new.owner_id))
    on conflict do nothing;
  insert into public.brand_kit (business_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger seed_business after insert on public.businesses
  for each row execute function public.seed_business();

-- =====================================================================
-- 4. Unique rules are per business
-- =====================================================================

select pg_temp.drop_unique('brand_bible', array['version']);
alter table public.brand_bible add constraint brand_bible_business_version_key unique (business_id, version);
drop index if exists public.brand_bible_one_approved;
create unique index brand_bible_one_approved on public.brand_bible (business_id) where status = 'approved';

select pg_temp.drop_unique('content_plans', array['week_start']);
alter table public.content_plans add constraint content_plans_business_week_key unique (business_id, week_start);

select pg_temp.drop_unique('weekly_reports', array['week_start']);
alter table public.weekly_reports add constraint weekly_reports_business_week_key unique (business_id, week_start);

select pg_temp.drop_unique('account_snapshots', array['platform', 'account_id', 'captured_on']);
alter table public.account_snapshots
  add constraint account_snapshots_business_account_day_key unique (business_id, platform, account_id, captured_on);

select pg_temp.drop_unique('learnings', array['dimension', 'value', 'platform']);
alter table public.learnings
  add constraint learnings_business_dimension_value_platform_key unique nulls not distinct (business_id, dimension, value, platform);

-- =====================================================================
-- 5. Foreign keys stay inside one business
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'brand_bible', 'personas', 'content_pillars', 'offerings', 'offers', 'competitors', 'brand_sources',
    'content_plans', 'plan_items', 'media', 'posts', 'post_targets'
  ] loop
    execute format('alter table public.%I add constraint %I unique (id, business_id)', t, t || '_id_business_key');
  end loop;
end;
$$;

-- RESTRICT becomes NO ACTION: the same error for a normal delete, but deleting a whole
-- business (which removes both sides in one statement) can go through.
select pg_temp.business_fk('offers', 'offering_id', 'offerings', 'cascade');
select pg_temp.business_fk('offerings', 'source_id', 'brand_sources', 'set null');
select pg_temp.business_fk('offers', 'source_id', 'brand_sources', 'set null');
select pg_temp.business_fk('proof_items', 'offering_id', 'offerings', 'set null');
select pg_temp.business_fk('proof_items', 'source_id', 'brand_sources', 'set null');
select pg_temp.business_fk('brand_assets', 'offering_id', 'offerings', 'set null');
select pg_temp.business_fk('brand_sources', 'competitor_id', 'competitors', 'cascade');
select pg_temp.business_fk('brand_chunks', 'source_id', 'brand_sources', 'cascade');
select pg_temp.business_fk('content_plans', 'brand_bible_id', 'brand_bible', 'no action');
select pg_temp.business_fk('plan_items', 'plan_id', 'content_plans', 'cascade');
select pg_temp.business_fk('plan_items', 'pillar_id', 'content_pillars', 'set null');
select pg_temp.business_fk('plan_items', 'persona_id', 'personas', 'set null');
select pg_temp.business_fk('plan_items', 'offering_id', 'offerings', 'set null');
select pg_temp.business_fk('plan_items', 'offer_id', 'offers', 'set null');
select pg_temp.business_fk('plan_items', 'selected_media_id', 'media', 'set null');
select pg_temp.business_fk('hook_library', 'plan_item_id', 'plan_items', 'set null');
select pg_temp.business_fk('media', 'plan_item_id', 'plan_items', 'set null');
select pg_temp.business_fk('media', 'offering_id', 'offerings', 'set null');
select pg_temp.business_fk('media', 'variant_of', 'media', 'set null');
select pg_temp.business_fk('media_files', 'media_id', 'media', 'cascade');
select pg_temp.business_fk('posts', 'media_id', 'media', 'no action');
select pg_temp.business_fk('posts', 'plan_item_id', 'plan_items', 'set null');
select pg_temp.business_fk('post_targets', 'post_id', 'posts', 'cascade');
select pg_temp.business_fk('post_metrics', 'post_target_id', 'post_targets', 'cascade');
select pg_temp.business_fk('feedback', 'plan_item_id', 'plan_items', 'cascade');
select pg_temp.business_fk('feedback', 'media_id', 'media', 'set null');
select pg_temp.business_fk('agent_runs', 'plan_id', 'content_plans', 'set null');
select pg_temp.business_fk('agent_runs', 'plan_item_id', 'plan_items', 'set null');
select pg_temp.business_fk('agent_runs', 'media_id', 'media', 'set null');

-- posts.plan_item_id stays unique on its own; this copy matches the foreign key's columns, so
-- the API still embeds a slot's post as one object, not a list
alter table public.posts add constraint posts_plan_item_business_key unique (plan_item_id, business_id);

-- =====================================================================
-- 6. A row never moves to another business
-- =====================================================================

create function public.keep_business_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'A row cannot move to another business' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Columns only the server may set. Logged-in users can write their own rows straight through the
-- API, so without this they could point a post at another business's social account, cancel or read
-- another business's posts, or swap in another Zernio profile. They may only clear these (null).
create function public.guard_server_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
  new_value text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  foreach col in array tg_argv loop
    new_value := to_jsonb(new) ->> col;
    if new_value is not null
       and (tg_op = 'INSERT' or new_value is distinct from (to_jsonb(old) ->> col)) then
      raise exception 'Only the server can set %.%', tg_table_name, col using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

create trigger guard_server_columns before insert or update on public.app_settings
  for each row execute function public.guard_server_columns('zernio_profile_id');
create trigger guard_server_columns before insert or update on public.post_targets
  for each row execute function public.guard_server_columns('provider_ref', 'provider_post_id');

-- =====================================================================
-- 7. RLS: each logged-in user sees and writes only their own business
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'business_profile', 'app_settings', 'brand_kit',
    'brand_bible', 'personas', 'content_pillars', 'offerings', 'offers', 'competitors', 'calendar_events',
    'brand_sources', 'brand_chunks', 'proof_items', 'brand_assets',
    'content_plans', 'plan_items', 'hook_library',
    'media', 'media_files', 'posts', 'post_targets', 'post_metrics', 'account_snapshots',
    'learnings', 'feedback', 'agent_runs', 'notifications', 'weekly_reports'
  ] loop
    execute format(
      'create trigger keep_business_id before update of business_id on public.%I for each row execute function public.keep_business_id()',
      t
    );
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format(
      'create policy "own_business" on public.%I for all to authenticated using (business_id = (select public.current_business_id())) with check (business_id = (select public.current_business_id()))',
      t
    );
  end loop;
end;
$$;

-- =====================================================================
-- 8. Search functions look in one business only
-- =====================================================================
-- Logged-in callers: their own business (RLS applies as well). The service role passes
-- p_business_id; without it nothing matches.

drop function if exists public.match_brand_chunks(extensions.vector, integer, jsonb);
create function public.match_brand_chunks(
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
  select c.id, c.source_id, c.content, c.metadata, 1 - (c.embedding <=> query_embedding) as similarity
  from brand_chunks c
  where c.business_id = coalesce(p_business_id, public.current_business_id())
    and c.embedding is not null
    and c.metadata @> filter
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_brand_chunks(extensions.vector, integer, jsonb, uuid) from public, anon;
grant execute on function public.match_brand_chunks(extensions.vector, integer, jsonb, uuid) to authenticated, service_role;

drop function if exists public.match_recent_hooks(extensions.vector, timestamptz, integer);
create function public.match_recent_hooks(
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
  select h.id, h.text, 1 - (h.embedding <=> query_embedding) as similarity
  from hook_library h
  where h.business_id = coalesce(p_business_id, public.current_business_id())
    and h.embedding is not null
    and (h.created_at >= since or h.plan_item_id is not null)
  order by h.embedding <=> query_embedding
  limit match_count;
$$;
revoke execute on function public.match_recent_hooks(extensions.vector, timestamptz, integer, uuid) from public, anon;
grant execute on function public.match_recent_hooks(extensions.vector, timestamptz, integer, uuid) to authenticated, service_role;

-- =====================================================================
-- 9. Storage: files of a business live under "<business id>/…"
-- =====================================================================
-- The bucket stays publicly readable (Kie, Zernio and Twelve Labs fetch files by URL).
-- Logged-in users may only create files in their own folder (signed upload links).
-- Replacing and deleting files is done by the server after it checked the database row.
-- Files made before this migration keep their old paths.

-- Public file links work without a policy. This one let anyone list every file in the bucket,
-- which shows every business's file names and ids.
drop policy if exists "allow_public_read_media_bucket" on storage.objects;
drop policy if exists "media_bucket_insert_authenticated" on storage.objects;
drop policy if exists "media_bucket_update_authenticated" on storage.objects;
drop policy if exists "media_bucket_delete_authenticated" on storage.objects;

create policy "media_bucket_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select public.current_business_id())::text
  );

-- =====================================================================
-- 10. Every other login gets its own business; new logins get one when they're created
-- =====================================================================

insert into public.businesses (owner_id)
select u.id from auth.users u
where not exists (select 1 from public.businesses b where b.owner_id = u.id);

create function public.create_business_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.businesses (owner_id) values (new.id) on conflict (owner_id) do nothing;
  return new;
end;
$$;
create trigger prodo_create_business after insert on auth.users
  for each row execute function public.create_business_for_new_user();

-- =====================================================================
-- Grants (same rules as 0009): authenticated and service role only
-- =====================================================================

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on function public.keep_business_id() from public, anon, authenticated;
revoke execute on function public.guard_server_columns() from public, anon, authenticated;
revoke execute on function public.seed_business() from public, anon, authenticated;
revoke execute on function public.create_business_for_new_user() from public, anon, authenticated;
