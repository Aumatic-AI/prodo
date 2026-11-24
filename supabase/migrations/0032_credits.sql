-- 0032 · Credits and the admin panel, plus the month's agent spend added up in the database.
--
-- Credits: each business has a balance (businesses.credits). Every change is one row in credit_ledger:
-- 'topup' (an admin added credits, with what the client paid when given), 'adjust' (an admin took some away),
-- 'charge' (an action used them) and 'refund' (a charge given back when the work failed). Only the server
-- writes them, through the credit_* functions below, which lock the business row so two actions can never
-- spend the same credits. What each action costs is in credit_prices (the admin panel edits it).
--
-- Admins: logins listed in public.admins. They have no business and see the admin panel (/admin) only.
-- A login made with app_metadata.role = 'admin' (scripts/setup/admin.ts, or the Auth admin API) becomes one.
--
-- The month's agent spend (was 0032_month_spend, never run): month_spend() adds up agent_runs.cost_usd in
-- the database; reading the rows stopped at the API's 1,000-row cap. It drives the monthly safety cap,
-- which only the server (the admin panel) changes now.
--
-- Safe to run once on a database that has 0001–0031.

-- =====================================================================
-- 1. The month's agent spend (the safety cap)
-- =====================================================================

create index if not exists idx_agent_runs_business_created on public.agent_runs (business_id, created_at);
create index if not exists idx_agent_runs_created on public.agent_runs (created_at);

create or replace function public.month_spend(p_since timestamptz, p_business_id uuid default null)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(r.cost_usd), 0)
  from public.agent_runs r
  where r.business_id = coalesce(p_business_id, public.current_business_id())
    and r.created_at >= p_since
$$;
revoke execute on function public.month_spend(timestamptz, uuid) from public, anon;
grant execute on function public.month_spend(timestamptz, uuid) to authenticated, service_role;

-- The cap is Prodo's own guard against runaway costs, not the client's: only the server may change it
drop trigger if exists guard_server_columns on public.app_settings;
create trigger guard_server_columns before insert or update on public.app_settings
  for each row execute function public.guard_server_columns('zernio_profile_id', 'monthly_budget_usd');

-- =====================================================================
-- 2. Admins
-- =====================================================================

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- No policies: nobody reads or writes it through the API; only the server (service role) and is_admin()
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant all on public.admins to service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- A new login gets its own business and is its owner, as before; an admin login gets none
create or replace function public.create_business_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') = 'admin' then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
    return new;
  end if;
  if exists (select 1 from public.business_members where user_id = new.id) then
    return new;
  end if;
  insert into public.businesses (owner_id) values (new.id) returning id into made;
  insert into public.business_members (user_id, business_id, role) values (new.id, made, 'owner');
  return new;
end;
$$;
revoke execute on function public.create_business_for_new_user() from public, anon, authenticated;

-- Admin logins made before this ran (app_metadata.role = 'admin') got a business from the old trigger:
-- they become admins and lose that business while it is still empty (setup not started, no other login)
insert into public.admins (user_id)
select u.id from auth.users u where coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
on conflict do nothing;

delete from public.businesses b
where b.owner_id in (select a.user_id from public.admins a)
  and not exists (
    select 1 from public.business_members m
    where m.business_id = b.id and m.user_id not in (select a.user_id from public.admins a)
  )
  and coalesce((select p.onboarding_status from public.business_profile p where p.business_id = b.id), 'not_started') = 'not_started';

delete from public.business_members m where m.user_id in (select a.user_id from public.admins a);

-- =====================================================================
-- 3. Credits
-- =====================================================================

-- The balance, and a monthly fee that couldn't be taken (publishing waits until it is)
alter table public.businesses add column if not exists credits integer not null default 0;
alter table public.businesses add column if not exists fees_due jsonb;
do $$
begin
  alter table public.businesses add constraint businesses_credits_not_negative check (credits >= 0);
exception when duplicate_object then null;
end $$;

