insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  104857600,
  array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;
