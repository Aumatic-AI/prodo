-- Phase 1.3 (part 1): columns the code already uses but no migration created.
-- They may already exist on databases where they were added by hand, hence "if not exists".
alter table media add column if not exists voice_name text;
alter table media add column if not exists audio_style text;
alter table media add column if not exists "character" text;
alter table media add column if not exists language text;
alter table media add column if not exists product text; -- moved to offering_id and dropped in 0012

alter table business_profile add column if not exists language text not null default 'en';
