-- 0029 · The website's design language: what makes its look recognisable (components, recurring motifs, how
-- images and screens are shown) and how it moves, written by the Visual Identity Analyst from screenshots of the
-- homepage and two key pages plus the motion our code reads from the site's code. Image and video prompts use it;
-- the client can edit it in Brand → Brand kit.
-- Safe to run once on a database that has 0001–0028.

alter table public.brand_kit add column if not exists design_language text;
