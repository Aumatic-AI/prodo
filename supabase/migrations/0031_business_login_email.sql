-- 0031 · The login email of the business a request is for (its owner's), so the account menu shows the open
-- business's own email after switching, not only the email of the login doing the switching. A business made
-- from "Add account" has no login of its own: its owner is the login that made it.
-- Safe to run once on a database that has 0001–0030.

create or replace function public.business_login_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  where b.id = public.current_business_id()
$$;
revoke execute on function public.business_login_email() from public, anon;
grant execute on function public.business_login_email() to authenticated;
