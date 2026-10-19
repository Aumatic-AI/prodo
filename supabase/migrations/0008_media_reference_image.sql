-- Reference image uploaded by the user to guide Kie's image generation
-- (e.g. a product photo, logo, or person). Used as input.image_urls on
-- google/nano-banana, same pattern as Kinetix's Ad Studio reference flow.
alter table media add column if not exists reference_image_key text;
