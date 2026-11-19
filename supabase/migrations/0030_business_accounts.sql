-- 0030 · One login, several businesses ("Add account" and switching), the same on every device.
-- business_members says which logins can open which business: 'owner' (the login was made with it, or made it
-- from "Add account") or 'member' (linked by signing in once with that business's own login). Each business keeps
-- its own login too. current_business_id(), which every RLS policy and column default uses, now returns the
-- business the request asks for, only when the login belongs to it:
--   x-prodo-business header: the business a browser tab shows (sent with every API call); not a member = none
--   x-prodo-pick header: the business picked on this device (cookie, for page loads); not a member = ignored
--   neither: the login's own first business
-- Jobs and agents are unchanged: they use the service role and pass the business id themselves.
-- Safe to run once on a database that has 0001–0029.

create table if not exists public.business_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index if not exists idx_business_members_business_id on public.business_members (business_id);

alter table public.business_members enable row level security;
drop policy if exists "own_memberships" on public.business_members;
create policy "own_memberships" on public.business_members for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.business_members from anon, authenticated;
grant select on public.business_members to authenticated;
grant all on public.business_members to service_role;

-- Every owner so far
insert into public.business_members (user_id, business_id, role, created_at)
select owner_id, id, 'owner', created_at from public.businesses where owner_id is not null
on conflict do nothing;

-- A login can now own several businesses (owner_id stays as the login that made it)
alter table public.businesses drop constraint if exists businesses_owner_id_key;

-- A login reads the businesses it belongs to
drop policy if exists "owner_reads" on public.businesses;
drop policy if exists "member_reads" on public.businesses;
create policy "member_reads" on public.businesses for select to authenticated
  using (exists (select 1 from public.business_members m where m.business_id = id and m.user_id = (select auth.uid())));

create or replace function public.current_business_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  headers json := nullif(current_setting('request.headers', true), '')::json;
  asked text := headers ->> 'x-prodo-business';
  picked text := headers ->> 'x-prodo-pick';
  found uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  -- A tab asks for the business it shows: that one when the login belongs to it, otherwise none (never another)
  if asked is not null then
    if asked !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return null;
    end if;
    select m.business_id into found from public.business_members m where m.user_id = auth.uid() and m.business_id = asked::uuid;
    return found;
  end if;
  -- A page load: the business picked on this device, while the login still belongs to it
  if picked ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select m.business_id into found from public.business_members m where m.user_id = auth.uid() and m.business_id = picked::uuid;
    if found is not null then
      return found;
    end if;
  end if;
  -- Otherwise the login's own first business
  select m.business_id into found from public.business_members m
  where m.user_id = auth.uid()
  order by (m.role = 'owner') desc, m.created_at
  limit 1;
  return found;
end;
$$;
revoke execute on function public.current_business_id() from public, anon;
grant execute on function public.current_business_id() to authenticated, service_role;

-- A new login gets its own business, as before, and is its owner
create or replace function public.create_business_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
begin
  if exists (select 1 from public.business_members where user_id = new.id) then
    return new;
  end if;
  insert into public.businesses (owner_id) values (new.id) returning id into made;
  insert into public.business_members (user_id, business_id, role) values (new.id, made, 'owner');
  return new;
end;
$$;
revoke execute on function public.create_business_for_new_user() from public, anon, authenticated;

-- The login's businesses for the account menu: name, logo, how far its setup is, and how it was added
create or replace function public.my_businesses()
returns table (id uuid, name text, logo_key text, onboarding_status text, role text, added_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id, coalesce(p.name, ''), p.logo_key, coalesce(p.onboarding_status, 'not_started'), m.role, m.created_at
  from public.business_members m
  left join public.business_profile p on p.business_id = m.business_id
  where m.user_id = auth.uid()
  order by m.created_at
$$;
revoke execute on function public.my_businesses() from public, anon;
grant execute on function public.my_businesses() to authenticated;

-- "Add account" → a new business: the login's unfinished setup when it has one (one at a time), else a new
-- business it owns (its settings rows come from seed_business). At most 25 businesses per login.
create or replace function public.create_business()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  made uuid;
begin
  if me is null then
    raise exception 'Log in to add a business';
  end if;
  select m.business_id into made
  from public.business_members m
  join public.business_profile p on p.business_id = m.business_id
  where m.user_id = me and m.role = 'owner' and p.onboarding_status <> 'done'
  order by m.created_at desc
  limit 1;
  if made is not null then
    return made;
  end if;
  if (select count(*) from public.business_members where user_id = me) >= 25 then
    raise exception 'You already have 25 businesses on this login';
  end if;
  insert into public.businesses (owner_id) values (me) returning id into made;
  insert into public.business_members (user_id, business_id, role) values (me, made, 'owner');
  return made;
end;
$$;
revoke execute on function public.create_business() from public, anon;
grant execute on function public.create_business() to authenticated;
