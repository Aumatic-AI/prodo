-- The ElevenLabs voiceover is uploaded as audio/mpeg to the 'media' bucket before
-- being handed to the FFmpeg stitch job. The bucket's original mime allowlist
-- (0004_storage_bucket.sql) only covered image/video types, so uploads failed with
-- "mime type audio/mpeg is not supported".
update storage.buckets
set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp',
  'video/mp4', 'video/quicktime',
  'audio/mpeg'
]
where id = 'media';
