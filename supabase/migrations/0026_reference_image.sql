-- 0026 · A reference image for one image ad: an ad the owner likes, sent to the image model so the new ad is
-- made the same way (layout, style, colours, mood) for this business. The file waits in tmp/ (storage deletes
-- it after 7 days); after that a redo is made without it.
-- Safe to run once on a database that has 0001–0025.

alter table public.plan_items add column if not exists reference_image_key text;
