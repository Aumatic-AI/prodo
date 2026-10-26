-- Leftover access policies from before multi-tenant.
--
-- Postgres combines policies with OR, so any old "allow everything" policy on a table cancels the
-- per-business rule from 0017. 0009 dropped the first ones by name, but databases set up by hand
-- can have them under other names (found on business_profile, media, posts and post_targets:
-- every login saw every business's rows there). This drops every policy on the business tables
-- except "own_business", and every policy on the media bucket except the own-folder upload rule,
-- whatever their names.

do $$
declare p record;
begin
  for p in
    select pol.schemaname, pol.tablename, pol.policyname
    from pg_policies pol
    join information_schema.columns c
      on c.table_schema = pol.schemaname and c.table_name = pol.tablename and c.column_name = 'business_id'
    where pol.schemaname = 'public'
      and pol.policyname <> 'own_business'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice 'dropped policy % on %', p.policyname, p.tablename;
  end loop;

  for p in
    select pol.policyname
    from pg_policies pol
    where pol.schemaname = 'storage'
      and pol.tablename = 'objects'
      and pol.policyname <> 'media_bucket_insert_own_folder'
      and (coalesce(pol.qual, '') || coalesce(pol.with_check, '')) like '%''media''%'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'dropped storage policy %', p.policyname;
  end loop;
end;
$$;

-- What is left: one "own_business" policy per table, and the upload rule on storage
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