-- What each action costs. Read by every login (the app shows prices); changed only by the server.
create table if not exists public.credit_prices (
  action text primary key,
  credits integer not null check (credits >= 0),
  label text not null,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.credit_prices enable row level security;
drop policy if exists "everyone_reads" on public.credit_prices;
create policy "everyone_reads" on public.credit_prices for select to authenticated using (true);
revoke all on public.credit_prices from anon, authenticated;
grant select on public.credit_prices to authenticated;
grant all on public.credit_prices to service_role;

insert into public.credit_prices (action, credits, label, sort) values
  ('onboarding', 15, 'Onboarding (website scan and brand research)', 10),
  ('brand_refresh', 10, 'Refresh brand', 20),
  ('market_refresh', 5, 'Monthly market refresh', 30),
  ('bible_regenerate', 2, 'Rewrite the Brand Bible', 40),
  ('brand_video', 1, 'Video added to brand assets', 50),
  ('week_plan', 2, 'Plan a week', 60),
  ('image_ad', 8, 'Image ad', 70),
  ('image_ad_reference', 10, 'Image ad from a reference image', 80),
  ('carousel', 8, 'Carousel', 90),
  ('text_post', 2, 'Text post', 100),
  ('video', 70, 'Video (up to 30 seconds)', 110),
  ('video_copy', 70, 'Copy a video', 120),
  ('social_account', 60, 'Social account (per month)', 130)
on conflict (action) do nothing;

-- Every change to a balance
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('topup', 'adjust', 'charge', 'refund')),
  -- Added (+) or taken (-)
  credits integer not null,
  -- The balance after this row
  balance integer not null check (balance >= 0),
  -- What it was for (credit_prices.action); null for top-ups and adjustments
  action text,
  -- What the client sees: "Image ad · Summer sale"
  label text not null default '',
  -- The slot, plan, media item, research run or asset it was for
  ref_id uuid,
  -- What the client paid for a top-up (optional, US dollars)
  amount_usd numeric(10, 2) check (amount_usd is null or amount_usd >= 0),
  note text,
  -- The same key is charged once (retries can't charge twice)
  key text,
  -- A refund names the charge it gives back (once)
  refund_of uuid references public.credit_ledger (id) on delete set null,
  -- The admin who added or removed credits
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists credit_ledger_key on public.credit_ledger (business_id, key) where key is not null;
create unique index if not exists credit_ledger_refund_of on public.credit_ledger (refund_of) where refund_of is not null;
create index if not exists idx_credit_ledger_business_created on public.credit_ledger (business_id, created_at desc);
create index if not exists idx_credit_ledger_created on public.credit_ledger (created_at);

-- A business reads its own rows, without the admins' note, who added them and the charge keys; nobody writes
-- them through the API
alter table public.credit_ledger enable row level security;
drop policy if exists "own_business" on public.credit_ledger;
create policy "own_business" on public.credit_ledger for select to authenticated
  using (business_id = (select public.current_business_id()));
revoke all on public.credit_ledger from anon, authenticated;
grant select (id, business_id, kind, credits, balance, action, label, ref_id, amount_usd, refund_of, created_at) on public.credit_ledger to authenticated;
grant all on public.credit_ledger to service_role;
drop trigger if exists keep_business_id on public.credit_ledger;
create trigger keep_business_id before update of business_id on public.credit_ledger
  for each row execute function public.keep_business_id();

-- The balance (and any fee due) of the business: the logged-in one, or the one a job passes.
-- Security invoker: RLS on businesses lets a login read only its own businesses.
create or replace function public.credit_balance(p_business_id uuid default null)
returns table (credits integer, fees_due jsonb)
language sql
stable
set search_path = ''
as $$
  select b.credits, b.fees_due from public.businesses b
  where b.id = coalesce(p_business_id, public.current_business_id())
$$;
revoke execute on function public.credit_balance(uuid) from public, anon;
grant execute on function public.credit_balance(uuid) to authenticated, service_role;

-- Takes credits for an action. Not enough: raises NO_CREDITS (with what's needed and what's there) and
-- takes nothing. A key already used returns the balance without charging again. Returns the new balance.
create or replace function public.credit_spend(
  p_business_id uuid,
  p_credits integer,
  p_action text,
  p_label text,
  p_ref_id uuid default null,
  p_key text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  have integer;
begin
  if p_credits is null or p_credits < 0 then
    raise exception 'Credits to take must be 0 or more';
  end if;
  select b.credits into have from public.businesses b where b.id = p_business_id for update;
  if not found then
    raise exception 'No such business';
  end if;
  if p_key is not null and exists (select 1 from public.credit_ledger l where l.business_id = p_business_id and l.key = p_key) then
    return have;
  end if;
  if p_credits = 0 then
    return have;
  end if;
  if have < p_credits then
    raise exception 'NO_CREDITS needed=% have=%', p_credits, have using errcode = 'P0001';
  end if;
  update public.businesses set credits = have - p_credits where id = p_business_id;
  insert into public.credit_ledger (business_id, kind, credits, balance, action, label, ref_id, key)
  values (p_business_id, 'charge', -p_credits, have - p_credits, p_action, coalesce(p_label, ''), p_ref_id, p_key);
  return have - p_credits;
end;
$$;
revoke execute on function public.credit_spend(uuid, integer, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.credit_spend(uuid, integer, text, text, uuid, text) to service_role;

-- Gives back the charge made with this key (once). No such charge: nothing happens. Returns the balance.
create or replace function public.credit_refund(p_business_id uuid, p_key text, p_label text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.credit_ledger;
  have integer;
begin
  select * into c from public.credit_ledger l where l.business_id = p_business_id and l.key = p_key and l.kind = 'charge';
  select b.credits into have from public.businesses b where b.id = p_business_id for update;
  if c.id is null or exists (select 1 from public.credit_ledger l where l.refund_of = c.id) then
    return have;
  end if;
  update public.businesses set credits = have - c.credits where id = p_business_id;
  insert into public.credit_ledger (business_id, kind, credits, balance, action, label, ref_id, refund_of, key)
  values (p_business_id, 'refund', -c.credits, have - c.credits, c.action, coalesce(p_label, 'Returned: ' || c.label), c.ref_id, c.id, 'refund:' || p_key);
  return have - c.credits;
end;
$$;
revoke execute on function public.credit_refund(uuid, text, text) from public, anon, authenticated;
grant execute on function public.credit_refund(uuid, text, text) to service_role;

-- An admin adds credits (with what the client paid, when given) or takes some away (never below 0)
create or replace function public.credit_topup(
  p_business_id uuid,
  p_credits integer,
  p_amount_usd numeric default null,
  p_note text default null,
  p_admin uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  have integer;
begin
  if p_credits is null or p_credits = 0 then
    raise exception 'Enter a number of credits other than 0';
  end if;
  select b.credits into have from public.businesses b where b.id = p_business_id for update;
  if not found then
    raise exception 'No such business';
  end if;
  if have + p_credits < 0 then
    raise exception 'This business has only % credits to take away', have;
  end if;
  update public.businesses set credits = have + p_credits where id = p_business_id;
  insert into public.credit_ledger (business_id, kind, credits, balance, label, amount_usd, note, created_by)
  values (
    p_business_id,
    case when p_credits > 0 then 'topup' else 'adjust' end,
    p_credits,
    have + p_credits,
    case when p_credits > 0 then 'Credits added' else 'Credits removed' end,
    case when p_credits > 0 then p_amount_usd end,
    nullif(trim(coalesce(p_note, '')), ''),
    p_admin
  );
  return have + p_credits;
end;
$$;
revoke execute on function public.credit_topup(uuid, integer, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.credit_topup(uuid, integer, numeric, text, uuid) to service_role;

-- =====================================================================
-- 4. Admin panel reads (service role only)
-- =====================================================================

-- Every business (or one) with its login, setup, balance, usage, payments, our cost and activity
create or replace function public.admin_businesses(p_business_id uuid default null)
returns table (
  id uuid,
  name text,
  logo_key text,
  email text,
  onboarding_status text,
  paused boolean,
  credits integer,
  fees_due jsonb,
  budget_usd numeric,
  created_at timestamptz,
  used_month integer,
  used_30d integer,
  added_total integer,
  paid_usd numeric,
  last_topup_at timestamptz,
  cost_month numeric,
  posts_30d integer,
  last_active timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    coalesce(p.name, ''),
    p.logo_key,
    u.email::text,
    coalesce(p.onboarding_status, 'not_started'),
    coalesce(s.paused, false),
    b.credits,
    b.fees_due,
    s.monthly_budget_usd,
    b.created_at,
    coalesce((select -sum(l.credits) from public.credit_ledger l where l.business_id = b.id and l.kind in ('charge', 'refund') and l.created_at >= date_trunc('month', now())), 0)::integer,
    coalesce((select -sum(l.credits) from public.credit_ledger l where l.business_id = b.id and l.kind in ('charge', 'refund') and l.created_at >= now() - interval '30 days'), 0)::integer,
    coalesce((select sum(l.credits) from public.credit_ledger l where l.business_id = b.id and l.kind in ('topup', 'adjust')), 0)::integer,
    coalesce((select sum(l.amount_usd) from public.credit_ledger l where l.business_id = b.id), 0),
    (select max(l.created_at) from public.credit_ledger l where l.business_id = b.id and l.kind = 'topup'),
    coalesce((select sum(r.cost_usd) from public.agent_runs r where r.business_id = b.id and r.created_at >= date_trunc('month', now())), 0),
    (select count(*) from public.post_targets t where t.business_id = b.id and t.status = 'published' and t.published_at >= now() - interval '30 days')::integer,
    greatest(
      (select max(r.created_at) from public.agent_runs r where r.business_id = b.id),
      (select max(l.created_at) from public.credit_ledger l where l.business_id = b.id and l.kind = 'charge')
    )
  from public.businesses b
  left join public.business_profile p on p.business_id = b.id
  left join public.app_settings s on s.business_id = b.id
  left join auth.users u on u.id = b.owner_id
  where p_business_id is null or b.id = p_business_id
  order by b.created_at desc
$$;
revoke execute on function public.admin_businesses(uuid) from public, anon, authenticated;
grant execute on function public.admin_businesses(uuid) to service_role;

-- Credits used (charges less refunds) per business and action in a period
create or replace function public.admin_usage(p_since timestamptz, p_until timestamptz, p_business_id uuid default null)
returns table (business_id uuid, action text, used integer, uses integer)
language sql
stable
set search_path = ''
as $$
  select
    l.business_id,
    coalesce(l.action, 'other'),
    (-sum(l.credits))::integer,
    (count(*) filter (where l.kind = 'charge') - count(*) filter (where l.kind = 'refund'))::integer
  from public.credit_ledger l
  where l.kind in ('charge', 'refund')
    and l.created_at >= p_since
    and l.created_at < p_until
    and (p_business_id is null or l.business_id = p_business_id)
  group by 1, 2
$$;
revoke execute on function public.admin_usage(timestamptz, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.admin_usage(timestamptz, timestamptz, uuid) to service_role;

-- Per day or month: credits used, credits added, money paid and our AI cost (all businesses, or one)
create or replace function public.admin_series(p_since timestamptz, p_until timestamptz, p_unit text default 'day', p_business_id uuid default null)
returns table (bucket date, used integer, added integer, paid numeric, ai_cost numeric)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_unit not in ('day', 'week', 'month') then
    raise exception 'Unit must be day, week or month';
  end if;
  return query
  with buckets as (
    select generate_series(date_trunc(p_unit, p_since), date_trunc(p_unit, p_until - interval '1 microsecond'), ('1 ' || p_unit)::interval) as t
  ),
  ledger as (
    select
      date_trunc(p_unit, l.created_at) as t,
      -sum(l.credits) filter (where l.kind in ('charge', 'refund')) as used,
      sum(l.credits) filter (where l.kind in ('topup', 'adjust')) as added,
      sum(l.amount_usd) as paid
    from public.credit_ledger l
    where l.created_at >= p_since and l.created_at < p_until and (p_business_id is null or l.business_id = p_business_id)
    group by 1
  ),
  costs as (
    select date_trunc(p_unit, r.created_at) as t, sum(r.cost_usd) as cost
    from public.agent_runs r
    where r.created_at >= p_since and r.created_at < p_until and (p_business_id is null or r.business_id = p_business_id)
    group by 1
  )
  select b.t::date, coalesce(l.used, 0)::integer, coalesce(l.added, 0)::integer, coalesce(l.paid, 0)::numeric, coalesce(c.cost, 0)::numeric
  from buckets b
  left join ledger l on l.t = b.t
  left join costs c on c.t = b.t
  order by b.t;
end;
$$;
revoke execute on function public.admin_series(timestamptz, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_series(timestamptz, timestamptz, text, uuid) to service_role;

-- Our AI cost per business in a period (agent_runs), for the usage screen's margin
create or replace function public.admin_ai_cost(p_since timestamptz, p_until timestamptz)
returns table (business_id uuid, cost numeric)
language sql
stable
set search_path = ''
as $$
  select r.business_id, coalesce(sum(r.cost_usd), 0)
  from public.agent_runs r
  where r.created_at >= p_since and r.created_at < p_until
  group by r.business_id
$$;
revoke execute on function public.admin_ai_cost(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_ai_cost(timestamptz, timestamptz) to service_role;
