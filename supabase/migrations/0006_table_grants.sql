-- Base table-level grants: RLS policies only take effect once these grants exist.
-- Without this, PostgREST (and the service_role client) gets "permission denied for table X"
-- even with permissive RLS policies in place.

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
