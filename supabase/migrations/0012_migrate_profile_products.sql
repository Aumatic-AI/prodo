-- Phase 1.3 (part 3): move existing data into the new shape, then drop the old columns.
--   business_profile.about     -> business_profile.description
--   business_profile.products  -> offerings rows (kind = product)
--   media.product (free text)  -> media.offering_id by name match; unmatched names
--                                 are kept in media.creative_spec.product_name

-- 1. about -> description
update business_profile
set description = about
where coalesce(description, '') = '' and coalesce(about, '') <> '';

-- 2. products jsonb -> offerings. Items are {name, description} objects or plain strings.
insert into offerings (kind, name, description, active)
select distinct on (lower(p.name))
  'product', p.name, p.description, true
from (
  select
    trim(case when jsonb_typeof(item) = 'string' then item #>> '{}' else item ->> 'name' end) as name,
    nullif(trim(case when jsonb_typeof(item) = 'object' then item ->> 'description' end), '') as description
  from business_profile bp,
       jsonb_array_elements(case when jsonb_typeof(bp.products) = 'array' then bp.products else '[]'::jsonb end) as item
) p
where coalesce(p.name, '') <> ''
  and not exists (select 1 from offerings o where lower(o.name) = lower(p.name));

-- 3. media.product -> media.offering_id
update media m
set offering_id = o.id
from offerings o
where m.offering_id is null
  and coalesce(trim(m.product), '') <> ''
  and lower(trim(m.product)) = lower(o.name);

-- Names that matched no offering (the "Other" free-text option) stay usable for Try again
update media
set creative_spec = coalesce(creative_spec, '{}'::jsonb) || jsonb_build_object('product_name', trim(product))
where offering_id is null
  and coalesce(trim(product), '') <> '';

-- 4. Drop the old columns
alter table business_profile drop column if exists about;
alter table business_profile drop column if exists products;
alter table media drop column if exists product;
