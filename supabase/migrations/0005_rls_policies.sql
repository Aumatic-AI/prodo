-- Enable RLS on all tables
alter table business_profile enable row level security;
alter table media enable row level security;
alter table posts enable row level security;
alter table post_targets enable row level security;

-- business_profile: single-tenant, allow all operations
create policy "allow_all_business_profile" on business_profile
  for all using (true) with check (true);

-- media: allow all operations
create policy "allow_all_media" on media
  for all using (true) with check (true);

-- posts: allow all operations
create policy "allow_all_posts" on posts
  for all using (true) with check (true);

-- post_targets: allow all operations
create policy "allow_all_post_targets" on post_targets
  for all using (true) with check (true);

-- Storage: allow public read and authenticated uploads on media bucket
create policy "allow_public_read_media_bucket" on storage.objects
  for select using (bucket_id = 'media');

create policy "allow_insert_media_bucket" on storage.objects
  for insert with check (bucket_id = 'media');

create policy "allow_update_media_bucket" on storage.objects
  for update using (bucket_id = 'media');

create policy "allow_delete_media_bucket" on storage.objects
  for delete using (bucket_id = 'media');
