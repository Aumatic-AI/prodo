-- Phase 1.2: only logged-in users and our own service-role jobs can read or
-- change data. Replaces the allow_all policies (0005) and the anon grants (0006).

-- 1. Drop the allow_all table policies
drop policy if exists "allow_all_business_profile" on business_profile;
drop policy if exists "allow_all_media" on media;
drop policy if exists "allow_all_posts" on posts;
drop policy if exists "allow_all_post_targets" on post_targets;

-- 2. Authenticated users only. service_role bypasses RLS, so jobs keep working.
create policy "authenticated_all" on business_profile
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on media
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on posts
  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on post_targets
  for all to authenticated using (true) with check (true);

-- 3. Remove every anon privilege, including on tables created later
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon;

grant all privileges on all tables in schema public to authenticated, service_role;
grant all privileges on all sequences in schema public to authenticated, service_role;

-- 4. Storage: the media bucket stays publicly readable (Kie, Zernio and Twelve Labs
-- fetch files by public URL). Writes are for logged-in users only.
drop policy if exists "allow_insert_media_bucket" on storage.objects;
drop policy if exists "allow_update_media_bucket" on storage.objects;
drop policy if exists "allow_delete_media_bucket" on storage.objects;

create policy "media_bucket_insert_authenticated" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
create policy "media_bucket_update_authenticated" on storage.objects
  for update to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
create policy "media_bucket_delete_authenticated" on storage.objects
  for delete to authenticated using (bucket_id = 'media');
